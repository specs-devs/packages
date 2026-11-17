#pragma once
//
// AudioFocusSession — registers a foreground AUDIO_IN_OUT focus session (the
// documented "voice-call style" reservation) with the SnapOS audio coordinator
// while the agent session runs. Per the SpecsNDK docs, raw SpecsAudioRecord +
// SpecsAudioPlayback users should hold a focus session so the platform
// arbitrates the hardware for them; without it concurrent mic+speaker use is
// uncoordinated and can be preempted or degraded.
//
#include <atomic>

struct SpecsForegroundAudioSessionCoordinator;
struct SpecsForegroundAudioFocusSessionSubscription;

namespace webrtcstream {

class AudioFocusSession {
public:
    ~AudioFocusSession();
    // Register the AUDIO_IN_OUT focus session (idempotent). Returns false on failure.
    bool acquire();
    void release();  // idempotent
    bool active() const { return active_.load(); }

private:
    SpecsForegroundAudioSessionCoordinator* coordinator_ = nullptr;
    SpecsForegroundAudioFocusSessionSubscription* subscription_ = nullptr;
    std::atomic<bool> active_{false};
};

} // namespace webrtcstream
