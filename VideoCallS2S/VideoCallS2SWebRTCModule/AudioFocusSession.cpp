#include "AudioFocusSession.hpp"

#include <SpecsForegroundAudioSessionCoordinator.h>

#include <cstdio>

namespace webrtcstream {
namespace {

void onClosed(void*) { std::fprintf(stderr, "[AudioFocusSession] closed by service\n"); }
void onInactive(void*, SpecsForegroundAudioSession_InactiveReason reason) {
    std::fprintf(stderr, "[AudioFocusSession] inactive (reason=%d)\n", static_cast<int>(reason));
}
void onActive(void*) { std::fprintf(stderr, "[AudioFocusSession] active\n"); }
void getAudioClientIds(void*, const int64_t** outIds, size_t* outCount) {
    *outIds = nullptr;
    *outCount = 0;
}
void getOwnerDisplayName(void*, const char** outName) { *outName = "VideoCallS2S"; }
void getFocusType(void*, SpecsForegroundAudioSession_FocusType* outType) {
    *outType = SPECS_FOREGROUND_AUDIO_SESSION_FOCUS_TYPE_AUDIO_IN_OUT;
}

// Owned by the caller and must stay valid until the subscription closes.
constexpr SpecsForegroundAudioFocusSession_Callbacks kCallbacks{
    nullptr, onClosed, onInactive, onActive, getAudioClientIds,
    getOwnerDisplayName, getFocusType,
};

}  // namespace

AudioFocusSession::~AudioFocusSession() { release(); }

bool AudioFocusSession::acquire() {
    if (active_.load()) return true;
    if (SpecsForegroundAudioSessionCoordinator_create(&coordinator_) !=
            SPECS_FOREGROUND_AUDIO_SESSION_SUCCESS || !coordinator_) {
        std::fprintf(stderr, "[AudioFocusSession] coordinator create failed\n");
        coordinator_ = nullptr;
        return false;
    }
    if (SpecsForegroundAudioSessionCoordinator_registerFocusSession(
            coordinator_, SPECS_FOREGROUND_AUDIO_SESSION_PRIORITY_HIGH, &kCallbacks,
            &subscription_) != SPECS_FOREGROUND_AUDIO_SESSION_SUCCESS || !subscription_) {
        std::fprintf(stderr, "[AudioFocusSession] registerFocusSession failed\n");
        SpecsForegroundAudioSessionCoordinator_delete(coordinator_);
        coordinator_ = nullptr;
        subscription_ = nullptr;
        return false;
    }
    active_.store(true);
    return true;
}

void AudioFocusSession::release() {
    if (!active_.exchange(false)) return;
    if (subscription_) {
        SpecsForegroundAudioFocusSessionSubscription_close(subscription_);
        subscription_ = nullptr;
    }
    if (coordinator_) {
        SpecsForegroundAudioSessionCoordinator_delete(coordinator_);
        coordinator_ = nullptr;
    }
}

}  // namespace webrtcstream
