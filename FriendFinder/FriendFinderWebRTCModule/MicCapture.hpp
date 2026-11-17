#pragma once
//
// MicCapture — continuous microphone capture via the SpecsNDK audio-record API
// (SpecsAudioRecord.h). Delivers interleaved S16 PCM to a sink, which hands it to
// libSpecsWebRTC (swrtc_send_audio_pcm) for Opus encode + RTP. Mirrors CameraStreamer.
//
#include <atomic>
#include <cstdint>
#include <functional>

// Opaque record-stream handle (defined in SpecsAudioRecord.h; forward-declared here so
// this header doesn't pull the NDK include into every translation unit).
struct SpecsAudioRecord_Stream_t_;
typedef struct SpecsAudioRecord_Stream_t_ SpecsAudioRecord_Stream_t;

namespace webrtcstream {

// sink(interleaved S16 PCM, framesPerChannel, channels, sampleRate, ptsUs)
using MicFrameSink =
    std::function<void(const int16_t* pcm, int frames, int channels, uint32_t sampleRate, uint64_t ptsUs)>;

class MicCapture {
public:
    ~MicCapture();
    // Open + start the mic (48 kHz mono PCM16). Frames arrive on the sink on an
    // internal service thread. Returns false if the mic couldn't be opened/started.
    bool start(const MicFrameSink& sink);
    void stop();  // idempotent

private:
    static void dataTrampoline(SpecsAudioRecord_Stream_t* stream, const void* data,
                               int32_t byteCount, uint64_t timestampMs, void* ctx);
    void onData(const void* data, int32_t byteCount, uint64_t timestampMs);

    SpecsAudioRecord_Stream_t* stream_ = nullptr;
    MicFrameSink sink_;
    std::atomic<bool> active_{false};
    int channels_ = 1;
    uint32_t sampleRate_ = 48000;
};

} // namespace webrtcstream
