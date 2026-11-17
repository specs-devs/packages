#include "DecartWebRTCModule.hpp"
#include "HostFunctionWrapper.hpp"
#include "CameraStreamer.hpp"
#include "specs_webrtc.h"

#include "SpecsMedia.h"
#include "SpecsMediaCodec.h"
#include "SpecsMediaFormat.h"

#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <memory>
#include <mutex>
#include <new>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

// ============================================================================
// DecartWebRTCModule — on-device (Glasses / NDK) WebRTC transport for Decart.
//
// SPLIT OF RESPONSIBILITY:
//   • TypeScript (DecartWebRTCSession.ts) owns the Decart /v1/stream signaling
//     WebSocket (via the Lens InternetModule) and the prompt control channel.
//   • This native module owns the media: a libSpecsWebRTC session in MANUAL
//     signaling mode (offer → answer → ICE bridged through TS), camera capture
//     → HW H.265 encode (swrtc_send_video_raw), and inbound track → SpecsMediaCodec
//     HW decode → NV12→RGBA → getFrameRGBA() for the Lens display quad.
//
// Signaling bridge (native ↔ TS):
//   • on_local_description / on_local_candidate  → queued → getSignalingOut()  (TS drains → WS)
//   • WS answer / remote ICE → setRemoteAnswer() / addRemoteCandidate()        (TS → native)
//
// ON-DEVICE TUNING NOTES (the parts with no prior reference implementation):
//   • The decoded color-format has NO SDK constant; we read width/height/
//     color-format back from getOutputFormat() and assume NV12 semi-planar with
//     tight (== width) stride. If a device reports padded stride or I420, adjust
//     convert_nv12_to_rgba()/read the stride from the output format.
//   • ICE: uses a public STUN server + trickle ICE. If Decart provides its own
//     ICE servers over signaling, prefer those.
// ============================================================================

namespace usercode {
namespace {

// ── Config (set by startSession) ─────────────────────────────────────────────
bool s_useH265 = true;
uint32_t s_fps = 30;
uint32_t s_bitrateKbps = 6000;
int s_cameraMaxWidth = 1280;

// ── libSpecsWebRTC session ───────────────────────────────────────────────────
swrtc_session* s_session = nullptr;
webrtcstream::CameraStreamer s_camera;
std::atomic<bool> s_streaming{false};
int s_state = 0; // swrtc_state; 6 = our "streaming" pseudo-state

// Keyframe (RTCP PLI) requests are rate-limited through ONE choke point so the
// several call sites (TS periodic, queue overflow, decode drop) can never stack
// into an IDR storm — big intra frames spike bandwidth → Wi-Fi loss → more
// corruption → more requests. steady_clock ms of the last honored request.
std::atomic<int64_t> s_lastKeyframeMs{0};

// ── Lightweight per-second pipeline counters (diagnostic) ────────────────────
// Emitted once/sec from the decode worker as ONE stderr line so an on-device test
// pinpoints WHERE frames are lost along: arrival → inbound queue → decoder input →
// HW decode → convert → handed to JS. All atomic/relaxed — a couple of bumps/frame.
std::atomic<uint32_t> s_cntRx{0};        // frames received from Decart (receive thread)
std::atomic<uint32_t> s_cntOvfDrop{0};   // frames dropped by inbound-queue overflow (backlog)
std::atomic<uint32_t> s_cntFed{0};       // frames fed into the HW decoder
std::atomic<uint32_t> s_cntFeedDrop{0};  // frames dropped: no decoder input buffer (frame-num gap)
std::atomic<uint32_t> s_cntDecoded{0};   // frames the HW decoder produced
std::atomic<uint32_t> s_cntConverted{0}; // frames YUV→RGBA converted (newest-only; ≤ decoded BY DESIGN)
std::atomic<uint32_t> s_cntPublished{0}; // frames handed to JS via pullFrameInto (≈ displayed fps)
std::atomic<uint32_t> s_cntKf{0};        // keyframe (PLI) requests actually honored
std::atomic<uint32_t> s_maxBatch{0};     // largest single-wake backlog drained (1 = worker keeping up)
std::atomic<int64_t> s_statLastMs{0};

// ── Outbound signaling queue (filled on worker threads, drained on JS thread) ─
struct SigMsg {
    int kind = 0; // 1 = offer sdp, 2 = answer sdp, 3 = ice candidate
    std::string sdp;
    std::string candidate;
    std::string mid;
};
std::mutex s_sigMtx;
std::deque<SigMsg> s_sigOut;

// ── Inbound decoder (SpecsMediaCodec) ────────────────────────────────────────
std::mutex s_decoderMtx;
SpecsMediaCodec* s_decoder = nullptr;
int s_decW = 0;
int s_decH = 0;
int s_colorFormat = -1;

// Newest decoded YUV held for conversion. drain_output() memcpy's each ready
// decoded frame here (cheap; newest wins) and releases the HW buffer immediately;
// the expensive YUV→RGBA convert then runs ONCE per worker wake on this buffer.
// This decouples HW decode throughput from the single-threaded CPU convert and
// stops us burning CPU converting frames JS will never display (it only ever
// paints the newest). Guarded by s_decoderMtx (worker + teardown only).
std::vector<uint8_t> s_pendingYuv;
int s_pendingW = 0;
int s_pendingH = 0;
bool s_pendingValid = false;

// ── Latest decoded RGBA frame (published for getFrameRGBA) ───────────────────
std::mutex s_frameMtx;
std::vector<uint8_t> s_latestRgba;  // reused RGBA buffer (already vertically flipped for display)
int s_latestW = 0;
int s_latestH = 0;
uint64_t s_frameSeq = 0;   // bumped whenever a new decoded frame is written
uint64_t s_polledSeq = 0;  // last sequence handed to JS via getFrameRGBA

// Decode worker: on_video_frame (WebRTC receive thread) ONLY enqueues Annex-B; this
// worker thread runs the HW decode + CPU YUV→RGBA convert. Keeping that work off the
// receive thread stops it from blocking packet reception (which was dropping UDP packets
// → frame-num gaps → corruption + ~5 fps).
std::thread s_decodeThread;
std::atomic<bool> s_decodeRun{false};
std::mutex s_inMtx;
std::condition_variable s_inCv;
std::deque<std::vector<uint8_t>> s_inQueue; // Annex-B access units, in order
std::deque<int> s_inKey;                    // parallel keyframe flags

// ── Small helpers ─────────────────────────────────────────────────────────────
CoreJsAbiValueOrError num(double x) {
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindNumber, .data = {.number = x}}};
}

inline uint8_t clamp255(int v) {
    return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v));
}

inline int64_t steady_now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

// Single choke point for RTCP PLI requests. Honors at most one every minGapMs so
// no combination of callers can produce a keyframe storm. First call (last==0)
// always passes, so the on-connect keyframe is immediate.
void maybe_request_keyframe(int64_t minGapMs) {
    if (s_session == nullptr) {
        return;
    }
    const int64_t now = steady_now_ms();
    int64_t last = s_lastKeyframeMs.load(std::memory_order_relaxed);
    if (now - last < minGapMs) {
        return;
    }
    if (s_lastKeyframeMs.compare_exchange_strong(last, now, std::memory_order_relaxed)) {
        swrtc_request_keyframe(s_session);
        s_cntKf.fetch_add(1, std::memory_order_relaxed);
    }
}

void release_managed_pointer(CoreJsAbiManagedPointer* p) {
    if (p != nullptr) {
        p->vtable->release(p);
    }
}

// UTF-8 string argument reader (runtime writes into a caller-owned growable buffer).
struct StdGrowableBuffer {
    CoreJsAbiGrowableBuffer base;
    static void try_grow_to(CoreJsAbiGrowableBuffer* b, size_t sz) {
        if (sz <= b->capacity) {
            return;
        }
        uint8_t* np = static_cast<uint8_t*>(std::realloc(b->data, sz));
        if (np != nullptr) {
            b->data = np;
            b->capacity = sz;
        }
    }
    static const CoreJsAbiGrowableBufferVTable vtable;
    StdGrowableBuffer() {
        base.vtable = &vtable;
        base.data = nullptr;
        base.capacity = 0;
        base.used = 0;
    }
    ~StdGrowableBuffer() { std::free(base.data); }
};
const CoreJsAbiGrowableBufferVTable StdGrowableBuffer::vtable{&StdGrowableBuffer::try_grow_to};

bool read_string_arg(CoreJsAbiRuntime* rt, const CoreJsAbiValue& v, std::string& out) {
    out.clear();
    if (v.kind != CoreJsAbiValueKindString || v.data.pointer == nullptr) {
        return false;
    }
    CoreJsAbiString str{v.data.pointer};
    StdGrowableBuffer sgb;
    rt->vt->get_utf8_from_string(rt, &str, &sgb.base);
    if (sgb.base.data != nullptr && sgb.base.used > 0) {
        out.assign(reinterpret_cast<const char*>(sgb.base.data), sgb.base.used);
    }
    return true;
}

double arg_num(const CoreJsAbiValue* args, size_t argc, size_t i, double dflt) {
    if (i < argc && args[i].kind == CoreJsAbiValueKindNumber) {
        return args[i].data.number;
    }
    return dflt;
}

// (Decoded frames are written directly into s_latestRgba by convert_yuv420_to_rgba,
//  vertically flipped, with no intermediate copy — see below.)

// Decoded YUV 4:2:0 → RGBA8 (BT.601 limited range). Handles both planar I420
// (Y, then U plane, then V plane) and semi-planar NV12 (Y, then interleaved UV),
// with a per-plane row stride derived from the actual buffer size (covers padding).
// Toggle s_planarI420 if the device decoder turns out to be semi-planar.
bool s_planarI420 = true;

void convert_yuv420_to_rgba(const uint8_t* yuv, size_t size, int w, int h) {
    const size_t tight = static_cast<size_t>(w) * static_cast<size_t>(h) * 3 / 2;
    // Derive the luma row stride from the buffer size (>= width if the decoder pads rows).
    // total = strideY*h (Y) + strideY*h/2 (chroma, same stride, half height) = strideY*h*3/2.
    size_t strideY = static_cast<size_t>(w);
    if (size > tight && h > 0) {
        const size_t s = (size * 2) / (static_cast<size_t>(h) * 3);
        if (s >= static_cast<size_t>(w)) strideY = s;
    }
    static int s_fmtLog = 0;
    if ((s_fmtLog++ % 60) == 0) {
        std::fprintf(stderr, "[DecartNative] convert %dx%d size=%zu tight=%zu strideY=%zu %s\n",
                     w, h, size, tight, strideY, s_planarI420 ? "I420" : "NV12");
    }
    if (size < tight) {
        return;
    }
    const size_t strideC = strideY / 2;               // chroma plane row stride (I420)
    const uint8_t* Y = yuv;
    const uint8_t* U = yuv + strideY * static_cast<size_t>(h);          // I420: U plane
    const uint8_t* V = U + strideC * static_cast<size_t>(h / 2);        // I420: V plane
    const uint8_t* UV = U;                                             // NV12: interleaved UV

    // Write straight into the reused, mutex-guarded output buffer, VERTICALLY FLIPPED
    // (so JS uploads with no CPU flip). No per-frame allocation.
    const size_t need = static_cast<size_t>(w) * static_cast<size_t>(h) * 4;
    std::lock_guard<std::mutex> lock(s_frameMtx);
    if (s_latestRgba.size() != need) {
        s_latestRgba.resize(need);
    }
    uint8_t* dst = s_latestRgba.data();

    // BT.601 limited-range YUV→RGB (integer fixed-point). The I420/NV12 branch is
    // hoisted OUT of the pixel loop, and chroma is read once per horizontal pixel
    // pair (i and i+1 share the same subsampled U/V) — both trim per-pixel work on
    // the single convert thread. Output is byte-for-byte identical to the per-pixel
    // version, still vertically flipped for direct upload.
    auto write_px = [](uint8_t* p, int c, int u, int v) {
        p[0] = clamp255((298 * c + 409 * v + 128) >> 8);
        p[1] = clamp255((298 * c - 100 * u - 208 * v + 128) >> 8);
        p[2] = clamp255((298 * c + 516 * u + 128) >> 8);
        p[3] = 255;
    };
    for (int j = 0; j < h; ++j) {
        const int cj = j / 2;
        const uint8_t* yrow = Y + static_cast<size_t>(j) * strideY;
        uint8_t* row = dst + static_cast<size_t>(h - 1 - j) * static_cast<size_t>(w) * 4; // flip
        if (s_planarI420) {
            const uint8_t* urow = U + static_cast<size_t>(cj) * strideC;
            const uint8_t* vrow = V + static_cast<size_t>(cj) * strideC;
            for (int i = 0; i < w; i += 2) {
                const int ci = i >> 1;
                const int u = static_cast<int>(urow[ci]) - 128;
                const int v = static_cast<int>(vrow[ci]) - 128;
                int c0 = static_cast<int>(yrow[i]) - 16;
                if (c0 < 0) c0 = 0;
                write_px(row + static_cast<size_t>(i) * 4, c0, u, v);
                if (i + 1 < w) {
                    int c1 = static_cast<int>(yrow[i + 1]) - 16;
                    if (c1 < 0) c1 = 0;
                    write_px(row + static_cast<size_t>(i + 1) * 4, c1, u, v);
                }
            }
        } else {
            const uint8_t* uvrow = UV + static_cast<size_t>(cj) * strideY;
            for (int i = 0; i < w; i += 2) {
                const size_t uvIdx = static_cast<size_t>(i >> 1) * 2;
                const int u = static_cast<int>(uvrow[uvIdx]) - 128;
                const int v = static_cast<int>(uvrow[uvIdx + 1]) - 128;
                int c0 = static_cast<int>(yrow[i]) - 16;
                if (c0 < 0) c0 = 0;
                write_px(row + static_cast<size_t>(i) * 4, c0, u, v);
                if (i + 1 < w) {
                    int c1 = static_cast<int>(yrow[i + 1]) - 16;
                    if (c1 < 0) c1 = 0;
                    write_px(row + static_cast<size_t>(i + 1) * 4, c1, u, v);
                }
            }
        }
    }
    s_latestW = w;
    s_latestH = h;
    ++s_frameSeq;
}

void read_decoder_output_format() {
    SpecsMediaFormat* of = SpecsMediaCodec_getOutputFormat(s_decoder);
    if (of == nullptr) {
        return;
    }
    int32_t w = 0, h = 0, cf = -1;
    SpecsMediaFormat_getInt32(of, SPECSMEDIAFORMAT_KEY_WIDTH, &w);
    SpecsMediaFormat_getInt32(of, SPECSMEDIAFORMAT_KEY_HEIGHT, &h);
    SpecsMediaFormat_getInt32(of, SPECSMEDIAFORMAT_KEY_COLOR_FORMAT, &cf);
    if (w > 0) s_decW = w;
    if (h > 0) s_decH = h;
    s_colorFormat = cf;
    std::fprintf(stderr, "[DecartNative] decoder OUT format w=%d h=%d colorfmt=%d\n", s_decW, s_decH, s_colorFormat);
    SpecsMediaFormat_delete(of);
}

void ensure_decoder() {
    if (s_decoder != nullptr) {
        return;
    }
    const char* mime = s_useH265 ? "video/hevc" : "video/avc";
    s_decoder = SpecsMediaCodec_createDecoderByType(mime);
    std::fprintf(stderr, "[DecartNative] createDecoderByType(%s) -> %p\n", mime, static_cast<void*>(s_decoder));
    if (s_decoder == nullptr) {
        return;
    }
    SpecsMediaFormat* f = SpecsMediaFormat_new();
    SpecsMediaFormat_setString(f, SPECSMEDIAFORMAT_KEY_MIME, mime);
    SpecsMediaFormat_setInt32(f, SPECSMEDIAFORMAT_KEY_WIDTH, 1280);
    SpecsMediaFormat_setInt32(f, SPECSMEDIAFORMAT_KEY_HEIGHT, 720);
    // flags = 0 → CPU-readable output via getOutputBuffer (no OUTPUT_MEDIA_BUFFER).
    const SpecsMedia_Result cr = SpecsMediaCodec_configure(s_decoder, f, nullptr, 0);
    SpecsMediaFormat_delete(f);
    std::fprintf(stderr, "[DecartNative] decoder configure(%s) -> %d\n", mime, static_cast<int>(cr));
    if (cr != SPECSMEDIA_SUCCESS) {
        SpecsMediaCodec_delete(s_decoder);
        s_decoder = nullptr;
        return;
    }
    SpecsMediaCodec_start(s_decoder);
    std::fprintf(stderr, "[DecartNative] decoder started\n");
}

// Drain all ready decoded frames from the HW decoder, keeping ONLY the newest as
// raw YUV in s_pendingYuv (cheap memcpy) and releasing every buffer immediately so
// the decoder never stalls waiting for a free output buffer. The costly YUV→RGBA
// convert is deferred to convert_pending() (once per worker wake) — NOT run here per
// frame. Caller holds s_decoderMtx.
void drain_output() {
    for (;;) {
        SpecsMediaCodec_bufferInfo info{};
        size_t outIdx = 0;
        const SpecsMedia_Result r = SpecsMediaCodec_dequeueOutputBuffer(s_decoder, 0, &outIdx, &info);
        if (r != SPECSMEDIA_SUCCESS) {
            break; // AGAIN / TIMED_OUT / error → nothing (more) to drain
        }
        if ((info.flags & SPECSMEDIACODEC_BUFFER_FLAG_FORMAT_CHANGED) || s_decW == 0) {
            read_decoder_output_format();
        }
        size_t outSize = 0;
        uint8_t* out = SpecsMediaCodec_getOutputBuffer(s_decoder, outIdx, &outSize);
        if (out != nullptr && outSize > 0 && s_decW > 0 && s_decH > 0) {
            if (s_pendingYuv.size() != outSize) {
                s_pendingYuv.resize(outSize);
            }
            std::memcpy(s_pendingYuv.data(), out, outSize);
            s_pendingW = s_decW;
            s_pendingH = s_decH;
            s_pendingValid = true; // a newer frame overwrites the older — we only paint the newest
            s_cntDecoded.fetch_add(1, std::memory_order_relaxed);
        }
        SpecsMediaCodec_releaseOutputBuffer(s_decoder, outIdx);
    }
}

// Convert the newest decoded frame (if any) to displayable RGBA — the single
// expensive per-wake operation. Caller holds s_decoderMtx.
void convert_pending() {
    if (s_pendingValid && s_pendingW > 0 && s_pendingH > 0) {
        convert_yuv420_to_rgba(s_pendingYuv.data(), s_pendingYuv.size(), s_pendingW, s_pendingH);
        s_pendingValid = false;
        s_cntConverted.fetch_add(1, std::memory_order_relaxed);
    }
}

// Emit one diagnostic counter line if ≥1s has elapsed since the last (called from
// the decode worker). Reading each line: rx is Decart's arrival rate; dec≈rx means
// the network + decoder keep up; conv<dec is EXPECTED (we convert newest-only); pub
// ≈ conv is the displayed fps. Trouble signatures: ovfDrop>0 or maxBatch growing →
// convert/decoder falling behind (the old collapse); feedDrop>0 → decoder input
// starvation; rx itself decaying → Decart/Wi-Fi downlink loss; kf climbing → keyframe
// churn. All counters reset each interval.
void flush_stats() {
    const int64_t now = steady_now_ms();
    int64_t last = s_statLastMs.load(std::memory_order_relaxed);
    if (last == 0) {
        s_statLastMs.store(now, std::memory_order_relaxed);
        return;
    }
    const int64_t dt = now - last;
    if (dt < 1000) {
        return;
    }
    if (!s_statLastMs.compare_exchange_strong(last, now, std::memory_order_relaxed)) {
        return; // another flush won the race
    }
    const uint32_t rx = s_cntRx.exchange(0, std::memory_order_relaxed);
    const uint32_t ovf = s_cntOvfDrop.exchange(0, std::memory_order_relaxed);
    const uint32_t fed = s_cntFed.exchange(0, std::memory_order_relaxed);
    const uint32_t feedDrop = s_cntFeedDrop.exchange(0, std::memory_order_relaxed);
    const uint32_t dec = s_cntDecoded.exchange(0, std::memory_order_relaxed);
    const uint32_t conv = s_cntConverted.exchange(0, std::memory_order_relaxed);
    const uint32_t pub = s_cntPublished.exchange(0, std::memory_order_relaxed);
    const uint32_t kf = s_cntKf.exchange(0, std::memory_order_relaxed);
    const uint32_t maxB = s_maxBatch.exchange(0, std::memory_order_relaxed);
    std::fprintf(
        stderr,
        "[DecartNative] stat/%.2fs: rx=%u ovfDrop=%u fed=%u feedDrop=%u dec=%u conv=%u pub=%u kf=%u maxBatch=%u\n",
        static_cast<double>(dt) / 1000.0, rx, ovf, fed, feedDrop, dec, conv, pub, kf, maxB);
}

// Feed one inbound Annex-B access unit to the HW decoder. Caller holds s_decoderMtx.
// Does NOT convert — drain_output() keeps the newest decoded YUV, and the worker
// converts once after the whole backlog is fed (see decode_worker).
void feed_frame(const uint8_t* annexb, size_t size, int is_keyframe) {
    if (s_decoder == nullptr || annexb == nullptr || size == 0) {
        return;
    }

    // Free the decoder first so an input buffer is available.
    drain_output();

    // Feed this frame — NEVER silently drop it. H.264 needs every access unit in order;
    // skipping one causes a frame-num gap → corruption regardless of the network. Retry,
    // draining output between attempts to free input buffers.
    size_t inIdx = 0;
    SpecsMedia_Result dq = SPECSMEDIA_ERROR_AGAIN;
    for (int attempt = 0; attempt < 25; ++attempt) {
        dq = SpecsMediaCodec_dequeueInputBuffer(s_decoder, 20000, &inIdx); // 20ms
        if (dq == SPECSMEDIA_SUCCESS) {
            break;
        }
        drain_output(); // freeing output lets the decoder accept input
    }
    if (dq == SPECSMEDIA_SUCCESS) {
        size_t cap = 0;
        uint8_t* in = SpecsMediaCodec_getInputBuffer(s_decoder, inIdx, &cap);
        if (in != nullptr && cap >= size) {
            std::memcpy(in, annexb, size);
            const uint32_t flags = is_keyframe ? SPECSMEDIACODEC_BUFFER_FLAG_KEY_FRAME : 0u;
            SpecsMediaCodec_queueInputBuffer(s_decoder, inIdx, 0, size, 0, 0, flags);
            s_cntFed.fetch_add(1, std::memory_order_relaxed);
        } else {
            static int s_capWarn = 0;
            if ((s_capWarn++ % 30) == 0) {
                std::fprintf(stderr, "[DecartNative] INPUT BUFFER too small cap=%zu size=%zu → DROP (gap)\n", cap, size);
            }
            s_cntFeedDrop.fetch_add(1, std::memory_order_relaxed);
            maybe_request_keyframe(1000);
        }
    } else {
        static int s_dropWarn = 0;
        if ((s_dropWarn++ % 15) == 0) {
            std::fprintf(stderr, "[DecartNative] no input buffer after retries → DROPPED frame (gap)\n");
        }
        s_cntFeedDrop.fetch_add(1, std::memory_order_relaxed);
        maybe_request_keyframe(1000);
    }

    drain_output();
}

void teardown_decoder() {
    std::lock_guard<std::mutex> lock(s_decoderMtx);
    if (s_decoder != nullptr) {
        SpecsMediaCodec_stop(s_decoder);
        SpecsMediaCodec_delete(s_decoder);
        s_decoder = nullptr;
    }
    s_decW = 0;
    s_decH = 0;
    s_colorFormat = -1;
    s_pendingValid = false;
    s_pendingW = 0;
    s_pendingH = 0;
    s_pendingYuv.clear();
}

// ── libSpecsWebRTC callbacks (fire on worker threads) ────────────────────────
void start_video() {
    if (s_streaming.exchange(true)) {
        return;
    }
    s_state = 6; // streaming
    s_camera.start(
        [](int fmt, const uint8_t* data, size_t size, uint32_t w, uint32_t h, uint64_t pts) {
            if (s_session != nullptr) {
                swrtc_send_video_raw(s_session, static_cast<swrtc_pixel_format>(fmt), data, size, w, h, pts);
            }
        },
        s_cameraMaxWidth);
}

void on_state_cb(swrtc_session*, swrtc_state state, void*) {
    s_state = static_cast<int>(state);
    if (state == SWRTC_STATE_CONNECTED) {
        start_video();
    }
}

void on_local_description_cb(swrtc_session*, swrtc_sdp_type type, const char* sdp, void*) {
    SigMsg m;
    m.kind = (type == SWRTC_SDP_OFFER) ? 1 : 2;
    m.sdp = (sdp != nullptr) ? sdp : "";
    std::lock_guard<std::mutex> lock(s_sigMtx);
    s_sigOut.push_back(std::move(m));
}

void on_local_candidate_cb(swrtc_session*, const char* candidate, const char* mid, void*) {
    SigMsg m;
    m.kind = 3;
    m.candidate = (candidate != nullptr) ? candidate : "";
    m.mid = (mid != nullptr) ? mid : "";
    std::lock_guard<std::mutex> lock(s_sigMtx);
    s_sigOut.push_back(std::move(m));
}

// Runs on the decode worker thread: drain the ENTIRE inbound backlog into the HW
// decoder back-to-back, then convert only the newest decoded frame ONCE. Under
// backlog this collapses N expensive converts into 1 (JS paints only the newest
// frame anyway), so the single-threaded convert can never become the throughput
// ceiling that starved the pipeline into a stale slideshow after a few seconds.
void decode_worker() {
    std::deque<std::vector<uint8_t>> batch;
    std::deque<int> batchKey;
    while (s_decodeRun.load()) {
        {
            std::unique_lock<std::mutex> lk(s_inMtx);
            s_inCv.wait(lk, [] { return !s_inQueue.empty() || !s_decodeRun.load(); });
            if (!s_decodeRun.load()) {
                break;
            }
            batch.swap(s_inQueue); // take the whole backlog in one shot
            batchKey.swap(s_inKey);
        }
        // Track the largest single-wake backlog: >1 sustained means the worker is
        // running behind Decart's arrival rate.
        const uint32_t bsz = static_cast<uint32_t>(batch.size());
        uint32_t prevMax = s_maxBatch.load(std::memory_order_relaxed);
        while (bsz > prevMax && !s_maxBatch.compare_exchange_weak(prevMax, bsz, std::memory_order_relaxed)) {
        }
        std::lock_guard<std::mutex> lock(s_decoderMtx);
        ensure_decoder();
        if (s_decoder == nullptr) {
            batch.clear();
            batchKey.clear();
            continue;
        }
        while (!batch.empty()) {
            feed_frame(batch.front().data(), batch.front().size(), batchKey.front());
            batch.pop_front();
            batchKey.pop_front();
        }
        convert_pending(); // one YUV→RGBA for the newest decoded frame, per wake
        flush_stats();     // emit the once/sec diagnostic line
    }
}

// WebRTC receive thread: enqueue only (fast) so packet reception never blocks.
void on_video_frame_cb(swrtc_session*, const uint8_t* annexb, size_t size, uint64_t /*pts*/, int is_keyframe, void*) {
    static int s_rxCount = 0;
    if ((s_rxCount++ % 30) == 0) {
        std::fprintf(stderr, "[DecartNative] rx video frame #%d size=%zu key=%d\n", s_rxCount, size, is_keyframe);
    }
    if (annexb == nullptr || size == 0) {
        return;
    }
    s_cntRx.fetch_add(1, std::memory_order_relaxed);
    {
        std::lock_guard<std::mutex> lk(s_inMtx);
        if (s_inQueue.size() > 45) {
            // ~1.5s ceiling. The worker drains the whole queue each wake, so this only
            // fills if HW decode itself can't keep up; drop the backlog + resync via a
            // (rate-limited) keyframe to bound latency instead of drifting into a slideshow.
            s_cntOvfDrop.fetch_add(static_cast<uint32_t>(s_inQueue.size()), std::memory_order_relaxed);
            s_inQueue.clear();
            s_inKey.clear();
            maybe_request_keyframe(1000);
        }
        s_inQueue.emplace_back(annexb, annexb + size);
        s_inKey.push_back(is_keyframe);
    }
    s_inCv.notify_one();
}

// ── JS object property helper ────────────────────────────────────────────────
bool set_str_prop(CoreJsAbiRuntime* rt, CoreJsAbiObject* obj, const char* key, const std::string& val) {
    CoreJsAbiStringOrError s = rt->vt->create_string_from_utf8(rt, val.c_str(), val.size());
    if (s.is_error) {
        return false;
    }
    CoreJsAbiValue v{.kind = CoreJsAbiValueKindString, .data = {.pointer = s.ptr_or_error.ptr}};
    // set_object_property_from_string takes ownership of the string value.
    return !rt->vt->set_object_property_from_string(rt, obj, key, std::strlen(key), &v).is_error;
}

// ════════════════════════════ exported host functions ════════════════════════

CoreJsAbiValueOrError ping_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    return num(1.0);
}

// startSession(useH265, fps, bitrateKbps, cameraMaxWidth) -> swrtc_result (0 ok)
CoreJsAbiValueOrError start_session_impl(CoreJsAbiRuntime*,
                                         const CoreJsAbiValue*,
                                         const CoreJsAbiValue* args,
                                         size_t argc) {
    s_useH265 = arg_num(args, argc, 0, 1.0) != 0.0;
    s_fps = static_cast<uint32_t>(arg_num(args, argc, 1, 30.0));
    s_bitrateKbps = static_cast<uint32_t>(arg_num(args, argc, 2, 6000.0));
    s_cameraMaxWidth = static_cast<int>(arg_num(args, argc, 3, 1280.0));

    {
        std::lock_guard<std::mutex> lock(s_sigMtx);
        s_sigOut.clear();
    }
    {
        std::lock_guard<std::mutex> lock(s_frameMtx);
        s_frameSeq = 0;
        s_polledSeq = 0;
    }
    // Reset diagnostic counters so each session's per-second stats start clean.
    s_cntRx.store(0, std::memory_order_relaxed);
    s_cntOvfDrop.store(0, std::memory_order_relaxed);
    s_cntFed.store(0, std::memory_order_relaxed);
    s_cntFeedDrop.store(0, std::memory_order_relaxed);
    s_cntDecoded.store(0, std::memory_order_relaxed);
    s_cntConverted.store(0, std::memory_order_relaxed);
    s_cntPublished.store(0, std::memory_order_relaxed);
    s_cntKf.store(0, std::memory_order_relaxed);
    s_maxBatch.store(0, std::memory_order_relaxed);
    s_statLastMs.store(0, std::memory_order_relaxed);

    // Start the decode worker (off the WebRTC receive thread).
    if (!s_decodeRun.exchange(true)) {
        s_decodeThread = std::thread(decode_worker);
    }

    swrtc_config cfg;
    swrtc_config_default(&cfg);
    cfg.role = SWRTC_ROLE_OFFERER;
    cfg.signaling_mode = SWRTC_SIGNALING_MANUAL;
    cfg.video_codec = s_useH265 ? SWRTC_VIDEO_H265 : SWRTC_VIDEO_H264;
    cfg.video_fps = s_fps;
    cfg.video_bitrate_kbps = s_bitrateKbps;
    cfg.audio_codec = SWRTC_AUDIO_NONE;
    cfg.lan_only = 0; // Decart is reached over the public internet
    cfg.video_duplex = 1; // send camera up AND receive Decart's transformed track on one PC
    static const char* const kIceServers[] = {"stun:stun.l.google.com:19302"};
    cfg.ice_servers = kIceServers;
    cfg.ice_server_count = 1;

    swrtc_callbacks cb{};
    cb.on_state = on_state_cb;
    cb.on_local_description = on_local_description_cb;
    cb.on_local_candidate = on_local_candidate_cb;
    cb.on_video_frame = on_video_frame_cb;

    const swrtc_result r = swrtc_session_create(&cfg, &cb, &s_session);
    if (r != SWRTC_OK) {
        s_state = static_cast<int>(SWRTC_STATE_FAILED);
        return num(static_cast<double>(r));
    }
    s_state = static_cast<int>(SWRTC_STATE_CONNECTING);
    const swrtc_result ro = swrtc_create_offer(s_session);
    return num(static_cast<double>(ro));
}

// stopSession() -> 1
CoreJsAbiValueOrError stop_session_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    s_camera.stop();
    s_streaming.store(false);
    // Stop the decode worker FIRST, then destroy the session. The worker (feed_frame →
    // maybe_request_keyframe) and the decoder teardown both touch state the session's
    // callbacks race with; joining the worker before swrtc_session_destroy closes that
    // use-after-free window. (Also required for single-threaded decoder access below.)
    if (s_decodeRun.exchange(false)) {
        s_inCv.notify_all();
        if (s_decodeThread.joinable()) {
            s_decodeThread.join();
        }
    }
    if (s_session != nullptr) {
        swrtc_session_destroy(s_session); // JS thread — never call from a callback
        s_session = nullptr;
    }
    {
        std::lock_guard<std::mutex> lk(s_inMtx);
        s_inQueue.clear();
        s_inKey.clear();
    }
    teardown_decoder();
    {
        std::lock_guard<std::mutex> lock(s_sigMtx);
        s_sigOut.clear();
    }
    {
        std::lock_guard<std::mutex> lock(s_frameMtx);
        s_frameSeq = 0;
        s_polledSeq = 0;
    }
    s_state = static_cast<int>(SWRTC_STATE_CLOSED);
    return num(1.0);
}

// setRemoteAnswer(sdp) -> swrtc_result
CoreJsAbiValueOrError set_remote_answer_impl(CoreJsAbiRuntime* rt,
                                             const CoreJsAbiValue*,
                                             const CoreJsAbiValue* args,
                                             size_t argc) {
    if (s_session == nullptr) {
        return num(static_cast<double>(SWRTC_ERR_INVALID_STATE));
    }
    std::string sdp;
    if (argc < 1 || !read_string_arg(rt, args[0], sdp) || sdp.empty()) {
        return num(static_cast<double>(SWRTC_ERR_INVALID_ARG));
    }
    return num(static_cast<double>(swrtc_set_remote_description(s_session, SWRTC_SDP_ANSWER, sdp.c_str())));
}

// addRemoteCandidate(candidate, mid) -> swrtc_result
CoreJsAbiValueOrError add_remote_candidate_impl(CoreJsAbiRuntime* rt,
                                                const CoreJsAbiValue*,
                                                const CoreJsAbiValue* args,
                                                size_t argc) {
    if (s_session == nullptr) {
        return num(static_cast<double>(SWRTC_ERR_INVALID_STATE));
    }
    std::string candidate, mid;
    if (argc < 1 || !read_string_arg(rt, args[0], candidate)) {
        return num(static_cast<double>(SWRTC_ERR_INVALID_ARG));
    }
    if (argc >= 2) {
        read_string_arg(rt, args[1], mid);
    }
    return num(static_cast<double>(swrtc_add_remote_candidate(s_session, candidate.c_str(), mid.c_str())));
}

// getSignalingOut() -> { kind: "offer"|"answer"|"cand"|"none", sdp?, candidate?, mid? }
CoreJsAbiValueOrError get_signaling_out_impl(CoreJsAbiRuntime* rt,
                                             const CoreJsAbiValue*,
                                             const CoreJsAbiValue*,
                                             size_t) {
    SigMsg m;
    bool have = false;
    {
        std::lock_guard<std::mutex> lock(s_sigMtx);
        if (!s_sigOut.empty()) {
            m = std::move(s_sigOut.front());
            s_sigOut.pop_front();
            have = true;
        }
    }

    CoreJsAbiObjectOrError objOrErr = rt->vt->create_object(rt);
    if (objOrErr.is_error) {
        std::string_view e = "getSignalingOut: create_object failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }
    CoreJsAbiManagedPointer* objPtr = objOrErr.ptr_or_error.ptr;
    CoreJsAbiObject obj{.pointer = objPtr};

    const char* kind = "none";
    if (have && m.kind == 1) kind = "offer";
    else if (have && m.kind == 2) kind = "answer";
    else if (have && m.kind == 3) kind = "cand";

    set_str_prop(rt, &obj, "kind", kind);
    if (have && (m.kind == 1 || m.kind == 2)) {
        set_str_prop(rt, &obj, "sdp", m.sdp);
    } else if (have && m.kind == 3) {
        set_str_prop(rt, &obj, "candidate", m.candidate);
        set_str_prop(rt, &obj, "mid", m.mid);
    }
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindObject, .data = {.pointer = objPtr}}};
}

// getState() -> int (swrtc_state; 6 = streaming)
CoreJsAbiValueOrError get_state_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    return num(static_cast<double>(s_state));
}

// requestKeyframe() -> 1. Sends an RTCP PLI to Decart so it emits a fresh IDR; the HW
// decoder re-syncs, clearing packet-loss corruption instead of smearing indefinitely.
CoreJsAbiValueOrError request_keyframe_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    maybe_request_keyframe(700); // gated so the TS cadence can't stack into an IDR storm
    return num(1.0);
}

// requestDownlinkKbps(kbps) -> 1. Sends REMB asking Decart to cap its DOWNLINK bitrate.
// Fewer/smaller packets → less Wi-Fi packet loss → less corruption (at the cost of a
// softer image). This is a receiver→sender request; Decart must honor REMB.
CoreJsAbiValueOrError request_downlink_kbps_impl(CoreJsAbiRuntime*,
                                                 const CoreJsAbiValue*,
                                                 const CoreJsAbiValue*,
                                                 size_t) {
    // No-op. This USED to call swrtc_set_video_bitrate(), but that sets the LOCAL
    // ENCODER (uplink / camera) bitrate — it does NOT cap Decart's downlink, and this
    // engine exposes no REMB / receiver-side bitrate control to honor. Calling it only
    // churned the uplink encoder every couple of seconds. Kept as an export so the TS
    // ABI is unchanged; uplink bitrate is set once in startSession().
    return num(1.0);
}

// ── Frame delivery (getFrameRGBA) ─────────────────────────────────────────────
constexpr int kFrameWidth = 256;
constexpr int kFrameHeight = 256;
uint64_t s_frameAnimTick = 0;

void fill_animated_gradient_rgba(uint8_t* out, int w, int h, uint64_t tick) {
    const double phase = 0.02 * static_cast<double>(tick);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            const size_t i = (static_cast<size_t>(y) * static_cast<size_t>(w) + static_cast<size_t>(x)) * 4;
            const double u = (static_cast<double>(x) + 0.5) / static_cast<double>(w);
            const double v = (static_cast<double>(y) + 0.5) / static_cast<double>(h);
            out[i + 0] = static_cast<uint8_t>(255.0 * (0.5 + 0.5 * std::sin(u * 6.28318530718 + phase)));
            out[i + 1] = static_cast<uint8_t>(255.0 * (0.5 + 0.5 * std::sin(v * 6.28318530718 + phase * 1.3)));
            out[i + 2] = static_cast<uint8_t>(255.0 * (0.5 + 0.5 * std::sin((u + v) * 6.28318530718 + phase * 0.7)));
            out[i + 3] = 255;
        }
    }
}

void release_pixel_buffer(CoreJsAbiMutableBuffer* self) {
    delete[] static_cast<uint8_t*>(self->data);
    delete self;
}
static constexpr CoreJsAbiMutableBufferVTable kPixelBufferVtable{.release = release_pixel_buffer};

/// getFrameRGBA() -> { buffer, width, height }. Latest decoded frame if the WebRTC
/// return track has produced one, else a live gradient (device-path-alive signal).
CoreJsAbiValueOrError get_frame_rgba_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    int w = 0;
    int h = 0;
    uint8_t* pixels = nullptr;
    bool gradient = false;

    {
        std::lock_guard<std::mutex> lock(s_frameMtx);
        if (s_frameSeq != 0 && s_frameSeq != s_polledSeq && !s_latestRgba.empty()) {
            s_polledSeq = s_frameSeq; // new decoded frame — hand it over exactly once
            w = s_latestW;
            h = s_latestH;
            const size_t nbytes = static_cast<size_t>(w) * static_cast<size_t>(h) * 4;
            pixels = new (std::nothrow) uint8_t[nbytes];
            if (pixels != nullptr && nbytes <= s_latestRgba.size()) {
                std::memcpy(pixels, s_latestRgba.data(), nbytes);
            }
        } else if (s_frameSeq == 0) {
            gradient = true; // no decoded frame yet — show the "alive" gradient
        }
        // else: frame unchanged since last poll → w stays 0 → JS skips the upload
    }

    if (gradient) {
        w = kFrameWidth;
        h = kFrameHeight;
        pixels = new (std::nothrow) uint8_t[static_cast<size_t>(w) * static_cast<size_t>(h) * 4];
        if (pixels != nullptr) {
            ++s_frameAnimTick;
            fill_animated_gradient_rgba(pixels, w, h, s_frameAnimTick);
        }
    }

    if (pixels == nullptr) {
        // No new frame (skip) — return a tiny width=0 frame so JS does no upload work.
        w = 0;
        h = 0;
        pixels = new (std::nothrow) uint8_t[4];
        if (pixels == nullptr) {
            std::string_view e = "getFrameRGBA: pixel allocation failed";
            rt->vt->set_string_error_value(rt, e.data(), e.size());
            return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
        }
    }

    const size_t bufBytes = (w > 0 && h > 0) ? static_cast<size_t>(w) * static_cast<size_t>(h) * 4 : 4;
    auto* mutableBuf = new (std::nothrow) CoreJsAbiMutableBuffer{&kPixelBufferVtable, pixels, bufBytes};
    if (mutableBuf == nullptr) {
        delete[] pixels;
        std::string_view e = "getFrameRGBA: buffer handle allocation failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }

    CoreJsAbiArrayBufferOrError abOrErr = rt->vt->create_arraybuffer_from_external_data(rt, mutableBuf);
    if (abOrErr.is_error) {
        mutableBuf->vtable->release(mutableBuf);
        std::string_view e = "getFrameRGBA: create_arraybuffer failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }
    CoreJsAbiManagedPointer* abPtr = abOrErr.ptr_or_error.ptr;

    CoreJsAbiObjectOrError objOrErr = rt->vt->create_object(rt);
    if (objOrErr.is_error) {
        release_managed_pointer(abPtr);
        std::string_view e = "getFrameRGBA: create_object failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }
    CoreJsAbiManagedPointer* objPtr = objOrErr.ptr_or_error.ptr;
    CoreJsAbiObject frameObj{.pointer = objPtr};

    CoreJsAbiValue widthVal{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(w)}};
    if (rt->vt->set_object_property_from_string(rt, &frameObj, "width", 5, &widthVal).is_error) {
        release_managed_pointer(objPtr);
        release_managed_pointer(abPtr);
        std::string_view e = "getFrameRGBA: set width failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }
    CoreJsAbiValue heightVal{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(h)}};
    if (rt->vt->set_object_property_from_string(rt, &frameObj, "height", 6, &heightVal).is_error) {
        release_managed_pointer(objPtr);
        release_managed_pointer(abPtr);
        std::string_view e = "getFrameRGBA: set height failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }
    CoreJsAbiValue bufferVal{.kind = CoreJsAbiValueKindObject, .data = {.pointer = abPtr}};
    if (rt->vt->set_object_property_from_string(rt, &frameObj, "buffer", 6, &bufferVal).is_error) {
        release_managed_pointer(objPtr);
        release_managed_pointer(abPtr);
        std::string_view e = "getFrameRGBA: set buffer failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }

    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindObject, .data = {.pointer = objPtr}}};
}

// ── Export registration ───────────────────────────────────────────────────────
// pullFrameInto(buffer) -> { width, height }. Copies the latest decoded RGBA into the
// caller's PERSISTENT ArrayBuffer (zero per-frame allocation). width=0 means "no new
// frame since last poll" so JS does no upload work.
CoreJsAbiValueOrError pull_frame_into_impl(CoreJsAbiRuntime* rt,
                                           const CoreJsAbiValue*,
                                           const CoreJsAbiValue* args,
                                           size_t argc) {
    int w = 0;
    int h = 0;
    if (argc >= 1 && args[0].kind == CoreJsAbiValueKindObject && args[0].data.pointer != nullptr) {
        CoreJsAbiArrayBuffer ab{args[0].data.pointer};
        CoreJsAbiUint8SpanOrError sp = rt->vt->get_arraybuffer_span(rt, &ab);
        if (!sp.is_error && sp.span_or_error.span.data != nullptr) {
            uint8_t* dst = sp.span_or_error.span.data;
            const size_t cap = sp.span_or_error.span.length;
            std::lock_guard<std::mutex> lock(s_frameMtx);
            if (s_frameSeq != 0 && s_frameSeq != s_polledSeq && !s_latestRgba.empty()) {
                const size_t n = static_cast<size_t>(s_latestW) * static_cast<size_t>(s_latestH) * 4;
                if (n <= cap && n <= s_latestRgba.size()) {
                    s_polledSeq = s_frameSeq;
                    std::memcpy(dst, s_latestRgba.data(), n);
                    w = s_latestW;
                    h = s_latestH;
                    s_cntPublished.fetch_add(1, std::memory_order_relaxed);
                }
            }
        }
    }

    CoreJsAbiObjectOrError objOrErr = rt->vt->create_object(rt);
    if (objOrErr.is_error) {
        std::string_view e = "pullFrameInto: create_object failed";
        rt->vt->set_string_error_value(rt, e.data(), e.size());
        return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
    }
    CoreJsAbiManagedPointer* objPtr = objOrErr.ptr_or_error.ptr;
    CoreJsAbiObject o{.pointer = objPtr};
    CoreJsAbiValue wv{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(w)}};
    rt->vt->set_object_property_from_string(rt, &o, "width", 5, &wv);
    CoreJsAbiValue hv{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(h)}};
    rt->vt->set_object_property_from_string(rt, &o, "height", 6, &hv);
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindObject, .data = {.pointer = objPtr}}};
}

bool register_export(CoreJsAbiRuntime* runtime,
                     CoreJsAbiObject* moduleObject,
                     std::string_view propName,
                     HostFunction fn) {
    auto wrappedFunction = std::make_unique<HostFunctionWrapper>(std::move(fn));
    CoreJsAbiFunctionOrError functionOrError =
        runtime->vt->create_function_from_host_function(runtime, wrappedFunction.get());
    if (functionOrError.is_error) {
        std::string_view e = "Failed creating native export function";
        runtime->vt->set_string_error_value(runtime, e.data(), e.size());
        return false;
    }
    wrappedFunction.release();
    CoreJsAbiManagedPointer* functionPtr = functionOrError.ptr_or_error.ptr;
    CoreJsAbiValue functionAsAbiValue{.kind = CoreJsAbiValueKindObject, .data = {.pointer = functionPtr}};
    if (runtime->vt
            ->set_object_property_from_string(
                runtime, moduleObject, propName.data(), propName.size(), &functionAsAbiValue)
            .is_error) {
        release_managed_pointer(functionPtr);
        std::string_view e = "Failed setting native export on module object";
        runtime->vt->set_string_error_value(runtime, e.data(), e.size());
        return false;
    }
    return true;
}

} // namespace

void assignNativeFunctions(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject) {
    if (!register_export(runtime, moduleObject, "ping", ping_impl)) return;
    if (!register_export(runtime, moduleObject, "startSession", start_session_impl)) return;
    if (!register_export(runtime, moduleObject, "stopSession", stop_session_impl)) return;
    if (!register_export(runtime, moduleObject, "setRemoteAnswer", set_remote_answer_impl)) return;
    if (!register_export(runtime, moduleObject, "addRemoteCandidate", add_remote_candidate_impl)) return;
    if (!register_export(runtime, moduleObject, "getSignalingOut", get_signaling_out_impl)) return;
    if (!register_export(runtime, moduleObject, "getState", get_state_impl)) return;
    if (!register_export(runtime, moduleObject, "requestKeyframe", request_keyframe_impl)) return;
    if (!register_export(runtime, moduleObject, "requestDownlinkKbps", request_downlink_kbps_impl)) return;
    if (!register_export(runtime, moduleObject, "getFrameRGBA", get_frame_rgba_impl)) return;
    if (!register_export(runtime, moduleObject, "pullFrameInto", pull_frame_into_impl)) return;
}
} // namespace usercode

extern "C" {
void CoreJsOnLoad(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject, void**) {
    usercode::assignNativeFunctions(runtime, moduleObject);
}
void CoreJsOnUnload(CoreJsAbiRuntime*, void*) {}
}
