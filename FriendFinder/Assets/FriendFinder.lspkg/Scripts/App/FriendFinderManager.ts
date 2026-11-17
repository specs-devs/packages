// FriendFinderManager — AR guidance to a friend's phone.
//
// Renders two things in front of the wearer:
//   1. DestinationPointer — a camera-anchored 3D arrow (~50 cm ahead, below eye
//      line) that smoothly yaws toward the friend's real-world bearing.
//   2. FriendMarker — a pulsing sphere placed in the world along that bearing
//      (distance clamped to 5–30 m), with a billboarded label above it showing
//      the friend phone's network name and live distance (FriendMarkerUI).
//
// Location sources:
//   - Friend: always from the paired iPhone over Glasses Mobile Kit ("location"
//     subscription — see MobileKitLink.ts and iOS/FriendFinder/MobileKitModel.swift).
//   - Self: Glasses GeoLocation by default, or the phone's GPS when
//     usePhoneLocation is on. In the Lens Studio preview a simulation feed runs
//     instead (simulateInPreview, auto-detected via isEditor()).
//
// Every fix is also mirrored to Snap Cloud (CloudPathLogger — fire-and-forget).

import {
    haversineMeters,
    initialBearing,
    toRad,
    toDeg,
    shortestAngleDeg,
    smoothFactor,
} from "../Geolocation/GeoMath"
import { MobileKitLink, LocationFix } from "../MobileKit/MobileKitLink"
import { CloudPathLogger } from "../SnapCloud/CloudPathLogger"
import { FriendPositionEstimator } from "../Geolocation/FriendPositionEstimator"
import { CloudCheckpoints, CheckpointVisitNote } from "../SnapCloud/CloudCheckpoints"
import { FriendMarkerUI } from "../Geolocation/FriendMarkerUI"
import { MiniMapUI } from "../Geolocation/MiniMapUI"
import { IncomingCallUI } from "./IncomingCallUI"
import { ModeMenuUI } from "./ModeMenuUI"
import { PovPanelUI } from "../WebRTC/PovPanelUI"
import { PovVideoSource, SyntheticPovSource, WebRtcWatchYourBackSource } from "../WebRTC/PovVideoSource"
import { CallStreamer } from "../WebRTC/CallStreamer"
import { VIDEO_QUALITY_PRESETS_KBPS } from "../WebRTC/WebRTCSession"
import { RtcMailbox } from "../SnapCloud/RtcMailbox"
import { MobileKitModule } from "../MobileKit/MobileKitModule"
import { SnapCloudModule } from "../SnapCloud/SnapCloudModule"
import { ModeSelection, makeSessionCode, STREAMER_GLASSES, STREAMER_PHONE_FRIEND } from "./Types"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

// Ensure these native modules are included in the Lens package.
require("LensStudio:RawLocationModule")
// Mobile Kit is owned by the PhoneLink block (MobileKitModule.ts) — the single
// SpectaclesMobileKitModule require lives there, wired into this manager via the
// `mobileKit` @input below. Never re-add a SpectaclesMobileKitModule asset/@input.

const POINTER_PREFAB = requireAsset("../../Meshes/DestinationPointer.glb") as ObjectPrefab
const MARKER_MESH = requireAsset("../../Meshes/MarkerSphere.mesh") as RenderMesh
const MARKER_MAT = requireAsset("../../Materials/MarkerMat.mat") as Material
const CHIME_TRACK = requireAsset("../../Audio/ConnectChime.wav") as AudioTrackAsset
const PING_TRACK = requireAsset("../../Audio/TargetPing.wav") as AudioTrackAsset

// Pointer follow (world-space, cm): the arrow continuously eases toward its
// anchor ~50 cm ahead / 12 cm below eye line every frame — no dead zone, no
// parked-then-jump. Critically-damped feel via exponential lerp.
const TETHER_FORWARD_CM = 50
const TETHER_DOWN_CM = 12
const POINTER_FOLLOW_RATE = 6.5
// Arrow look-at smoothing (per second) — lazy enough to feel physical.
const LOOKAT_SMOOTH_RATE = 6
// Marker render-distance clamp (cm): 5–30 m.
const MARKER_MIN_CM = 500
const MARKER_MAX_CM = 3000
// Marker apparent size: diameter as a fraction of its distance (~2.5° angular).
const MARKER_DIAMETER_RATIO = 0.045
// The label UI is authored for the z = -110 cm focal plane; scale keeps its
// angular size constant at any marker distance.
const LABEL_FOCAL_CM = 110
// Authored half-height of the label panel (cm) — used to keep the panel's
// bottom edge clear of the sphere at any distance/scale.
const LABEL_PANEL_HALF_H_CM = 6.5
// Smoothing rates (per second) — higher = snappier, lower = floatier.
const YAW_SMOOTH_RATE = 8
const POS_SMOOTH_RATE = 4
// Guidance debug: journal print every 2 s + numbers appended to the label.
// Face north with a phone compass in hand — hdg should read ~0, east ~90.
const DEBUG_GUIDANCE = true
// A UWB reading older than this falls back to GPS haversine.
const UWB_FRESH_S = 3

/** UI tag for a video-quality preset ("1K" / "2K" / "MAX"). */
function qualityLabel(kbps: number): string {
    return kbps >= 3000 ? "MAX" : kbps >= 1500 ? "2K" : "1K"
}

// Incoming-call dialog auto-dismiss ("missed"). Must stay SHORTER than the
// friend phone's ringing fallback (75 s in ContentView.swift): this timeout is
// the authoritative resolution of an unanswered call — it dismisses the dialog
// AND tells the friend "missed" — while the phone's fallback only covers the
// case where that message never arrives.
const INCOMING_CALL_RING_S = 60

// Rotating call-setup loader lines (~7 s each). Call setup legitimately takes
// seconds — SDP/ICE ride polled DB rows — so keep the wait human. Mirrored on
// the phone in RemotePovView.swift; keep the two lists in sync-ish.
const CONNECTING_MESSAGES = [
    "Connecting the dots…",
    "We're working on it…",
    "Taking longer than expected — hang tight…",
    "Herding video packets…",
    "Negotiating pixels with the cloud…",
    "Finding the shortest path to your friend…",
    "Still dialing across the internet…",
    "Warming up the cameras…",
    "Trading secret handshakes…",
    "Good things take a second (or ten)…",
]

@component
export class FriendFinderManager extends BaseScriptComponent {
    @input
    @hint("Friend marker label UI (wired by scene bootstrap)")
    uiLabel!: FriendMarkerUI

    @input
    @hint("Feed fake self+friend GPS in the Lens Studio preview (no phone connection exists there)")
    simulateInPreview: boolean = true

    @input
    @hint("Default GPS source before the menu picks one: ON = iPhone (Mobile application), OFF = Glasses GeoLocation. The start menu's GPS SOURCE switch overrides this at launch.")
    usePhoneLocation: boolean = true

    @input
    @hint("North-up debug minimap panel in Find Friend mode — compare against the phone app's map")
    showMiniMap: boolean = true

    @input
    @hint("PhoneLink block — the ▸ PhoneLink · Mobile Kit object (MobileKitModule). REQUIRED transport.")
    mobileKit!: MobileKitModule

    @input
    @allowUndefined
    @hint("Snap Cloud block — the ▸ Snap Cloud object (SnapCloudModule). OPTIONAL: unwire or disable its object to run offline (no path logging / checkpoints / cloud call-signaling).")
    snapCloud!: SnapCloudModule

    @input
    @hint("Lower the start menu by this much (cm) below eye level, e.g. to leave room for a panel above it")
    menuDrop: number = 0

    // Scene refs
    private cameraProvider = WorldCameraFinderProvider.getInstance()
    // Clean scene architecture: one "Friend Finder" root with three functional
    // group nodes under it (prefab-ready). Everything this manager spawns is
    // parented into the group it belongs to.
    private friendFinderRoot!: SceneObject
    private uiGroup!: SceneObject      // ModeMenu, IncomingCall — all UI
    private videoGroup!: SceneObject   // POV panel + WebRTC native controllers
    private geoGroup!: SceneObject     // arrow, marker, minimap — GPS/UWB guidance
    private pointerRoot!: SceneObject
    private markerRoot!: SceneObject
    private markerVisualObj!: SceneObject
    private miniMapObj!: SceneObject
    private miniMap!: MiniMapUI
    private chime!: AudioComponent
    private ping!: AudioComponent

    // Services — resolved from the module blocks (@input) at onAwake, not
    // constructed here. `cloud` is null when the Snap Cloud block is absent/off.
    private phoneLink!: MobileKitLink
    private cloud: CloudPathLogger | null = null
    private cloudCheckpoints: CloudCheckpoints | null = null
    private locationService: LocationService | null = null

    // Guidance state
    private simulating = false
    private gpsActive = false
    private haveSelf = false
    private haveFriend = false
    private selfLat = 0
    private selfLon = 0
    private selfAccuracy: number | null = null
    private lastSelfFixAt = -1
    private lastFriendFixAt = -1
    private selfAlt: number | null = null
    private selfVAcc: number | null = null
    private selfPressure: number | null = null
    private friendLat = 0
    private friendLon = 0
    private friendAlt: number | null = null
    private friendVAcc: number | null = null
    private friendPressure: number | null = null
    private friendAccuracy: number | null = null
    private friendName: string | null = null
    // Most-probable-position estimator: heading/velocity extrapolation so the
    // friend marker survives a live-link dropout (media doesn't, position does).
    private friendEstimator = new FriendPositionEstimator()
    private friendEstStale = false
    private friendEstAgeS = 0
    // UWB phone-to-phone distance (m) — beats GPS haversine while fresh.
    private friendUwbDistM: number | null = null
    private lastUwbAt = -1
    private uwbActive = false
    private glassesHeadingDeg: number | null = null
    private phoneHeadingDeg: number | null = null
    private smoothedRelDeg: number | null = null
    private smoothedMarkerPos: vec3 | null = null
    private baseDiameterCm: number | null = null
    // False until the pointer has been placed once (snap on first show).
    private pointerPlaced = false
    // Snap (not slerp) the arrow's aim on its first frame after being shown.
    private pointerRotSnap = false

    // FriendFinder modes (picked on the start menu).
    private modeMenu!: ModeMenuUI
    private selection: ModeSelection | null = null
    private sessionCode = makeSessionCode()
    private povPanel: PovPanelUI | null = null
    private wybSource: PovVideoSource | null = null
    private callStreamer: CallStreamer | null = null
    private callMailbox: RtcMailbox | null = null
    private callLive = false
    private incomingCall: IncomingCallUI | null = null
    // Auto-dismisses an unanswered incoming-call dialog (missed call).
    private incomingCallTimeout: DelayedCallbackEvent | null = null
    // Call-wide video quality preset (kbps). The LENS owns this value: the
    // phone requests changes, the lens applies + acks, every UI mirrors the ack.
    private videoQualityKbps = VIDEO_QUALITY_PRESETS_KBPS[0]
    // True while the incoming-call dialog has temporarily hidden the start
    // menu (its interaction plane would otherwise block the dialog buttons).
    private menuHiddenForCall = false
    private get findEnabled(): boolean {
        return this.selection !== null && this.selection.findFriend
    }
    // Test messages hold the status line for a few seconds so they're readable.
    private testStatusUntil = 0
    // Guidance debug state (DEBUG_GUIDANCE).
    private lastDebugPrint = 0
    private dbgLine: string | null = null

    onAwake(): void {
        this.buildScene()
        this.buildModeMenu()

        // Service blocks (@input) are resolved in onStart(), not here: this manager
        // sits under ● Core at the top of the hierarchy, so its onAwake runs before
        // the module components lower down are awake — their typed methods aren't
        // available until every onAwake has completed. onStart is the first safe
        // point to read them. See resolveServiceBlocks().
        this.createEvent("OnStartEvent").bind(() => this.onStart())
        this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    }

    // ── Scene construction (all composition happens here, in code) ──────

    private buildScene(): void {
        // 0. Clean hierarchy: "Friend Finder" root → UIPanel / VideoCall / GeoFinder.
        this.friendFinderRoot = global.scene.createSceneObject("Friend Finder")
        this.uiGroup = global.scene.createSceneObject("UIPanel")
        this.uiGroup.setParent(this.friendFinderRoot)
        this.videoGroup = global.scene.createSceneObject("VideoCall")
        this.videoGroup.setParent(this.friendFinderRoot)
        this.geoGroup = global.scene.createSceneObject("GeoFinder")
        this.geoGroup.setParent(this.friendFinderRoot)
        // Adopt the authored native-module controllers under VideoCall so all the
        // WebRTC pieces live together (skips gracefully if they aren't found).
        this.adoptRootByName("WebRTCController", this.videoGroup)
        this.adoptRootByName("StreamController", this.videoGroup)

        // 1. World-space tethered destination pointer (generated GLB, -Z forward
        //    baked). Position is driven by the tether solver in onUpdate.
        this.pointerRoot = global.scene.createSceneObject("DestinationPointer")
        this.pointerRoot.setParent(this.geoGroup)
        POINTER_PREFAB.instantiate(this.pointerRoot) // default 100x scale — displayed 8.8 x 1.7 x 12 cm
        this.pointerRoot.enabled = false

        // 2. World-anchored friend marker (sphere primitive + unlit teal material).
        this.markerRoot = global.scene.createSceneObject("FriendMarker")
        this.markerRoot.setParent(this.geoGroup)
        this.markerVisualObj = global.scene.createSceneObject("MarkerSphereVisual")
        this.markerVisualObj.setParent(this.markerRoot)
        const rmv = this.markerVisualObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
        rmv.mesh = MARKER_MESH
        rmv.mainMaterial = MARKER_MAT
        this.markerRoot.enabled = false

        // 2b. Debug minimap (tethers itself ahead-right; shown with the other
        //     Find visuals when showMiniMap is on).
        this.miniMapObj = global.scene.createSceneObject("MiniMap")
        this.miniMapObj.setParent(this.geoGroup)
        this.miniMap = this.miniMapObj.createComponent(MiniMapUI.getTypeName()) as MiniMapUI
        this.miniMap.onClose.add(() => this.returnToMenu())
        this.miniMapObj.enabled = false

        // 3. State-cue audio (LowLatency — these react to connection events).
        this.chime = this.makeAudio(CHIME_TRACK)
        this.ping = this.makeAudio(PING_TRACK)

        // The friend marker's label (authored @input) belongs with the guidance.
        if (this.uiLabel) this.uiLabel.getSceneObject().setParent(this.geoGroup)
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
            print("[FriendFinder] Could not adopt " + name + ": " + e)
        }
    }

    private buildModeMenu(): void {
        const menuObj = global.scene.createSceneObject("ModeMenu")
        menuObj.setParent(this.uiGroup)
        menuObj.getTransform().setWorldPosition(new vec3(0, -this.menuDrop, -110))
        this.modeMenu = menuObj.createComponent(ModeMenuUI.getTypeName()) as ModeMenuUI
        this.modeMenu.onStartSelected.add((sel) => this.applySelection(sel))
    }

    private applySelection(sel: ModeSelection): void {
        this.teardownModes()
        this.selection = sel
        // GPS self-location source is chosen on the start menu (default: the
        // phone, "Mobile application"). Apply it before the find branch below,
        // which uses it to decide whether to spin up Glasses GeoLocation.
        this.usePhoneLocation = sel.usePhoneLocation
        print("[FriendFinder] Modes: wyb=" + sel.watchYourBack + " call=" + sel.callFriend +
            " find=" + sel.findFriend + " source=" + sel.source +
            " usePhoneLocation=" + sel.usePhoneLocation +
            " session=" + this.sessionCode)

        // Tell the bonded phone (it forwards to the friend phone via multipeer).
        this.phoneLink.sendControl({
            type: "peopleFinder-control",
            session: this.sessionCode,
            wyb: sel.watchYourBack,
            call: sel.callFriend,
            find: sel.findFriend,
            source: sel.source,
            camera: sel.callFriend ? "front" : "back",
        })

        if (sel.findFriend) {
            if (!this.simulating && !this.usePhoneLocation) {
                this.startGps()
            }
            if (this.uiLabel) {
                // Re-enable explicitly: a previous find-off session leaves the
                // label disabled, and the guided path only enables it once both
                // fixes exist — without this, toggling find back ON shows nothing.
                this.uiLabel.getSceneObject().enabled = true
                this.uiLabel.setStatus(this.simulating ? "SIMULATED PREVIEW" : "Waiting for phone…")
            }
            this.miniMapObj.enabled = this.showMiniMap
            this.miniMap.setWaiting(this.simulating ? "sim fixes incoming…" : "waiting for GPS fixes…")
        } else {
            // Find Friend off: hide every guidance visual right now (arrow,
            // marker sphere, and the friend info frame) — don't wait a frame.
            this.setFindVisualsEnabled(false)
        }

        // POV viewer panel: Watch Your Back shows the chosen phone;
        // Call Friend is Glasses ↔ friend's phone (they see your POV, you see
        // theirs) — the bonded phone only relays control.
        if (sel.watchYourBack || sel.callFriend) {
            // The panel tethers itself to the wearer (arrow idiom) — no fixed
            // placement needed; it snaps to its anchor on the first frame.
            const panelObj = global.scene.createSceneObject("PovPanel")
            panelObj.setParent(this.videoGroup)
            this.povPanel = panelObj.createComponent(PovPanelUI.getTypeName()) as PovPanelUI
            this.povPanel.onClose.add(() => this.returnToMenu())
            // Quality button: cycle 1K → 2K → MAX; applied live to the POV
            // encoder and acked to the phones so every UI shows the same value.
            this.povPanel.onQualityToggle.add(() => {
                const presets = VIDEO_QUALITY_PRESETS_KBPS
                const i = presets.indexOf(this.videoQualityKbps)
                this.applyVideoQuality(presets[(i + 1) % presets.length])
            })
            this.povPanel.setQualityLabel("VIDEO · " + qualityLabel(this.videoQualityKbps))
            this.povPanel.setCaption(sel.callFriend
                ? "CALL FRIEND · connecting over WebRTC…"
                : "WATCH YOUR BACK · open the app on YOUR phone…")
        }

        // Watch Your Back media: EXACTLY ONE source feeds the panel, chosen ONCE
        // by isEditor() — this is the "editor vs device, never both" gate, NOT a
        // runtime fallback. On device the wearer's own phone streams its rear
        // camera peer-to-peer over WebRTC (H.264 → native decode → texture); in
        // the LS preview the .so can't load, so a synthetic test pattern stands in
        // so the panel/UI stays iterable. Call Friend keeps its own WebRTC wiring
        // below.
        if (sel.watchYourBack) {
            this.wybSource = global.deviceInfoSystem.isEditor()
                ? new SyntheticPovSource(this)
                : new WebRtcWatchYourBackSource(this, this.sessionCode)
            this.wybSource.onTexture = (tex) => {
                if (!this.povPanel) return
                this.povPanel.setFrameTexture(tex)
                this.povPanel.setCaption("WATCH YOUR BACK · " + this.wybSource!.statusLine())
            }
            this.wybSource.start()
        }

        // Call Friend streams OUR side purely over WebRTC: Glasses camera POV +
        // mic Opus up (native pov session), friend voice down. SDP/ICE are
        // exchanged via the Snap Cloud DB mailbox (RtcMailbox, PostgREST
        // polling) — the Realtime WebSocket and the BLE relay both proved
        // unreliable for signaling; the DB REST API works on device. Media
        // itself stays peer-to-peer WebRTC. Friend → Glasses video rides the inbound
        // leg of the duplex pov session (native H.264 decode → texture) onto the
        // panel; the caption reports link + mic + friend-cam frame count.
        if (sel.callFriend) {
            // Cloud signaling (SDP/ICE) comes from the Snap Cloud block. With that
            // block off, there is no mailbox — skip the call rather than crash.
            this.callMailbox = this.snapCloud
                ? this.snapCloud.createRtcMailbox(this.sessionCode, STREAMER_GLASSES)
                : null
            if (this.callMailbox) {
                this.callMailbox.start()
                // Friend taps End Call on their phone → cloud "bye" → end the call
                // on the Glasses too. Rides the DB mailbox so it works cross-network
                // (the multipeer control path can't reach a remote friend).
                this.callMailbox.onRtcSignal("bye", STREAMER_PHONE_FRIEND, () => this.handleRemoteHangup())
                this.callStreamer = new CallStreamer(this, this.callMailbox)
                // Friend → Glasses video: when the decoded friend-camera texture is ready,
                // show it on the same POV panel (the phone offers its camera; the native
                // friendvid session decodes H.264 → this texture).
                this.callStreamer.onFriendVideoTexture = (tex) => {
                    if (this.povPanel) this.povPanel.setFrameTexture(tex)
                }
                this.callStreamer.start()
                const micPoll = this.createEvent("DelayedCallbackEvent")
                micPoll.bind(() => {
                    if (!this.callStreamer || !this.povPanel) return // torn down
                    if (!this.callStreamer.mediaConnected) {
                        // Setup takes seconds by design (polled DB signaling) —
                        // rotate a playful loader line instead of a frozen caption.
                        // Same message set as the phone (RemotePovView.swift).
                        const i = Math.floor(getTime() / 7) % CONNECTING_MESSAGES.length
                        this.povPanel.setCaption("CALL FRIEND\n" + CONNECTING_MESSAGES[i])
                    } else {
                        this.povPanel.setCaption(
                            "CALL FRIEND · " + this.callStreamer.transportLine() +
                            "\n" + this.callStreamer.micStatusLine() +
                            " · " + this.callStreamer.friendVideoLine())
                    }
                    micPoll.reset(1)
                })
                micPoll.reset(1)
                this.callLive = true
                this.logCallState("call started")
            } else {
                print("[FriendFinder] Call Friend needs the Snap Cloud block (RtcMailbox signaling) — off/unwired, so the call is skipped.")
                if (this.povPanel) this.povPanel.setCaption("CALL FRIEND · unavailable (Snap Cloud block off)")
            }
        }
    }

    /** The friend ended the call from their phone (a cloud "bye" arrived on the
     *  mailbox). End the call here too, but KEEP Find Your Friend running if it
     *  was on — only the call/POV panel goes away. */
    private handleRemoteHangup(): void {
        if (!this.callStreamer && !this.callMailbox) return // no active call
        print("[FriendFinder] Friend hung up (cloud bye) — ending call.")
        this.teardownModes(false) // no bye echo — the friend already left
        const findStillOn = this.selection !== null && this.selection.findFriend
        // Keep local mode state consistent: call off, find preserved.
        if (this.selection) this.selection = {
            ...this.selection, callFriend: false, watchYourBack: false,
        }
        this.logCallState(findStillOn ? "call ended, Find kept" : "call ended")
        if (findStillOn) {
            // Keep Find running; just tell the LOCAL phones the call is off.
            this.phoneLink.sendControl({
                type: "peopleFinder-control",
                session: this.sessionCode,
                wyb: false, call: false, find: true,
                source: "phoneB", camera: "back",
            })
        } else {
            this.returnToMenu()
        }
    }

    /** One consistent status line for the whole call/mode state, mirrored by the
     *  phone's [CallState] logs so the two devices can be diffed at a glance. */
    private logCallState(reason: string): void {
        const sel = this.selection
        const transport = this.callStreamer ? this.callStreamer.transportLine() : "no call"
        print("[CallState] " + reason +
            " | call=" + (this.callStreamer !== null) +
            " wyb=" + (sel !== null && sel.watchYourBack) +
            " find=" + (sel !== null && sel.findFriend) +
            " session=" + this.sessionCode +
            " | " + transport)
    }

    /** Hide/show every Find Friend visual: arrow, marker sphere, info frame. */
    private setFindVisualsEnabled(on: boolean): void {
        this.pointerRoot.enabled = on
        this.markerRoot.enabled = on
        this.miniMapObj.enabled = on && this.showMiniMap
        if (this.uiLabel) this.uiLabel.getSceneObject().enabled = on
        if (!on) {
            // Reset guidance smoothing so the next show snaps fresh into place.
            this.pointerPlaced = false
            this.pointerRotSnap = false
            this.smoothedRelDeg = null
            this.smoothedMarkerPos = null
        }
    }

    /** Stop receivers/streamers and remove the POV panel (mode switch/exit).
     *  `sendBye` (default true): when a Call Friend session is live, post a cloud
     *  "bye" so the friend phone tears its side down too — reaches it even on a
     *  different network. Pass false when this teardown was itself triggered by
     *  the friend's bye, so we don't echo it back. */
    private teardownModes(sendBye: boolean = true): void {
        if (this.wybSource) {
            this.wybSource.stop()
            this.wybSource = null
        }
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
        this.callLive = false
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

    // ── Incoming call (friend phone requested, relayed by bonded phone) ──

    /** Phone pressed "Quit mode" — mirror CHANGE MODES on device. */
    private handleModeExitFromPhone(): void {
        if (this.selection === null) return // already at the menu
        print("[FriendFinder] Mode exit requested from phone — returning to menu.")
        this.returnToMenu()
    }

    private handleCallRequest(name: string): void {
        if (this.callStreamer) {
            // Already in a call — reply busy right away, no dialog.
            this.sendCallResponse("busy")
            return
        }
        if (this.incomingCall) {
            // Dialog already up (friend retried) — just re-ack that we're ringing.
            this.sendCallResponse("ringing")
            return
        }
        // The menu's interaction plane sits between the wearer and the dialog
        // and swallows its pinches — hide it while the dialog is up.
        if (this.selection === null) {
            this.modeMenu.hide()
            this.menuHiddenForCall = true
        }
        this.ping.play(1)
        const obj = global.scene.createSceneObject("IncomingCall")
        obj.setParent(this.uiGroup)
        this.incomingCall = obj.createComponent(IncomingCallUI.getTypeName()) as IncomingCallUI
        this.incomingCall.setRequester(name)
        this.incomingCall.onAccept.add(() => this.answerCall(true))
        this.incomingCall.onDeny.add(() => this.answerCall(false))
        print("[FriendFinder] Incoming call request from " + name)
        // Ack immediately so the friend phone can show "Ringing…" instead of
        // guessing whether the request even arrived.
        this.sendCallResponse("ringing")
        // Unanswered dialog times out as "missed" — without this the friend
        // phone gave up silently while the dialog sat on the Glasses forever.
        if (!this.incomingCallTimeout) {
            this.incomingCallTimeout = this.createEvent("DelayedCallbackEvent")
            this.incomingCallTimeout.bind(() => this.missIncomingCall())
        }
        this.incomingCallTimeout.reset(INCOMING_CALL_RING_S)
    }

    /**
     * Apply a video-quality preset (kbps) — the ONE place the setting changes.
     * Reaches the POV HW encoder live (no renegotiation), updates the panel
     * button, and acks the phones so their UIs mirror the applied value (the
     * friend phone also caps its own return-camera bitrate on this ack).
     */
    private applyVideoQuality(kbps: number): void {
        this.videoQualityKbps = kbps
        const applied = this.callStreamer ? this.callStreamer.setVideoBitrate(kbps) : 0
        if (this.povPanel) {
            this.povPanel.setQualityLabel("VIDEO · " + qualityLabel(kbps))
        }
        this.phoneLink.sendOneShot({
            type: "quality-applied", kbps, session: this.sessionCode,
        })
        print("[FriendFinder] Video quality -> " + kbps + " kbps (" +
            qualityLabel(kbps) + (applied === 0 ? ", encoder not running yet" : "") + ").")
    }

    /** One call-response on the phone relay. status: ringing | accepted |
     *  declined | busy | missed. `accepted` kept for older phone builds. */
    private sendCallResponse(status: string): void {
        this.phoneLink.sendOneShot({
            type: "call-response", accepted: status === "accepted",
            status, session: this.sessionCode,
        })
    }

    /** Friend phone cancelled its pending request — drop the dialog quietly. */
    private handleCallCancel(): void {
        if (!this.incomingCall) return
        print("[FriendFinder] Call request cancelled by the friend — dismissing dialog.")
        this.clearIncomingCallTimeout()
        this.dismissIncomingCall()
        if (this.menuHiddenForCall) {
            this.menuHiddenForCall = false
            this.modeMenu.show()
        }
    }

    /** The wearer never answered — treat as missed so BOTH sides reset. */
    private missIncomingCall(): void {
        if (!this.incomingCall) return
        print("[FriendFinder] Incoming call unanswered for " + INCOMING_CALL_RING_S +
            " s — missed.")
        this.dismissIncomingCall()
        if (this.menuHiddenForCall) {
            this.menuHiddenForCall = false
            this.modeMenu.show()
        }
        this.sendCallResponse("missed")
    }

    private clearIncomingCallTimeout(): void {
        if (this.incomingCallTimeout) this.incomingCallTimeout.enabled = false
    }

    private answerCall(accepted: boolean): void {
        this.clearIncomingCallTimeout()
        this.dismissIncomingCall()
        if (!accepted) {
            if (this.menuHiddenForCall) {
                this.menuHiddenForCall = false
                this.modeMenu.show()
            }
            this.sendCallResponse("declined")
            print("[FriendFinder] Call request denied.")
            return
        }
        this.menuHiddenForCall = false
        // Tell the friend phone the accept happened NOW — the control that
        // actually starts its call side takes a relay round-trip, and the gap
        // used to read as "nothing happened".
        this.sendCallResponse("accepted")
        // Accept = the same path as picking CALL FRIEND on the menu (keeps
        // Find running if it already was). The resulting peopleFinder-control
        // reaching the friend phone is what starts their side of the call.
        this.modeMenu.hide()
        this.applySelection({
            watchYourBack: false,
            callFriend: true,
            findFriend: this.selection !== null && this.selection.findFriend,
            source: "phoneA",
            usePhoneLocation: this.usePhoneLocation,
        })
    }

    private dismissIncomingCall(): void {
        if (!this.incomingCall) return
        // Hide instantly; defer destroy — tearing the hierarchy down from
        // inside the dialog's own button callback is unreliable on device.
        const obj = this.incomingCall.getSceneObject()
        obj.enabled = false
        const destroyEvt = this.createEvent("DelayedCallbackEvent")
        destroyEvt.bind(() => obj.destroy())
        destroyEvt.reset(0.1)
        this.incomingCall = null
    }

    /** CHANGE MODES (POV panel) or EXIT (minimap) — back to the start menu. */
    private returnToMenu(): void {
        this.teardownModes()
        this.setFindVisualsEnabled(false)
        this.friendEstimator.reset()
        this.selection = null
        // Tell the phones to stop streaming.
        this.phoneLink.sendControl({
            type: "peopleFinder-control",
            session: this.sessionCode,
            wyb: false, call: false, find: false,
            source: "phoneB", camera: "back",
        })
        if (this.uiLabel) {
            // Back at the menu: hide the friend card again (Find is re-picked
            // from the menu, which re-enables it).
            this.uiLabel.getSceneObject().enabled = false
        }
        this.modeMenu.show()
        print("[FriendFinder] Returned to mode menu.")
    }

    private makeAudio(track: AudioTrackAsset): AudioComponent {
        const audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
        audio.audioTrack = track
        audio.playbackMode = Audio.PlaybackMode.LowLatency
        audio.volume = 0.8
        return audio
    }

    // ── Lifecycle ───────────────────────────────────────────────────────

    /** Resolve the module blocks (@input) and wire phone-link events. Returns
     *  false if the required PhoneLink block is missing. Called from onStart —
     *  the first point where the lower-in-hierarchy module components have awoken
     *  and their typed methods (getLink / getPathLogger / …) are available. */
    private resolveServiceBlocks(): boolean {
        if (!this.mobileKit) {
            print("[FriendFinder] PhoneLink block not wired (mobileKit @input) — cannot start. Add the ▸ PhoneLink · Mobile Kit object with a MobileKitModule and wire it here.")
            return false
        }
        this.phoneLink = this.mobileKit.getLink()
        this.cloud = this.snapCloud ? this.snapCloud.getPathLogger() : null

        this.phoneLink.onConnection.add((connected) => this.handleConnection(connected))
        this.phoneLink.onSelfFix.add((fix) => this.handleSelfFix(fix))
        this.phoneLink.onFriendFix.add((fix) => this.handleFriendFix(fix))
        this.phoneLink.onTestMessage.add((message) => this.handleTestMessage(message))
        this.phoneLink.onCallRequest.add((name) => this.handleCallRequest(name))
        this.phoneLink.onCallCancel.add(() => this.handleCallCancel())
        this.phoneLink.onModeExit.add(() => this.handleModeExitFromPhone())
        // Friend phone's Video button: snap the request to the nearest preset
        // and apply — the ack keeps every device showing the same value.
        this.phoneLink.onQualityRequest.add((kbps) => {
            const presets = VIDEO_QUALITY_PRESETS_KBPS
            let best = presets[0]
            for (const p of presets) {
                if (Math.abs(p - kbps) < Math.abs(best - kbps)) best = p
            }
            this.applyVideoQuality(best)
        })
        return true
    }

    private onStart(): void {
        if (!this.resolveServiceBlocks()) return
        this.simulating = this.simulateInPreview && global.deviceInfoSystem.isEditor()
        if (this.cloud) this.cloud.start()
        this.cloudCheckpoints = this.snapCloud ? this.snapCloud.createCheckpoints() : null
        if (this.cloudCheckpoints) {
            this.cloudCheckpoints.onVisit = (note) => this.handleCheckpointVisit(note)
            this.cloudCheckpoints.start()
        }
        this.phoneLink.start(this.simulating)
        // GPS + guidance start only after the user picks modes on the menu
        // (applySelection); the transport starts right away so the control
        // message can reach the phone as soon as it connects.
        if (this.uiLabel) {
            // The friend info card stays hidden on entry — it only appears once
            // the wearer turns on Find Your Friend (default off in the menu).
            this.uiLabel.setStatus("Waiting for phone…")
            this.uiLabel.getSceneObject().enabled = false
        }
        print("[FriendFinder] Started. simulating=" + this.simulating +
            " usePhoneLocation=" + this.usePhoneLocation)
    }

    // ── Data handlers ───────────────────────────────────────────────────

    private handleConnection(connected: boolean): void {
        if (connected) {
            this.chime.play(1)
            if (!this.haveFriend && this.uiLabel && !this.simulating) {
                this.uiLabel.setStatus("Phone linked — waiting for friend…")
            }
        } else if (this.uiLabel) {
            this.uiLabel.setStatus("Phone disconnected — reconnecting…")
        }
    }

    private handleTestMessage(message: string): void {
        print("[FriendFinder] TEST from phone: " + message)
        if (this.uiLabel) {
            this.uiLabel.setStatus("TEST: " + message)
        }
        this.testStatusUntil = getTime() + 5
        this.ping.play(1)
    }

    /** In-app checkpoint notification: "<who> was at <checkpoint> <rel time>". */
    private handleCheckpointVisit(note: CheckpointVisitNote): void {
        const when = note.ageS < 45
            ? "just now"
            : note.ageS < 3600
                ? Math.round(note.ageS / 60) + " min ago"
                : Math.round(note.ageS / 3600) + " h ago"
        const msg = note.who + " was at " + note.checkpoint + " " + when
        print("[FriendFinder] CHECKPOINT: " + msg)
        this.ping.play(1)
        if (this.uiLabel) {
            this.uiLabel.setStatus(msg)
            this.testStatusUntil = getTime() + 6
        }
    }

    private handleSelfFix(fix: LocationFix): void {
        if (fix.heading !== null) {
            this.phoneHeadingDeg = fix.heading
        }
        // The phone barometer is the only pressure source, so take it regardless
        // of which device owns the self position.
        if (fix.pressure !== null) {
            this.selfPressure = fix.pressure
        }
        // When Glasses GPS is active (and not phone-preferred), it owns self position.
        if (this.usePhoneLocation || this.simulating || !this.gpsActive) {
            this.selfLat = fix.lat
            this.selfLon = fix.lon
            this.selfAccuracy = fix.accuracy
            this.lastSelfFixAt = getTime()
            if (fix.alt !== null) {
                this.selfAlt = fix.alt
                this.selfVAcc = fix.vAcc
            }
            this.haveSelf = true
            this.cloud?.logFix("self", fix)
            if (this.cloudCheckpoints) this.cloudCheckpoints.noteFix("self", "You", fix.lat, fix.lon)
        }
    }

    private handleFriendFix(fix: LocationFix): void {
        this.friendLat = fix.lat
        this.friendLon = fix.lon
        this.friendAccuracy = fix.accuracy
        this.lastFriendFixAt = getTime()
        if (fix.alt !== null) {
            this.friendAlt = fix.alt
            this.friendVAcc = fix.vAcc
        }
        if (fix.pressure !== null) {
            this.friendPressure = fix.pressure
        }
        if (fix.uwbDist !== null) {
            this.friendUwbDistM = fix.uwbDist
            this.lastUwbAt = getTime()
            if (DEBUG_GUIDANCE && this.friendUwbDistM !== null && Math.random() < 0.05) {
                print("[FriendFinder] UWB distance: " + this.friendUwbDistM.toFixed(2) + " m")
            }
        }
        if (fix.name && fix.name !== this.friendName) {
            this.friendName = fix.name
            if (this.uiLabel) this.uiLabel.setName(fix.name)
        }
        if (!this.haveFriend) {
            this.haveFriend = true
            this.ping.play(1)
            if (this.uiLabel && !fix.name) this.uiLabel.setName("Friend")
        }
        this.friendEstimator.addFix(fix.lat, fix.lon, fix.accuracy)
        this.cloud?.logFix("friend", fix)
        if (this.cloudCheckpoints) {
            this.cloudCheckpoints.noteFix("friend", this.friendName || fix.name || "Friend", fix.lat, fix.lon)
        }
    }

    // ── Glasses GPS (self position + north-aligned heading) ──────────

    private startGps(): void {
        try {
            this.locationService = GeoLocation.createLocationService()
            this.locationService.accuracy = GeoLocationAccuracy.Navigation

            this.locationService.onNorthAlignedOrientationUpdate.add(
                (orientation: quat, _accuracy: CompassTrackingData.Accuracy) => {
                    this.glassesHeadingDeg = GeoLocation.getNorthAlignedHeading(orientation)
                }
            )

            const poll = this.createEvent("DelayedCallbackEvent")
            poll.bind(() => {
                if (this.locationService) {
                    this.locationService.getCurrentPosition(
                        (pos: GeoPosition) => {
                            this.gpsActive = true
                            this.selfLat = pos.latitude
                            this.selfLon = pos.longitude
                            this.selfAccuracy = pos.horizontalAccuracy > 0 ? pos.horizontalAccuracy : null
                            this.lastSelfFixAt = getTime()
                            this.haveSelf = true
                            if (pos.verticalAccuracy > 0) {
                                this.selfAlt = pos.altitude
                                this.selfVAcc = pos.verticalAccuracy
                            }
                            this.cloud?.logFix("self", {
                                lat: pos.latitude,
                                lon: pos.longitude,
                                accuracy: pos.horizontalAccuracy,
                                heading: this.glassesHeadingDeg,
                                name: null,
                                alt: pos.verticalAccuracy > 0 ? pos.altitude : null,
                                vAcc: pos.verticalAccuracy > 0 ? pos.verticalAccuracy : null,
                                pressure: null,
                                uwbDist: null,
                            })
                            if (this.cloudCheckpoints) {
                                this.cloudCheckpoints.noteFix("self", "You", pos.latitude, pos.longitude)
                            }
                        },
                        (err: string) => print("[FriendFinder] GPS error: " + err)
                    )
                }
                poll.reset(1.0)
            })
            poll.reset(1.0)
            print("[FriendFinder] Glasses GPS started.")
        } catch (e) {
            print("[FriendFinder] Failed to start GPS: " + e)
        }
    }

    /**
     * Friend's height relative to the wearer in meters (positive = friend is
     * above). Prefers barometer-to-barometer comparison — weather cancels
     * between nearby phones, ~1 m relative accuracy — and falls back to GPS
     * altitude only when the difference exceeds the combined vertical
     * uncertainty. Returns null when the difference isn't confidently nonzero.
     */
    private heightDiffM(): number | null {
        if (this.selfPressure !== null && this.friendPressure !== null) {
            // Hypsometric approximation, ~8435 m scale height — exact enough
            // for the <100 m differences that matter here.
            const diff = Math.log(this.selfPressure / this.friendPressure) * 8434.66
            return Math.abs(diff) >= 3 ? diff : null
        }
        if (this.selfAlt !== null && this.friendAlt !== null) {
            const combined = (this.selfVAcc ?? 10) + (this.friendVAcc ?? 10)
            const diff = this.friendAlt - this.selfAlt
            return Math.abs(diff) > combined ? diff : null
        }
        return null
    }

    /**
     * Heading (deg clockwise from north) of the wearer's current facing.
     * Priority: Glasses compass > phone heading > camera yaw (simulation /
     * no-compass fallback, which treats world -Z as north).
     */
    private activeHeadingDeg(camYawDeg: number): number {
        if (this.glassesHeadingDeg !== null) return this.glassesHeadingDeg
        if (this.phoneHeadingDeg !== null && this.usePhoneLocation) return this.phoneHeadingDeg
        return camYawDeg
    }

    // ── Per-frame guidance ──────────────────────────────────────────────

    private onUpdate(): void {
        const dt = getDeltaTime()
        const camT = this.cameraProvider.getTransform()
        const camPos = camT.getWorldPosition()
        const fwd = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
        const camYawDeg = toDeg(Math.atan2(fwd.x, -fwd.z))

        if (!this.findEnabled || !this.haveSelf || !this.haveFriend) {
            this.pointerRoot.enabled = false
            this.pointerPlaced = false
            this.markerRoot.enabled = false
            if (this.findEnabled && this.miniMapObj.enabled) {
                this.miniMap.setWaiting(this.haveSelf
                    ? "waiting for friend fix…"
                    : "waiting for self fix…")
            }
            // Only park the info card while Find Your Friend is on but waiting
            // for fixes. With no mode selected (or Find off) it stays hidden.
            if (this.findEnabled) {
                this.parkLabel(camPos, fwd, dt)
            }
            return
        }

        // Distance: UWB phone-to-phone ranging (±10 cm) wins over the GPS
        // haversine (±10+ m) whenever a fresh reading exists — this is what
        // makes the short-range readout meaningful. Bearing stays GPS+compass:
        // UWB gives no direction with phones in pockets.
        // Most-probable friend position: the live fix when fresh, else the track
        // extrapolated along recent heading/velocity (resilience layer — the
        // marker keeps pointing sensibly through a link dropout).
        const est = this.friendEstimator.estimate()
        const fLat = est ? est.lat : this.friendLat
        const fLon = est ? est.lon : this.friendLon
        this.friendEstStale = est ? est.estimated : false
        this.friendEstAgeS = est ? est.ageS : 0
        const gpsDistanceM = haversineMeters(this.selfLat, this.selfLon, fLat, fLon)
        this.uwbActive = this.friendUwbDistM !== null && this.lastUwbAt >= 0 &&
            getTime() - this.lastUwbAt < UWB_FRESH_S
        const distanceM = this.uwbActive ? this.friendUwbDistM! : gpsDistanceM
        const bearingDeg = initialBearing(this.selfLat, this.selfLon, fLat, fLon)
        const headingDeg = this.activeHeadingDeg(camYawDeg)
        const headingSrc = this.glassesHeadingDeg !== null
            ? "GLASSES"
            : (this.phoneHeadingDeg !== null && this.usePhoneLocation ? "PHONE" : "CAM")

        if (this.miniMapObj.enabled) {
            this.miniMap.setData({
                selfLat: this.selfLat,
                selfLon: this.selfLon,
                selfAccM: this.selfAccuracy,
                selfSource: this.simulating
                    ? "SIM"
                    : (this.gpsActive && !this.usePhoneLocation ? "GLASSES" : "PHONE"),
                selfAgeS: this.lastSelfFixAt >= 0 ? getTime() - this.lastSelfFixAt : null,
                friendLat: this.friendLat,
                friendLon: this.friendLon,
                friendAccM: this.friendAccuracy,
                friendAgeS: this.lastFriendFixAt >= 0 ? getTime() - this.lastFriendFixAt : null,
                uwbDistM: this.uwbActive ? this.friendUwbDistM : null,
                headingDeg,
                headingSource: headingSrc,
                phoneHeadingDeg: this.phoneHeadingDeg,
                bearingDeg,
                distanceM,
            })
        }

        if (DEBUG_GUIDANCE) {
            this.dbgLine = "hdg " + headingDeg.toFixed(0) + "°(" + headingSrc + ") brg " +
                bearingDeg.toFixed(0) + "° rel " +
                shortestAngleDeg(0, bearingDeg - headingDeg).toFixed(0) + "°"
            if (getTime() - this.lastDebugPrint > 2) {
                this.lastDebugPrint = getTime()
                print("[FriendFinder] DBG " + this.dbgLine +
                    " dist=" + distanceM.toFixed(1) + "m" +
                    " camYaw=" + camYawDeg.toFixed(0) + "°" +
                    " self=" + this.selfLat.toFixed(6) + "," + this.selfLon.toFixed(6) +
                    (this.gpsActive ? " (glassesGPS)" : " (phoneGPS)") +
                    " friend=" + this.friendLat.toFixed(6) + "," + this.friendLon.toFixed(6) +
                    " ±" + (this.friendAccuracy !== null ? this.friendAccuracy.toFixed(0) : "?") + "m")
            }
        }

        // Relative yaw from the wearer's facing to the friend, smoothed along
        // the shortest arc so the pointer glides instead of jittering.
        const targetRelDeg = shortestAngleDeg(0, bearingDeg - headingDeg)
        if (this.smoothedRelDeg === null) {
            this.smoothedRelDeg = targetRelDeg
        } else {
            this.smoothedRelDeg +=
                shortestAngleDeg(this.smoothedRelDeg, targetRelDeg) * smoothFactor(YAW_SMOOTH_RATE, dt)
            this.smoothedRelDeg = shortestAngleDeg(0, this.smoothedRelDeg)
        }

        // 1. Pointer: continuous follow toward the anchor ahead of the wearer
        //    (flattened forward so head pitch doesn't drag it).
        const flatLen = Math.sqrt(fwd.x * fwd.x + fwd.z * fwd.z)
        const pointerT = this.pointerRoot.getTransform()
        if (flatLen > 0.05) {
            const desired = new vec3(
                camPos.x + (fwd.x / flatLen) * TETHER_FORWARD_CM,
                camPos.y - TETHER_DOWN_CM,
                camPos.z + (fwd.z / flatLen) * TETHER_FORWARD_CM
            )
            if (!this.pointerRoot.enabled || !this.pointerPlaced) {
                // First show: snap to the anchor instead of swooping in.
                this.pointerRoot.enabled = true
                this.pointerPlaced = true
                pointerT.setWorldPosition(desired)
                this.pointerRotSnap = true
            } else {
                // Ease toward the anchor every frame — smooth, always following.
                pointerT.setWorldPosition(vec3.lerp(
                    pointerT.getWorldPosition(), desired, smoothFactor(POINTER_FOLLOW_RATE, dt)
                ))
            }
        }

        // 2. Marker: world position along the real-world bearing, clamped.
        const worldYawRad = toRad(camYawDeg + this.smoothedRelDeg)
        const dir = new vec3(Math.sin(worldYawRad), 0, -Math.cos(worldYawRad))
        const clampedCm = Math.max(MARKER_MIN_CM, Math.min(MARKER_MAX_CM, distanceM * 100))
        // Preserve the real elevation angle at the clamped render distance:
        // yOffset/clamped == heightDiff/actualDistance (capped at ~±31°).
        const heightDiffM = this.heightDiffM()
        let elevOffsetCm = 0
        if (heightDiffM !== null && distanceM > 1) {
            const elevRatio = Math.max(-0.6, Math.min(0.6, heightDiffM / distanceM))
            elevOffsetCm = clampedCm * elevRatio
        }
        const targetPos = new vec3(
            camPos.x + dir.x * clampedCm,
            camPos.y - 20 + elevOffsetCm,
            camPos.z + dir.z * clampedCm
        )
        if (this.smoothedMarkerPos === null) {
            this.smoothedMarkerPos = targetPos
        } else {
            this.smoothedMarkerPos = vec3.lerp(
                this.smoothedMarkerPos, targetPos, smoothFactor(POS_SMOOTH_RATE, dt)
            )
        }
        this.markerRoot.enabled = true
        this.markerRoot.getTransform().setWorldPosition(this.smoothedMarkerPos)

        // Arrow look-at: aim from the arrow toward the marker (yaw + pitch),
        // eased with a lazy slerp so it swings like a physical needle.
        const arrowPos = pointerT.getWorldPosition()
        const aim = new vec3(
            this.smoothedMarkerPos.x - arrowPos.x,
            this.smoothedMarkerPos.y - arrowPos.y,
            this.smoothedMarkerPos.z - arrowPos.z
        )
        if (aim.length > 1) {
            // quat.lookAt aligns the object's +Z with the passed direction
            // (verified against live scene transforms); the arrow nose is baked
            // -Z, so aim the +Z axis backwards.
            const back = new vec3(-aim.x, -aim.y, -aim.z).normalize()
            const targetRot = quat.lookAt(back, vec3.up())
            if (this.pointerRotSnap) {
                this.pointerRotSnap = false
                pointerT.setWorldRotation(targetRot)
            } else {
                pointerT.setWorldRotation(quat.slerp(
                    pointerT.getWorldRotation(), targetRot, smoothFactor(LOOKAT_SMOOTH_RATE, dt)
                ))
            }
        }

        // Constant angular size + gentle pulse (scale lives on the leaf visual).
        const diameterCm = clampedCm * MARKER_DIAMETER_RATIO
        const pulse = 1 + 0.08 * Math.sin(getTime() * Math.PI * 2)
        const s = (diameterCm / this.markerBaseDiameterCm()) * pulse
        this.markerVisualObj.getTransform().setLocalScale(new vec3(s, s, s))

        // 3. Label: above the sphere, billboarded by the UI module, scaled so
        //    its angular size matches its authored 110 cm focal plane.
        const labelObj = this.uiLabel.getSceneObject()
        labelObj.enabled = true
        const labelScale = Math.max(0.5, clampedCm / LABEL_FOCAL_CM)
        const labelPos = new vec3(
            this.smoothedMarkerPos.x,
            // sphere top (incl. pulse) + scaled panel half-height + small gap
            this.smoothedMarkerPos.y + diameterCm * 0.62 + LABEL_PANEL_HALF_H_CM * labelScale,
            this.smoothedMarkerPos.z
        )
        labelObj.getTransform().setWorldPosition(labelPos)
        labelObj.getTransform().setWorldScale(new vec3(labelScale, labelScale, labelScale))

        // 4. Push live values into the UI.
        this.uiLabel.setDistanceMeters(distanceM, heightDiffM)
        this.updateStatusLine()
    }

    /** No target yet: keep the label parked 2.5 m ahead as a status card. */
    private parkLabel(camPos: vec3, fwd: vec3, dt: number): void {
        if (!this.uiLabel) return
        const labelObj = this.uiLabel.getSceneObject()
        const len = Math.sqrt(fwd.x * fwd.x + fwd.z * fwd.z) || 1
        const target = new vec3(
            camPos.x + (fwd.x / len) * 250,
            camPos.y - 10,
            camPos.z + (fwd.z / len) * 250
        )
        const t = labelObj.getTransform()
        t.setWorldPosition(vec3.lerp(t.getWorldPosition(), target, smoothFactor(POS_SMOOTH_RATE, dt)))
        const s = 250 / LABEL_FOCAL_CM
        t.setWorldScale(new vec3(s, s, s))
    }

    private updateStatusLine(): void {
        if (!this.uiLabel) return
        if (getTime() < this.testStatusUntil) return
        if (this.simulating) {
            this.uiLabel.setStatus("SIMULATED PREVIEW")
            return
        }
        const source = (this.uwbActive ? "UWB · " : "") + (this.glassesHeadingDeg !== null
            ? "GLASSES GPS"
            : (this.usePhoneLocation ? "PHONE GPS" : "GPS"))
        const acc = this.friendAccuracy !== null
            ? " · ±" + (this.friendAccuracy * 3.28084).toFixed(0) + " ft"
            : ""
        const dbg = DEBUG_GUIDANCE && this.dbgLine ? "\n" + this.dbgLine : ""
        if (this.friendEstStale) {
            this.uiLabel.setStatus(
                "LAST KNOWN · est " + this.friendEstAgeS.toFixed(0) + "s ago · " + source + acc + dbg)
        } else {
            this.uiLabel.setStatus("LIVE · " + source + acc + dbg)
        }
    }

    private markerBaseDiameterCm(): number {
        if (this.baseDiameterCm === null) {
            const mn = MARKER_MESH.aabbMin
            const mx = MARKER_MESH.aabbMax
            const d = Math.max(mx.x - mn.x, Math.max(mx.y - mn.y, mx.z - mn.z))
            this.baseDiameterCm = d > 0.001 ? d : 100
        }
        return this.baseDiameterCm
    }
}
