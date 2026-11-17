// SnapCloudModule — the Snap Cloud building block as a drop-in scene component.
//
// Owns the app's Snap Cloud services and hands them to Core (FriendFinderManager)
// through an @input reference instead of Core importing + constructing them — so
// the Snap Cloud block is a self-contained object a developer can drop into any
// scene:
//   • CloudPathLogger  — fire-and-forget position history (shared, built once).
//   • CloudCheckpoints — geofence "was here" notes, bound to that logger.
//   • RtcMailbox       — per-session WebRTC signaling over the Snap Cloud DB.
//
// Snap Cloud is OPTIONAL: disable this object (or leave Core's @input unwired)
// and Core runs fully offline — no path logging, no checkpoints, and Call Friend's
// cloud signaling is skipped. Every accessor returns null while the module is
// inactive, so Core degrades gracefully.

import { CloudPathLogger } from "./CloudPathLogger"
import { CloudCheckpoints } from "./CloudCheckpoints"
import { RtcMailbox } from "./RtcMailbox"

@component
export class SnapCloudModule extends BaseScriptComponent {
    private _logger: CloudPathLogger | null = null

    /** True only while this module's object is enabled in the hierarchy — the
     *  single switch a developer flips to take the whole block offline. */
    private get active(): boolean {
        return this.enabled && this.getSceneObject().isEnabledInHierarchy
    }

    /** The shared position-history logger (fire-and-forget), or null when the
     *  module is inactive. Constructed once, owned by this component. Caller
     *  still drives its lifecycle (start()), preserving the original timing. */
    getPathLogger(): CloudPathLogger | null {
        if (!this.active) return null
        if (!this._logger) this._logger = new CloudPathLogger(this)
        return this._logger
    }

    /** Checkpoint geofence detector bound to the shared logger, or null when the
     *  module is inactive. Caller drives onVisit + start(). */
    createCheckpoints(): CloudCheckpoints | null {
        const logger = this.getPathLogger()
        if (!logger) return null
        return new CloudCheckpoints(this, logger)
    }

    /** A WebRTC signaling mailbox for one session/streamer, or null when the
     *  module is inactive (Call Friend's cloud signaling is then unavailable). */
    createRtcMailbox(session: string, streamer: string): RtcMailbox | null {
        if (!this.active) return null
        return new RtcMailbox(this, session, streamer)
    }
}
