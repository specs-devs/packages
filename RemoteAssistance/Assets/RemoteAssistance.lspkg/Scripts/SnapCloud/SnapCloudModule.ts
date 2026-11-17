// SnapCloudModule — the Snap Cloud building block as a drop-in scene component.
//
// Owns the app's Snap Cloud services and hands them to Core
// (RemoteAssistanceManager) through an @input reference instead of Core
// importing + constructing them — so the Snap Cloud block is a self-contained
// object a developer can drop into any scene:
//   • RtcMailbox — per-session WebRTC signaling + the drawing channel over the
//     Snap Cloud DB (`rtc_signals` rows via PostgREST).
//
// Snap Cloud is REQUIRED for Call Assistance's signaling: disable this object
// (or leave Core's @input unwired) and the call is skipped gracefully. Every
// accessor returns null while the module is inactive.

import { RtcMailbox } from "./RtcMailbox"
import { SnapCloudRequirements } from "../../SnapCloudRequirements"

@component
export class SnapCloudModule extends BaseScriptComponent {
    @input
    @allowUndefined
    @hint("SnapCloudRequirements holding the SupabaseProject. Empty: falls back to the deprecated SupabaseRequirements component")
    snapCloudRequirements: SnapCloudRequirements

    /** True only while this module's object is enabled in the hierarchy — the
     *  single switch a developer flips to take the whole block offline. */
    private get active(): boolean {
        return this.enabled && this.getSceneObject().isEnabledInHierarchy
    }

    /** A WebRTC signaling + drawing mailbox for one session/streamer, or null
     *  when the module is inactive (the call's cloud signaling is then
     *  unavailable). */
    createRtcMailbox(session: string, streamer: string): RtcMailbox | null {
        if (!this.active) return null
        const requirements = this.snapCloudRequirements
        if (!requirements) {
            return new RtcMailbox(this, session, streamer)
        }
        return new RtcMailbox(this, session, streamer, () =>
            requirements.isConfigured() ? requirements.getSupabaseProject() : null)
    }
}
