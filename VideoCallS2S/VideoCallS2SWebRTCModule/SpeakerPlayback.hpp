#pragma once
//
// SpeakerPlayback — remote-audio output via the SpecsNDK playback API
// (SpecsAudioPlayback.h). Mirrors MicCapture: 48 kHz mono PCM16 to the speaker,
// pull-mode (need-data callback) fed from an internal ring buffer. When the ring
// is empty it writes silence, which both avoids underrun glitches and keeps the
// service from evicting the stream before the agent first speaks.
//
#include <cstdint>
#include <deque>
#include <mutex>
#include <string>

struct SpecsAudioPlayback_Stream_t_;
typedef struct SpecsAudioPlayback_Stream_t_ SpecsAudioPlayback_Stream_t;

namespace webrtcstream {

class SpeakerPlayback {
public:
    ~SpeakerPlayback();
    // Open + start the speaker stream (48 kHz mono PCM16). Returns false on failure.
    bool start();
    void stop();  // idempotent

    // Queue decoded PCM for playback (any thread). Interleaved S16; if stereo,
    // it is downmixed to mono. Drops oldest audio if the queue overflows.
    void push(const int16_t* pcm, int frames, int channels);

    // Resolved stream parameters (valid after start) + a diagnostics line for
    // surfacing on the HUD: "rate=48000 ch=2 burst=480 underruns=3".
    std::string diag();

private:
    static void needDataTrampoline(SpecsAudioPlayback_Stream_t* stream, int32_t requestedFrames,
                                   uint64_t expectedPlayTimeNs, void* ctx);
    void onNeedData(int32_t requestedFrames);

    SpecsAudioPlayback_Stream_t* stream_ = nullptr;
    std::mutex mtx_;
    std::deque<int16_t> ring_;  // mono S16 @ 48 kHz
    bool active_ = false;
    // Jitter buffering: silence until `primed_` (ring reached the prime level);
    // on underrun, drop back to buffering instead of interleaving silence into
    // speech — interleaved gap-fill is what makes jittery audio unintelligible.
    bool primed_ = false;
    // Resolved (negotiated) stream parameters — the service may not honor the
    // requested mono/48k exactly; writes must match the RESOLVED frame size or
    // every burst plays fractionally short (garbled speech).
    unsigned int outRate_ = 48000;
    unsigned int outChannels_ = 1;
    int burstFrames_ = 0;
    unsigned long underruns_ = 0;
};

} // namespace webrtcstream
