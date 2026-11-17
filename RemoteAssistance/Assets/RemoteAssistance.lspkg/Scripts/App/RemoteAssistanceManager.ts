// RemoteAssistanceManager — Core orchestrator for the Remote Assistance lens.
//
// OWNS: the call lifecycle (menu → call → back), the call session (WebRTC
//       media via CallStreamer + Snap Cloud mailbox signaling),
//       video-quality control, and the wiring of the drawing channel
//       (mailbox "draw" rows → AnnotationRenderer).
// EXPECTS (@input): snapCloud (Snap Cloud block — the call is skipped without
//       it), annotations (AnnotationRenderer on the authored Annotations3D
//       object).
// MUST NOT: build UI content itself (ModeMenuUI / PovPanelUI own their
//       surfaces) or touch stroke geometry (AnnotationRenderer owns it).
//
// The call is GLASSES-INITIATED and the helper joins from a WEB BROWSER (the
// package's web/ portal, served on the helper's machine — no phone app, no
// phone link). Pairing is the session code shown on the start menu: the
// wearer presses START, the helper enters the code in the portal, and the
// portal answers the Glasses' WebRTC offer over the same Snap Cloud DB mailbox
// that carries the drawing strokes. Media is peer-to-peer WebRTC: Glasses POV
// camera + mic go up; the helper's voice (and optionally their webcam) come
// back. While on the call the helper DRAWS on the POV video — stroke rows
// arrive on the mailbox (kind "draw") and render as 3D lines anchored in the
// wearer's world.

import { ModeMenuUI } from "./ModeMenuUI"
import { PovPanelUI } from "../WebRTC/PovPanelUI"
import { CallStreamer } from "../WebRTC/CallStreamer"
import { VIDEO_QUALITY_PRESETS_KBPS } from "../WebRTC/WebRTCSession"
import { RtcMailbox } from "../SnapCloud/RtcMailbox"
import { SnapCloudModule } from "../SnapCloud/SnapCloudModule"
import { AnnotationRenderer } from "../Drawing/AnnotationRenderer"
import { makeSessionCode, STREAMER_GLASSES, STREAMER_HELPER } from "./Types"

const CHIME_TRACK = requireAsset("../../Audio/ConnectChime.wav") as AudioTrackAsset

/** UI tag for a video-quality preset ("1K" / "2K" / "MAX"). */
function qualityLabel(kbps: number): string {
    return kbps >= 3000 ? "MAX" : kbps >= 1500 ? "2K" : "1K"
}

// Rotating call-setup loader lines (~7 s each). Call setup legitimately takes
// seconds — SDP/ICE ride polled DB rows — so keep the wait human. The session
// code is pinned above these so the helper can join at any point.
const CONNECTING_MESSAGES = [
    "Waiting for your helper to join…",
    "Connecting the dots…",
    "We're working on it…",
    "Herding video packets…",
    "Negotiating pixels with the cloud…",
    "Finding the shortest path to your helper…",
    "Good things take a second (or ten)…",
]

@component
export class RemoteAssistanceManager extends BaseScriptComponent {
    @ui.label('<span style="color: #60A5FA;">RemoteAssistanceManager – call + drawing orchestrator</span>')
    @ui.separator
    @ui.group_start("References")
    @input
    @allowUndefined
    @hint("Snap Cloud block — the ▸ Snap Cloud object (SnapCloudModule). Needed for the call's signaling + the drawing channel; without it the call is skipped.")
    snapCloud!: SnapCloudModule

    @input
    @hint("AnnotationRenderer on the authored Annotations3D object — renders the helper's strokes as 3D lines")
    annotations!: AnnotationRenderer
    @ui.group_end
    @ui.separator
    @ui.group_start("Settings")
    @input
    @hint("In the Lens Studio preview (no helper): stream demo strokes when a call starts, so the drawing pipeline is verifiable in-editor")
    simulateInPreview: boolean = true
    @ui.group_end

    // Scene refs — one "Remote Assistance" root with functional group nodes
    // under it (prefab-ready). Everything this manager spawns is parented
    // into the group it belongs to.
    private appRoot!: SceneObject
    private uiGroup!: SceneObject      // ModeMenu — all UI
    private videoGroup!: SceneObject   // POV panel + WebRTC native controllers
    private chime!: AudioComponent

    // Call state.
    private simulating = false
    private modeMenu!: ModeMenuUI
    private sessionCode = makeSessionCode()
    private povPanel: PovPanelUI | null = null
    private callStreamer: CallStreamer | null = null
    private callMailbox: RtcMailbox | null = null
    private chimedThisCall = false
    // Call-wide video quality preset (kbps). The LENS owns this value.
    private videoQualityKbps = VIDEO_QUALITY_PRESETS_KBPS[0]

    onAwake(): void {
        this.buildScene()
        this.buildModeMenu()
        this.createEvent("OnStartEvent").bind(() => this.onStart())
    }

    // ── Scene construction ──────────────────────────────────────────────

    private buildScene(): void {
        // Clean hierarchy: "Remote Assistance" root → UIPanel / VideoCall.
        this.appRoot = global.scene.createSceneObject("Remote Assistance")
        this.uiGroup = global.scene.createSceneObject("UIPanel")
        this.uiGroup.setParent(this.appRoot)
        this.videoGroup = global.scene.createSceneObject("VideoCall")
        this.videoGroup.setParent(this.appRoot)
        // Adopt the authored native-module controllers under VideoCall so all the
        // WebRTC pieces live together (skips gracefully if they aren't found).
        this.adoptRootByName("WebRTCController", this.videoGroup)
        this.adoptRootByName("StreamController", this.videoGroup)
        // The authored annotations object (AnnotationRenderer @input) joins the
        // root too — its stroke children are world-anchored, so the identity
        // reparent is purely organizational.
        if (this.annotations) {
            this.annotations.getSceneObject().setParent(this.appRoot)
        }

        // State-cue audio (LowLatency — reacts to the helper joining).
        this.chime = this.makeAudio(CHIME_TRACK)
    }

    /** Find a root scene object by name and reparent it under `parent` — used to
     *  pull the authored native-module controllers under the VideoCall group. */
    private adoptRootByName(name: string, parent: SceneObject): void {
        try {
            const count = global.scene.getRootObjectsCount()
            for (let i = 0; i < count; i++) {
                const obj = global.scene.getRootObject(i)
                if (obj && obj.name === name) {
                    obj.setParent(parent)
                    return
                }
            }
        } catch (e) {
            print("[RemoteAssistance] Could not adopt " + name + ": " + e)
        }
    }

    private buildModeMenu(): void {
        const menuObj = global.scene.createSceneObject("ModeMenu")
        menuObj.setParent(this.uiGroup)
        menuObj.getTransform().setWorldPosition(new vec3(0, 0, -110))
        this.modeMenu = menuObj.createComponent(ModeMenuUI.getTypeName()) as ModeMenuUI
        this.modeMenu.setSessionCode(this.sessionCode)
        this.modeMenu.onStartCall.add(() => this.startCall())
    }

    // ── The call ─────────────────────────────────────────────────────────

    private startCall(): void {
        this.teardownCall()
        print("[RemoteAssistance] Call starting. session=" + this.sessionCode)

        // The panel tethers itself to the wearer — no fixed placement
        // needed; it snaps to its anchor on the first frame.
        const panelObj = global.scene.createSceneObject("PovPanel")
        panelObj.setParent(this.videoGroup)
        this.povPanel = panelObj.createComponent(PovPanelUI.getTypeName()) as PovPanelUI
        this.povPanel.onClose.add(() => this.returnToMenu())
        // Quality button: cycle 1K → 2K → MAX; applied live to the POV encoder.
        this.povPanel.onQualityToggle.add(() => {
            const presets = VIDEO_QUALITY_PRESETS_KBPS
            const i = presets.indexOf(this.videoQualityKbps)
            this.applyVideoQuality(presets[(i + 1) % presets.length])
        })
        this.povPanel.setQualityLabel("VIDEO · " + qualityLabel(this.videoQualityKbps))
        this.povPanel.setCaption("CALL HELPER · code " + this.sessionCode)

        // The call streams OUR side purely over WebRTC: Glasses camera POV +
        // mic Opus up (native pov session), helper voice down. SDP/ICE are
        // exchanged via the Snap Cloud DB mailbox (RtcMailbox, PostgREST
        // polling) — media itself stays peer-to-peer WebRTC. The web portal
        // is the answering peer (sender "phoneB", kept from the phone era for
        // wire compatibility). The DRAWING channel rides the SAME mailbox:
        // kind "draw" rows from the helper land in the AnnotationRenderer as
        // world-anchored 3D lines.
        this.callMailbox = this.snapCloud
            ? this.snapCloud.createRtcMailbox(this.sessionCode, STREAMER_GLASSES)
            : null
        if (!this.callMailbox) {
            print("[RemoteAssistance] The call needs the Snap Cloud block (RtcMailbox signaling) — off/unwired, so the call is skipped.")
            if (this.povPanel) this.povPanel.setCaption("CALL HELPER · unavailable (Snap Cloud block off)")
            // Still demo the drawing pipeline in preview so it stays iterable.
            if (this.simulating && this.annotations) {
                this.annotations.simulateDemo()
            }
            return
        }

        this.callMailbox.start()
        // Helper clicks End Call in the web portal → cloud "bye" → end the
        // call on the Glasses too.
        this.callMailbox.onRtcSignal("bye", STREAMER_HELPER, () => this.handleRemoteHangup())
        // Drawing channel: helper stroke/clear rows → 3D annotations.
        if (this.annotations) {
            this.callMailbox.onRtcSignal("draw", STREAMER_HELPER,
                (p) => this.annotations.handleSignal(p))
        }
        this.callStreamer = new CallStreamer(this, this.callMailbox)
        // Helper → Glasses video: when the decoded helper-camera texture is
        // ready, show it on the POV panel.
        this.callStreamer.onFriendVideoTexture = (tex) => {
            if (this.povPanel) this.povPanel.setFrameTexture(tex)
        }
        this.callStreamer.start()
        this.chimedThisCall = false
        if (this.povPanel) {
            this.povPanel.setClearDrawingsVisible(true)
            this.povPanel.onClearDrawings.add(() => this.clearDrawings())
        }
        const statusPoll = this.createEvent("DelayedCallbackEvent")
        statusPoll.bind(() => {
            if (!this.callStreamer || !this.povPanel) return // torn down
            if (!this.callStreamer.mediaConnected) {
                // Setup takes seconds by design (polled DB signaling) — keep
                // the session code pinned and rotate a playful loader line.
                const i = Math.floor(getTime() / 7) % CONNECTING_MESSAGES.length
                this.povPanel.setCaption("CALL HELPER · code " + this.sessionCode +
                    "\n" + CONNECTING_MESSAGES[i])
            } else {
                if (!this.chimedThisCall) {
                    this.chimedThisCall = true
                    this.chime.play(1)
                }
                this.povPanel.setCaption(
                    "CALL HELPER · " + this.callStreamer.transportLine() +
                    "\n" + this.callStreamer.micStatusLine() +
                    " · " + this.callStreamer.friendVideoLine() +
                    (this.annotations ? " · " + this.annotations.statusLine() : ""))
            }
            statusPoll.reset(1)
        })
        statusPoll.reset(1)
        this.logCallState("call started")
        // Preview: no helper can draw, so stream a demo drawing through
        // the real applyStroke path to verify the pipeline in-editor.
        if (this.simulating && this.annotations) {
            this.annotations.simulateDemo()
        }
    }

    /** Clear the 3D annotations locally AND tell the helper (a "draw"
     *  clear row) so the portal overlay can mirror the wipe. */
    private clearDrawings(): void {
        if (this.annotations) this.annotations.clearAll()
        if (this.callMailbox) {
            this.callMailbox.sendRtcSignal("draw", STREAMER_GLASSES,
                { t: "clear", sdp: JSON.stringify({ scope: "all" }) })
        }
        print("[RemoteAssistance] Drawings cleared (wearer).")
    }

    /** The helper ended the call from the portal (a cloud "bye" arrived on the
     *  mailbox). End the call here too. */
    private handleRemoteHangup(): void {
        if (!this.callStreamer && !this.callMailbox) return // no active call
        print("[RemoteAssistance] Helper hung up (cloud bye) — ending call.")
        this.teardownCall(false) // no bye echo — the helper already left
        this.logCallState("call ended")
        this.returnToMenu()
    }

    /** One consistent status line for the whole call state, mirrored by the
     *  portal's status line so the two ends can be diffed at a glance. */
    private logCallState(reason: string): void {
        const transport = this.callStreamer ? this.callStreamer.transportLine() : "no call"
        print("[CallState] " + reason +
            " | call=" + (this.callStreamer !== null) +
            " session=" + this.sessionCode +
            " | " + transport)
    }

    /** Stop the streamer and remove the POV panel (call exit).
     *  `sendBye` (default true): when a call session is live, post a cloud
     *  "bye" so the helper portal tears its side down too. Pass false when
     *  this teardown was itself triggered by the helper's bye, so we don't
     *  echo it back. */
    private teardownCall(sendBye: boolean = true): void {
        if (sendBye && this.callStreamer && this.callMailbox) {
            this.callMailbox.sendRtcSignal("bye", STREAMER_GLASSES, { t: "bye" })
            this.logCallState("call ended (Glasses)")
        }
        if (this.callStreamer) {
            this.callStreamer.stop()
            this.callStreamer = null
        }
        if (this.callMailbox) {
            this.callMailbox.stop()
            this.callMailbox = null
        }
        // Drawings belong to the call session — wipe them with it.
        if (this.annotations) this.annotations.clearAll()
        if (this.povPanel) {
            // Hide instantly; defer destroy — tearing the hierarchy down from
            // inside the panel's own button callback is unreliable on device.
            const panelObj = this.povPanel.getSceneObject()
            panelObj.enabled = false
            const destroyEvt = this.createEvent("DelayedCallbackEvent")
            destroyEvt.bind(() => panelObj.destroy())
            destroyEvt.reset(0.1)
            this.povPanel = null
        }
    }

    /**
     * Apply a video-quality preset (kbps) — the ONE place the setting changes.
     * Reaches the POV HW encoder live (no renegotiation) and updates the
     * panel button.
     */
    private applyVideoQuality(kbps: number): void {
        this.videoQualityKbps = kbps
        const applied = this.callStreamer ? this.callStreamer.setVideoBitrate(kbps) : 0
        if (this.povPanel) {
            this.povPanel.setQualityLabel("VIDEO · " + qualityLabel(kbps))
        }
        print("[RemoteAssistance] Video quality -> " + kbps + " kbps (" +
            qualityLabel(kbps) + (applied === 0 ? ", encoder not running yet" : "") + ").")
    }

    /** CHANGE MODES (POV panel) — back to the start menu. */
    private returnToMenu(): void {
        this.teardownCall()
        this.modeMenu.show()
        print("[RemoteAssistance] Returned to start menu.")
    }

    private makeAudio(track: AudioTrackAsset): AudioComponent {
        const audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
        audio.audioTrack = track
        audio.playbackMode = Audio.PlaybackMode.LowLatency
        audio.volume = 0.8
        return audio
    }

    // ── Lifecycle ───────────────────────────────────────────────────────

    private onStart(): void {
        this.simulating = this.simulateInPreview && global.deviceInfoSystem.isEditor()
        print("[RemoteAssistance] Started. simulating=" + this.simulating +
            " session=" + this.sessionCode)
    }
}
