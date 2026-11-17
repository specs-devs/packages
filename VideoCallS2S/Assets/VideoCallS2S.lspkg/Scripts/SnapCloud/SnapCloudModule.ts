// SnapCloudModule — the Snap Cloud building block as a drop-in scene component.
//
// Owns the app's only Snap Cloud service — the RtcMailbox that carries the call
// handshake + WebRTC signaling — and hands it to Core (VideoCallS2SManager)
// through an @input reference. Credentials come from the package's
// SnapCloudRequirements component (assign YOUR SupabaseProject asset there),
// read through the sibling SupabaseRequirements bridge.
//
// Without a configured project the module reports unconfigured and every
// accessor returns null: the UI still shows, but calling is disabled.

import { RtcMailbox } from "./RtcMailbox"
import { SupabaseRequirements } from "./SupabaseRequirements"

@component
export class SnapCloudModule extends BaseScriptComponent {
    /** True only while this module's object is enabled in the hierarchy. */
    private get active(): boolean {
        return this.enabled && this.getSceneObject().isEnabledInHierarchy
    }

    /** Whether a SupabaseProject asset is assigned (SupabaseRequirements). */
    isConfigured(): boolean {
        return this.active && SupabaseRequirements.getProject("SnapCloudModule") !== null
    }

    /** A mailbox for one session as sender `me`, or null when the module is
     *  inactive / unconfigured. The caller drives start() / stop(). */
    createRtcMailbox(session: string, me: string, pollInterval?: number): RtcMailbox | null {
        if (!this.isConfigured()) return null
        return new RtcMailbox(this, session, me, pollInterval)
    }
}
