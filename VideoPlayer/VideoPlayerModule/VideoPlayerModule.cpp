// VideoPlayerModule — CoreJS native module wrapping the SpecsNDK SpecsPlayer API
// (libspecs_player.so) for Lens scripts.
//
// One player per module instance. Video is decoded in SPECSPLAYER_VIDEO_OUTPUT_CALLBACK
// mode: every CPU-readable frame (RGBA, I420 or NV12) is converted to RGBA8, scaled
// down to fit the max frame size (default 1280x720, nearest-neighbour, aspect kept),
// flipped vertically for ProceduralTextureProvider.setPixels (bottom-left origin) and
// published into a mutex-guarded double buffer. JS polls it with pullFrameInto().
// Audio goes to the speaker (SPECSPLAYER_AUDIO_OUTPUT_SPEAKER).
//
// Threading
//   * JS calls arrive on the Lens script thread.
//   * open() runs create/configure/open on a worker thread so a slow network preroll
//     never stalls the Lens. Commands issued while opening (play/pause/loop/volume)
//     are recorded and applied by the worker once open succeeds.
//   * Event and frame callbacks arrive on SpecsPlayer's internal threads; they only
//     touch atomics, the error string (mutex) and the frame buffers (mutex).
//   * close()/unload join the worker, then SpecsPlayer_close (which guarantees no
//     callback runs after it returns) and SpecsPlayer_destroy.

#include "VideoPlayerModule.hpp"
#include "HostFunctionWrapper.hpp"

#include "SpecsPlayer.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace usercode {
namespace {

// ── JS-facing state enum (mirrors VideoPlayerState in VideoPlayerNativeModule.ts) ──
enum JsState : int {
    kIdle = 0,
    kOpening = 1,
    kBuffering = 2,
    kPlaying = 3,
    kPaused = 4,
    kStopped = 5,
    kEnded = 6,
    kError = 7,
};

// ── Player + lifecycle ────────────────────────────────────────────────────────
std::mutex g_playerMtx;           // guards g_player and every SpecsPlayer_* call on it
SpecsPlayer_t* g_player = nullptr;
std::thread g_openThread;         // create/configure/open worker (joined by close)

std::mutex g_pendingMtx;          // guards g_opening transitions + pending commands
std::atomic<bool> g_opening{false};
bool g_pendingPlay = false;
bool g_pendingLoop = false;
double g_pendingVolume = 1.0;

// ── Event-driven state (written by callbacks, read by JS) ────────────────────
std::atomic<int> g_state{kIdle};
std::atomic<bool> g_wantPlaying{false};   // last play/pause intent (restores state after buffering)
std::atomic<bool> g_stopRequested{false};
std::atomic<bool> g_loop{false};
std::atomic<int> g_bufferPercent{100};
std::atomic<double> g_duration{0.0};
std::atomic<double> g_lastPosition{0.0};
std::atomic<double> g_volume{1.0};

std::mutex g_errMtx;
std::string g_lastError;

// ── Frame double buffer ───────────────────────────────────────────────────────
std::atomic<int> g_maxW{1280};
std::atomic<int> g_maxH{720};
std::mutex g_frameMtx;            // guards g_front*, g_frameSeq, g_polledSeq
std::vector<uint8_t> g_front;     // newest published RGBA frame (already flipped)
int g_frontW = 0;
int g_frontH = 0;
uint64_t g_frameSeq = 0;
uint64_t g_polledSeq = 0;
std::vector<uint8_t> g_back;      // frame-callback thread only: conversion target
std::atomic<int> g_srcW{0};
std::atomic<int> g_srcH{0};
std::atomic<int> g_srcFormat{0};

// ── Small helpers ─────────────────────────────────────────────────────────────
CoreJsAbiValueOrError num(double x) {
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindNumber, .data = {.number = x}}};
}

CoreJsAbiValueOrError js_error(CoreJsAbiRuntime* rt, std::string_view msg) {
    rt->vt->set_string_error_value(rt, msg.data(), msg.size());
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError}};
}

CoreJsAbiValueOrError str(CoreJsAbiRuntime* rt, const std::string& s) {
    CoreJsAbiStringOrError so = rt->vt->create_string_from_utf8(rt, s.c_str(), s.size());
    if (so.is_error) {
        return js_error(rt, "create_string_from_utf8 failed");
    }
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindString, .data = {.pointer = so.ptr_or_error.ptr}}};
}

void release_managed_pointer(CoreJsAbiManagedPointer* p) {
    if (p != nullptr) {
        p->vtable->release(p);
    }
}

double arg_num(const CoreJsAbiValue* args, size_t argc, size_t i, double dflt) {
    if (i < argc && args[i].kind == CoreJsAbiValueKindNumber) {
        return args[i].data.number;
    }
    return dflt;
}

bool arg_bool(const CoreJsAbiValue* args, size_t argc, size_t i, bool dflt) {
    if (i >= argc) return dflt;
    if (args[i].kind == CoreJsAbiValueKindBoolean) return args[i].data.boolean;
    if (args[i].kind == CoreJsAbiValueKindNumber) return args[i].data.number != 0.0;
    return dflt;
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
    CoreJsAbiString s{v.data.pointer};
    StdGrowableBuffer sgb;
    rt->vt->get_utf8_from_string(rt, &s, &sgb.base);
    if (sgb.base.data != nullptr && sgb.base.used > 0) {
        out.assign(reinterpret_cast<const char*>(sgb.base.data), sgb.base.used);
    }
    return true;
}

const char* result_name(SpecsPlayer_Result_t r) {
    switch (r) {
        case SPECSPLAYER_SUCCESS: return "SUCCESS";
        case SPECSPLAYER_ERROR_GENERIC: return "ERROR_GENERIC";
        case SPECSPLAYER_ERROR_INVALID_PARAM: return "ERROR_INVALID_PARAM";
        case SPECSPLAYER_ERROR_INVALID_STATE: return "ERROR_INVALID_STATE";
        case SPECSPLAYER_ERROR_NETWORK: return "ERROR_NETWORK";
        case SPECSPLAYER_ERROR_FORMAT: return "ERROR_FORMAT";
        case SPECSPLAYER_ERROR_NOT_SUPPORTED: return "ERROR_NOT_SUPPORTED";
        case SPECSPLAYER_ERROR_NO_HANDLER: return "ERROR_NO_HANDLER";
        case SPECSPLAYER_ERROR_RESOURCE_EXHAUSTED: return "ERROR_RESOURCE_EXHAUSTED";
    }
    return "ERROR_UNKNOWN";
}

void set_error(const std::string& msg) {
    {
        std::lock_guard<std::mutex> lk(g_errMtx);
        g_lastError = msg;
    }
    g_state.store(kError);
    std::fprintf(stderr, "[VideoPlayerModule] error: %s\n", msg.c_str());
}

void fail_call(const char* what, SpecsPlayer_Result_t r) {
    set_error(std::string(what) + " failed: " + result_name(r) + " (" + std::to_string(static_cast<int>(r)) + ")");
}

std::string json_escape(const char* s) {
    std::string out;
    if (s == nullptr) return out;
    for (const char* p = s; *p != '\0'; ++p) {
        const unsigned char c = static_cast<unsigned char>(*p);
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
    return out;
}

// ── Callbacks (SpecsPlayer internal threads) ─────────────────────────────────
void on_event(SpecsPlayer_t*, const SpecsPlayer_Event_t* ev, void*) {
    if (ev == nullptr) return;
    switch (ev->type) {
        case SPECSPLAYER_EVENT_STATE_CHANGED: {
            const SpecsPlayer_State_t ns = ev->data.state_changed.new_state;
            const int cur = g_state.load();
            if (cur == kError) break; // sticky until the next open()
            if (ns == SPECSPLAYER_STATE_PLAYING) {
                g_stopRequested.store(false);
                g_state.store(g_bufferPercent.load() < 100 ? kBuffering : kPlaying);
            } else if (g_stopRequested.load()) {
                g_state.store(kStopped);
            } else if (ns == SPECSPLAYER_STATE_PAUSED) {
                // PAUSED after preroll (opening) or after a pause; keep "ended" if EOS already hit.
                if (cur != kEnded) g_state.store(kPaused);
            } else if (cur == kPlaying || cur == kPaused || cur == kBuffering) {
                g_state.store(kStopped);
            }
            break;
        }
        case SPECSPLAYER_EVENT_ERROR: {
            const SpecsPlayer_Result_t code = ev->data.error.error_code;
            std::string msg = ev->data.error.message != nullptr ? ev->data.error.message : "";
            set_error(std::string(result_name(code)) + (msg.empty() ? "" : ": " + msg));
            break;
        }
        case SPECSPLAYER_EVENT_END_OF_STREAM: {
            if (!g_loop.load() && g_state.load() != kError) {
                g_wantPlaying.store(false);
                g_state.store(kEnded);
            }
            break;
        }
        case SPECSPLAYER_EVENT_BUFFERING: {
            const int pct = ev->data.buffering.percent;
            g_bufferPercent.store(pct);
            const int cur = g_state.load();
            if (cur == kError || cur == kEnded || cur == kStopped) break;
            if (pct < 100) {
                g_state.store(kBuffering);
            } else if (cur == kBuffering) {
                g_state.store(g_wantPlaying.load() ? kPlaying : kPaused);
            }
            break;
        }
        case SPECSPLAYER_EVENT_DURATION_CHANGED:
            g_duration.store(ev->data.duration_changed.duration);
            break;
    }
}

inline uint8_t clamp255(int v) {
    return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v));
}

// BT.601 limited range YUV -> RGB (integer, 8.8 fixed point).
inline void yuv_to_rgba(int y, int u, int v, uint8_t* o) {
    const int c = (y - 16) * 298;
    const int d = u - 128;
    const int e = v - 128;
    o[0] = clamp255((c + 409 * e + 128) >> 8);
    o[1] = clamp255((c - 100 * d - 208 * e + 128) >> 8);
    o[2] = clamp255((c + 516 * d + 128) >> 8);
    o[3] = 255;
}

void on_frame(SpecsPlayer_t*, const SpecsPlayer_Frame_t* f, void*) {
    if (f == nullptr || f->data == nullptr || f->width <= 0 || f->height <= 0) return;
    const int sw = f->width;
    const int sh = f->height;
    g_srcW.store(sw);
    g_srcH.store(sh);
    g_srcFormat.store(static_cast<int>(f->format));

    // Fit inside the max size, keep aspect, never upscale. Even dimensions.
    const int maxW = std::max(16, g_maxW.load());
    const int maxH = std::max(16, g_maxH.load());
    double scale = std::min(1.0, std::min(static_cast<double>(maxW) / sw, static_cast<double>(maxH) / sh));
    int dw = std::max(2, static_cast<int>(sw * scale) & ~1);
    int dh = std::max(2, static_cast<int>(sh * scale) & ~1);

    const size_t need = static_cast<size_t>(dw) * static_cast<size_t>(dh) * 4;
    if (g_back.size() != need) g_back.assign(need, 0);

    const uint8_t* base = f->data;
    const size_t total = f->size;
    // Precompute source column per destination column.
    static thread_local std::vector<int> xs;
    xs.resize(static_cast<size_t>(dw));
    for (int x = 0; x < dw; ++x) xs[static_cast<size_t>(x)] = std::min(sw - 1, static_cast<int>((x + 0.5) * sw / dw));

    switch (f->format) {
        case SPECSPLAYER_FRAME_FORMAT_RGBA: {
            const int stride = f->stride > 0 ? f->stride : sw * 4;
            if (static_cast<size_t>(stride) * (sh - 1) + static_cast<size_t>(sw) * 4 > total) return;
            for (int y = 0; y < dh; ++y) {
                const int sy = std::min(sh - 1, static_cast<int>((y + 0.5) * sh / dh));
                const uint8_t* srow = base + static_cast<size_t>(sy) * stride;
                uint8_t* drow = g_back.data() + static_cast<size_t>(dh - 1 - y) * dw * 4; // flipped
                for (int x = 0; x < dw; ++x) {
                    const uint8_t* s = srow + xs[static_cast<size_t>(x)] * 4;
                    uint8_t* d = drow + x * 4;
                    d[0] = s[0]; d[1] = s[1]; d[2] = s[2]; d[3] = 255;
                }
            }
            break;
        }
        case SPECSPLAYER_FRAME_FORMAT_I420:
        case SPECSPLAYER_FRAME_FORMAT_NV12: {
            const bool nv12 = f->format == SPECSPLAYER_FRAME_FORMAT_NV12;
            const int strideY = f->plane_strides[0] > 0 ? f->plane_strides[0] : (f->stride > 0 ? f->stride : sw);
            const size_t offY = f->plane_offsets[0];
            const size_t offU = f->plane_offsets[1] != 0 ? f->plane_offsets[1] : offY + static_cast<size_t>(strideY) * sh;
            const int strideU = f->plane_strides[1] > 0 ? f->plane_strides[1] : (nv12 ? strideY : strideY / 2);
            const size_t offV = nv12 ? 0
                : (f->plane_offsets[2] != 0 ? f->plane_offsets[2] : offU + static_cast<size_t>(strideU) * ((sh + 1) / 2));
            const int strideV = nv12 ? 0 : (f->plane_strides[2] > 0 ? f->plane_strides[2] : strideU);
            // Bounds check against the last byte each plane can touch.
            const size_t ch = static_cast<size_t>((sh + 1) / 2);
            const size_t endY = offY + static_cast<size_t>(strideY) * sh;
            const size_t endU = offU + static_cast<size_t>(strideU) * ch;
            const size_t endV = nv12 ? 0 : offV + static_cast<size_t>(strideV) * ch;
            if (endY > total || endU > total || endV > total) {
                static int s_warn = 0;
                if ((s_warn++ % 120) == 0) {
                    std::fprintf(stderr, "[VideoPlayerModule] frame plane layout exceeds buffer (%dx%d size=%zu)\n", sw, sh, total);
                }
                return;
            }
            for (int y = 0; y < dh; ++y) {
                const int sy = std::min(sh - 1, static_cast<int>((y + 0.5) * sh / dh));
                const uint8_t* yrow = base + offY + static_cast<size_t>(sy) * strideY;
                const uint8_t* urow = base + offU + static_cast<size_t>(sy / 2) * strideU;
                const uint8_t* vrow = nv12 ? nullptr : base + offV + static_cast<size_t>(sy / 2) * strideV;
                uint8_t* drow = g_back.data() + static_cast<size_t>(dh - 1 - y) * dw * 4; // flipped
                for (int x = 0; x < dw; ++x) {
                    const int sx = xs[static_cast<size_t>(x)];
                    int u;
                    int v;
                    if (nv12) {
                        u = urow[(sx / 2) * 2];
                        v = urow[(sx / 2) * 2 + 1];
                    } else {
                        u = urow[sx / 2];
                        v = vrow[sx / 2];
                    }
                    yuv_to_rgba(yrow[sx], u, v, drow + x * 4);
                }
            }
            break;
        }
        default: {
            static int s_warn = 0;
            if ((s_warn++ % 120) == 0) {
                std::fprintf(stderr, "[VideoPlayerModule] unsupported frame format %d\n", static_cast<int>(f->format));
            }
            return;
        }
    }

    std::lock_guard<std::mutex> lk(g_frameMtx);
    g_front.swap(g_back);
    g_frontW = dw;
    g_frontH = dh;
    ++g_frameSeq;
}

// ── Lifecycle (caller must not hold g_playerMtx) ─────────────────────────────
void reset_frames() {
    std::lock_guard<std::mutex> lk(g_frameMtx);
    g_front.clear();
    g_frontW = 0;
    g_frontH = 0;
    g_frameSeq = 0;
    g_polledSeq = 0;
}

void teardown() {
    if (g_openThread.joinable()) {
        g_openThread.join();
    }
    {
        std::lock_guard<std::mutex> lk(g_playerMtx);
        if (g_player != nullptr) {
            SpecsPlayer_close(g_player); // no event callbacks after this returns
            SpecsPlayer_destroy(&g_player);
            g_player = nullptr;
        }
    }
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        g_opening.store(false);
        g_pendingPlay = false;
    }
    g_wantPlaying.store(false);
    g_stopRequested.store(false);
    g_duration.store(0.0);
    g_lastPosition.store(0.0);
    g_bufferPercent.store(100);
    g_srcW.store(0);
    g_srcH.store(0);
    reset_frames();
}

SpecsPlayer_Result_t player_play_locked() {
    SpecsPlayer_Result_t r = SpecsPlayer_playAsync(g_player);
    if (r == SPECSPLAYER_ERROR_NOT_SUPPORTED) r = SpecsPlayer_play(g_player);
    return r;
}

void open_worker(std::string url) {
    std::lock_guard<std::mutex> lk(g_playerMtx);
    SpecsPlayer_t* p = nullptr;
    SpecsPlayer_Config_t cfg{.app_name = "VideoPlayer"};
    SpecsPlayer_Result_t r = SpecsPlayer_create(&p, &cfg);
    if (r != SPECSPLAYER_SUCCESS || p == nullptr) {
        fail_call("SpecsPlayer_create", r);
        std::lock_guard<std::mutex> plk(g_pendingMtx);
        g_opening.store(false);
        return;
    }
    // Callbacks and output modes must be set before open.
    const char* step = "SpecsPlayer_setEventCallback";
    r = SpecsPlayer_setEventCallback(p, on_event, nullptr);
    if (r == SPECSPLAYER_SUCCESS) {
        step = "SpecsPlayer_setVideoOutputMode(CALLBACK)";
        r = SpecsPlayer_setVideoOutputMode(p, SPECSPLAYER_VIDEO_OUTPUT_CALLBACK);
    }
    if (r == SPECSPLAYER_SUCCESS) {
        step = "SpecsPlayer_setVideoFrameCallback";
        r = SpecsPlayer_setVideoFrameCallback(p, on_frame, nullptr);
    }
    if (r == SPECSPLAYER_SUCCESS) {
        step = "SpecsPlayer_setAudioOutputMode(SPEAKER)";
        r = SpecsPlayer_setAudioOutputMode(p, SPECSPLAYER_AUDIO_OUTPUT_SPEAKER);
    }
    if (r == SPECSPLAYER_SUCCESS) {
        step = "SpecsPlayer_open";
        r = SpecsPlayer_open(p, url.c_str());
    }
    if (r != SPECSPLAYER_SUCCESS) {
        fail_call(step, r);
        SpecsPlayer_close(p);
        SpecsPlayer_destroy(&p);
        std::lock_guard<std::mutex> plk(g_pendingMtx);
        g_opening.store(false);
        return;
    }
    g_player = p;

    // Apply commands recorded while opening, then leave the opening state atomically
    // with respect to JS (which checks g_opening under g_pendingMtx).
    std::lock_guard<std::mutex> plk(g_pendingMtx);
    SpecsPlayer_Result_t lr = SpecsPlayer_setShouldLoop(g_player, g_pendingLoop);
    if (lr != SPECSPLAYER_SUCCESS) {
        std::fprintf(stderr, "[VideoPlayerModule] setShouldLoop: %s\n", result_name(lr));
    }
    SpecsPlayer_Result_t vr = SpecsPlayer_setVolume(g_player, g_pendingVolume);
    if (vr != SPECSPLAYER_SUCCESS) {
        std::fprintf(stderr, "[VideoPlayerModule] setVolume: %s\n", result_name(vr));
    }
    if (g_state.load() == kOpening) g_state.store(kPaused);
    if (g_pendingPlay) {
        g_wantPlaying.store(true);
        SpecsPlayer_Result_t pr = player_play_locked();
        if (pr != SPECSPLAYER_SUCCESS) fail_call("SpecsPlayer_play", pr);
    }
    g_opening.store(false);
}

// Runs fn(player) under g_playerMtx if a player is open (not opening). Returns false otherwise.
template <typename Fn>
bool with_player(Fn&& fn) {
    std::lock_guard<std::mutex> lk(g_playerMtx);
    if (g_player == nullptr) return false;
    fn(g_player);
    return true;
}

// ════════════════════════════ exported host functions ════════════════════════
using Args = const CoreJsAbiValue*;

CoreJsAbiValueOrError ping_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    return num(1.0);
}

// open(url, loop) -> 0 when the open was started (async), else a SpecsPlayer_Result_t code.
CoreJsAbiValueOrError open_impl(CoreJsAbiRuntime* rt, Args, Args args, size_t argc) {
    std::string url;
    if (argc < 1 || !read_string_arg(rt, args[0], url) || url.empty()) {
        set_error("open: url must be a non-empty string (file://, http:// or https://)");
        return num(static_cast<double>(SPECSPLAYER_ERROR_INVALID_PARAM));
    }
    const bool loop = arg_bool(args, argc, 1, false);
    teardown();
    {
        std::lock_guard<std::mutex> lk(g_errMtx);
        g_lastError.clear();
    }
    g_loop.store(loop);
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        g_pendingLoop = loop;
        g_pendingVolume = g_volume.load();
        g_pendingPlay = false;
        g_opening.store(true);
    }
    g_state.store(kOpening);
    g_openThread = std::thread(open_worker, std::move(url));
    return num(0.0);
}

CoreJsAbiValueOrError play_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        if (g_opening.load()) {
            g_pendingPlay = true;
            g_wantPlaying.store(true);
            return num(0.0);
        }
    }
    SpecsPlayer_Result_t r = SPECSPLAYER_ERROR_INVALID_STATE;
    const int prev = g_state.load();
    with_player([&](SpecsPlayer_t*) {
        // Replay from the start after "ended" / "stopped".
        if (prev == kEnded || prev == kStopped) SpecsPlayer_seek(g_player, 0.0);
        g_stopRequested.store(false);
        g_wantPlaying.store(true);
        r = player_play_locked();
    });
    if (r != SPECSPLAYER_SUCCESS) fail_call("SpecsPlayer_play", r);
    return num(static_cast<double>(r));
}

CoreJsAbiValueOrError pause_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        if (g_opening.load()) {
            g_pendingPlay = false;
            g_wantPlaying.store(false);
            return num(0.0);
        }
    }
    SpecsPlayer_Result_t r = SPECSPLAYER_ERROR_INVALID_STATE;
    with_player([&](SpecsPlayer_t* p) {
        g_wantPlaying.store(false);
        r = SpecsPlayer_pauseAsync(p);
        if (r == SPECSPLAYER_ERROR_NOT_SUPPORTED) r = SpecsPlayer_pause(p);
    });
    return num(static_cast<double>(r));
}

// stop(): pause and rewind to 0 (keeps the media open so play() restarts instantly).
CoreJsAbiValueOrError stop_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        if (g_opening.load()) {
            g_pendingPlay = false;
            g_wantPlaying.store(false);
            return num(0.0);
        }
    }
    SpecsPlayer_Result_t r = SPECSPLAYER_ERROR_INVALID_STATE;
    with_player([&](SpecsPlayer_t* p) {
        g_wantPlaying.store(false);
        g_stopRequested.store(true);
        r = SpecsPlayer_pause(p);
        SpecsPlayer_seek(p, 0.0);
    });
    if (r == SPECSPLAYER_SUCCESS && g_state.load() != kError) g_state.store(kStopped);
    g_lastPosition.store(0.0);
    return num(static_cast<double>(r));
}

CoreJsAbiValueOrError seek_impl(CoreJsAbiRuntime*, Args, Args args, size_t argc) {
    const double t = std::max(0.0, arg_num(args, argc, 0, 0.0));
    SpecsPlayer_Result_t r = SPECSPLAYER_ERROR_INVALID_STATE;
    with_player([&](SpecsPlayer_t* p) { r = SpecsPlayer_seek(p, t); });
    if (r == SPECSPLAYER_SUCCESS) {
        g_lastPosition.store(t);
        if (g_state.load() == kEnded) g_state.store(kPaused);
    }
    return num(static_cast<double>(r));
}

CoreJsAbiValueOrError set_loop_impl(CoreJsAbiRuntime*, Args, Args args, size_t argc) {
    const bool loop = arg_bool(args, argc, 0, false);
    g_loop.store(loop);
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        if (g_opening.load()) {
            g_pendingLoop = loop;
            return num(0.0);
        }
    }
    SpecsPlayer_Result_t r = SPECSPLAYER_SUCCESS; // no media yet: remembered for the next open()
    with_player([&](SpecsPlayer_t* p) { r = SpecsPlayer_setShouldLoop(p, loop); });
    return num(static_cast<double>(r));
}

CoreJsAbiValueOrError set_volume_impl(CoreJsAbiRuntime*, Args, Args args, size_t argc) {
    const double v = std::clamp(arg_num(args, argc, 0, 1.0), 0.0, 1.0);
    g_volume.store(v);
    {
        std::lock_guard<std::mutex> lk(g_pendingMtx);
        if (g_opening.load()) {
            g_pendingVolume = v;
            return num(0.0);
        }
    }
    SpecsPlayer_Result_t r = SPECSPLAYER_SUCCESS;
    with_player([&](SpecsPlayer_t* p) { r = SpecsPlayer_setVolume(p, v); });
    return num(static_cast<double>(r));
}

CoreJsAbiValueOrError get_state_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    return num(static_cast<double>(g_state.load()));
}

CoreJsAbiValueOrError get_last_error_impl(CoreJsAbiRuntime* rt, Args, Args, size_t) {
    std::string e;
    {
        std::lock_guard<std::mutex> lk(g_errMtx);
        e = g_lastError;
    }
    return str(rt, e);
}

// Getters never block on an in-flight open: they fall back to cached values.
CoreJsAbiValueOrError get_duration_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    std::unique_lock<std::mutex> lk(g_playerMtx, std::try_to_lock);
    if (lk.owns_lock() && g_player != nullptr) {
        double d = 0.0;
        if (SpecsPlayer_getDuration(g_player, &d) == SPECSPLAYER_SUCCESS && d > 0.0 && std::isfinite(d)) {
            g_duration.store(d);
        }
    }
    return num(g_duration.load());
}

CoreJsAbiValueOrError get_position_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    std::unique_lock<std::mutex> lk(g_playerMtx, std::try_to_lock);
    if (lk.owns_lock() && g_player != nullptr) {
        const int s = g_state.load();
        double pos = 0.0;
        if ((s == kPlaying || s == kPaused || s == kBuffering) &&
            SpecsPlayer_getPosition(g_player, &pos) == SPECSPLAYER_SUCCESS && std::isfinite(pos)) {
            g_lastPosition.store(pos);
        } else if (s == kEnded) {
            g_lastPosition.store(g_duration.load());
        }
    }
    return num(g_lastPosition.load());
}

// getMediaInfo() -> JSON string. Properties are only available in PAUSED/PLAYING;
// missing ones are reported as 0 / "".
CoreJsAbiValueOrError get_media_info_impl(CoreJsAbiRuntime* rt, Args, Args, size_t) {
    int hasVideo = 0, hasAudio = 0, width = 0, height = 0, sampleRate = 0, channels = 0;
    double fps = 0.0;
    std::string vcodec, acodec;
    bool available = false;
    {
        std::unique_lock<std::mutex> lk(g_playerMtx, std::try_to_lock);
        if (lk.owns_lock() && g_player != nullptr) {
            available = SpecsPlayer_getMediaPropertyInt(g_player, SPECSPLAYER_PROP_HAS_VIDEO, &hasVideo) == SPECSPLAYER_SUCCESS;
            SpecsPlayer_getMediaPropertyInt(g_player, SPECSPLAYER_PROP_HAS_AUDIO, &hasAudio);
            SpecsPlayer_getMediaPropertyInt(g_player, SPECSPLAYER_PROP_VIDEO_WIDTH, &width);
            SpecsPlayer_getMediaPropertyInt(g_player, SPECSPLAYER_PROP_VIDEO_HEIGHT, &height);
            SpecsPlayer_getMediaPropertyDouble(g_player, SPECSPLAYER_PROP_VIDEO_FRAMERATE, &fps);
            const char* s = nullptr;
            if (SpecsPlayer_getMediaPropertyString(g_player, SPECSPLAYER_PROP_VIDEO_CODEC, &s) == SPECSPLAYER_SUCCESS && s) vcodec = s;
            s = nullptr;
            SpecsPlayer_getMediaPropertyInt(g_player, SPECSPLAYER_PROP_AUDIO_SAMPLE_RATE, &sampleRate);
            SpecsPlayer_getMediaPropertyInt(g_player, SPECSPLAYER_PROP_AUDIO_CHANNELS, &channels);
            if (SpecsPlayer_getMediaPropertyString(g_player, SPECSPLAYER_PROP_AUDIO_CODEC, &s) == SPECSPLAYER_SUCCESS && s) acodec = s;
        }
    }
    if (width <= 0) width = g_srcW.load();
    if (height <= 0) height = g_srcH.load();
    if (!std::isfinite(fps)) fps = 0.0;
    int outW = 0, outH = 0;
    {
        std::lock_guard<std::mutex> lk(g_frameMtx);
        outW = g_frontW;
        outH = g_frontH;
    }
    char buf[256];
    std::snprintf(buf, sizeof(buf),
                  "{\"available\":%s,\"hasVideo\":%s,\"hasAudio\":%s,\"width\":%d,\"height\":%d,"
                  "\"framerate\":%.3f,\"sampleRate\":%d,\"channels\":%d,\"frameFormat\":%d,"
                  "\"outputWidth\":%d,\"outputHeight\":%d,",
                  available ? "true" : "false", hasVideo ? "true" : "false", hasAudio ? "true" : "false",
                  width, height, fps, sampleRate, channels, g_srcFormat.load(), outW, outH);
    std::string json = buf;
    json += "\"videoCodec\":\"" + json_escape(vcodec.c_str()) + "\",";
    json += "\"audioCodec\":\"" + json_escape(acodec.c_str()) + "\"}";
    return str(rt, json);
}

// pullFrameInto(buffer) -> { updated, width, height }. Copies the newest RGBA frame
// (vertically flipped, ready for ProceduralTextureProvider.setPixels) into the caller's
// persistent ArrayBuffer. updated=false means no new frame since the last pull, or the
// buffer is smaller than width*height*4 (width/height still report the frame size so
// JS can grow its buffer).
CoreJsAbiValueOrError pull_frame_into_impl(CoreJsAbiRuntime* rt, Args, Args args, size_t argc) {
    bool updated = false;
    int w = 0;
    int h = 0;
    if (argc >= 1 && args[0].kind == CoreJsAbiValueKindObject && args[0].data.pointer != nullptr) {
        CoreJsAbiArrayBuffer ab{args[0].data.pointer};
        CoreJsAbiUint8SpanOrError sp = rt->vt->get_arraybuffer_span(rt, &ab);
        std::lock_guard<std::mutex> lk(g_frameMtx);
        w = g_frontW;
        h = g_frontH;
        if (!sp.is_error && sp.span_or_error.span.data != nullptr && g_frameSeq != 0 && g_frameSeq != g_polledSeq) {
            const size_t n = static_cast<size_t>(w) * static_cast<size_t>(h) * 4;
            if (n > 0 && n <= sp.span_or_error.span.length && n <= g_front.size()) {
                std::memcpy(sp.span_or_error.span.data, g_front.data(), n);
                g_polledSeq = g_frameSeq;
                updated = true;
            }
        }
    }
    CoreJsAbiObjectOrError objOrErr = rt->vt->create_object(rt);
    if (objOrErr.is_error) {
        return js_error(rt, "pullFrameInto: create_object failed");
    }
    CoreJsAbiManagedPointer* objPtr = objOrErr.ptr_or_error.ptr;
    CoreJsAbiObject o{.pointer = objPtr};
    CoreJsAbiValue uv{.kind = CoreJsAbiValueKindBoolean, .data = {.boolean = updated}};
    rt->vt->set_object_property_from_string(rt, &o, "updated", 7, &uv);
    CoreJsAbiValue wv{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(w)}};
    rt->vt->set_object_property_from_string(rt, &o, "width", 5, &wv);
    CoreJsAbiValue hv{.kind = CoreJsAbiValueKindNumber, .data = {.number = static_cast<double>(h)}};
    rt->vt->set_object_property_from_string(rt, &o, "height", 6, &hv);
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindObject, .data = {.pointer = objPtr}}};
}

// setMaxFrameSize(w, h): cap for the RGBA frames handed to JS (default 1280x720).
CoreJsAbiValueOrError set_max_frame_size_impl(CoreJsAbiRuntime*, Args, Args args, size_t argc) {
    const int w = static_cast<int>(std::clamp(arg_num(args, argc, 0, 1280.0), 16.0, 4096.0));
    const int h = static_cast<int>(std::clamp(arg_num(args, argc, 1, 720.0), 16.0, 4096.0));
    g_maxW.store(w);
    g_maxH.store(h);
    return num(0.0);
}

CoreJsAbiValueOrError close_impl(CoreJsAbiRuntime*, Args, Args, size_t) {
    teardown();
    g_state.store(kIdle);
    return num(0.0);
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
    if (!register_export(runtime, moduleObject, "open", open_impl)) return;
    if (!register_export(runtime, moduleObject, "play", play_impl)) return;
    if (!register_export(runtime, moduleObject, "pause", pause_impl)) return;
    if (!register_export(runtime, moduleObject, "stop", stop_impl)) return;
    if (!register_export(runtime, moduleObject, "seek", seek_impl)) return;
    if (!register_export(runtime, moduleObject, "setLoop", set_loop_impl)) return;
    if (!register_export(runtime, moduleObject, "setVolume", set_volume_impl)) return;
    if (!register_export(runtime, moduleObject, "getState", get_state_impl)) return;
    if (!register_export(runtime, moduleObject, "getLastError", get_last_error_impl)) return;
    if (!register_export(runtime, moduleObject, "getDuration", get_duration_impl)) return;
    if (!register_export(runtime, moduleObject, "getPosition", get_position_impl)) return;
    if (!register_export(runtime, moduleObject, "getMediaInfo", get_media_info_impl)) return;
    if (!register_export(runtime, moduleObject, "pullFrameInto", pull_frame_into_impl)) return;
    if (!register_export(runtime, moduleObject, "setMaxFrameSize", set_max_frame_size_impl)) return;
    if (!register_export(runtime, moduleObject, "close", close_impl)) return;
}

void shutdownPlayer() {
    teardown();
    g_state.store(kIdle);
}
} // namespace usercode

extern "C" {
void CoreJsOnLoad(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject, void**) {
    usercode::assignNativeFunctions(runtime, moduleObject);
}
void CoreJsOnUnload(CoreJsAbiRuntime*, void*) {
    usercode::shutdownPlayer();
}
}
