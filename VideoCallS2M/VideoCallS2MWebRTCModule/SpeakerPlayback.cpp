#include "SpeakerPlayback.hpp"

#include <SpecsAudioPlayback.h>

#include <cstdio>
#include <vector>

namespace webrtcstream {
namespace {
constexpr uint32_t kRate = 48000;
constexpr int kChannels = 1;
constexpr size_t kMaxQueuedSamples = kRate * 20;      // cap the ring at ~20 s (long TTS answers)
constexpr size_t kPrimeSamples = (kRate * 300) / 1000; // buffer 300 ms before starting playback
}  // namespace

SpeakerPlayback::~SpeakerPlayback() { stop(); }

bool SpeakerPlayback::start() {
    std::lock_guard<std::mutex> lk(mtx_);
    if (active_) return true;

    SpecsAudioPlayback_Config_t* cfg = SpecsAudioPlayback_configCreate();
    if (!cfg) return false;
    SpecsAudioPlayback_configSetSampleRate(cfg, kRate);
    SpecsAudioPlayback_configSetChannels(cfg, kChannels);
    SpecsAudioPlayback_configSetSampleFormat(cfg, SPECSAUDIOPLAYBACK_FORMAT_PCM16);
    SpecsAudioPlayback_configSetDestination(cfg, SPECSAUDIOPLAYBACK_DEST_SPKR);
    stream_ = SpecsAudioPlayback_streamOpen(cfg);
    SpecsAudioPlayback_configDestroy(cfg);
    if (!stream_) {
        std::fprintf(stderr, "[SpeakerPlayback] streamOpen failed\n");
        return false;
    }
    if (SpecsAudioPlayback_setNeedDataCallback(stream_, needDataTrampoline, this) !=
        SPECSAUDIOPLAYBACK_OK) {
        std::fprintf(stderr, "[SpeakerPlayback] setNeedDataCallback failed\n");
        SpecsAudioPlayback_streamClose(stream_);
        stream_ = nullptr;
        return false;
    }
    if (SpecsAudioPlayback_start(stream_) != SPECSAUDIOPLAYBACK_OK) {
        std::fprintf(stderr, "[SpeakerPlayback] start failed\n");
        SpecsAudioPlayback_streamClose(stream_);
        stream_ = nullptr;
        return false;
    }

    // The service may NEGOTIATE different parameters than requested (e.g. the
    // stereo default instead of mono). Writes must match the resolved frame
    // size, or every burst plays fractionally short — garbled speech.
    SpecsAudioPlayback_Config_t* resolved = SpecsAudioPlayback_configCreate();
    if (resolved) {
        SpecsAudioPlayback_streamGetConfig(stream_, resolved);
        outRate_ = SpecsAudioPlayback_configGetSampleRate(resolved);
        outChannels_ = SpecsAudioPlayback_configGetChannels(resolved);
        SpecsAudioPlayback_configDestroy(resolved);
    }
    if (outRate_ == 0) outRate_ = kRate;
    if (outChannels_ == 0) outChannels_ = kChannels;
    burstFrames_ = SpecsAudioPlayback_getFramesPerBurst(stream_);
    underruns_ = 0;
    std::fprintf(stderr, "[SpeakerPlayback] resolved rate=%u ch=%u burst=%d\n",
                 outRate_, outChannels_, burstFrames_);

    active_ = true;
    return true;
}

std::string SpeakerPlayback::diag() {
    std::lock_guard<std::mutex> lk(mtx_);
    return "speaker rate=" + std::to_string(outRate_) + " ch=" + std::to_string(outChannels_) +
           " burst=" + std::to_string(burstFrames_) + " underruns=" + std::to_string(underruns_) +
           " queued_ms=" + std::to_string(ring_.size() * 1000 / kRate) +
           (active_ ? "" : " (inactive)");
}

void SpeakerPlayback::stop() {
    SpecsAudioPlayback_Stream_t* s = nullptr;
    {
        std::lock_guard<std::mutex> lk(mtx_);
        if (!active_) return;
        active_ = false;
        s = stream_;
        stream_ = nullptr;
        ring_.clear();
        primed_ = false;
    }
    if (s) {
        SpecsAudioPlayback_stop(s);
        SpecsAudioPlayback_streamClose(s);
    }
}

void SpeakerPlayback::push(const int16_t* pcm, int frames, int channels) {
    if (!pcm || frames <= 0) return;
    std::lock_guard<std::mutex> lk(mtx_);
    if (!active_) return;
    for (int i = 0; i < frames; ++i) {
        int v = 0;
        for (int c = 0; c < channels; ++c) v += pcm[i * channels + c];
        ring_.push_back(static_cast<int16_t>(v / (channels > 0 ? channels : 1)));
    }
    while (ring_.size() > kMaxQueuedSamples)
        ring_.pop_front();  // drop oldest — stay near-live rather than drift behind
    if (!primed_ && ring_.size() >= kPrimeSamples) primed_ = true;
}

void SpeakerPlayback::needDataTrampoline(SpecsAudioPlayback_Stream_t* /*stream*/,
                                         int32_t requestedFrames, uint64_t /*expectedPlayTimeNs*/,
                                         void* ctx) {
    static_cast<SpeakerPlayback*>(ctx)->onNeedData(requestedFrames);
}

void SpeakerPlayback::onNeedData(int32_t requestedFrames) {
    if (requestedFrames <= 0) return;
    SpecsAudioPlayback_Stream_t* s = nullptr;
    unsigned int ch = 1;
    std::vector<int16_t> buf;
    {
        std::lock_guard<std::mutex> lk(mtx_);
        if (!active_ || !stream_) return;
        s = stream_;
        ch = outChannels_;
        // Output buffer sized in the stream's RESOLVED frame layout.
        buf.assign(static_cast<size_t>(requestedFrames) * ch, 0);
        if (primed_) {
            if (ring_.empty()) {
                primed_ = false;  // underrun: re-buffer to the prime level (write silence now)
                ++underruns_;
            } else {
                // Ring is mono @ 48 kHz; step-resample if the stream negotiated a
                // different rate and fan the sample out across resolved channels.
                const double step = static_cast<double>(kRate) / outRate_;
                double pos = 0.0;
                size_t consumed = 0;
                for (int32_t i = 0; i < requestedFrames; ++i) {
                    const size_t idx = static_cast<size_t>(pos);
                    if (idx >= ring_.size()) break;  // short tail: end of utterance, pad zeros
                    const int16_t v = ring_[idx];
                    for (unsigned int c = 0; c < ch; ++c)
                        buf[static_cast<size_t>(i) * ch + c] = v;
                    pos += step;
                    consumed = idx + 1;
                }
                ring_.erase(ring_.begin(), ring_.begin() + static_cast<long>(consumed));
            }
        }
        // Not primed: whole buffer stays silence while the jitter buffer refills;
        // writing silence (not skipping) keeps the service from evicting the stream.
    }
    SpecsAudioPlayback_write(s, buf.data(), static_cast<int>(buf.size() * sizeof(int16_t)));
}

}  // namespace webrtcstream
