#pragma once
//
// CameraCapture — continuous Glasses RGB camera source for FriendFinderStreamModule.
//
// Adapted from CLAD-DAY-021-Twitch's CameraStreamer: opens a continuous
// SpecsCamera stream (YUV_420_888) and, on each delivered frame, packs the
// planes tightly (stripping row-stride padding) and hands the packed
// I420/NV12 buffer to `sink`. Frames arrive on the camera HAL thread;
// packing is the only work done there. Device-only.
//
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <vector>

// Forward declarations mirror the SpecsCamera C ABI (see SpecsCameraStructures.h /
// SpecsCameraDefinitions.h) so this header needn't pull the SDK into every TU.
struct SpecsCamera_Client_s;
struct SpecsCamera_Frame_s;

namespace friendFinderstream {

// Receives one packed video frame.
//   fmt: 0 = I420 (planar), 1 = NV12 (interleaved UV).
using CameraFrameSink =
    std::function<void(int fmt, const uint8_t* data, size_t size,
                       uint32_t width, uint32_t height, uint64_t ptsUs)>;

class CameraCapture {
public:
    CameraCapture() = default;
    ~CameraCapture();
    CameraCapture(const CameraCapture&) = delete;
    CameraCapture& operator=(const CameraCapture&) = delete;

    // Open the RGB camera and begin delivering packed frames to `sink`. Picks the
    // largest supported RGB stream whose width is <= maxWidth; if none fits, the
    // narrowest larger stream (the caller downscales). Returns false if no
    // camera/stream is available. A second start() while active is a no-op.
    bool start(const CameraFrameSink& sink, int maxWidth);

    // Stop delivery and release the camera. No-op if not started.
    void stop();

private:
    static void frameTrampoline(const SpecsCamera_Frame_s* frame, void* ctx);
    static void noteTrampoline(int32_t notificationTag, void* ctx);
    void onFrame(const SpecsCamera_Frame_s* frame);

    SpecsCamera_Client_s* client_ = nullptr;
    int64_t streamId_ = 0;
    CameraFrameSink sink_;
    std::atomic<bool> active_{false};
    std::vector<uint8_t> pack_;  // reused packing buffer (HAL thread only)
};

} // namespace friendFinderstream
