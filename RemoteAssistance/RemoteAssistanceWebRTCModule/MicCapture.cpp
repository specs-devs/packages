#include "MicCapture.hpp"

#include <SpecsAudioRecord.h>

#include <cstdio>

namespace webrtcstream {

MicCapture::~MicCapture() { stop(); }

bool MicCapture::start(const MicFrameSink& sink) {
    if (active_.load()) return true;
    sink_ = sink;

    SpecsAudioRecord_Config_t* cfg = SpecsAudioRecord_configCreate();
    if (!cfg) {
        std::fprintf(stderr, "[MicCapture] configCreate failed\n");
        return false;
    }
    // 48 kHz mono PCM16 — matches the Opus track; VOICE_CALL source enables echo
    // cancellation, which matters for a two-way agent conversation: without it the
    // agent's own voice from the speakers loops back into the mic (and can retrigger
    // the wake phrase). The Twitch broadcast build used CAMCORDER instead.
    SpecsAudioRecord_configSetSampleRate(cfg, SPECSAUDIORECORD_SAMPLERATE_48K);
    SpecsAudioRecord_configSetChannels(cfg, 1);
    SpecsAudioRecord_configSetFormat(cfg, SPECSAUDIORECORD_FORMAT_PCM16);
    SpecsAudioRecord_configSetSourceType(cfg, SPECSAUDIORECORD_SOURCE_VOICE_CALL);
    channels_ = 1;
    sampleRate_ = 48000;

    stream_ = SpecsAudioRecord_streamOpen(cfg);
    SpecsAudioRecord_configDestroy(cfg);
    if (!stream_) {
        std::fprintf(stderr, "[MicCapture] streamOpen failed\n");
        return false;
    }

    if (SpecsAudioRecord_setDataCallback(stream_, &MicCapture::dataTrampoline, this) !=
        SPECSAUDIORECORD_OK) {
        std::fprintf(stderr, "[MicCapture] setDataCallback failed\n");
        SpecsAudioRecord_streamClose(stream_);
        stream_ = nullptr;
        return false;
    }

    SpecsAudioRecord_awaitReady(stream_, 2000);  // best-effort; start still gated below

    active_.store(true);
    if (SpecsAudioRecord_start(stream_) != SPECSAUDIORECORD_OK) {
        std::fprintf(stderr, "[MicCapture] start failed\n");
        active_.store(false);
        SpecsAudioRecord_streamClose(stream_);
        stream_ = nullptr;
        return false;
    }
    std::fprintf(stderr, "[MicCapture] mic streaming 48k mono PCM16\n");
    return true;
}

void MicCapture::stop() {
    active_.store(false);
    if (stream_) {
        SpecsAudioRecord_stop(stream_);
        SpecsAudioRecord_streamClose(stream_);
        stream_ = nullptr;
    }
}

void MicCapture::dataTrampoline(SpecsAudioRecord_Stream_t*, const void* data,
                                int32_t byteCount, uint64_t timestampMs, void* ctx) {
    auto* self = static_cast<MicCapture*>(ctx);
    if (!self) return;
    try {
        self->onData(data, byteCount, timestampMs);
    } catch (...) {
    }
}

void MicCapture::onData(const void* data, int32_t byteCount, uint64_t timestampMs) {
    if (!active_.load() || !data || byteCount <= 0 || channels_ <= 0) return;
    const int bytesPerSample = 2;  // PCM16
    const int frames = byteCount / (bytesPerSample * channels_);
    if (frames <= 0) return;
    // timestamp is in ms (0 if unavailable); swrtc wants microseconds.
    sink_(reinterpret_cast<const int16_t*>(data), frames, channels_, sampleRate_,
          timestampMs * 1000ULL);
}

} // namespace webrtcstream
