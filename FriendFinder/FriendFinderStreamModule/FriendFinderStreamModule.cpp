//
// FriendFinderStreamModule — native video hot path for the FriendFinder walkie-talkie.
//
// Owns the Glasses RGB camera (continuous SpecsCamera stream) and an encoder
// worker thread that turns the latest frame into a base64 JPEG at the target
// fps: pack (HAL thread) -> downscale + 4:2:0 JPEG encode + base64 (worker).
// JS polls getEncodedFrame() — a sub-millisecond string swap — and drops the
// payload into the Supabase Realtime channel. No pixels ever cross the JS
// boundary; JS never runs an encode.
//
// While this module streams, the Lens must NOT also request the camera via
// CameraModule (a second client evicts the first) — CallStreamer.ts
// switches between the native and JS capture paths for exactly that reason.
//
#include "FriendFinderStreamModule.hpp"
#include "HostFunctionWrapper.hpp"
#include "CameraCapture.hpp"
#include "JpegEncoder.hpp"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <memory>
#include <mutex>
#include <new>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace usercode {
namespace {

// ── Stream state ────────────────────────────────────────────────────────────
std::atomic<bool> g_running{false};
std::atomic<int> g_quality{55};
std::atomic<int> g_fps{12};
std::atomic<int> g_maxWidth{480};
friendFinderstream::CameraCapture g_camera;
std::thread g_encoderThread;

// Latest raw frame (camera HAL thread -> encoder thread).
std::mutex g_rawMutex;
std::condition_variable g_rawCv;
std::vector<uint8_t> g_raw;   // packed I420 (fmt 0) or NV12 (fmt 1)
int g_rawFmt = 0;
uint32_t g_rawW = 0;
uint32_t g_rawH = 0;
uint64_t g_rawSeq = 0;

// Latest encoded frame (encoder thread -> JS thread).
std::mutex g_outMutex;
std::string g_outB64;
bool g_outFresh = false;

// ── Helpers ─────────────────────────────────────────────────────────────────

int as_int(const CoreJsAbiValue& v) {
    return v.kind == CoreJsAbiValueKindNumber ? static_cast<int>(v.data.number) : 0;
}

CoreJsAbiValue number(double n) {
    return CoreJsAbiValue{.kind = CoreJsAbiValueKindNumber, .data = {.number = n}};
}

CoreJsAbiValue undefined() {
    return CoreJsAbiValue{.kind = CoreJsAbiValueKindUndefined, .data = {}};
}

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

// Resample a packed I420/NV12 frame into tight planar YUV at (ow, oh) using
// nearest sampling (adequate for a live feed; the JPEG quantizer dominates).
// Also the NV12 -> planar deinterleave point. ow/oh must be even.
void samplePlanes(int fmt, const uint8_t* src, uint32_t sw, uint32_t sh,
                  int ow, int oh,
                  std::vector<uint8_t>& Y, std::vector<uint8_t>& U, std::vector<uint8_t>& V) {
    const size_t ySize = static_cast<size_t>(sw) * sh;
    const int scw = static_cast<int>(sw) / 2;
    const uint8_t* srcY = src;
    const uint8_t* srcUV = src + ySize;                                       // NV12
    const uint8_t* srcU = src + ySize;                                        // I420
    const uint8_t* srcV = src + ySize + static_cast<size_t>(scw) * (sh / 2);  // I420

    const int ocw = ow / 2;
    const int och = oh / 2;
    Y.resize(static_cast<size_t>(ow) * oh);
    U.resize(static_cast<size_t>(ocw) * och);
    V.resize(static_cast<size_t>(ocw) * och);

    for (int y = 0; y < oh; ++y) {
        const int sy = static_cast<int>(static_cast<int64_t>(y) * sh / oh);
        const uint8_t* row = srcY + static_cast<size_t>(sy) * sw;
        uint8_t* dst = Y.data() + static_cast<size_t>(y) * ow;
        if (ow == static_cast<int>(sw)) {
            std::memcpy(dst, row, ow);
        } else {
            for (int x = 0; x < ow; ++x)
                dst[x] = row[static_cast<int>(static_cast<int64_t>(x) * sw / ow)];
        }
    }
    for (int y = 0; y < och; ++y) {
        const int cy = static_cast<int>(static_cast<int64_t>(y) * (sh / 2) / och);
        uint8_t* du = U.data() + static_cast<size_t>(y) * ocw;
        uint8_t* dv = V.data() + static_cast<size_t>(y) * ocw;
        for (int x = 0; x < ocw; ++x) {
            const int cx = static_cast<int>(static_cast<int64_t>(x) * scw / ocw);
            if (fmt == 1) {  // NV12
                const uint8_t* p = srcUV + static_cast<size_t>(cy) * (scw * 2) + cx * 2;
                du[x] = p[0];
                dv[x] = p[1];
            } else {  // I420
                du[x] = srcU[static_cast<size_t>(cy) * scw + cx];
                dv[x] = srcV[static_cast<size_t>(cy) * scw + cx];
            }
        }
    }
}

// ── Encoder worker ──────────────────────────────────────────────────────────

void encoderLoop() {
    using clock = std::chrono::steady_clock;
    uint64_t lastSeq = 0;
    auto nextAt = clock::now();
    std::vector<uint8_t> raw;
    std::vector<uint8_t> Y, U, V;
    std::vector<uint8_t> jpeg;
    std::string b64;
    int fmt = 0;
    uint32_t w = 0, h = 0;

    while (g_running.load()) {
        {
            std::unique_lock<std::mutex> lk(g_rawMutex);
            g_rawCv.wait(lk, [&] { return !g_running.load() || g_rawSeq != lastSeq; });
            if (!g_running.load()) break;
            lastSeq = g_rawSeq;
            raw = g_raw;
            fmt = g_rawFmt;
            w = g_rawW;
            h = g_rawH;
        }

        // Throttle to the target fps by encoding at most once per interval;
        // newer camera frames simply overwrite the latest-raw slot meanwhile.
        const auto interval =
            std::chrono::microseconds(1000000 / (g_fps.load() > 0 ? g_fps.load() : 12));
        auto now = clock::now();
        if (now < nextAt) {
            std::this_thread::sleep_until(nextAt);
            now = clock::now();
        }
        nextAt = now + interval;
        if (!g_running.load()) break;

        int ow = static_cast<int>(w);
        int oh = static_cast<int>(h);
        const int maxW = g_maxWidth.load();
        if (maxW > 0 && ow > maxW) {
            oh = static_cast<int>(static_cast<int64_t>(oh) * maxW / ow);
            ow = maxW;
        }
        ow &= ~1;
        oh &= ~1;
        if (ow < 2 || oh < 2) continue;

        samplePlanes(fmt, raw.data(), w, h, ow, oh, Y, U, V);
        friendFinderjpeg::EncodeYUV420(Y.data(), U.data(), V.data(), ow, oh,
                                 ow, ow / 2, g_quality.load(), jpeg);
        if (jpeg.empty()) continue;
        base64Encode(jpeg.data(), jpeg.size(), b64);

        {
            std::lock_guard<std::mutex> lk(g_outMutex);
            g_outB64.swap(b64);
            g_outFresh = true;
        }
    }
}

void cameraSink(int fmt, const uint8_t* data, size_t size,
                uint32_t width, uint32_t height, uint64_t /*ptsUs*/) {
    if (!g_running.load()) return;
    {
        std::lock_guard<std::mutex> lk(g_rawMutex);
        g_raw.assign(data, data + size);
        g_rawFmt = fmt;
        g_rawW = width;
        g_rawH = height;
        ++g_rawSeq;
    }
    g_rawCv.notify_one();
}

void stopStream() {
    if (!g_running.exchange(false)) return;
    g_rawCv.notify_all();
    if (g_encoderThread.joinable()) g_encoderThread.join();
    g_camera.stop();
    std::lock_guard<std::mutex> lk(g_outMutex);
    g_outB64.clear();
    g_outFresh = false;
}

// ── Exports ─────────────────────────────────────────────────────────────────

CoreJsAbiValueOrError ping_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    return {number(1.0)};
}

/// startStream(maxWidth, quality, fps) -> number (0 ok, -1 camera failed).
/// Idempotent; parameters are applied on every call.
CoreJsAbiValueOrError start_stream_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*,
                                        const CoreJsAbiValue* args, size_t arg_count) {
    const int maxWidth = (arg_count >= 1 && as_int(args[0]) > 0) ? as_int(args[0]) : 480;
    const int quality = (arg_count >= 2 && as_int(args[1]) > 0) ? as_int(args[1]) : 55;
    const int fps = (arg_count >= 3 && as_int(args[2]) > 0) ? as_int(args[2]) : 12;
    g_maxWidth.store(maxWidth);
    g_quality.store(quality);
    g_fps.store(fps);

    if (g_running.load()) return {number(0.0)};
    g_running.store(true);
    if (!g_camera.start(cameraSink, maxWidth)) {
        g_running.store(false);
        return {number(-1.0)};
    }
    g_encoderThread = std::thread(encoderLoop);
    return {number(0.0)};
}

/// stopStream() -> 0. Releases the camera and stops the encoder thread.
CoreJsAbiValueOrError stop_stream_impl(CoreJsAbiRuntime*, const CoreJsAbiValue*, const CoreJsAbiValue*, size_t) {
    stopStream();
    return {number(0.0)};
}

/// getEncodedFrame() -> string | undefined. The latest base64 JPEG, or
/// undefined when no NEW frame was encoded since the last call (so JS never
/// re-sends duplicates). Cheap: one string copy under a mutex.
CoreJsAbiValueOrError get_encoded_frame_impl(CoreJsAbiRuntime* rt, const CoreJsAbiValue*,
                                             const CoreJsAbiValue*, size_t) {
    std::string b64;
    {
        std::lock_guard<std::mutex> lk(g_outMutex);
        if (!g_outFresh) return {undefined()};
        b64 = g_outB64;
        g_outFresh = false;
    }
    CoreJsAbiStringOrError s = rt->vt->create_string_from_utf8(rt, b64.data(), b64.size());
    if (s.is_error) return {CoreJsAbiValue{.kind = CoreJsAbiValueKindError, .data = {}}};
    return {CoreJsAbiValue{.kind = CoreJsAbiValueKindString,
                           .data = {.pointer = s.ptr_or_error.ptr}}};
}

void release_managed_pointer(CoreJsAbiManagedPointer* p) {
    if (p != nullptr) {
        p->vtable->release(p);
    }
}

bool register_export(CoreJsAbiRuntime* runtime,
                     CoreJsAbiObject* moduleObject,
                     std::string_view propName,
                     HostFunction fn) {
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

} // namespace

void assignNativeFunctions(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject) {
    if (!register_export(runtime, moduleObject, "ping", ping_impl)) return;
    if (!register_export(runtime, moduleObject, "startStream", start_stream_impl)) return;
    if (!register_export(runtime, moduleObject, "stopStream", stop_stream_impl)) return;
    if (!register_export(runtime, moduleObject, "getEncodedFrame", get_encoded_frame_impl)) return;
}
} // namespace usercode

extern "C" {
void CoreJsOnLoad(CoreJsAbiRuntime* runtime, struct CoreJsAbiObject* moduleObject, void**) {
    usercode::assignNativeFunctions(runtime, moduleObject);
}

void CoreJsOnUnload(CoreJsAbiRuntime*, void*) {
    usercode::stopStream();
}
}
