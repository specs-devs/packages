#include "CameraStreamer.hpp"

#include <SpecsCameraDefinitions.h>
#include <SpecsCameraStructures.h>
#include <SpecsCameraManager.h>

#include <climits>
#include <cstdio>
#include <cstring>

namespace webrtcstream {

namespace {
// swrtc_pixel_format values we hand to the sink (kept in sync with specs_webrtc.h).
constexpr int kFmtI420 = 0;
constexpr int kFmtNV12 = 1;
} // namespace

CameraStreamer::~CameraStreamer() { stop(); }

bool CameraStreamer::start(const CameraFrameSink& sink, int maxWidth) {
    if (active_.load()) return true;
    sink_ = sink;

    if (SpecsCameraClient_create(&client_) != SPECSCAMERA_SUCCESS || !client_) {
        std::fprintf(stderr, "[CameraStreamer] SpecsCameraClient_create failed\n");
        client_ = nullptr;
        return false;
    }

    SpecsCamera_StreamDescription_t* rows = nullptr;  // owned by the implementation
    size_t count = 0;
    if (SpecsCamera_supportedStreamInfoGet(client_, &rows, &count) != SPECSCAMERA_SUCCESS ||
        !rows || count == 0) {
        std::fprintf(stderr, "[CameraStreamer] supportedStreamInfoGet returned no streams\n");
        SpecsCameraClient_destroy(client_);
        client_ = nullptr;
        return false;
    }

    // Prefer the fused RGB location, then a single-eye RGB. Within a location pick the
    // largest width that fits maxWidth; if none fits, take the narrowest overflow.
    const SpecsCamera_LocationAndType_t prefs[] = {
        SPECSCAMERA_LOCATIONANDTYPE_RGB,
        SPECSCAMERA_LOCATIONANDTYPE_LEFT_RGB,
        SPECSCAMERA_LOCATIONANDTYPE_RIGHT_RGB,
    };
    size_t pick = SIZE_MAX;
    for (auto loc : prefs) {
        size_t fit = SIZE_MAX;  int fitW = 0;
        size_t over = SIZE_MAX; int overW = INT_MAX;
        for (size_t i = 0; i < count; ++i) {
            if (rows[i].location_and_type != loc || rows[i].width <= 0) continue;
            const int w = rows[i].width;
            if (w <= maxWidth) { if (w > fitW) { fitW = w; fit = i; } }
            else               { if (w < overW) { overW = w; over = i; } }
        }
        if (fit != SIZE_MAX)  { pick = fit;  break; }
        if (over != SIZE_MAX) { pick = over; break; }
    }
    if (pick == SIZE_MAX) {
        std::fprintf(stderr, "[CameraStreamer] no RGB stream available\n");
        SpecsCameraClient_destroy(client_);
        client_ = nullptr;
        return false;
    }

    SpecsCamera_StreamDescription_t d = rows[pick];  // keeps width/height/frameRate/location
    d.callbacks.frame_callback = &CameraStreamer::frameTrampoline;
    d.callbacks.notification_callback = &CameraStreamer::noteTrampoline;
    d.cbk_context = this;
    d.configs = nullptr;       // continuous stream needs no config items
    d.config_count = 0;

    active_.store(true);
    const SpecsCamera_Result_t rc = SpecsCameraStream_add(client_, &d, &streamId_);
    if (rc != SPECSCAMERA_SUCCESS) {
        std::fprintf(stderr, "[CameraStreamer] SpecsCameraStream_add failed (%d)\n", (int)rc);
        active_.store(false);
        SpecsCameraClient_destroy(client_);
        client_ = nullptr;
        return false;
    }
    std::fprintf(stderr, "[CameraStreamer] streaming RGB camera %dx%d\n", d.width, d.height);
    return true;  // frames now arrive on frameTrampoline
}

void CameraStreamer::stop() {
    // Gate the frame callback out first, then tear the stream down off the HAL thread.
    active_.store(false);
    if (client_) {
        if (streamId_ != 0) SpecsCameraStream_remove(client_, streamId_);
        SpecsCameraClient_destroy(client_);
        client_ = nullptr;
        streamId_ = 0;
    }
}

void CameraStreamer::frameTrampoline(const SpecsCamera_Frame_s* frame, void* ctx) {
    auto* self = static_cast<CameraStreamer*>(ctx);
    if (!self || !frame) return;
    // The frame callback must not let an exception escape (fatal in the HAL).
    try {
        self->onFrame(frame);
    } catch (...) {
    }
}

void CameraStreamer::noteTrampoline(int32_t notificationTag, void* ctx) {
    auto* self = static_cast<CameraStreamer*>(ctx);
    // Only client eviction is terminal; interruptions are transient — log and ride out.
    if (notificationTag == SPECSCAMERA_STREAMNOTIFY_CLIENT_EVICTION) {
        std::fprintf(stderr, "[CameraStreamer] camera client evicted\n");
        if (self) self->active_.store(false);
    } else {
        std::fprintf(stderr, "[CameraStreamer] camera notify %d (transient)\n", (int)notificationTag);
    }
}

void CameraStreamer::onFrame(const SpecsCamera_Frame_s* frame) {
    if (!active_.load()) return;
    const SpecsCamera_BufferInfo_t& b = frame->buffer_info;
    if (b.image_format != SPECSCAMERA_IMAGEFORMAT_YUV_420_888) return;  // RGB stream => YUV 4:2:0

    const int w = b.image_width;
    const int h = b.image_height;
    if (w < 2 || h < 2 || w > 8192 || h > 8192) return;  // sanity: buffers can be partly mapped
    if (!b.channel_data[0]) return;

    const int yStride = b.channel_row_strides[0] > 0 ? b.channel_row_strides[0] : w;
    if (yStride < w) return;

    const int cw = w / 2;
    const int ch = h / 2;
    const size_t ySize = static_cast<size_t>(w) * h;
    const size_t cSize = static_cast<size_t>(cw) * ch;
    pack_.resize(ySize + 2 * cSize);  // I420/NV12 are both w*h*3/2
    uint8_t* dst = pack_.data();

    // Y plane: strip row padding.
    for (int r = 0; r < h; ++r)
        std::memcpy(dst + static_cast<size_t>(r) * w, b.channel_data[0] + static_cast<size_t>(r) * yStride, w);

    // Chroma: NV12 (interleaved UV, pixel stride 2) vs planar I420 (pixel stride 1).
    const bool nv12 = (b.num_channels < 3) || (b.channel_pixel_strides[1] == 2) || !b.channel_data[2];
    if (nv12) {
        const uint8_t* srcUV = b.channel_data[1];
        if (!srcUV) return;
        const int uvStride = b.channel_row_strides[1] > 0 ? b.channel_row_strides[1] : (cw * 2);
        uint8_t* dstUV = dst + ySize;                 // ch rows of cw*2 bytes = w*ch = 2*cSize
        for (int r = 0; r < ch; ++r)
            std::memcpy(dstUV + static_cast<size_t>(r) * (cw * 2), srcUV + static_cast<size_t>(r) * uvStride, cw * 2);
        sink_(kFmtNV12, dst, pack_.size(), static_cast<uint32_t>(w), static_cast<uint32_t>(h),
              static_cast<uint64_t>(frame->timestamp_ns) / 1000ULL);
    } else {
        const uint8_t* srcU = b.channel_data[1];
        const uint8_t* srcV = b.channel_data[2];
        if (!srcU || !srcV) return;
        const int uStride = b.channel_row_strides[1] > 0 ? b.channel_row_strides[1] : cw;
        const int vStride = b.channel_row_strides[2] > 0 ? b.channel_row_strides[2] : cw;
        uint8_t* dstU = dst + ySize;
        uint8_t* dstV = dstU + cSize;
        for (int r = 0; r < ch; ++r)
            std::memcpy(dstU + static_cast<size_t>(r) * cw, srcU + static_cast<size_t>(r) * uStride, cw);
        for (int r = 0; r < ch; ++r)
            std::memcpy(dstV + static_cast<size_t>(r) * cw, srcV + static_cast<size_t>(r) * vStride, cw);
        sink_(kFmtI420, dst, pack_.size(), static_cast<uint32_t>(w), static_cast<uint32_t>(h),
              static_cast<uint64_t>(frame->timestamp_ns) / 1000ULL);
    }
}

} // namespace webrtcstream
