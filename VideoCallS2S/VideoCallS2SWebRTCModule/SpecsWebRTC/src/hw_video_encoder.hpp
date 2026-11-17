#pragma once
//
// hw_video_encoder — internal: hardware H.264 encoder (SpecsMediaCodec) for the
// lib's swrtc_send_video_raw path. Device-only; the whole body is compiled only
// when SWRTC_HW_ENCODER is defined (Mac/host builds skip it and send_video_raw
// returns SWRTC_ERR_UNSUPPORTED).
//
// Accepts raw RGBA / NV12 / I420 frames, converts to the encoder's input format,
// hardware-encodes to H.264 Annex-B on worker threads, and hands each access unit
// to a sink callback (wired to the WebRTC video track).
//
#include <cstddef>
#include <cstdint>
#include <functional>

namespace swrtc_hw {

// Mirrors swrtc_pixel_format (kept independent so this header has no ABI dep).
enum class PixFmt { I420 = 0, NV12 = 1, RGBA = 2 };
enum class RateControl { Default = 0, CBR = 1, VBR = 2, CQ = 3 };

using AnnexBSink = std::function<void(const uint8_t* annexb, size_t size, uint64_t pts_us)>;

struct EncodeParams {
    int width = 0, height = 0;     // 0 = take from the first frame
    int fps = 30;
    int bitrate_bps = 4'000'000;
    int max_qp = 0;                // 0 = encoder default; ~24 sets a quality floor
    RateControl rate_control = RateControl::CBR;
    bool h265 = false;             // true: HEVC (video/hevc); false: H.264 (video/avc)
};

class HwVideoEncoder {
public:
    HwVideoEncoder() = default;
    ~HwVideoEncoder();

    bool start(const EncodeParams& params, AnnexBSink sink);
    // Feed one raw frame; converted to the encoder input format as needed.
    void pushFrame(PixFmt fmt, const uint8_t* data, int width, int height, uint64_t pts_us);
    void requestKeyframe();
    // Live bitrate change (SpecsMediaCodec setParameters) — no reconfigure, no
    // keyframe gap. Call from the same thread that calls start()/stop().
    void setBitrate(int bps);
    void stop();
    bool running() const;

private:
    struct Impl;
    Impl* impl_ = nullptr;
};

}  // namespace swrtc_hw
