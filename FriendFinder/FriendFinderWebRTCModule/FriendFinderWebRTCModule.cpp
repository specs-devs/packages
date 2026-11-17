//
// FriendFinderWebRTCModule — real WebRTC media path for the FriendFinder video call.
//
// Bridges the Lens (TypeScript) to libSpecsWebRTC (H.264 hardware encode +
// Opus over RTP/SRTP via libdatachannel). Two independent sessions, both
// with the Glasses as OFFERER and MANUAL signaling (JS ferries SDP/ICE over
// the Supabase Realtime channel):
//
//   kind 0 "pov"   : SEND — Glasses OFFERS: camera video (H.264) + mic (Opus mono)
//   kind 1 "voice" : RECV — the PHONE offers its mic track; Glasses ANSWERS and
//                    gets friend voice as decoded PCM handed to JS.
//
// (Receive-only peers must be answerers in this engine: inbound tracks are
// created from the remote offer's m-lines via the track callback.)
//
// Camera capture reuses FriendFinderStreamModule's CameraCapture (single camera
// client rule still applies: never run this while the JPEG path or a JS
// CameraModule request is active). The camera starts only when the pov
// session reaches CONNECTED and stops on teardown, so a failed negotiation
// never holds the camera hostage.
//
// Threading: CoreJs entry points are serialized on the JS thread; the
// library fires callbacks on its worker threads. Callbacks only push into
// mutex-guarded queues (signaling msgs, decoded PCM) that JS drains by
// polling once per frame. swrtc_session_destroy is only ever called from
// the JS thread (never from a callback), per the library contract.
//
#include "FriendFinderWebRTCModule.hpp"
#include "HostFunctionWrapper.hpp"
#include "SpeakerPlayback.hpp"
#include "../FriendFinderStreamModule/CameraCapture.hpp"
#include "MicCapture.hpp"
#include "AudioFocusSession.hpp"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <memory>
#include <mutex>
#include <new>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

#include <arpa/inet.h>
#include <cerrno>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include "specs_webrtc.h"  // reusable WebRTC media engine (libSpecsWebRTC.so), C ABI

#include "SpecsMedia.h"        // inbound friend-camera HW decode (H.264 → YUV)
#include "SpecsMediaCodec.h"
#include "SpecsMediaFormat.h"

namespace usercode {
namespace {

// ── ABI value helpers ───────────────────────────────────────────────────────

int as_int(const CoreJsAbiValue& v) {
    return v.kind == CoreJsAbiValueKindNumber ? static_cast<int>(v.data.number) : 0;
}

CoreJsAbiValue number(double n) {
    return CoreJsAbiValue{.kind = CoreJsAbiValueKindNumber, .data = {.number = n}};
}

CoreJsAbiValue undefined() {
    return CoreJsAbiValue{.kind = CoreJsAbiValueKindUndefined, .data = {}};
}

// Read a JS string argument into a std::string (UTF-8). Wraps a std::string
// in a CoreJsAbiGrowableBuffer so the runtime writes straight into it.
struct GrowableString {
    CoreJsAbiGrowableBuffer buf;  // MUST be first (we recover `this` from buf*)
    std::string s;

    static void tryGrowTo(CoreJsAbiGrowableBuffer* b, size_t sz) {
        auto* self = reinterpret_cast<GrowableString*>(b);
        if (sz <= self->s.size()) return;
        self->s.resize(sz);
        b->data = reinterpret_cast<uint8_t*>(self->s.data());
        b->capacity = self->s.size();
    }
    static constexpr CoreJsAbiGrowableBufferVTable kVTable{.try_grow_to = tryGrowTo};

    GrowableString() : buf{&kVTable, nullptr, 0, 0} {}
};

std::string as_string(CoreJsAbiRuntime* rt, const CoreJsAbiValue& v) {
    if (v.kind != CoreJsAbiValueKindString || v.data.pointer == nullptr) return {};
    CoreJsAbiString str{v.data.pointer};
    GrowableString g;
    rt->vt->get_utf8_from_string(rt, &str, &g.buf);
    g.s.resize(g.buf.used);
    return std::move(g.s);
}

CoreJsAbiValueOrError string_result(CoreJsAbiRuntime* rt, const std::string& s) {
    CoreJsAbiStringOrError out = rt->vt->create_string_from_utf8(rt, s.data(), s.size());
    if (out.is_error) return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError, .data = {}}};
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindString,
                           .data = {.pointer = out.ptr_or_error.ptr}}};
}

// ── base64 ──────────────────────────────────────────────────────────────────

void base64Encode(const uint8_t* data, size_t len, std::string& out) {
    static const char kAlphabet[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    out.clear();
    out.reserve(((len + 2) / 3) * 4);
    size_t i = 0;
    for (; i + 3 <= len; i += 3) {
        const uint32_t v = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        out.push_back(kAlphabet[(v >> 18) & 63]);
        out.push_back(kAlphabet[(v >> 12) & 63]);
        out.push_back(kAlphabet[(v >> 6) & 63]);
        out.push_back(kAlphabet[v & 63]);
    }
    if (i + 1 == len) {
        const uint32_t v = data[i] << 16;
        out.push_back(kAlphabet[(v >> 18) & 63]);
        out.push_back(kAlphabet[(v >> 12) & 63]);
        out.push_back('=');
        out.push_back('=');
    } else if (i + 2 == len) {
        const uint32_t v = (data[i] << 16) | (data[i + 1] << 8);
        out.push_back(kAlphabet[(v >> 18) & 63]);
        out.push_back(kAlphabet[(v >> 12) & 63]);
        out.push_back(kAlphabet[(v >> 6) & 63]);
        out.push_back('=');
    }
}

bool base64Decode(const std::string& in, std::vector<uint8_t>& out) {
    static int8_t table[256];
    static bool init = false;
    if (!init) {
        std::memset(table, -1, sizeof(table));
        const char* alpha =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (int i = 0; i < 64; ++i) table[static_cast<uint8_t>(alpha[i])] = static_cast<int8_t>(i);
        init = true;
    }
    out.clear();
    out.reserve((in.size() / 4) * 3);
    uint32_t acc = 0;
    int bits = 0;
    for (char c : in) {
        if (c == '=' || c == '\n' || c == '\r') continue;
        const int8_t v = table[static_cast<uint8_t>(c)];
        if (v < 0) return false;
        acc = (acc << 6) | static_cast<uint32_t>(v);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push_back(static_cast<uint8_t>((acc >> bits) & 0xFF));
        }
    }
    return true;
}

// Minimal JSON string escaper (SDP carries \r\n).
void jsonEscape(const std::string& in, std::string& out) {
    for (char c : in) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<uint8_t>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out.push_back(c);
                }
        }
    }
}

// ── Session state ───────────────────────────────────────────────────────────

constexpr int kKindPov = 0;        // send: camera H.264 + mic Opus
constexpr int kKindVoice = 1;      // recv: friend voice Opus -> PCM
constexpr int kKindFriendVid = 2;  // recv: friend phone camera H.264 -> RGBA texture
constexpr int kNumKinds = 3;

struct SessionSlot {
    swrtc_session* session = nullptr;
    int kind = 0;

    // Signaling messages (worker threads -> JS poll). Already JSON-encoded.
    std::mutex sigMutex;
    std::deque<std::string> sigQueue;

    // Decoded inbound PCM, mono S16 (voice session only).
    std::mutex pcmMutex;
    std::vector<int16_t> pcmQueue;
    uint32_t pcmRate = 48000;

    std::atomic<int> state{-1};

    void pushSignal(std::string msg) {
        std::lock_guard<std::mutex> lk(sigMutex);
        if (sigQueue.size() >= 256) sigQueue.pop_front();  // paranoia bound
        sigQueue.push_back(std::move(msg));
    }
};

SessionSlot g_slots[kNumKinds];

// Camera (pov session video source). Guarded by g_cameraMutex because the
// state callback (worker thread) starts it and JS stops it.
std::mutex g_cameraMutex;
friendFinderstream::CameraCapture g_camera;
std::atomic<bool> g_cameraWanted{false};
std::atomic<bool> g_cameraRunning{false};
std::atomic<int> g_maxWidth{640};

SessionSlot* slot_for(int kind) {
    return (kind >= 0 && kind < kNumKinds) ? &g_slots[kind] : nullptr;
}

void startCameraIfWanted() {
    std::lock_guard<std::mutex> lk(g_cameraMutex);
    if (!g_cameraWanted.load() || g_cameraRunning.load()) return;
    const bool ok = g_camera.start(
        [](int fmt, const uint8_t* data, size_t size, uint32_t w, uint32_t h, uint64_t pts) {
            swrtc_session* s = g_slots[kKindPov].session;
            if (s != nullptr)
                swrtc_send_video_raw(s, static_cast<swrtc_pixel_format>(fmt), data, size, w, h,
                                     pts);
        },
        g_maxWidth.load());
    if (ok) {
        g_cameraRunning.store(true);
    } else {
        std::fprintf(stderr, "[FriendFinderWebRTCModule] camera start failed (evicted or busy?)\n");
    }
}

// Stop the camera hardware but keep g_cameraWanted — a reconnected pov
// session re-grabs it (state callback / rtcEnsureCamera).
void releaseCameraHw() {
    std::lock_guard<std::mutex> lk(g_cameraMutex);
    if (g_cameraRunning.exchange(false)) g_camera.stop();
}

void stopCamera() {
    g_cameraWanted.store(false);
    releaseCameraHw();
}

// ── Inbound friend-camera video decode (kKindFriendVid) ─────────────────────
// Ported from the Decart on-device path (02-DecartAI/DecartWebRTCModule): the
// friendvid session is a receive-only ANSWERER (phone OFFERS its camera H.264;
// engine fires on_friend_video_frame with Annex-B). on_friend_video_frame runs on
// the WebRTC receive thread and ONLY enqueues (fast, never blocks packet RX). A
// dedicated worker thread runs SpecsMediaCodec HW decode + YUV→RGBA convert.
// Newest-wins: JS paints only the freshest frame, so the single-threaded convert
// can never become the throughput ceiling. JS drains via pullInboundFrame().

inline uint8_t clamp255(int v) { return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v)); }

inline int64_t steady_now_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
}

std::mutex g_decMtx;                 // decoder + pending YUV (worker + teardown only)
SpecsMediaCodec* g_decoder = nullptr;
int g_decW = 0, g_decH = 0, g_colorFormat = -1;
std::vector<uint8_t> g_pendingYuv;   // newest decoded YUV awaiting convert
int g_pendingW = 0, g_pendingH = 0;
bool g_pendingValid = false;
bool g_planarI420 = true;            // toggled if the device decoder reports NV12

std::mutex g_rgbaMtx;                // published RGBA (worker writes, JS reads)
std::vector<uint8_t> g_latestRgba;   // vertically flipped, ready for texture upload
int g_latestW = 0, g_latestH = 0;
uint64_t g_frameSeq = 0, g_polledSeq = 0;

std::thread g_decodeThread;
std::atomic<bool> g_decodeRun{false};
std::mutex g_inMtx;
std::condition_variable g_inCv;
std::deque<std::vector<uint8_t>> g_inQueue;  // Annex-B access units, in order
std::deque<int> g_inKey;                     // parallel keyframe flags

// Diagnostics (one stderr line/sec) — on-device pipeline visibility.
std::atomic<uint32_t> g_cntRx{0}, g_cntDecoded{0}, g_cntPublished{0};
std::atomic<int64_t> g_statLastMs{0};

// Keyframe (RTCP PLI) request is DEFERRED to the JS thread. The decode worker and
// the WebRTC receive thread must NOT touch g_slots[kKindFriendVid].session: the JS
// thread destroys+recreates that session on every phone re-offer, so a worker-thread
// deref races with the free → use-after-free crash. They only set this flag; the JS
// thread (pullInboundFrame, serialized with rtcCreate/rtcStop) issues the PLI safely.
std::atomic<bool> g_wantFriendKeyframe{false};
std::atomic<int64_t> g_lastFriendKfMs{0};

void friendvid_request_keyframe() {
    g_wantFriendKeyframe.store(true, std::memory_order_relaxed);
}

// Decoded YUV 4:2:0 → RGBA8 (BT.601 limited range), vertically flipped for direct
// texture upload. Handles planar I420 and semi-planar NV12; row stride derived from
// the actual buffer size (covers decoder row padding).
void convert_yuv420_to_rgba(const uint8_t* yuv, size_t size, int w, int h) {
    if (w <= 0 || h <= 0) return;
    const size_t tight = static_cast<size_t>(w) * static_cast<size_t>(h) * 3 / 2;
    if (size < tight) return;
    size_t strideY = static_cast<size_t>(w);
    if (size > tight) {
        const size_t s = (size * 2) / (static_cast<size_t>(h) * 3);
        if (s >= static_cast<size_t>(w)) strideY = s;
    }
    const size_t strideC = strideY / 2;
    const uint8_t* Y = yuv;
    const uint8_t* U = yuv + strideY * static_cast<size_t>(h);
    const uint8_t* V = U + strideC * static_cast<size_t>(h / 2);
    const uint8_t* UV = U;

    const size_t need = static_cast<size_t>(w) * static_cast<size_t>(h) * 4;
    std::lock_guard<std::mutex> lock(g_rgbaMtx);
    if (g_latestRgba.size() != need) g_latestRgba.resize(need);
    uint8_t* dst = g_latestRgba.data();

    auto write_px = [](uint8_t* p, int c, int u, int v) {
        p[0] = clamp255((298 * c + 409 * v + 128) >> 8);
        p[1] = clamp255((298 * c - 100 * u - 208 * v + 128) >> 8);
        p[2] = clamp255((298 * c + 516 * u + 128) >> 8);
        p[3] = 255;
    };
    for (int j = 0; j < h; ++j) {
        const int cj = j / 2;
        const uint8_t* yrow = Y + static_cast<size_t>(j) * strideY;
        uint8_t* row = dst + static_cast<size_t>(h - 1 - j) * static_cast<size_t>(w) * 4;  // flip
        if (g_planarI420) {
            const uint8_t* urow = U + static_cast<size_t>(cj) * strideC;
            const uint8_t* vrow = V + static_cast<size_t>(cj) * strideC;
            for (int i = 0; i < w; i += 2) {
                const int ci = i >> 1;
                const int u = static_cast<int>(urow[ci]) - 128;
                const int v = static_cast<int>(vrow[ci]) - 128;
                int c0 = static_cast<int>(yrow[i]) - 16; if (c0 < 0) c0 = 0;
                write_px(row + static_cast<size_t>(i) * 4, c0, u, v);
                if (i + 1 < w) {
                    int c1 = static_cast<int>(yrow[i + 1]) - 16; if (c1 < 0) c1 = 0;
                    write_px(row + static_cast<size_t>(i + 1) * 4, c1, u, v);
                }
            }
        } else {
            const uint8_t* uvrow = UV + static_cast<size_t>(cj) * strideY;
            for (int i = 0; i < w; i += 2) {
                const size_t uvIdx = static_cast<size_t>(i >> 1) * 2;
                const int u = static_cast<int>(uvrow[uvIdx]) - 128;
                const int v = static_cast<int>(uvrow[uvIdx + 1]) - 128;
                int c0 = static_cast<int>(yrow[i]) - 16; if (c0 < 0) c0 = 0;
                write_px(row + static_cast<size_t>(i) * 4, c0, u, v);
                if (i + 1 < w) {
                    int c1 = static_cast<int>(yrow[i + 1]) - 16; if (c1 < 0) c1 = 0;
                    write_px(row + static_cast<size_t>(i + 1) * 4, c1, u, v);
                }
            }
        }
    }
    g_latestW = w;
    g_latestH = h;
    ++g_frameSeq;
}

void read_decoder_output_format() {
    SpecsMediaFormat* of = SpecsMediaCodec_getOutputFormat(g_decoder);
    if (of == nullptr) return;
    int32_t w = 0, h = 0, cf = -1;
    SpecsMediaFormat_getInt32(of, SPECSMEDIAFORMAT_KEY_WIDTH, &w);
    SpecsMediaFormat_getInt32(of, SPECSMEDIAFORMAT_KEY_HEIGHT, &h);
    SpecsMediaFormat_getInt32(of, SPECSMEDIAFORMAT_KEY_COLOR_FORMAT, &cf);
    if (w > 0) g_decW = w;
    if (h > 0) g_decH = h;
    g_colorFormat = cf;
    std::fprintf(stderr, "[FriendFinderWebRTC] friendvid decoder OUT w=%d h=%d colorfmt=%d\n",
                 g_decW, g_decH, g_colorFormat);
    SpecsMediaFormat_delete(of);
}

void ensure_decoder() {
    if (g_decoder != nullptr) return;
    const char* mime = "video/avc";  // phone sends H.264 (libwebrtc)
    g_decoder = SpecsMediaCodec_createDecoderByType(mime);
    if (g_decoder == nullptr) {
        std::fprintf(stderr, "[FriendFinderWebRTC] friendvid createDecoderByType(%s) FAILED\n", mime);
        return;
    }
    SpecsMediaFormat* f = SpecsMediaFormat_new();
    SpecsMediaFormat_setString(f, SPECSMEDIAFORMAT_KEY_MIME, mime);
    SpecsMediaFormat_setInt32(f, SPECSMEDIAFORMAT_KEY_WIDTH, 1280);
    SpecsMediaFormat_setInt32(f, SPECSMEDIAFORMAT_KEY_HEIGHT, 720);
    const SpecsMedia_Result cr = SpecsMediaCodec_configure(g_decoder, f, nullptr, 0);
    SpecsMediaFormat_delete(f);
    if (cr != SPECSMEDIA_SUCCESS) {
        std::fprintf(stderr, "[FriendFinderWebRTC] friendvid decoder configure -> %d\n", static_cast<int>(cr));
        SpecsMediaCodec_delete(g_decoder);
        g_decoder = nullptr;
        return;
    }
    SpecsMediaCodec_start(g_decoder);
    std::fprintf(stderr, "[FriendFinderWebRTC] friendvid decoder started\n");
}

// Drain all ready decoded frames, keeping only the newest YUV (cheap memcpy) and
// releasing HW buffers immediately. Caller holds g_decMtx.
void drain_output() {
    for (;;) {
        SpecsMediaCodec_bufferInfo info{};
        size_t outIdx = 0;
        const SpecsMedia_Result r = SpecsMediaCodec_dequeueOutputBuffer(g_decoder, 0, &outIdx, &info);
        if (r != SPECSMEDIA_SUCCESS) break;
        if ((info.flags & SPECSMEDIACODEC_BUFFER_FLAG_FORMAT_CHANGED) || g_decW == 0) {
            read_decoder_output_format();
        }
        size_t outSize = 0;
        uint8_t* out = SpecsMediaCodec_getOutputBuffer(g_decoder, outIdx, &outSize);
        if (out != nullptr && outSize > 0 && g_decW > 0 && g_decH > 0) {
            if (g_pendingYuv.size() != outSize) g_pendingYuv.resize(outSize);
            std::memcpy(g_pendingYuv.data(), out, outSize);
            g_pendingW = g_decW;
            g_pendingH = g_decH;
            g_pendingValid = true;
            g_cntDecoded.fetch_add(1, std::memory_order_relaxed);
        }
        SpecsMediaCodec_releaseOutputBuffer(g_decoder, outIdx);
    }
}

// Feed one Annex-B access unit to the HW decoder. Never silently drop (H.264 needs
// every AU in order). Caller holds g_decMtx.
void feed_frame(const uint8_t* annexb, size_t size, int is_keyframe) {
    if (g_decoder == nullptr || annexb == nullptr || size == 0) return;
    drain_output();
    size_t inIdx = 0;
    SpecsMedia_Result dq = SPECSMEDIA_ERROR_AGAIN;
    for (int attempt = 0; attempt < 25; ++attempt) {
        dq = SpecsMediaCodec_dequeueInputBuffer(g_decoder, 20000, &inIdx);
        if (dq == SPECSMEDIA_SUCCESS) break;
        drain_output();
    }
    if (dq == SPECSMEDIA_SUCCESS) {
        size_t cap = 0;
        uint8_t* in = SpecsMediaCodec_getInputBuffer(g_decoder, inIdx, &cap);
        if (in != nullptr && cap >= size) {
            std::memcpy(in, annexb, size);
            const uint32_t flags = is_keyframe ? SPECSMEDIACODEC_BUFFER_FLAG_KEY_FRAME : 0u;
            SpecsMediaCodec_queueInputBuffer(g_decoder, inIdx, 0, size, 0, 0, flags);
        } else {
            friendvid_request_keyframe();
        }
    } else {
        friendvid_request_keyframe();
    }
    drain_output();
}

void convert_pending() {
    if (g_pendingValid && g_pendingW > 0 && g_pendingH > 0) {
        convert_yuv420_to_rgba(g_pendingYuv.data(), g_pendingYuv.size(), g_pendingW, g_pendingH);
        g_pendingValid = false;
    }
}

void flush_inbound_stats() {
    const int64_t now = steady_now_ms();
    int64_t last = g_statLastMs.load(std::memory_order_relaxed);
    if (last == 0) { g_statLastMs.store(now, std::memory_order_relaxed); return; }
    if (now - last < 1000) return;
    if (!g_statLastMs.compare_exchange_strong(last, now, std::memory_order_relaxed)) return;
    const uint32_t rx = g_cntRx.exchange(0, std::memory_order_relaxed);
    const uint32_t dec = g_cntDecoded.exchange(0, std::memory_order_relaxed);
    const uint32_t pub = g_cntPublished.exchange(0, std::memory_order_relaxed);
    std::fprintf(stderr, "[FriendFinderWebRTC] friendvid stat: rx=%u dec=%u pub=%u\n", rx, dec, pub);
}

void decode_worker() {
    std::deque<std::vector<uint8_t>> batch;
    std::deque<int> batchKey;
    while (g_decodeRun.load()) {
        {
            std::unique_lock<std::mutex> lk(g_inMtx);
            g_inCv.wait(lk, [] { return !g_inQueue.empty() || !g_decodeRun.load(); });
            if (!g_decodeRun.load()) break;
            batch.swap(g_inQueue);
            batchKey.swap(g_inKey);
        }
        std::lock_guard<std::mutex> lock(g_decMtx);
        ensure_decoder();
        if (g_decoder == nullptr) { batch.clear(); batchKey.clear(); continue; }
        while (!batch.empty()) {
            feed_frame(batch.front().data(), batch.front().size(), batchKey.front());
            batch.pop_front();
            batchKey.pop_front();
        }
        convert_pending();
        flush_inbound_stats();
    }
}

void teardown_decoder() {
    std::lock_guard<std::mutex> lock(g_decMtx);
    if (g_decoder != nullptr) {
        SpecsMediaCodec_stop(g_decoder);
        SpecsMediaCodec_delete(g_decoder);
        g_decoder = nullptr;
    }
    g_decW = g_decH = 0;
    g_colorFormat = -1;
    g_pendingValid = false;
    g_pendingW = g_pendingH = 0;
    g_pendingYuv.clear();
}

// WebRTC receive thread: enqueue only. is_keyframe surfaced by the engine.
void on_friend_video_frame(swrtc_session*, const uint8_t* annexb, size_t size,
                           uint64_t /*pts_us*/, int is_keyframe, void*) {
    if (annexb == nullptr || size == 0) return;
    g_cntRx.fetch_add(1, std::memory_order_relaxed);
    {
        std::lock_guard<std::mutex> lk(g_inMtx);
        if (g_inQueue.size() > 45) {  // ~1.5s ceiling: HW decode can't keep up → resync
            g_inQueue.clear();
            g_inKey.clear();
            friendvid_request_keyframe();
        }
        g_inQueue.emplace_back(annexb, annexb + size);
        g_inKey.push_back(is_keyframe);
    }
    g_inCv.notify_one();
}

void start_inbound_decode() {
    if (!g_decodeRun.exchange(true)) {
        g_statLastMs.store(0, std::memory_order_relaxed);
        g_decodeThread = std::thread(decode_worker);
    }
}

void stop_inbound_decode() {
    if (g_decodeRun.exchange(false)) {
        g_inCv.notify_all();
        if (g_decodeThread.joinable()) g_decodeThread.join();
    }
    teardown_decoder();
    {
        std::lock_guard<std::mutex> lk(g_inMtx);
        g_inQueue.clear();
        g_inKey.clear();
    }
    {
        std::lock_guard<std::mutex> lock(g_rgbaMtx);
        g_frameSeq = 0;
        g_polledSeq = 0;
    }
}

// ── libSpecsWebRTC callbacks (worker threads) ───────────────────────────────

void on_state(swrtc_session*, swrtc_state state, void* user) {
    auto* slot = static_cast<SessionSlot*>(user);
    slot->state.store(static_cast<int>(state));
    if (slot->kind == kKindPov) {
        if (state == SWRTC_STATE_CONNECTED) {
            startCameraIfWanted();
        } else if (state == SWRTC_STATE_DISCONNECTED || state == SWRTC_STATE_FAILED ||
                   state == SWRTC_STATE_CLOSED) {
            // Release the hardware so the JPEG fallback can take the camera
            // while this session re-offers (single-camera-client rule).
            releaseCameraHw();
        }
    }
}

void on_error(swrtc_session*, swrtc_result code, const char* message, void* user) {
    auto* slot = static_cast<SessionSlot*>(user);
    std::fprintf(stderr, "[FriendFinderWebRTCModule] kind=%d error %d: %s\n", slot->kind,
                 static_cast<int>(code), message ? message : "");
}

void on_local_description(swrtc_session*, swrtc_sdp_type type, const char* sdp, void* user) {
    auto* slot = static_cast<SessionSlot*>(user);
    std::string msg = "{\"t\":\"";
    msg += (type == SWRTC_SDP_ANSWER) ? "answer" : "offer";
    msg += "\",\"sdp\":\"";
    jsonEscape(sdp ? sdp : "", msg);
    msg += "\"}";
    slot->pushSignal(std::move(msg));
}

void on_local_candidate(swrtc_session*, const char* candidate, const char* mid, void* user) {
    auto* slot = static_cast<SessionSlot*>(user);
    std::string msg = "{\"t\":\"cand\",\"cand\":\"";
    jsonEscape(candidate ? candidate : "", msg);
    msg += "\",\"mid\":\"";
    jsonEscape(mid ? mid : "", msg);
    msg += "\"}";
    slot->pushSignal(std::move(msg));
}

// Native speaker for friend voice (ported from XR-AI-Lens's WebRTCStreamModule).
// Decoded PCM plays straight from this decode callback — it never crosses the
// JS bridge, so playback is immune to lens frame rate. The old path shipped
// base64 PCM to JS once per rendered frame; below ~30 fps it fell behind and
// voice went choppy, then died.
//
// Start/stop discipline (the 2026-08-06 crash was starting the stream from
// the decode callback at voice-session creation): the stream is started ONLY
// via rtcSpeakerStart from JS, on a detached worker, under the shared
// AUDIO_IN_OUT focus session — the same rules the native mic follows. This
// callback only ever push()es into the ring.
webrtcstream::SpeakerPlayback g_speaker;
std::atomic<int> g_speakerState{0};  // 0 idle, 1 starting, 2 active, -1 failed

void on_audio_frame(swrtc_session*, const int16_t* pcm, int num_frames, int channels,
                    uint32_t sample_rate, uint64_t /*pts_us*/, void* user) {
    auto* slot = static_cast<SessionSlot*>(user);
    if (num_frames <= 0 || channels <= 0) return;
    // Native path: decode thread -> speaker ring, no JS in the loop. The ring
    // is mono @48 kHz (the Opus decoder's rate); anything else falls through
    // to the JS queue, which handles arbitrary rates.
    if (g_speakerState.load(std::memory_order_relaxed) == 2 && sample_rate == 48000) {
        g_speaker.push(pcm, num_frames, channels);
        return;
    }
    // JS queue fallback (lens streams it into an Audio Output provider) —
    // used before the native speaker is ACTIVE and whenever it failed.
    std::lock_guard<std::mutex> lk(slot->pcmMutex);
    slot->pcmRate = sample_rate;
    const size_t cap = static_cast<size_t>(sample_rate) * 4;
    for (int i = 0; i < num_frames; ++i) {
        int32_t v = 0;
        for (int c = 0; c < channels; ++c) v += pcm[i * channels + c];
        slot->pcmQueue.push_back(static_cast<int16_t>(v / channels));
    }
    if (slot->pcmQueue.size() > cap)
        slot->pcmQueue.erase(slot->pcmQueue.begin(),
                             slot->pcmQueue.begin() + (slot->pcmQueue.size() - cap));
}

// Native microphone for the pov session (ported from XR-AI-Lens). 48 kHz mono
// PCM16 with SOURCE_VOICE_CALL — the platform applies echo cancellation, which
// the JS MicrophoneAudioProvider path never gets (friend voice from the Glasses
// speaker loops straight back into the JS mic). Frames go from the record
// service thread into swrtc_send_audio_pcm (engine resamples + Opus-encodes).
//
// Lifecycle rules learned from the native-speaker crash (see on_audio_frame):
//   - started ONLY from JS (rtcMicStart), never inside session creation;
//   - start runs on a detached worker (SpecsAudioRecord_awaitReady blocks up
//     to 2 s — that would freeze the lens frame loop);
//   - JS must stop its own MicrophoneAudioProvider FIRST so the lens is not
//     holding the mic when the raw record stream opens;
//   - AUDIO_IN_OUT focus is OPTIONAL (rtcMicStart(1)): XR-AI holds it. Now
//     that friend voice can play through the NATIVE speaker (rtcSpeakerStart)
//     instead of lens-side audio, TS should pass 1 — the reservation then
//     covers exactly the two streams it arbitrates.
webrtcstream::MicCapture g_mic;
webrtcstream::AudioFocusSession g_audioFocus;

// ONE shared AUDIO_IN_OUT focus session around BOTH audio devices, XR-AI
// order: focus acquired before either device opens, released only after both
// have stopped. Mic and speaker each declare interest; acquire()/release()
// are idempotent, so recomputing after every change is race-free under the
// mutex (callers: JS thread, mic worker, speaker worker).
std::mutex g_focusMtx;
bool g_focusMicWant = false;
bool g_focusSpeakerWant = false;

void setFocusInterest(bool forMic, bool want) {
    std::lock_guard<std::mutex> lk(g_focusMtx);
    (forMic ? g_focusMicWant : g_focusSpeakerWant) = want;
    if (g_focusMicWant || g_focusSpeakerWant) {
        if (!g_audioFocus.acquire())
            std::fprintf(stderr,
                         "[FriendFinderWebRTCModule] audio focus denied — continuing without\n");
    } else {
        g_audioFocus.release();
    }
}
std::mutex g_micSendMtx;                       // guards g_micTarget vs teardown
swrtc_session* g_micTarget = nullptr;          // pov session the mic feeds
std::atomic<int> g_micState{0};                // 0 idle, 1 starting, 2 active, -1 failed
// PCM frames delivered by the record stream since the last rtcMicStart. JS polls
// this (rtcMicFrames) as a liveness watchdog: state==2 with a frozen counter means
// the record stream silently died — the failure mode rtcMicState can't see, and
// the reason "friend can't hear me" calls had no recovery path.
std::atomic<uint64_t> g_micFrames{0};

void stopNativeMic() {
    g_mic.stop();  // stops the record stream; in-flight sink calls drain first
    {
        std::lock_guard<std::mutex> lk(g_micSendMtx);
        g_micTarget = nullptr;
    }
    setFocusInterest(true, false);
    g_micState.store(0);
}

void stopNativeSpeaker() {
    g_speakerState.store(0);
    g_speaker.stop();  // idempotent — safe when it never started
    setFocusInterest(false, false);
}

// ── Session lifecycle (JS thread only) ──────────────────────────────────────

void destroy_slot(SessionSlot* slot) {
    // Pov slot owns the native mic — stop it BEFORE destroying the session so
    // the sink can never send into a dead session (stop() drains the record
    // callback, then g_micTarget is nulled under the send mutex).
    if (slot->kind == kKindPov && g_micState.load() != 0) stopNativeMic();
    if (slot->session != nullptr) {
        swrtc_session_destroy(slot->session);
        slot->session = nullptr;
    }
    // Voice slot owns the native speaker. It does NOT auto-restart on a
    // re-created session — JS calls rtcSpeakerStart again on voice connect.
    if (slot->kind == kKindVoice && g_speakerState.load() != 0) stopNativeSpeaker();
    slot->state.store(-1);
    {
        std::lock_guard<std::mutex> lk(slot->sigMutex);
        slot->sigQueue.clear();
    }
    {
        std::lock_guard<std::mutex> lk(slot->pcmMutex);
        slot->pcmQueue.clear();
    }
}

// ── Exports ─────────────────────────────────────────────────────────────────

CoreJsAbiValueOrError ping_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*,
                                size_t) {
    return {number(2.0)};  // 2 = webrtc-capable module generation
}

/// udpProbe(b0,b1,b2,b3,port) -> number. >=0 bytes sent; <0 -(1000+errno) socket
/// failure, -(2000+errno) sendto failure. Diagnoses UDP egress from the sandbox
/// (LAN peer or a public STUN host) before blaming ICE.
CoreJsAbiValueOrError udp_probe_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                     const CoreJsAbiValue* args, size_t arg_count) {
    int b0 = 0, b1 = 0, b2 = 0, b3 = 0, port = 0;
    if (arg_count >= 5) {
        b0 = as_int(args[0]);
        b1 = as_int(args[1]);
        b2 = as_int(args[2]);
        b3 = as_int(args[3]);
        port = as_int(args[4]);
    }
    int fd = ::socket(AF_INET, SOCK_DGRAM, 0);
    if (fd < 0) return {number(-static_cast<double>(1000 + errno))};
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<uint16_t>(port));
    const uint32_t ip = (static_cast<uint32_t>(b0 & 0xff) << 24) |
                        (static_cast<uint32_t>(b1 & 0xff) << 16) |
                        (static_cast<uint32_t>(b2 & 0xff) << 8) | static_cast<uint32_t>(b3 & 0xff);
    addr.sin_addr.s_addr = htonl(ip);
    const char payload[] = "FriendFinder_UDP_PROBE";
    const ssize_t sent = ::sendto(fd, payload, sizeof(payload) - 1, 0,
                                  reinterpret_cast<sockaddr*>(&addr), sizeof(addr));
    const int sendErrno = errno;
    ::close(fd);
    return {number(sent >= 0 ? static_cast<double>(sent)
                             : -static_cast<double>(2000 + sendErrno))};
}

/// rtcCreate(kind, bitrateKbps, fps, maxWidth, stunUrl) -> number (0 ok, else
/// negative swrtc_result). Destroys any existing session of that kind and
/// creates a fresh one with MANUAL signaling.
///   kind 0 (pov):  OFFERER — H.264 send (camera) + Opus mono send (mic via
///                  rtcSendAudio). The offer is generated immediately; poll
///                  rtcPollSignal(0) for {"t":"offer"|"cand", ...} to ferry out.
///   kind 1 (voice): ANSWERER — Opus recv (decoded PCM via rtcPollAudio).
///                  Feed the phone's offer via rtcSetRemoteDescription(1, 0, sdp);
///                  the answer then appears on rtcPollSignal(1).
///   stunUrl: e.g. "stun:stun.l.google.com:19302"; empty = LAN-only host candidates.
CoreJsAbiValueOrError rtc_create_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                      const CoreJsAbiValue* args, size_t arg_count) {
    const int kind = arg_count >= 1 ? as_int(args[0]) : 0;
    const int bitrate = (arg_count >= 2 && as_int(args[1]) > 0) ? as_int(args[1]) : 2500;
    const int fps = (arg_count >= 3 && as_int(args[2]) > 0) ? as_int(args[2]) : 24;
    const int maxWidth = (arg_count >= 4 && as_int(args[3]) > 0) ? as_int(args[3]) : 640;
    const std::string stun = arg_count >= 5 ? as_string(rt, args[4]) : std::string();
    // Optional 6th arg: encoder quality floor (max H.264 QP, 0 = encoder
    // default). A head-mounted camera moves the whole frame every frame, so
    // an unbounded QP turns the image into macroblock mush under motion;
    // capping it makes the encoder drop fps instead of quality.
    const int maxQp = (arg_count >= 6 && as_int(args[5]) > 0) ? as_int(args[5]) : 0;

    SessionSlot* slot = slot_for(kind);
    if (slot == nullptr) return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};
    slot->kind = kind;
    if (kind == kKindPov) stopCamera();
    destroy_slot(slot);

    swrtc_config cfg;
    swrtc_config_default(&cfg);
    cfg.role = SWRTC_ROLE_OFFERER;
    cfg.signaling_mode = SWRTC_SIGNALING_MANUAL;

    swrtc_callbacks cb{};
    cb.user_data = slot;
    cb.on_state = on_state;
    cb.on_error = on_error;
    cb.on_local_description = on_local_description;
    cb.on_local_candidate = on_local_candidate;

    if (kind == kKindPov) {
        // DUPLEX: send the Glasses camera (H.264) + mic (Opus) AND receive the friend's
        // camera on the SAME PeerConnection (video_duplex adds a sendrecv video m-line).
        // on_video_frame delivers the friend's inbound H.264 for HW decode → texture.
        // One PC / one ICE negotiation — reuses the POV path that already connects,
        // instead of the fragile separate friendvid session that crashed this engine.
        cfg.video_codec = SWRTC_VIDEO_H264;
        cfg.video_bitrate_kbps = static_cast<uint32_t>(bitrate);
        cfg.video_fps = static_cast<uint32_t>(fps);
        if (maxQp > 0) cfg.video_max_qp = static_cast<uint32_t>(maxQp);
        cfg.video_duplex = 1;
        cfg.audio_codec = SWRTC_AUDIO_OPUS;
        cfg.audio_channels = 1;
        cfg.audio_bitrate_kbps = 32;
        cb.on_video_frame = on_friend_video_frame;  // inbound friend camera (duplex return)
        g_maxWidth.store(maxWidth);
    } else if (kind == kKindVoice) {
        // Receive-only voice: no video; on_audio_frame marks audio as recv.
        // ANSWERER — the recv track is created from the phone's offer.
        cfg.role = SWRTC_ROLE_ANSWERER;
        cfg.video_codec = SWRTC_VIDEO_NONE;
        cfg.audio_codec = SWRTC_AUDIO_OPUS;
        cfg.audio_channels = 1;
        cb.on_audio_frame = on_audio_frame;
        // NOTE: native speaker start intentionally NOT called here — see the
        // crash note in on_audio_frame.
    } else {
        // Receive-only friend camera video: the PHONE offers its camera H.264, we
        // ANSWER and decode. Setting on_video_frame makes the engine treat this
        // session as a video RECEIVER (video_send = false; see specs_webrtc.cpp),
        // firing on_friend_video_frame with Annex-B — no video_duplex needed.
        cfg.role = SWRTC_ROLE_ANSWERER;
        cfg.video_codec = SWRTC_VIDEO_H264;
        cfg.audio_codec = SWRTC_AUDIO_NONE;
        cb.on_video_frame = on_friend_video_frame;
    }

    const char* iceServers[1];
    if (!stun.empty()) {
        iceServers[0] = stun.c_str();
        cfg.ice_servers = iceServers;
        cfg.ice_server_count = 1;
        cfg.lan_only = 0;
    } else {
        cfg.lan_only = 1;
    }

    swrtc_result r = swrtc_session_create(&cfg, &cb, &slot->session);
    if (r != SWRTC_OK) return {number(static_cast<double>(r))};
    if (kind == kKindPov) {
        g_cameraWanted.store(true);
        // The friend's camera arrives on this (duplex) POV session — run the HW
        // decoder. Clear any Annex-B queued against a prior generation first so a
        // re-created session never feeds the decoder a frame-num gap.
        {
            std::lock_guard<std::mutex> lk(g_inMtx);
            g_inQueue.clear();
            g_inKey.clear();
        }
        start_inbound_decode();
        r = swrtc_create_offer(slot->session);  // answer sessions wait for the remote offer
        if (r != SWRTC_OK) {
            destroy_slot(slot);
            g_cameraWanted.store(false);
        }
    }
    return {number(static_cast<double>(r))};
}

/// rtcSetRemoteDescription(kind, type, sdp) -> number. type: 0 offer, 1 answer.
/// Setting a remote OFFER auto-generates our answer (emitted on rtcPollSignal).
CoreJsAbiValueOrError rtc_set_remote_description_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                                      const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = arg_count >= 3 ? slot_for(as_int(args[0])) : nullptr;
    if (slot == nullptr || slot->session == nullptr)
        return {number(static_cast<double>(SWRTC_ERR_INVALID_STATE))};
    const swrtc_sdp_type type = as_int(args[1]) == 0 ? SWRTC_SDP_OFFER : SWRTC_SDP_ANSWER;
    const std::string sdp = as_string(rt, args[2]);
    if (sdp.empty()) return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};
    const swrtc_result r = swrtc_set_remote_description(slot->session, type, sdp.c_str());
    return {number(static_cast<double>(r))};
}

/// rtcAddRemoteCandidate(kind, candidate, mid) -> number.
CoreJsAbiValueOrError rtc_add_remote_candidate_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                                    const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = arg_count >= 2 ? slot_for(as_int(args[0])) : nullptr;
    if (slot == nullptr || slot->session == nullptr)
        return {number(static_cast<double>(SWRTC_ERR_INVALID_STATE))};
    const std::string cand = as_string(rt, args[1]);
    const std::string mid = arg_count >= 3 ? as_string(rt, args[2]) : std::string();
    if (cand.empty()) return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};
    const swrtc_result r =
        swrtc_add_remote_candidate(slot->session, cand.c_str(), mid.empty() ? nullptr : mid.c_str());
    return {number(static_cast<double>(r))};
}

/// rtcPollSignal(kind) -> string | undefined. One queued local signaling
/// message as JSON ({"t":"offer"|"answer","sdp":...} or {"t":"cand",...});
/// call repeatedly until undefined.
CoreJsAbiValueOrError rtc_poll_signal_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                           const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = arg_count >= 1 ? slot_for(as_int(args[0])) : nullptr;
    if (slot == nullptr) return {undefined()};
    std::string msg;
    {
        std::lock_guard<std::mutex> lk(slot->sigMutex);
        if (slot->sigQueue.empty()) return {undefined()};
        msg = std::move(slot->sigQueue.front());
        slot->sigQueue.pop_front();
    }
    return string_result(rt, msg);
}

/// rtcState(kind) -> number. -1 no session, else swrtc_state
/// (0 new, 1 connecting, 2 connected, 3 disconnected, 4 failed, 5 closed).
CoreJsAbiValueOrError rtc_state_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                     const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = arg_count >= 1 ? slot_for(as_int(args[0])) : nullptr;
    if (slot == nullptr || slot->session == nullptr) return {number(-1.0)};
    return {number(static_cast<double>(swrtc_get_state(slot->session)))};
}

/// rtcStop(kind) -> 0. Destroys the session; kind 0 also releases the camera.
CoreJsAbiValueOrError rtc_stop_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                    const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = arg_count >= 1 ? slot_for(as_int(args[0])) : nullptr;
    if (slot == nullptr) return {number(0.0)};
    if (slot->kind == kKindPov) {
        stopCamera();
        stop_inbound_decode();  // friend video rides the (duplex) POV session now
    }
    destroy_slot(slot);
    return {number(0.0)};
}

/// rtcSendAudio(b64Pcm16Mono, sampleRate) -> number. Feeds mic PCM (S16 mono,
/// base64) into the pov session; the lib resamples to 48 kHz and Opus-encodes
/// in 20 ms frames. Returns swrtc_result (NOT_CONNECTED before connect is
/// normal and harmless — callers may send unconditionally).
CoreJsAbiValueOrError rtc_send_audio_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                          const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = &g_slots[kKindPov];
    if (slot->session == nullptr) return {number(static_cast<double>(SWRTC_ERR_INVALID_STATE))};
    if (arg_count < 2) return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};
    const std::string b64 = as_string(rt, args[0]);
    const int rate = as_int(args[1]);
    if (b64.empty() || rate <= 0) return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};

    static thread_local std::vector<uint8_t> bytes;  // JS thread only
    if (!base64Decode(b64, bytes) || bytes.size() < 2)
        return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};
    const int frames = static_cast<int>(bytes.size() / 2);
    const swrtc_result r =
        swrtc_send_audio_pcm(slot->session, reinterpret_cast<const int16_t*>(bytes.data()),
                             frames, static_cast<uint32_t>(rate), 1, 0);
    return {number(static_cast<double>(r))};
}

/// rtcPollAudio() -> string | undefined. Drains ALL decoded friend-voice PCM
/// queued since the last call as JSON {"r":<sampleRate>,"d":"<b64 S16 mono>"}.
CoreJsAbiValueOrError rtc_poll_audio_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                          const CoreJsAbiValue*, size_t) {
    SessionSlot* slot = &g_slots[kKindVoice];
    std::vector<int16_t> pcm;
    uint32_t rate = 48000;
    {
        std::lock_guard<std::mutex> lk(slot->pcmMutex);
        if (slot->pcmQueue.empty()) return {undefined()};
        pcm.swap(slot->pcmQueue);
        rate = slot->pcmRate;
    }
    std::string b64;
    base64Encode(reinterpret_cast<const uint8_t*>(pcm.data()), pcm.size() * 2, b64);
    std::string msg = "{\"r\":";
    msg += std::to_string(rate);
    msg += ",\"d\":\"";
    msg += b64;  // base64 needs no JSON escaping
    msg += "\"}";
    return string_result(rt, msg);
}

/// rtcSpeakerDiag() -> string. Native speaker state for the DB diag, e.g.
/// "rate=48000 ch=1 burst=480 underruns=0" ("stopped" when not running).
CoreJsAbiValueOrError rtc_speaker_diag_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                            const CoreJsAbiValue*, size_t) {
    return string_result(rt, g_speaker.diag());
}

/// rtcSpeakerStart() -> number (0 accepted). Starts the NATIVE friend-voice
/// speaker (pull-mode SpecsAudioPlayback, 300 ms prime, always-writes).
/// Async: the stream opens on a detached worker (HAL opens can block or hang
/// on an unhealthy audio service — never do it on the JS thread); poll
/// rtcSpeakerState() for the outcome. While ACTIVE, decoded voice PCM goes
/// straight from the decode thread into the speaker ring and is NOT queued
/// for rtcPollAudio — on failure the JS fallback keeps flowing untouched.
/// Call from JS on voice connect. NEVER call from a native callback: the
/// 2026-08-06 crash was a start attempted inside the decode callback.
CoreJsAbiValueOrError rtc_speaker_start_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                             const CoreJsAbiValue*, size_t) {
    int expected = 0;
    if (!g_speakerState.compare_exchange_strong(expected, 1)) {
        expected = -1;  // allow retry after a failed attempt
        if (!g_speakerState.compare_exchange_strong(expected, 1))
            return {number(0.0)};  // already starting/active — idempotent
    }
    std::thread([]() {
        setFocusInterest(false, true);  // focus BEFORE the device (XR-AI order)
        if (!g_speaker.start()) {
            std::fprintf(stderr, "[FriendFinderWebRTCModule] native speaker start FAILED\n");
            setFocusInterest(false, false);
            g_speakerState.store(-1);  // JS keeps its AudioOutput fallback fed
            return;
        }
        // A teardown (rtcStop / rtcSpeakerStop) may have raced the open:
        // only 1 -> 2 counts as success; otherwise undo everything.
        int running = 1;
        if (!g_speakerState.compare_exchange_strong(running, 2)) {
            std::fprintf(stderr, "[FriendFinderWebRTCModule] speaker start raced a stop — closing\n");
            g_speaker.stop();
            setFocusInterest(false, false);
            return;
        }
        std::fprintf(stderr, "[FriendFinderWebRTCModule] native speaker ACTIVE\n");
    }).detach();
    return {number(0.0)};
}

/// rtcSpeakerStop() -> number (always 0). Stops the native speaker and drops
/// its focus interest; voice PCM resumes flowing to rtcPollAudio.
CoreJsAbiValueOrError rtc_speaker_stop_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                            const CoreJsAbiValue*, size_t) {
    stopNativeSpeaker();
    return {number(0.0)};
}

/// rtcSpeakerState() -> number. 0 idle, 1 starting, 2 active, -1 failed.
CoreJsAbiValueOrError rtc_speaker_state_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                             const CoreJsAbiValue*, size_t) {
    return {number(static_cast<double>(g_speakerState.load()))};
}

/// rtcAudioRxStats(kind = 1) -> string. Receive-side audio network stats
/// ("rx_pkts=.. red=.. reorder=.. late_drop=.. gaps=.. plc_frames=.. jb=..")
/// for the DB diag; "" when the session doesn't exist.
CoreJsAbiValueOrError rtc_audio_rx_stats_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                              const CoreJsAbiValue* args, size_t arg_count) {
    const int kind = arg_count >= 1 ? as_int(args[0]) : kKindVoice;
    SessionSlot* slot = slot_for(kind);
    char buf[256] = {0};
    if (slot != nullptr && slot->session != nullptr &&
        swrtc_get_audio_rx_stats(slot->session, buf, sizeof(buf)) == SWRTC_OK)
        return string_result(rt, buf);
    return string_result(rt, "");
}

/// rtcMicStart(useFocus = 0) -> number (0 accepted, negative = invalid state).
/// Starts NATIVE mic capture feeding the pov session's Opus track. Async: the
/// record stream opens on a detached worker (awaitReady blocks up to 2 s);
/// poll rtcMicState() for the outcome. JS MUST stop its own
/// MicrophoneAudioProvider before calling this (mic ownership), and stops
/// pushing rtcSendAudio once state()==2 (two producers would interleave).
CoreJsAbiValueOrError rtc_mic_start_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                         const CoreJsAbiValue* args, size_t arg_count) {
    const bool useFocus = arg_count >= 1 && as_int(args[0]) != 0;
    SessionSlot* slot = &g_slots[kKindPov];
    if (slot->session == nullptr)
        return {number(static_cast<double>(SWRTC_ERR_INVALID_STATE))};
    int expected = 0;
    if (!g_micState.compare_exchange_strong(expected, 1)) {
        expected = -1;  // allow retry after a failed attempt
        if (!g_micState.compare_exchange_strong(expected, 1))
            return {number(0.0)};  // already starting/active — idempotent
    }
    {
        std::lock_guard<std::mutex> lk(g_micSendMtx);
        g_micTarget = slot->session;
    }
    g_micFrames.store(0, std::memory_order_relaxed);
    std::thread([useFocus]() {
        if (useFocus) setFocusInterest(true, true);  // focus BEFORE the device (XR-AI order)
        const bool ok = g_mic.start(
            [](const int16_t* pcm, int frames, int ch, uint32_t rate, uint64_t ptsUs) {
                g_micFrames.fetch_add(static_cast<uint64_t>(frames), std::memory_order_relaxed);
                std::lock_guard<std::mutex> lk(g_micSendMtx);
                if (g_micTarget != nullptr)
                    swrtc_send_audio_pcm(g_micTarget, pcm, frames, rate, ch, ptsUs);
            });
        if (!ok) {
            std::fprintf(stderr, "[FriendFinderWebRTCModule] native mic start FAILED\n");
            {
                std::lock_guard<std::mutex> lk(g_micSendMtx);
                g_micTarget = nullptr;
            }
            setFocusInterest(true, false);
            g_micState.store(-1);
            return;
        }
        // A teardown (rtcStop / destroy_slot) may have raced the blocking
        // start: only 1 -> 2 counts as success; otherwise undo everything.
        int running = 1;
        if (!g_micState.compare_exchange_strong(running, 2)) {
            std::fprintf(stderr, "[FriendFinderWebRTCModule] mic start raced a stop — closing\n");
            g_mic.stop();
            setFocusInterest(true, false);
            return;
        }
        std::fprintf(stderr, "[FriendFinderWebRTCModule] native mic ACTIVE (VOICE_CALL, echo-cancelled)\n");
    }).detach();
    return {number(0.0)};
}

/// rtcMicStop() -> number (always 0). Stops native mic capture + releases focus.
CoreJsAbiValueOrError rtc_mic_stop_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                        const CoreJsAbiValue*, size_t) {
    stopNativeMic();
    return {number(0.0)};
}

/// rtcMicState() -> number. 0 idle, 1 starting, 2 active, -1 failed.
CoreJsAbiValueOrError rtc_mic_state_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                         const CoreJsAbiValue*, size_t) {
    return {number(static_cast<double>(g_micState.load()))};
}

/// rtcMicFrames() -> number. PCM frames delivered by the native record stream
/// since the last rtcMicStart. A frozen value while rtcMicState()==2 means the
/// capture silently died — JS restarts the handover (its stall watchdog).
CoreJsAbiValueOrError rtc_mic_frames_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                          const CoreJsAbiValue*, size_t) {
    return {number(static_cast<double>(g_micFrames.load(std::memory_order_relaxed)))};
}

/// rtcEnsureCamera() -> number (1 running, 0 not). Retries the camera grab for
/// the pov session. The state callback starts the camera on CONNECTED, but if
/// the JPEG fallback path still held it at that moment the grab fails — JS
/// calls this each pump after releasing the old path so the retry succeeds.
CoreJsAbiValueOrError rtc_ensure_camera_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                             const CoreJsAbiValue*, size_t) {
    if (g_slots[kKindPov].session != nullptr &&
        g_slots[kKindPov].state.load() == static_cast<int>(SWRTC_STATE_CONNECTED))
        startCameraIfWanted();
    return {number(g_cameraRunning.load() ? 1.0 : 0.0)};
}

/// rtcSetBitrate(kbps) -> number. Runtime video bitrate lever on the pov session.
CoreJsAbiValueOrError rtc_set_bitrate_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                           const CoreJsAbiValue* args, size_t arg_count) {
    SessionSlot* slot = &g_slots[kKindPov];
    if (slot->session == nullptr || arg_count < 1)
        return {number(static_cast<double>(SWRTC_ERR_INVALID_STATE))};
    const int kbps = as_int(args[0]);
    if (kbps <= 0) return {number(static_cast<double>(SWRTC_ERR_INVALID_ARG))};
    return {number(static_cast<double>(
        swrtc_set_video_bitrate(slot->session, static_cast<uint32_t>(kbps))))};
}

/// pullInboundFrame(buffer) -> { width, height }. Copies the newest decoded friend-
/// camera RGBA (BT.601, vertically flipped for direct upload) into the caller's
/// PERSISTENT ArrayBuffer — zero per-frame allocation. width=0 ⇒ no new frame since
/// the last poll, so JS skips the texture upload. Size the buffer to maxW*maxH*4.
CoreJsAbiValueOrError rtc_pull_inbound_frame_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                                  const CoreJsAbiValue* args, size_t arg_count) {
    // JS thread: safe place to honor a deferred keyframe request (session lifecycle
    // is owned by the JS thread, so this deref can't race a destroy). Rate-limited so
    // a decode backlog can't trigger an IDR storm.
    if (g_wantFriendKeyframe.exchange(false, std::memory_order_relaxed)) {
        const int64_t now = steady_now_ms();
        if (now - g_lastFriendKfMs.load(std::memory_order_relaxed) > 700) {
            g_lastFriendKfMs.store(now, std::memory_order_relaxed);
            // Friend video is the inbound leg of the duplex POV session — PLI it.
            swrtc_session* s = g_slots[kKindPov].session;
            if (s != nullptr) swrtc_request_keyframe(s);
        }
    }
    int w = 0, h = 0;
    if (arg_count >= 1 && args[0].kind == CoreJsAbiValueKindObject && args[0].data.pointer != nullptr) {
        CoreJsAbiArrayBuffer ab{args[0].data.pointer};
        CoreJsAbiUint8SpanOrError sp = rt->vt->get_arraybuffer_span(rt, &ab);
        if (!sp.is_error && sp.span_or_error.span.data != nullptr) {
            uint8_t* dst = sp.span_or_error.span.data;
            const size_t cap = sp.span_or_error.span.length;
            std::lock_guard<std::mutex> lock(g_rgbaMtx);
            if (g_frameSeq != 0 && g_frameSeq != g_polledSeq && !g_latestRgba.empty()) {
                const size_t n = static_cast<size_t>(g_latestW) * static_cast<size_t>(g_latestH) * 4;
                if (n <= cap && n <= g_latestRgba.size()) {
                    g_polledSeq = g_frameSeq;
                    std::memcpy(dst, g_latestRgba.data(), n);
                    w = g_latestW;
                    h = g_latestH;
                    g_cntPublished.fetch_add(1, std::memory_order_relaxed);
                }
            }
        }
    }
    CoreJsAbiObjectOrError objOrErr = rt->vt->create_object(rt);
    if (objOrErr.is_error) return {undefined()};
    CoreJsAbiManagedPointer* objPtr = objOrErr.ptr_or_error.ptr;
    CoreJsAbiObject o{.pointer = objPtr};
    CoreJsAbiValue wv{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(w)}};
    rt->vt->set_object_property_from_string(rt, &o, "width", 5, &wv);
    CoreJsAbiValue hv{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(h)}};
    rt->vt->set_object_property_from_string(rt, &o, "height", 6, &hv);
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindObject, .data = {.pointer = objPtr}}};
}

void shutdownAll() {
    stopCamera();
    stop_inbound_decode();
    for (auto& slot : g_slots) destroy_slot(&slot);
}

void release_managed_pointer(CoreJsAbiManagedPointer* p) {
    if (p != nullptr) p->vtable->release(p);
}

bool register_export(CoreJsAbiRuntime* runtime, CoreJsAbiObject* moduleObject,
                     std::string_view propName, HostFunction fn) {
    auto wrappedFunction = std::make_unique<HostFunctionWrapper>(std::move(fn));
    CoreJsAbiFunctionOrError functionOrError =
        runtime->vt->create_function_from_host_function(runtime, wrappedFunction.get());
    if (functionOrError.is_error) {
        std::string_view errorMsg = "Failed creating native export function";
        runtime->vt->set_string_error_value(runtime, errorMsg.data(), errorMsg.size());
        return false;
    }
    wrappedFunction.release();

    CoreJsAbiManagedPointer* functionPtr = functionOrError.ptr_or_error.ptr;
    CoreJsAbiValue functionAsAbiValue{
        .kind = CoreJsAbiValueKindObject, .data = {.pointer = functionPtr}};
    if (runtime->vt
            ->set_object_property_from_string(
                runtime, moduleObject, propName.data(), propName.size(), &functionAsAbiValue)
            .is_error) {
        release_managed_pointer(functionPtr);
        std::string_view errorMsg = "Failed setting native export on module object";
        runtime->vt->set_string_error_value(runtime, errorMsg.data(), errorMsg.size());
        return false;
    }
    // set_object_property_from_string took ownership of functionPtr; do not release here.
    return true;
}

}  // namespace

void assignNativeFunctions(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject) {
    if (!register_export(runtime, moduleObject, "ping", ping_impl)) return;
    if (!register_export(runtime, moduleObject, "udpProbe", udp_probe_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcCreate", rtc_create_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSetRemoteDescription", rtc_set_remote_description_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcAddRemoteCandidate", rtc_add_remote_candidate_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcPollSignal", rtc_poll_signal_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcState", rtc_state_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcStop", rtc_stop_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcEnsureCamera", rtc_ensure_camera_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSendAudio", rtc_send_audio_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcPollAudio", rtc_poll_audio_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSpeakerDiag", rtc_speaker_diag_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSpeakerStart", rtc_speaker_start_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSpeakerStop", rtc_speaker_stop_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSpeakerState", rtc_speaker_state_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcAudioRxStats", rtc_audio_rx_stats_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcMicStart", rtc_mic_start_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcMicStop", rtc_mic_stop_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcMicState", rtc_mic_state_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcMicFrames", rtc_mic_frames_impl)) return;
    if (!register_export(runtime, moduleObject, "rtcSetBitrate", rtc_set_bitrate_impl)) return;
    if (!register_export(runtime, moduleObject, "pullInboundFrame", rtc_pull_inbound_frame_impl)) return;
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
