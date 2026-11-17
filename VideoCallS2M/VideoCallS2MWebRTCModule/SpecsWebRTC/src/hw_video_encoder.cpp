#include "hw_video_encoder.hpp"

#if SWRTC_HW_ENCODER

extern "C" {
#include "SpecsMediaCodec.h"
#include "SpecsMediaFormat.h"
}

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <thread>
#include <vector>

namespace swrtc_hw {
namespace {

constexpr int kCfNV12 = 21;  // COLOR_FormatYUV420SemiPlanar
constexpr int kCfI420 = 19;  // COLOR_FormatYUV420Planar

inline uint8_t clamp8(int v) { return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v)); }

inline uint8_t y_of(int R, int G, int B)  { return clamp8(((66 * R + 129 * G + 25 * B + 128) >> 8) + 16); }
inline uint8_t u_of(int R, int G, int B)  { return clamp8(((-38 * R - 74 * G + 112 * B + 128) >> 8) + 128); }
inline uint8_t v_of(int R, int G, int B)  { return clamp8(((112 * R - 94 * G - 18 * B + 128) >> 8) + 128); }

// All writers target the encoder input buffer, which is laid out with a row
// `stride` (ls) and a Y-plane `sliceHeight` (sh) that the hardware may align up
// from the visible w/h (e.g. h=240 -> slice 256 on Venus). The chroma plane
// therefore starts at ls*sh, NOT w*h — getting that offset wrong misplaces
// chroma and smears color (luma stays correct because its stride matches). For
// NV12 the UV plane shares the luma stride; for I420 each chroma plane uses ls/2.

void rgbaToI420(const uint8_t* rgba, int w, int h, int ls, int sh, uint8_t* dst) {
    uint8_t* yp = dst;
    const int cs = ls / 2;                       // chroma row stride
    uint8_t* up = dst + static_cast<size_t>(ls) * sh;
    uint8_t* vp = up + static_cast<size_t>(cs) * (sh / 2);
    const int cw = w / 2;
    for (int y = 0; y < h; ++y) {
        const uint8_t* row = rgba + static_cast<size_t>(y) * w * 4;
        uint8_t* yr = yp + static_cast<size_t>(y) * ls;
        for (int x = 0; x < w; ++x) yr[x] = y_of(row[x*4], row[x*4+1], row[x*4+2]);
    }
    for (int cy = 0; cy < h / 2; ++cy) {
        const uint8_t* row = rgba + static_cast<size_t>(cy * 2) * w * 4;
        uint8_t* ur = up + static_cast<size_t>(cy) * cs;
        uint8_t* vr = vp + static_cast<size_t>(cy) * cs;
        for (int cx = 0; cx < cw; ++cx) {
            const int x = cx * 2, R = row[x*4], G = row[x*4+1], B = row[x*4+2];
            ur[cx] = u_of(R,G,B); vr[cx] = v_of(R,G,B);
        }
    }
}

void rgbaToNV12(const uint8_t* rgba, int w, int h, int ls, int sh, uint8_t* dst) {
    uint8_t* yp = dst; uint8_t* uvp = dst + static_cast<size_t>(ls) * sh;
    const int cw = w / 2;
    for (int y = 0; y < h; ++y) {
        const uint8_t* row = rgba + static_cast<size_t>(y) * w * 4;
        uint8_t* yr = yp + static_cast<size_t>(y) * ls;
        for (int x = 0; x < w; ++x) yr[x] = y_of(row[x*4], row[x*4+1], row[x*4+2]);
    }
    for (int cy = 0; cy < h / 2; ++cy) {
        const uint8_t* row = rgba + static_cast<size_t>(cy * 2) * w * 4;
        uint8_t* uvr = uvp + static_cast<size_t>(cy) * ls;   // UV stride == luma stride
        for (int cx = 0; cx < cw; ++cx) {
            const int x = cx * 2, R = row[x*4], G = row[x*4+1], B = row[x*4+2];
            uvr[cx*2] = u_of(R,G,B); uvr[cx*2+1] = v_of(R,G,B);
        }
    }
}

// Source planes are tightly packed (w,h) from the caller; the destination is
// strided (ls, sh).
void i420ToNv12(const uint8_t* src, int w, int h, int ls, int sh, uint8_t* dst) {
    const int cw = w / 2, chh = h / 2;
    for (int y = 0; y < h; ++y) std::memcpy(dst + static_cast<size_t>(y) * ls, src + static_cast<size_t>(y) * w, w);
    const uint8_t* u = src + static_cast<size_t>(w) * h;
    const uint8_t* v = u + static_cast<size_t>(cw) * chh;
    uint8_t* uvp = dst + static_cast<size_t>(ls) * sh;
    for (int cy = 0; cy < chh; ++cy) {
        uint8_t* uvr = uvp + static_cast<size_t>(cy) * ls;
        for (int cx = 0; cx < cw; ++cx) { uvr[cx*2] = u[cy*cw+cx]; uvr[cx*2+1] = v[cy*cw+cx]; }
    }
}

void nv12ToI420(const uint8_t* src, int w, int h, int ls, int sh, uint8_t* dst) {
    const int cw = w / 2, chh = h / 2, cs = ls / 2;
    for (int y = 0; y < h; ++y) std::memcpy(dst + static_cast<size_t>(y) * ls, src + static_cast<size_t>(y) * w, w);
    const uint8_t* uv = src + static_cast<size_t>(w) * h;
    uint8_t* up = dst + static_cast<size_t>(ls) * sh;
    uint8_t* vp = up + static_cast<size_t>(cs) * chh;
    for (int cy = 0; cy < chh; ++cy) {
        const uint8_t* uvr = uv + static_cast<size_t>(cy) * w;
        for (int cx = 0; cx < cw; ++cx) { up[cy*cs+cx] = uvr[cx*2]; vp[cy*cs+cx] = uvr[cx*2+1]; }
    }
}

// Copy a tightly-packed (w,h) source already in the target format into the
// strided destination: Y plane at stride ls, chroma plane(s) starting at ls*sh.
void copySameFormatStrided(bool nv12, const uint8_t* src, int w, int h, int ls, int sh, uint8_t* dst) {
    for (int y = 0; y < h; ++y) std::memcpy(dst + static_cast<size_t>(y) * ls, src + static_cast<size_t>(y) * w, w);
    const int chh = h / 2;
    const uint8_t* sc = src + static_cast<size_t>(w) * h;  // source chroma (tight)
    uint8_t* dc = dst + static_cast<size_t>(ls) * sh;       // dest chroma (strided)
    if (nv12) {
        for (int cy = 0; cy < chh; ++cy)
            std::memcpy(dc + static_cast<size_t>(cy) * ls, sc + static_cast<size_t>(cy) * w, w);
    } else {
        const int cw = w / 2, cs = ls / 2;
        const uint8_t* su = sc; const uint8_t* sv = sc + static_cast<size_t>(cw) * chh;
        uint8_t* du = dc; uint8_t* dv = dc + static_cast<size_t>(cs) * chh;
        for (int cy = 0; cy < chh; ++cy) {
            std::memcpy(du + static_cast<size_t>(cy) * cs, su + static_cast<size_t>(cy) * cw, cw);
            std::memcpy(dv + static_cast<size_t>(cy) * cs, sv + static_cast<size_t>(cy) * cw, cw);
        }
    }
}

void convertToEncoder(bool encNv12, PixFmt src, const uint8_t* in, int w, int h,
                      int ls, int sh, uint8_t* out) {
    if (encNv12) {
        if (src == PixFmt::RGBA) rgbaToNV12(in, w, h, ls, sh, out);
        else if (src == PixFmt::I420) i420ToNv12(in, w, h, ls, sh, out);
        else copySameFormatStrided(true, in, w, h, ls, sh, out);   // NV12 -> NV12
    } else {
        if (src == PixFmt::RGBA) rgbaToI420(in, w, h, ls, sh, out);
        else if (src == PixFmt::NV12) nv12ToI420(in, w, h, ls, sh, out);
        else copySameFormatStrided(false, in, w, h, ls, sh, out);  // I420 -> I420
    }
}

void setRuntimeBitrate(SpecsMediaCodec* codec, int bps) {
    SpecsMediaFormat* p = SpecsMediaFormat_new();
    if (!p) return;
    SpecsMediaFormat_setInt32(p, SPECSMEDIACODEC_PARAMETER_KEY_VIDEO_BITRATE, bps);
    SpecsMediaCodec_setParameters(codec, p);
    SpecsMediaFormat_delete(p);
}

void requestSyncFrame(SpecsMediaCodec* codec) {
    SpecsMediaFormat* p = SpecsMediaFormat_new();
    if (!p) return;
    SpecsMediaFormat_setInt32(p, SPECSMEDIACODEC_PARAMETER_KEY_REQUEST_SYNC_FRAME, 0);
    SpecsMediaCodec_setParameters(codec, p);
    SpecsMediaFormat_delete(p);
}

// Create + configure + start. Tries NV12 then I420 color format; for each, the
// richest knob set (bitrate + fps + control-rate + max-quant) then a minimal
// fallback. Reports the chosen color format. Logs to stdout (reaches the journal).
SpecsMediaCodec* makeEncoder(const EncodeParams& p, int* chosenCf) {
    // I420 first: tightly-packed planar input is the proven-good path on this
    // codec (clean chroma). NV12's strided input layout needs more work — see
    // the slice-height notes — so it stays as a fallback to revisit later.
    const char* mime = p.h265 ? "video/hevc" : "video/avc";
    const int cfs[] = {kCfI420, kCfNV12};
    for (int cf : cfs) {
        for (int attempt = 0; attempt < 2; ++attempt) {
            SpecsMediaCodec* codec = SpecsMediaCodec_createEncoderByType(mime);
            if (!codec) return nullptr;
            SpecsMediaFormat* fmt = SpecsMediaFormat_new();
            if (!fmt) { SpecsMediaCodec_delete(codec); return nullptr; }
            SpecsMediaFormat_setString(fmt, SPECSMEDIAFORMAT_KEY_MIME, mime);
            SpecsMediaFormat_setInt32(fmt, SPECSMEDIAFORMAT_KEY_WIDTH, p.width);
            SpecsMediaFormat_setInt32(fmt, SPECSMEDIAFORMAT_KEY_HEIGHT, p.height);
            SpecsMediaFormat_setInt32(fmt, SPECSMEDIAFORMAT_KEY_COLOR_FORMAT, cf);
            if (attempt == 0) {
                SpecsMediaFormat_setInt32(fmt, SPECSMEDIAFORMAT_KEY_BIT_RATE, p.bitrate_bps);
                SpecsMediaFormat_setInt32(fmt, SPECSMEDIAFORMAT_KEY_FRAME_RATE, p.fps);
                if (p.rate_control != RateControl::Default) {
                    // undocumented but honored on this codec (qtic2venc/codec2 CBR=1)
                    SpecsMediaFormat_setInt32(fmt, "control-rate", static_cast<int>(p.rate_control));
                    SpecsMediaFormat_setInt32(fmt, "bitrate-mode", 2);
                }
                if (p.max_qp > 0) {
                    SpecsMediaFormat_setInt32(fmt, "max-quant-i-frames", p.max_qp);
                    SpecsMediaFormat_setInt32(fmt, "max-quant-p-frames", p.max_qp);
                }
            }
            const SpecsMedia_Result r = SpecsMediaCodec_configure(codec, fmt, nullptr, 0);
            SpecsMediaFormat_delete(fmt);
            std::printf("[swrtc-enc] configure cf=%d %s bitrate=%d fps=%d maxqp=%d rc=%d -> %d\n",
                        cf, attempt == 0 ? "full" : "minimal", p.bitrate_bps, p.fps, p.max_qp,
                        static_cast<int>(p.rate_control), static_cast<int>(r));
            std::fflush(stdout);
            if (r == SPECSMEDIA_SUCCESS && SpecsMediaCodec_start(codec) == SPECSMEDIA_SUCCESS) {
                if (chosenCf) *chosenCf = cf;
                std::printf("[swrtc-enc] STARTED cf=%d (%s)\n", cf, attempt == 0 ? "full" : "minimal");
                std::fflush(stdout);
                return codec;
            }
            SpecsMediaCodec_delete(codec);
        }
    }
    return nullptr;
}

}  // namespace

struct HwVideoEncoder::Impl {
    SpecsMediaCodec* codec = nullptr;
    EncodeParams params;
    AnnexBSink sink;
    int width = 0, height = 0;
    int yStride = 0, sliceHeight = 0;  // encoder input layout (>= width/height)
    bool nv12 = false;
    size_t frameBytes = 0;

    std::atomic<bool> running{false};
    std::atomic<bool> inputDone{false};
    std::atomic<bool> forceKeyframe{false};
    std::thread inT, outT;

    std::mutex fmtx;
    std::condition_variable cv;      // wakes the input thread on a new frame / stop
    std::vector<uint8_t> latest;     // raw frame (caller's pixel format)
    PixFmt latestFmt = PixFmt::RGBA;
    uint64_t latestPts = 0;
    uint64_t seq = 0;                // bumped per pushFrame
    bool have = false;

    void inputLoop();
    void outputLoop();
};

void HwVideoEncoder::Impl::inputLoop() {
    std::vector<uint8_t> raw;
    PixFmt fmt = PixFmt::RGBA;
    uint64_t pts = 0, lastSeq = 0;
    int fed = 0;
    bool loggedGeom = false;
    const int kfInterval = params.fps * 2;

    while (running.load()) {
        bool got = false;
        {
            std::unique_lock<std::mutex> lk(fmtx);
            // Block until a new frame is staged (or stop); 200ms timeout so we
            // still re-check running() for clean shutdown. No more 2ms busy-poll.
            cv.wait_for(lk, std::chrono::milliseconds(200),
                        [this, lastSeq] { return !running.load() || (have && seq != lastSeq); });
            if (have && seq != lastSeq) {
                std::swap(raw, latest);  // O(1): take the frame instead of copying it
                fmt = latestFmt; pts = latestPts; lastSeq = seq; got = true;
            }
        }
        if (!got) continue;

        if ((fed > 0 && fed % kfInterval == 0) || forceKeyframe.exchange(false)) requestSyncFrame(codec);

        size_t inIdx = 0;
        if (SpecsMediaCodec_dequeueInputBuffer(codec, 200'000, &inIdx) != SPECSMEDIA_SUCCESS) continue;
        size_t bufSize = 0;
        uint8_t* in = SpecsMediaCodec_getInputBuffer(codec, inIdx, &bufSize);

        // Resolve the real plane layout from the buffer the codec actually gave
        // us. For an exactly-sized 4:2:0 buffer the chroma plane begins at 2/3 of
        // it, so slice-height = 2*bufSize / (3*stride) — this is correct whether
        // or not the codec reported stride/slice-height keys. Fall back to the
        // key/derived sliceHeight if the buffer isn't an exact plane (padding).
        int slice = sliceHeight;
        if (yStride > 0) {
            const size_t derived = (2 * bufSize) / (3 * static_cast<size_t>(yStride));
            if (derived >= static_cast<size_t>(height) &&
                static_cast<size_t>(yStride) * derived * 3 / 2 == bufSize) {
                slice = static_cast<int>(derived);
            }
        }
        const size_t needBytes = static_cast<size_t>(yStride) * slice * 3 / 2;

        if (!loggedGeom) {
            loggedGeom = true;
            std::printf("[swrtc-enc] first frame: bufSize=%zu stride=%d slice(key/derived)=%d/%d "
                        "-> using slice=%d need=%zu nv12=%d\n",
                        bufSize, yStride, sliceHeight, (yStride > 0 ?
                        static_cast<int>((2 * bufSize) / (3 * static_cast<size_t>(yStride))) : 0),
                        slice, needBytes, nv12 ? 1 : 0);
            std::fflush(stdout);
        }

        if (in && bufSize >= needBytes) {
            convertToEncoder(nv12, fmt, raw.data(), width, height, yStride, slice, in);
            SpecsMediaCodec_queueInputBuffer(codec, inIdx, 0, needBytes, pts, pts, 0);
            ++fed;
        } else {
            SpecsMediaCodec_queueInputBuffer(codec, inIdx, 0, 0, 0, 0, 0);
        }
    }
    inputDone.store(true);
}

void HwVideoEncoder::Impl::outputLoop() {
    while (running.load() || !inputDone.load()) {
        size_t idx = 0;
        SpecsMediaCodec_bufferInfo info{};
        if (SpecsMediaCodec_dequeueOutputBuffer(codec, 100'000, &idx, &info) != SPECSMEDIA_SUCCESS) {
            if (inputDone.load()) break;
            continue;
        }
        if (info.size > 0) {
            size_t sz = 0;
            uint8_t* buf = SpecsMediaCodec_getOutputBuffer(codec, idx, &sz);
            if (buf && sink) sink(buf, static_cast<size_t>(info.size),
                                  static_cast<uint64_t>(info.presentationTimeUs));
        }
        SpecsMediaCodec_releaseOutputBuffer(codec, idx);
    }
}

HwVideoEncoder::~HwVideoEncoder() { stop(); delete impl_; }

bool HwVideoEncoder::start(const EncodeParams& params, AnnexBSink sink) {
    if (impl_ && impl_->running.load()) return true;
    if (!impl_) impl_ = new Impl();
    impl_->params = params;
    impl_->sink = std::move(sink);
    impl_->width = params.width;
    impl_->height = params.height;
    impl_->frameBytes = static_cast<size_t>(params.width) * params.height * 3 / 2;

    int cf = kCfNV12;
    impl_->codec = makeEncoder(params, &cf);
    if (!impl_->codec) { std::printf("[swrtc-enc] start FAILED\n"); std::fflush(stdout); return false; }
    impl_->nv12 = (cf == kCfNV12);
    setRuntimeBitrate(impl_->codec, params.bitrate_bps);

    // Input plane layout. I420 (the active path) uses tightly-packed planes at
    // width*height — proven correct on this codec. NV12 needs the hardware's
    // aligned layout (Venus: stride %128, slice-height %32) but isn't fully right
    // yet (revisit later); a reported key overrides either way.
    auto alignUp = [](int v, int a) { return (v + a - 1) & ~(a - 1); };
    if (impl_->nv12) {
        impl_->yStride = alignUp(params.width, 128);
        impl_->sliceHeight = alignUp(params.height, 32);
    } else {  // I420: tightly packed
        impl_->yStride = params.width;
        impl_->sliceHeight = params.height;
    }
    if (SpecsMediaFormat* inf = SpecsMediaCodec_getInputFormat(impl_->codec)) {
        int32_t st = 0, sh = 0;
        if (SpecsMediaFormat_getInt32(inf, "stride", &st) == SPECSMEDIA_SUCCESS && st >= params.width)
            impl_->yStride = st;
        if (SpecsMediaFormat_getInt32(inf, "slice-height", &sh) == SPECSMEDIA_SUCCESS && sh >= params.height)
            impl_->sliceHeight = sh;
        SpecsMediaFormat_delete(inf);
    }
    impl_->frameBytes = static_cast<size_t>(impl_->yStride) * impl_->sliceHeight * 3 / 2;
    std::printf("[swrtc-enc] input layout: %dx%d stride=%d slice=%d frameBytes=%zu nv12=%d\n",
                params.width, params.height, impl_->yStride, impl_->sliceHeight,
                impl_->frameBytes, impl_->nv12 ? 1 : 0);
    std::fflush(stdout);

    impl_->running.store(true);
    impl_->inputDone.store(false);
    impl_->outT = std::thread(&Impl::outputLoop, impl_);
    impl_->inT = std::thread(&Impl::inputLoop, impl_);
    return true;
}

void HwVideoEncoder::pushFrame(PixFmt fmt, const uint8_t* data, int width, int height, uint64_t pts_us) {
    if (!impl_ || !data || width != impl_->width || height != impl_->height) return;
    size_t n = (fmt == PixFmt::RGBA) ? static_cast<size_t>(width) * height * 4
                                     : static_cast<size_t>(width) * height * 3 / 2;
    {
        std::lock_guard<std::mutex> lk(impl_->fmtx);
        impl_->latest.assign(data, data + n);
        impl_->latestFmt = fmt;
        impl_->latestPts = pts_us;
        ++impl_->seq;
        impl_->have = true;
    }
    impl_->cv.notify_one();  // wake the input thread immediately (no poll latency)
}

void HwVideoEncoder::requestKeyframe() { if (impl_) impl_->forceKeyframe.store(true); }

void HwVideoEncoder::setBitrate(int bps) {
    if (!impl_ || !impl_->codec || bps <= 0) return;
    impl_->params.bitrate_bps = bps;  // survives any later encoder re-config
    setRuntimeBitrate(impl_->codec, bps);
    std::printf("[swrtc-enc] runtime bitrate -> %d bps\n", bps);
    std::fflush(stdout);
}

void HwVideoEncoder::stop() {
    if (!impl_) return;
    if (!impl_->running.exchange(false) && !impl_->codec) return;
    impl_->cv.notify_all();  // unblock the input thread's wait so it can exit
    if (impl_->inT.joinable()) impl_->inT.join();
    if (impl_->outT.joinable()) impl_->outT.join();
    if (impl_->codec) {
        SpecsMediaCodec_stop(impl_->codec);
        SpecsMediaCodec_delete(impl_->codec);
        impl_->codec = nullptr;
    }
}

bool HwVideoEncoder::running() const { return impl_ && impl_->running.load(); }

}  // namespace swrtc_hw

#endif  // SWRTC_HW_ENCODER
