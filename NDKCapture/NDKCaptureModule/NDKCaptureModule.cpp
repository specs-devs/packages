//
// NDKCaptureModule — streaming and capture in one native module (SpecsNDK 1.1.0).
//
// Three independent LAYERS, each its own SpecsRecorder session:
//   camera  SPECSRECORDER_STREAM_TYPE_VIDEO     natural camera video (H.265)
//   ar      SPECSRECORDER_STREAM_TYPE_AR_VIDEO  rendered AR overlay video (H.265, new in 1.1.0)
//   mic     SPECSRECORDER_STREAM_TYPE_AUDIO     microphone audio (AAC)
// Every layer can be configured, started and stopped on its own, streamed to JS (encoded
// packets, polled) and/or recorded natively to its own track file, so the layers stay
// separate and can be re-edited later.
//
// Two extras:
//   proxy      a low-rate JPEG camera feed (SpecsCamera + JpegEncoder) for live previews in
//              the NDK Capture Studio, where browsers can't decode raw H.265.
//   composite  a single finished MP4 from SpecsCapture (camera + AR composited + audio) with
//              the AR blend mode and alpha chosen up front.
//
// Track file format ("NKC1", see Docs/format.md): an 8-byte header ("NKC1" + u32 JSON length),
// a JSON header, then packets [u8 layer][u8 flags][u16 0][u64 ts_ns][u32 size][payload]. The
// same packet framing is used for streamed packets.
//
#include "NDKCaptureModule.hpp"
#include "CameraCapture.hpp"
#include "HostFunctionWrapper.hpp"
#include "JpegEncoder.hpp"

#include <SpecsCapture.h>
#include <SpecsMedia.h>
#include <SpecsRecorder.h>

#include <fcntl.h>
#include <unistd.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace usercode {
namespace {

constexpr int kLayerCount = 3;
constexpr const char* kLayerNames[kLayerCount] = {"camera", "ar", "mic"};
constexpr size_t kMaxQueueBytes = 4u * 1024u * 1024u;  // per layer; oldest packets dropped beyond this
constexpr uint8_t kFlagKey = 1;

uint64_t monoNs() {
    return static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now().time_since_epoch())
            .count());
}

struct Packet {
    uint64_t ts;
    uint8_t flags;
    std::vector<uint8_t> data;
};

struct Layer {
    std::mutex mu;
    SpecsRecorder_t* rec = nullptr;
    int index = 0;
    // Requested settings (0 = SDK default). Applied when the session starts.
    uint32_t fps = 0;
    uint32_t bitrate = 0;
    uint32_t keyFrameInterval = 0;
    uint32_t rateControl = 0;
    uint32_t sampleRate = 48000;
    uint32_t channels = 1;
    uint32_t arEye = SPECSRECORDER_AR_CAMERA_POSITION_UNSET;
    bool running = false;
    // Streaming to JS.
    bool streaming = false;
    std::deque<Packet> queue;
    size_t queueBytes = 0;
    // Native track recording.
    FILE* file = nullptr;
    std::string path;
    // Stats.
    uint64_t frames = 0, bytes = 0, dropped = 0, lastTs = 0, startedAt = 0, keyFrames = 0;
    std::string lastError;
};

Layer g_layers[kLayerCount];

int layerIndex(const std::string& name) {
    for (int i = 0; i < kLayerCount; ++i)
        if (name == kLayerNames[i]) return i;
    return -1;
}

// H.265 Annex-B: a packet is a key frame when it carries an IRAP slice (NAL 16-21) or a
// parameter set (VPS/SPS/PPS 32-34), which the encoder emits right before an IDR.
bool isHevcKey(const uint8_t* p, size_t n) {
    for (size_t i = 0; i + 4 < n; ++i) {
        if (p[i] == 0 && p[i + 1] == 0 && (p[i + 2] == 1 || (p[i + 2] == 0 && p[i + 3] == 1))) {
            const size_t h = p[i + 2] == 1 ? i + 3 : i + 4;
            if (h >= n) break;
            const int type = (p[h] >> 1) & 0x3f;
            if ((type >= 16 && type <= 21) || (type >= 32 && type <= 34)) return true;
            i = h;
        }
    }
    return false;
}

void putU16(std::vector<uint8_t>& o, uint16_t v) {
    o.push_back(v & 0xff);
    o.push_back(v >> 8);
}
void putU32(std::vector<uint8_t>& o, uint32_t v) {
    for (int i = 0; i < 4; ++i) o.push_back((v >> (8 * i)) & 0xff);
}
void putU64(std::vector<uint8_t>& o, uint64_t v) {
    for (int i = 0; i < 8; ++i) o.push_back((v >> (8 * i)) & 0xff);
}

void framePacket(std::vector<uint8_t>& out, int layer, const Packet& p) {
    out.push_back(static_cast<uint8_t>(layer));
    out.push_back(p.flags);
    putU16(out, 0);
    putU64(out, p.ts);
    putU32(out, static_cast<uint32_t>(p.data.size()));
    out.insert(out.end(), p.data.begin(), p.data.end());
}

void onEncodedFrame(const SpecsRecorder_Frame_t* frame, void* ctx) {
    auto* L = static_cast<Layer*>(ctx);
    if (!L || !frame || !frame->buffer || frame->buffer_size == 0) return;
    try {
        Packet p;
        p.ts = frame->timestamp_ns;
        p.data.assign(frame->buffer, frame->buffer + frame->buffer_size);
        p.flags = (L->index == 2 || isHevcKey(p.data.data(), p.data.size())) ? kFlagKey : 0;
        std::lock_guard<std::mutex> lk(L->mu);
        L->frames++;
        L->bytes += p.data.size();
        L->lastTs = p.ts;
        if (p.flags & kFlagKey) L->keyFrames++;
        if (L->file) {
            std::vector<uint8_t> framed;
            framePacket(framed, L->index, p);
            std::fwrite(framed.data(), 1, framed.size(), L->file);
        }
        if (L->streaming) {
            L->queueBytes += p.data.size();
            L->queue.push_back(std::move(p));
            while (L->queueBytes > kMaxQueueBytes && !L->queue.empty()) {
                L->queueBytes -= L->queue.front().data.size();
                L->queue.pop_front();
                L->dropped++;
            }
        }
    } catch (...) {
        // Never let an exception escape into the media service thread.
    }
}

int startLayer(Layer& L) {
    std::lock_guard<std::mutex> lk(L.mu);
    if (L.running) return 0;
    SpecsRecorder_CreateParams_t params{};
    params.streamType = L.index == 0   ? SPECSRECORDER_STREAM_TYPE_VIDEO
                        : L.index == 1 ? SPECSRECORDER_STREAM_TYPE_AR_VIDEO
                                       : SPECSRECORDER_STREAM_TYPE_AUDIO;
    params.videoCodec = SPECSMEDIA_VIDEO_CODEC_DEFAULT;  // H.265
    params.audioCodec = SPECSMEDIA_AUDIO_CODEC_AAC;
    params.arCameraPosition = static_cast<SpecsRecorder_ArCameraPosition_t>(L.arEye);
    SpecsMedia_Result_t r = SpecsRecorder_create(&L.rec, &params, onEncodedFrame, &L);
    if (r != SPECSMEDIA_SUCCESS || !L.rec) {
        L.lastError = "SpecsRecorder_create failed (" + std::to_string(static_cast<int>(r)) + ")";
        L.rec = nullptr;
        return static_cast<int>(r);
    }
    SpecsRecorder_Config_t cfg{};
    SpecsRecorder_configGet(L.rec, &cfg);
    if (L.index == 0) {
        cfg.video.fps = L.fps;
        cfg.video.bitrate = L.bitrate;
        cfg.video.keyFrameInterval = L.keyFrameInterval;
        cfg.video.rateControl = static_cast<SpecsMedia_RateControl_t>(L.rateControl);
    } else if (L.index == 1) {
        cfg.ar.fps = L.fps;
        cfg.ar.bitrate = L.bitrate;
        cfg.ar.keyFrameInterval = L.keyFrameInterval;
        cfg.ar.rateControl = static_cast<SpecsMedia_RateControl_t>(L.rateControl);
    } else {
        cfg.audio.sampleRate = L.sampleRate;
        cfg.audio.channelCount = L.channels;
        cfg.audio.bitsPerSample = 16;
        cfg.audio.bitrate = L.bitrate;
    }
    r = SpecsRecorder_configSet(L.rec, &cfg);
    if (r != SPECSMEDIA_SUCCESS) {
        L.lastError = "SpecsRecorder_configSet failed (" + std::to_string(static_cast<int>(r)) + ")";
        SpecsRecorder_destroy(L.rec);
        L.rec = nullptr;
        return static_cast<int>(r);
    }
    r = SpecsRecorder_streamStart(L.rec);
    if (r != SPECSMEDIA_SUCCESS) {
        L.lastError = "SpecsRecorder_streamStart failed (" + std::to_string(static_cast<int>(r)) + ")";
        SpecsRecorder_destroy(L.rec);
        L.rec = nullptr;
        return static_cast<int>(r);
    }
    L.running = true;
    L.startedAt = monoNs();
    L.lastError.clear();
    return 0;
}

void stopLayer(Layer& L) {
    SpecsRecorder_t* rec = nullptr;
    {
        std::lock_guard<std::mutex> lk(L.mu);
        if (!L.running) return;
        L.running = false;
        rec = L.rec;
        L.rec = nullptr;
    }
    // Outside the lock: streamStop waits for in-flight callbacks, which take the lock.
    if (rec) {
        SpecsRecorder_streamStop(rec);
        SpecsRecorder_destroy(rec);
    }
}

void closeTrack(Layer& L) {
    std::lock_guard<std::mutex> lk(L.mu);
    if (L.file) {
        std::fclose(L.file);
        L.file = nullptr;
    }
}

// ── Camera proxy (JPEG) ─────────────────────────────────────────────────────

std::atomic<bool> g_proxyRunning{false};
std::atomic<int> g_proxyQuality{50};
std::atomic<int> g_proxyFps{8};
std::atomic<int> g_proxyMaxWidth{480};
ndkCapture::CameraCapture g_camera;
std::thread g_proxyThread;
std::mutex g_rawMu;
std::condition_variable g_rawCv;
std::vector<uint8_t> g_raw;
int g_rawFmt = 0;
uint32_t g_rawW = 0, g_rawH = 0;
uint64_t g_rawSeq = 0, g_rawTs = 0;
std::mutex g_jpegMu;
std::string g_jpegB64;
uint64_t g_jpegTs = 0;
bool g_jpegFresh = false;

void base64(const uint8_t* d, size_t n, std::string& out) {
    static const char A[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    out.clear();
    out.reserve(((n + 2) / 3) * 4);
    size_t i = 0;
    for (; i + 3 <= n; i += 3) {
        const uint32_t v = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        out.push_back(A[(v >> 18) & 63]);
        out.push_back(A[(v >> 12) & 63]);
        out.push_back(A[(v >> 6) & 63]);
        out.push_back(A[v & 63]);
    }
    if (i + 1 == n) {
        const uint32_t v = d[i] << 16;
        out += {A[(v >> 18) & 63], A[(v >> 12) & 63], '=', '='};
    } else if (i + 2 == n) {
        const uint32_t v = (d[i] << 16) | (d[i + 1] << 8);
        out += {A[(v >> 18) & 63], A[(v >> 12) & 63], A[(v >> 6) & 63], '='};
    }
}

void samplePlanes(int fmt, const uint8_t* src, uint32_t sw, uint32_t sh, int ow, int oh, std::vector<uint8_t>& Y,
                  std::vector<uint8_t>& U, std::vector<uint8_t>& V) {
    const size_t ySize = static_cast<size_t>(sw) * sh;
    const int scw = static_cast<int>(sw) / 2;
    const uint8_t* srcUV = src + ySize;
    const uint8_t* srcV = src + ySize + static_cast<size_t>(scw) * (sh / 2);
    const int ocw = ow / 2, och = oh / 2;
    Y.resize(static_cast<size_t>(ow) * oh);
    U.resize(static_cast<size_t>(ocw) * och);
    V.resize(static_cast<size_t>(ocw) * och);
    for (int y = 0; y < oh; ++y) {
        const uint8_t* row = src + static_cast<size_t>(y * static_cast<int64_t>(sh) / oh) * sw;
        for (int x = 0; x < ow; ++x) Y[static_cast<size_t>(y) * ow + x] = row[x * static_cast<int64_t>(sw) / ow];
    }
    for (int y = 0; y < och; ++y) {
        const int cy = static_cast<int>(static_cast<int64_t>(y) * (sh / 2) / och);
        for (int x = 0; x < ocw; ++x) {
            const int cx = static_cast<int>(static_cast<int64_t>(x) * scw / ocw);
            if (fmt == 1) {
                const uint8_t* p = srcUV + static_cast<size_t>(cy) * (scw * 2) + cx * 2;
                U[static_cast<size_t>(y) * ocw + x] = p[0];
                V[static_cast<size_t>(y) * ocw + x] = p[1];
            } else {
                U[static_cast<size_t>(y) * ocw + x] = srcUV[static_cast<size_t>(cy) * scw + cx];
                V[static_cast<size_t>(y) * ocw + x] = srcV[static_cast<size_t>(cy) * scw + cx];
            }
        }
    }
}

void proxyLoop() {
    using clock = std::chrono::steady_clock;
    uint64_t lastSeq = 0;
    auto nextAt = clock::now();
    std::vector<uint8_t> raw, Y, U, V, jpeg;
    std::string b64;
    while (g_proxyRunning.load()) {
        int fmt;
        uint32_t w, h;
        uint64_t ts;
        {
            std::unique_lock<std::mutex> lk(g_rawMu);
            g_rawCv.wait(lk, [&] { return !g_proxyRunning.load() || g_rawSeq != lastSeq; });
            if (!g_proxyRunning.load()) break;
            lastSeq = g_rawSeq;
            raw = g_raw;
            fmt = g_rawFmt;
            w = g_rawW;
            h = g_rawH;
            ts = g_rawTs;
        }
        const int fps = g_proxyFps.load() > 0 ? g_proxyFps.load() : 8;
        auto now = clock::now();
        if (now < nextAt) std::this_thread::sleep_until(nextAt);
        nextAt = clock::now() + std::chrono::microseconds(1000000 / fps);
        if (!g_proxyRunning.load()) break;
        int ow = static_cast<int>(w), oh = static_cast<int>(h);
        const int maxW = g_proxyMaxWidth.load();
        if (maxW > 0 && ow > maxW) {
            oh = static_cast<int>(static_cast<int64_t>(oh) * maxW / ow);
            ow = maxW;
        }
        ow &= ~1;
        oh &= ~1;
        if (ow < 2 || oh < 2) continue;
        samplePlanes(fmt, raw.data(), w, h, ow, oh, Y, U, V);
        ndkCaptureJpeg::EncodeYUV420(Y.data(), U.data(), V.data(), ow, oh, ow, ow / 2, g_proxyQuality.load(), jpeg);
        if (jpeg.empty()) continue;
        base64(jpeg.data(), jpeg.size(), b64);
        std::lock_guard<std::mutex> lk(g_jpegMu);
        g_jpegB64.swap(b64);
        g_jpegTs = ts * 1000ULL;
        g_jpegFresh = true;
    }
}

void cameraSink(int fmt, const uint8_t* data, size_t size, uint32_t width, uint32_t height, uint64_t ptsUs) {
    if (!g_proxyRunning.load()) return;
    {
        std::lock_guard<std::mutex> lk(g_rawMu);
        g_raw.assign(data, data + size);
        g_rawFmt = fmt;
        g_rawW = width;
        g_rawH = height;
        g_rawTs = ptsUs;
        ++g_rawSeq;
    }
    g_rawCv.notify_one();
}

void stopProxy() {
    if (!g_proxyRunning.exchange(false)) return;
    g_rawCv.notify_all();
    if (g_proxyThread.joinable()) g_proxyThread.join();
    g_camera.stop();
    std::lock_guard<std::mutex> lk(g_jpegMu);
    g_jpegB64.clear();
    g_jpegFresh = false;
}

// ── Composite capture (SpecsCapture MP4) ────────────────────────────────────

std::mutex g_compMu;
SpecsCapture_t* g_comp = nullptr;
int g_compFd = -1;
std::string g_compState = "idle";  // idle | preparing | recording | completed | error
std::string g_compPath;
std::string g_compMessage;
uint64_t g_compDurationNs = 0;

void onCaptureEvent(SpecsCapture_t*, SpecsCapture_Event_t event, const SpecsCapture_EventInfo_t* info, void*) {
    std::lock_guard<std::mutex> lk(g_compMu);
    if (event == SPECSCAPTURE_EVENT_READY) {
        if (g_compState == "preparing") g_compState = "ready";
    } else if (event == SPECSCAPTURE_EVENT_RECORDING_STARTED) {
        g_compState = "recording";
    } else if (event == SPECSCAPTURE_EVENT_COMPLETED || event == SPECSCAPTURE_EVENT_ERROR) {
        g_compState = event == SPECSCAPTURE_EVENT_COMPLETED ? "completed" : "error";
        if (info) {
            g_compDurationNs = info->recordedDurationNs;
            g_compMessage = info->message ? info->message : ("status " + std::to_string(static_cast<int>(info->status)));
        }
        if (g_compFd >= 0) {
            ::close(g_compFd);
            g_compFd = -1;
        }
    }
}

void destroyComposite() {
    SpecsCapture_t* s = nullptr;
    {
        std::lock_guard<std::mutex> lk(g_compMu);
        s = g_comp;
        g_comp = nullptr;
    }
    if (s) SpecsCapture_destroy(s);
    std::lock_guard<std::mutex> lk(g_compMu);
    if (g_compFd >= 0) {
        ::close(g_compFd);
        g_compFd = -1;
    }
}

// ── ABI helpers ─────────────────────────────────────────────────────────────

double num(const CoreJsAbiValue* args, size_t n, size_t i, double fallback) {
    return (i < n && args[i].kind == CoreJsAbiValueKindNumber) ? args[i].data.number : fallback;
}

struct Utf8Buffer : CoreJsAbiGrowableBuffer {
    std::string s;
    static void grow(CoreJsAbiGrowableBuffer* b, size_t sz) {
        auto* self = static_cast<Utf8Buffer*>(b);
        self->s.resize(sz);
        self->data = reinterpret_cast<uint8_t*>(self->s.data());
        self->capacity = self->s.size();
    }
    static constexpr CoreJsAbiGrowableBufferVTable vt{grow};
    Utf8Buffer() : CoreJsAbiGrowableBuffer{&vt, nullptr, 0, 0} {}
};

std::string str(CoreJsAbiRuntime* rt, const CoreJsAbiValue* args, size_t n, size_t i) {
    if (i >= n || args[i].kind != CoreJsAbiValueKindString) return "";
    Utf8Buffer b;
    CoreJsAbiString s{args[i].data.pointer};
    rt->vt->get_utf8_from_string(rt, &s, &b);
    b.s.resize(b.used);
    return b.s;
}

CoreJsAbiValue number(double v) {
    return CoreJsAbiValue{.kind = CoreJsAbiValueKindNumber, .data = {.number = v}};
}

CoreJsAbiValue undefinedValue() {
    return CoreJsAbiValue{.kind = CoreJsAbiValueKindUndefined, .data = {}};
}

CoreJsAbiValueOrError stringValue(CoreJsAbiRuntime* rt, const std::string& s) {
    CoreJsAbiStringOrError r = rt->vt->create_string_from_utf8(rt, s.data(), s.size());
    if (r.is_error) return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError, .data = {}}};
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindString, .data = {.pointer = r.ptr_or_error.ptr}}};
}

std::string jsonEscape(const std::string& s) {
    std::string o;
    for (char c : s) {
        if (c == '"' || c == '\\') o.push_back('\\'), o.push_back(c);
        else if (static_cast<unsigned char>(c) < 0x20) o += ' ';
        else o.push_back(c);
    }
    return o;
}

#define NDK_ARGS CoreJsAbiRuntime *rt, const CoreJsAbiValue *, const CoreJsAbiValue *args, size_t n

// ── Exports ─────────────────────────────────────────────────────────────────

CoreJsAbiValueOrError ping_impl(NDK_ARGS) {
    (void)rt, (void)args, (void)n;
    return {number(1.0)};
}

CoreJsAbiValueOrError version_impl(NDK_ARGS) {
    (void)args, (void)n;
    return stringValue(rt, "NDKCapture 4.0.0 (SpecsNDK 1.1.0)");
}

CoreJsAbiValueOrError clock_impl(NDK_ARGS) {
    (void)rt, (void)args, (void)n;
    return {number(static_cast<double>(monoNs()))};
}

/// configureLayer(layer, fps, bitrate, keyFrameInterval, rateControl, extra) -> 0 | -3
/// extra: AR eye position for "ar" (SpecsRecorder_ArCameraPosition_t), sample rate for "mic".
/// Takes effect on the next startLayer(); bitrate can also change live via layerAction.
CoreJsAbiValueOrError configure_layer_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    Layer& L = g_layers[i];
    std::lock_guard<std::mutex> lk(L.mu);
    L.fps = static_cast<uint32_t>(num(args, n, 1, 0));
    L.bitrate = static_cast<uint32_t>(num(args, n, 2, 0));
    L.keyFrameInterval = static_cast<uint32_t>(num(args, n, 3, 0));
    L.rateControl = static_cast<uint32_t>(num(args, n, 4, 0));
    if (i == 1) L.arEye = static_cast<uint32_t>(num(args, n, 5, SPECSRECORDER_AR_CAMERA_POSITION_UNSET));
    if (i == 2) L.sampleRate = static_cast<uint32_t>(num(args, n, 5, 48000));
    return {number(0)};
}

/// startLayer(layer) -> 0 or a SpecsMedia_Result_t error. Idempotent.
CoreJsAbiValueOrError start_layer_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    return {number(startLayer(g_layers[i]))};
}

/// stopLayer(layer) -> 0. Stops encoding; open track files stay open until recordLayer(layer, "").
CoreJsAbiValueOrError stop_layer_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    stopLayer(g_layers[i]);
    return {number(0)};
}

/// streamLayer(layer, on) -> 0. When on, encoded packets queue for pollLayer().
CoreJsAbiValueOrError stream_layer_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    Layer& L = g_layers[i];
    std::lock_guard<std::mutex> lk(L.mu);
    L.streaming = num(args, n, 1, 0) != 0;
    if (!L.streaming) {
        L.queue.clear();
        L.queueBytes = 0;
    }
    return {number(0)};
}

/// pollLayer(layer, maxBytes) -> base64 of framed packets, or undefined when nothing is queued.
CoreJsAbiValueOrError poll_layer_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {undefinedValue()};
    const size_t maxBytes = static_cast<size_t>(num(args, n, 1, 256 * 1024));
    std::vector<uint8_t> framed;
    {
        Layer& L = g_layers[i];
        std::lock_guard<std::mutex> lk(L.mu);
        while (!L.queue.empty() && (framed.empty() || framed.size() + L.queue.front().data.size() <= maxBytes)) {
            framePacket(framed, i, L.queue.front());
            L.queueBytes -= L.queue.front().data.size();
            L.queue.pop_front();
        }
    }
    if (framed.empty()) return {undefinedValue()};
    std::string b64;
    base64(framed.data(), framed.size(), b64);
    return stringValue(rt, b64);
}

/// recordLayer(layer, path, headerJson) -> 0 | -1. path "" closes the track. Writes an NKC1 track.
CoreJsAbiValueOrError record_layer_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    Layer& L = g_layers[i];
    const std::string path = str(rt, args, n, 1);
    const std::string header = str(rt, args, n, 2);
    closeTrack(L);
    if (path.empty()) return {number(0)};
    std::lock_guard<std::mutex> lk(L.mu);
    L.file = std::fopen(path.c_str(), "wb");
    if (!L.file) {
        L.lastError = "Couldn't open " + path;
        return {number(-1)};
    }
    L.path = path;
    std::vector<uint8_t> head = {'N', 'K', 'C', '1'};
    putU32(head, static_cast<uint32_t>(header.size()));
    head.insert(head.end(), header.begin(), header.end());
    std::fwrite(head.data(), 1, head.size(), L.file);
    return {number(0)};
}

/// layerAction(layer, action, value) -> SpecsMedia_Result_t. action 0 = key frame, 1 = target bitrate.
CoreJsAbiValueOrError layer_action_impl(NDK_ARGS) {
    const int i = layerIndex(str(rt, args, n, 0));
    if (i < 0) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    Layer& L = g_layers[i];
    std::lock_guard<std::mutex> lk(L.mu);
    if (!L.rec) return {number(SPECSMEDIA_ERROR_INVALID_STATE)};
    const int action = static_cast<int>(num(args, n, 1, 0));
    const uint64_t value = static_cast<uint64_t>(num(args, n, 2, 0));
    if (action == 1) L.bitrate = static_cast<uint32_t>(value);
    return {number(SpecsRecorder_action(L.rec, static_cast<SpecsRecorder_Action_t>(action), value))};
}

/// stats() -> JSON string with one object per layer, the proxy and the composite.
CoreJsAbiValueOrError stats_impl(NDK_ARGS) {
    (void)args, (void)n;
    std::string o = "{\"layers\":{";
    for (int i = 0; i < kLayerCount; ++i) {
        Layer& L = g_layers[i];
        std::lock_guard<std::mutex> lk(L.mu);
        if (i) o += ",";
        o += "\"" + std::string(kLayerNames[i]) + "\":{\"running\":" + (L.running ? "true" : "false") +
             ",\"streaming\":" + (L.streaming ? "true" : "false") + ",\"recording\":" + (L.file ? "true" : "false") +
             ",\"frames\":" + std::to_string(L.frames) + ",\"keyFrames\":" + std::to_string(L.keyFrames) +
             ",\"bytes\":" + std::to_string(L.bytes) + ",\"dropped\":" + std::to_string(L.dropped) +
             ",\"queued\":" + std::to_string(L.queue.size()) + ",\"lastTs\":" + std::to_string(L.lastTs) +
             ",\"bitrate\":" + std::to_string(L.bitrate) + ",\"error\":\"" + jsonEscape(L.lastError) + "\"}";
    }
    o += "},\"proxy\":{\"running\":" + std::string(g_proxyRunning.load() ? "true" : "false") + "}";
    {
        std::lock_guard<std::mutex> lk(g_compMu);
        o += ",\"composite\":{\"state\":\"" + g_compState + "\",\"path\":\"" + jsonEscape(g_compPath) +
             "\",\"durationNs\":" + std::to_string(g_compDurationNs) + ",\"message\":\"" + jsonEscape(g_compMessage) +
             "\"}}";
    }
    return stringValue(rt, o);
}

/// startProxy(maxWidth, quality, fps) -> 0 | -1 (camera unavailable).
CoreJsAbiValueOrError start_proxy_impl(NDK_ARGS) {
    (void)rt;
    g_proxyMaxWidth.store(static_cast<int>(num(args, n, 0, 480)));
    g_proxyQuality.store(static_cast<int>(num(args, n, 1, 50)));
    g_proxyFps.store(static_cast<int>(num(args, n, 2, 8)));
    if (g_proxyRunning.load()) return {number(0)};
    g_proxyRunning.store(true);
    if (!g_camera.start(cameraSink, g_proxyMaxWidth.load())) {
        g_proxyRunning.store(false);
        return {number(-1)};
    }
    g_proxyThread = std::thread(proxyLoop);
    return {number(0)};
}

CoreJsAbiValueOrError stop_proxy_impl(NDK_ARGS) {
    (void)rt, (void)args, (void)n;
    stopProxy();
    return {number(0)};
}

/// proxyFrame() -> "<tsNs>:<base64 JPEG>" or undefined when no new frame was encoded.
CoreJsAbiValueOrError proxy_frame_impl(NDK_ARGS) {
    (void)args, (void)n;
    std::string out;
    {
        std::lock_guard<std::mutex> lk(g_jpegMu);
        if (!g_jpegFresh) return {undefinedValue()};
        out = std::to_string(g_jpegTs) + ":" + g_jpegB64;
        g_jpegFresh = false;
    }
    return stringValue(rt, out);
}

/// startComposite(path, withAr, blend, alpha, width, height, bitrate, durationSec) -> SpecsMedia_Result_t.
/// One finished MP4 (camera, AR composited with blend/alpha, audio) through SpecsCapture.
CoreJsAbiValueOrError start_composite_impl(NDK_ARGS) {
    const std::string path = str(rt, args, n, 0);
    if (path.empty()) return {number(SPECSMEDIA_ERROR_BAD_ARGUMENT)};
    destroyComposite();
    const int fd = ::open(path.c_str(), O_RDWR | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return {number(-1)};
    SpecsCapture_CreateParams_t p{};
    p.mode = num(args, n, 1, 1) != 0 ? SPECSCAPTURE_MODE_VIDEO_WITH_AR_AND_AUDIO : SPECSCAPTURE_MODE_VIDEO_AND_AUDIO;
    p.arBlendMode = num(args, n, 2, 0) != 0 ? SPECSCAPTURE_AR_BLEND_ADDITIVE : SPECSCAPTURE_AR_BLEND_OPAQUE;
    p.arAlpha = num(args, n, 3, 1.0);
    p.resolution.width = static_cast<uint32_t>(num(args, n, 4, 1280));
    p.resolution.height = static_cast<uint32_t>(num(args, n, 5, 960));
    p.bitrate = static_cast<uint32_t>(num(args, n, 6, 0));
    p.durationNs = static_cast<uint64_t>(num(args, n, 7, 0) * 1e9);
    p.outputFd = fd;
    p.videoCodec = SPECSMEDIA_VIDEO_CODEC_DEFAULT;
    p.audioCodec = SPECSMEDIA_AUDIO_CODEC_AAC;
    SpecsCapture_t* s = nullptr;
    {
        std::lock_guard<std::mutex> lk(g_compMu);
        g_compFd = fd;
        g_compPath = path;
        g_compState = "preparing";
        g_compMessage.clear();
        g_compDurationNs = 0;
    }
    SpecsMedia_Result_t r = SpecsCapture_create(&s, &p, onCaptureEvent, nullptr);
    if (r == SPECSMEDIA_SUCCESS && s) r = SpecsCapture_start(s);
    std::lock_guard<std::mutex> lk(g_compMu);
    g_comp = s;
    if (r != SPECSMEDIA_SUCCESS) {
        g_compState = "error";
        g_compMessage = "SpecsCapture failed (" + std::to_string(static_cast<int>(r)) + ")";
        if (g_compFd >= 0) {
            ::close(g_compFd);
            g_compFd = -1;
        }
    }
    return {number(static_cast<int>(r))};
}

/// stopComposite() -> SpecsMedia_Result_t. The MP4 is final once stats().composite.state is "completed".
CoreJsAbiValueOrError stop_composite_impl(NDK_ARGS) {
    (void)rt, (void)args, (void)n;
    std::lock_guard<std::mutex> lk(g_compMu);
    if (!g_comp) return {number(SPECSMEDIA_ERROR_INVALID_STATE)};
    return {number(SpecsCapture_stop(g_comp))};
}

void release_managed_pointer(CoreJsAbiManagedPointer* p) {
    if (p) p->vtable->release(p);
}

bool register_export(CoreJsAbiRuntime* runtime, CoreJsAbiObject* moduleObject, std::string_view name, HostFunction fn) {
    auto wrapped = std::make_unique<HostFunctionWrapper>(std::move(fn));
    CoreJsAbiFunctionOrError f = runtime->vt->create_function_from_host_function(runtime, wrapped.get());
    if (f.is_error) {
        std::string_view msg = "Failed creating native export function";
        runtime->vt->set_string_error_value(runtime, msg.data(), msg.size());
        return false;
    }
    wrapped.release();
    CoreJsAbiManagedPointer* ptr = f.ptr_or_error.ptr;
    CoreJsAbiValue value{.kind = CoreJsAbiValueKindObject, .data = {.pointer = ptr}};
    if (runtime->vt->set_object_property_from_string(runtime, moduleObject, name.data(), name.size(), &value).is_error) {
        release_managed_pointer(ptr);
        std::string_view msg = "Failed setting native export on module object";
        runtime->vt->set_string_error_value(runtime, msg.data(), msg.size());
        return false;
    }
    return true;
}

}  // namespace

void assignNativeFunctions(CoreJsAbiRuntime* runtime, CoreJsAbiObject* moduleObject) {
    for (int i = 0; i < kLayerCount; ++i) g_layers[i].index = i;
    const std::pair<std::string_view, HostFunction> exports[] = {
        {"ping", ping_impl},
        {"version", version_impl},
        {"clockNs", clock_impl},
        {"configureLayer", configure_layer_impl},
        {"startLayer", start_layer_impl},
        {"stopLayer", stop_layer_impl},
        {"streamLayer", stream_layer_impl},
        {"pollLayer", poll_layer_impl},
        {"recordLayer", record_layer_impl},
        {"layerAction", layer_action_impl},
        {"stats", stats_impl},
        {"startProxy", start_proxy_impl},
        {"stopProxy", stop_proxy_impl},
        {"proxyFrame", proxy_frame_impl},
        {"startComposite", start_composite_impl},
        {"stopComposite", stop_composite_impl},
    };
    for (const auto& e : exports)
        if (!register_export(runtime, moduleObject, e.first, e.second)) return;
}

void shutdownAll() {
    for (auto& L : g_layers) {
        stopLayer(L);
        closeTrack(L);
    }
    stopProxy();
    {
        std::lock_guard<std::mutex> lk(g_compMu);
        if (g_comp) SpecsCapture_stop(g_comp);
    }
    destroyComposite();
}

}  // namespace usercode

extern "C" {
void CoreJsOnLoad(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject, void**) {
    usercode::assignNativeFunctions(runtime, moduleObject);
}

void CoreJsOnUnload(CoreJsAbiRuntime*, void*) {
    usercode::shutdownAll();
}
}
