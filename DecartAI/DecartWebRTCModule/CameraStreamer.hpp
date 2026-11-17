#pragma once
//
// CameraStreamer — device camera source for the WebRTC video track.
//
// Opens a continuous SpecsCamera stream (RGB/YUV_420_888) and, on each delivered
// frame, packs the planes tightly (stripping row-stride padding) and hands the
// packed I420/NV12 buffer to `sink`. The sink feeds it to swrtc_send_video_raw,
// which converts + hardware-encodes (H.264/H.265) on the library's encoder thread.
//
// Frames arrive on the camera HAL thread; packing is the only work done there
// (swrtc_send_video_raw just swaps the frame into the encoder's latest-frame slot
// and returns). This is the camera alternative to GradientStreamer. Device-only.
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

namespace webrtcstream {

// Receives one packed video frame ready for swrtc_send_video_raw.
//   fmt: swrtc_pixel_format value — 0 = I420, 1 = NV12.
using CameraFrameSink =
    std::function<void(int fmt, const uint8_t* data, size_t size,
                       uint32_t width, uint32_t height, uint64_t ptsUs)>;

class CameraStreamer {
public:
    CameraStreamer() = default;
    ~CameraStreamer();
    CameraStreamer(const CameraStreamer&) = delete;
    CameraStreamer& operator=(const CameraStreamer&) = delete;

    // Open the RGB camera and begin delivering packed frames to `sink`. Picks the
    // largest supported RGB stream whose width is <= maxWidth (RGB is capped well
    // under the SDK's stability limit). Returns false if no camera/stream is
    // available. Safe to call again after stop(); a second start() while active
    // is a no-op returning true.
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

} // namespace webrtcstream
