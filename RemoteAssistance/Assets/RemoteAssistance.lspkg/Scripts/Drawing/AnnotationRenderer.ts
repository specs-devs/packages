// AnnotationRenderer — renders the helper's 2D strokes as 3D lines in the
// wearer's world.
//
// OWNS: the stroke registry, the camera-pose history, the 2D→3D unprojection,
//       and the runtime ribbon meshes (MeshBuilder). Passive receiver — call
//       handleSignal() with "draw" payloads from any RtcSignalTransport.
// EXPECTS (@input): strokeMaterial — an UNLIT material with a baseColor
//       parameter (cloned per stroke and tinted).
// MUST NOT: talk to any transport itself, or touch the call/mode state — the
//       manager wires the mailbox to this component and drives teardown.
//
// How a stroke lands in the world:
//   The helper draws on the POV VIDEO they are watching — i.e. on a past
//   Glasses camera frame. When the first update of a stroke arrives, we look
//   up the wearer's head pose from `poseLagMs` ago (a small ring buffer of
//   recent camera transforms approximates the video + network latency), and
//   FREEZE that pose for the stroke's lifetime. All of the stroke's points
//   are unprojected through that frozen pose onto a plane `anchorDepthCm`
//   ahead of it, sized by `povHorizontalFovDeg` + the payload's aspect ratio
//   so normalized frame coords map onto what the camera saw. The result is a
//   world-anchored drawing the wearer can walk around — it does NOT follow
//   the head.

import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { RtcSignalPayload } from "../App/Types"
import { StrokePayload, parseStrokePayload, parseClearPayload } from "./AnnotationTypes"

// Default video aspect (w/h): the Glasses RGB camera streams land in 4:3.
const DEFAULT_ASPECT = 4 / 3
// Pose history: ~4 s at 60 fps, plenty for any realistic video+network lag.
const POSE_BUF_MAX = 256
// Skip incoming points closer than this (normalized units) to the previous
// kept point — decimates touch noise without visibly changing the line.
const MIN_PT_DIST = 0.004
// Auto palette for strokes that don't carry a color (RGB 0..1).
const PALETTE: [number, number, number][] = [
    [1.0, 0.35, 0.25], // coral red
    [1.0, 0.85, 0.25], // yellow
    [0.35, 0.9, 1.0],  // cyan
    [0.45, 1.0, 0.55], // green
    [1.0, 0.45, 0.95], // magenta
    [1.0, 0.6, 0.2],   // orange
]

interface PoseSample {
    t: number
    pos: vec3
    rot: quat
}

/** Frozen anchor frame + live mesh state for one stroke. */
interface StrokeState {
    root: SceneObject
    rmv: RenderMeshVisual
    mat: Material
    colorIndex: number
    // Frozen plane frame (world space).
    origin: vec3    // plane center
    right: vec3
    up: vec3
    normal: vec3    // toward the (frozen) camera
    halfW: number
    halfH: number
    widthCm: number
    // Kept (decimated) normalized points, flat [u,v,…].
    pts: number[]
    done: boolean
}

@component
export class AnnotationRenderer extends BaseScriptComponent {
    @ui.label('<span style="color: #60A5FA;">AnnotationRenderer – helper drawings as 3D lines</span>')
    @ui.separator
    @ui.group_start("References")
    @input
    @hint("UNLIT material with a baseColor parameter — cloned + tinted per stroke (wire Materials/StrokeMat)")
    strokeMaterial!: Material
    @ui.group_end
    @ui.separator
    @ui.group_start("Settings")
    @input
    @widget(new SliderWidget(50, 500, 10))
    @hint("Distance (cm) of the anchor plane the strokes land on, ahead of the frozen head pose")
    anchorDepthCm: number = 200
    @input
    @widget(new SliderWidget(30, 110, 1))
    @hint("Horizontal FOV (deg) of the POV video the helper annotates — match the Glasses RGB camera for best alignment")
    povHorizontalFovDeg: number = 66
    @input
    @widget(new SliderWidget(0.2, 5.0, 0.1))
    @hint("Ribbon width (cm) at the anchor plane")
    strokeWidthCm: number = 1.0
    @input
    @widget(new SliderWidget(0, 2000, 50))
    @hint("How far back (ms) to reach into the head-pose history when anchoring a new stroke — approximates video + network latency")
    poseLagMs: number = 400
    @ui.group_end

    private cameraProvider = WorldCameraFinderProvider.getInstance()
    private poseBuf: PoseSample[] = []
    private strokes = new Map<string, StrokeState>()
    private strokeCounter = 0
    // Bumped by clearAll(): pending simulateDemo callbacks from an older
    // generation are dropped, so a demo never draws after a clear or call end.
    private demoGeneration = 0

    onAwake(): void {
        this.createEvent("UpdateEvent").bind(() => this.samplePose())
    }

    // ── Transport entry point ───────────────────────────────────────────

    /** Feed one "draw" mailbox payload (t: "stroke" | "clear"). */
    handleSignal(p: RtcSignalPayload): void {
        if (p.t === "stroke") {
            const stroke = parseStrokePayload(p.sdp)
            if (stroke) this.applyStroke(stroke)
        } else if (p.t === "clear") {
            const clear = parseClearPayload(p.sdp)
            if (clear.id) this.clearStroke(clear.id)
            else this.clearAll()
        }
    }

    /** Short status for the call caption ("draw: 2"). */
    statusLine(): string {
        return "draw: " + this.strokes.size
    }

    // ── Stroke lifecycle ────────────────────────────────────────────────

    /** Create or update one stroke (cumulative point list). */
    applyStroke(p: StrokePayload): void {
        let s = this.strokes.get(p.id)
        if (!s) {
            s = this.createStroke(p)
            this.strokes.set(p.id, s)
            print("[AnnotationRenderer] Stroke '" + p.id + "' anchored " +
                this.anchorDepthCm.toFixed(0) + " cm ahead (lag " +
                this.poseLagMs.toFixed(0) + " ms, " + this.strokes.size + " total).")
        }
        if (s.done) return // final update already applied — ignore stragglers
        s.done = p.done === true

        // Decimate the cumulative point list (parser guarantees shape).
        const kept: number[] = []
        for (let i = 0; i + 1 < p.pts.length; i += 2) {
            const u = p.pts[i]
            const v = p.pts[i + 1]
            const n = kept.length
            if (n >= 2) {
                const du = u - kept[n - 2]
                const dv = v - kept[n - 1]
                if (Math.sqrt(du * du + dv * dv) < MIN_PT_DIST) continue
            }
            kept.push(u, v)
        }
        if (kept.length < 2) return
        s.pts = kept
        this.rebuildMesh(s)
    }

    clearStroke(id: string): void {
        const s = this.strokes.get(id)
        if (!s) return
        this.strokes.delete(id)
        s.root.destroy()
        print("[AnnotationRenderer] Stroke '" + id + "' cleared.")
    }

    clearAll(): void {
        this.demoGeneration++
        if (this.strokes.size === 0) return
        this.strokes.forEach((s) => s.root.destroy())
        this.strokes.clear()
        this.strokeCounter = 0
        print("[AnnotationRenderer] All strokes cleared.")
    }

    // ── Anchoring ───────────────────────────────────────────────────────

    private samplePose(): void {
        const t = this.cameraProvider.getTransform()
        this.poseBuf.push({
            t: getTime(),
            pos: t.getWorldPosition(),
            rot: t.getWorldRotation(),
        })
        if (this.poseBuf.length > POSE_BUF_MAX) this.poseBuf.shift()
    }

    /** Newest pose at or before (now - poseLagMs); falls back to the live camera. */
    private poseAtLag(): PoseSample {
        const target = getTime() - this.poseLagMs / 1000
        for (let i = this.poseBuf.length - 1; i >= 0; i--) {
            if (this.poseBuf[i].t <= target) return this.poseBuf[i]
        }
        if (this.poseBuf.length > 0) return this.poseBuf[0]
        const t = this.cameraProvider.getTransform()
        return { t: getTime(), pos: t.getWorldPosition(), rot: t.getWorldRotation() }
    }

    private createStroke(p: StrokePayload): StrokeState {
        const pose = this.poseAtLag()
        const fwd = pose.rot.multiplyVec3(new vec3(0, 0, -1))
        const right = pose.rot.multiplyVec3(new vec3(1, 0, 0))
        const up = pose.rot.multiplyVec3(new vec3(0, 1, 0))
        const depth = this.anchorDepthCm
        const origin = new vec3(
            pose.pos.x + fwd.x * depth,
            pose.pos.y + fwd.y * depth,
            pose.pos.z + fwd.z * depth
        )
        const ar = p.ar ?? DEFAULT_ASPECT
        const halfW = depth * Math.tan((this.povHorizontalFovDeg * Math.PI / 180) / 2)
        const halfH = halfW / ar

        const root = global.scene.createSceneObject("Stroke_" + p.id)
        root.setParent(this.getSceneObject())
        const rmv = root.createComponent("Component.RenderMeshVisual") as RenderMeshVisual

        const colorIndex = this.strokeCounter++
        const rgb = p.color ?? PALETTE[colorIndex % PALETTE.length]
        let mat: Material = this.strokeMaterial
        if (this.strokeMaterial) {
            mat = this.strokeMaterial.clone()
            try {
                mat.mainPass.baseColor = new vec4(rgb[0], rgb[1], rgb[2], 1)
            } catch (e) {
                print("[AnnotationRenderer] strokeMaterial has no baseColor param — strokes render untinted: " + e)
            }
            // Annotations are world-anchored: the wearer can walk behind them.
            mat.mainPass.twoSided = true
            rmv.mainMaterial = mat
        } else {
            print("[AnnotationRenderer] strokeMaterial @input not wired — strokes render with the default material.")
        }

        return {
            root, rmv, mat, colorIndex,
            origin, right, up,
            normal: new vec3(-fwd.x, -fwd.y, -fwd.z),
            halfW, halfH,
            widthCm: p.w !== undefined ? Math.max(0.2, p.w * halfH * 2) : this.strokeWidthCm,
            pts: [], done: false,
        }
    }

    // ── Ribbon mesh ─────────────────────────────────────────────────────

    /** Rebuild the stroke's ribbon from its kept points (coplanar strip). */
    private rebuildMesh(s: StrokeState): void {
        const n = s.pts.length / 2
        // Plane-space 2D points (cm).
        const px: number[] = []
        const py: number[] = []
        for (let i = 0; i < n; i++) {
            px.push((s.pts[i * 2] * 2 - 1) * s.halfW)
            py.push((1 - s.pts[i * 2 + 1] * 2) * s.halfH)
        }

        const hw = s.widthCm / 2
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3 },
            { name: "texture0", components: 2 },
        ])
        builder.topology = MeshTopology.Triangles
        builder.indexType = MeshIndexType.UInt16

        const verts: number[] = []
        const idx: number[] = []

        if (n === 1) {
            // Single tap: a small square "dot".
            this.emitQuad(s, verts, idx, px[0], py[0], hw)
        } else {
            // Per-point averaged perpendicular (miter-lite) in plane space.
            for (let i = 0; i < n; i++) {
                let dx = 0
                let dy = 0
                if (i > 0) { dx += px[i] - px[i - 1]; dy += py[i] - py[i - 1] }
                if (i < n - 1) { dx += px[i + 1] - px[i]; dy += py[i + 1] - py[i] }
                const len = Math.sqrt(dx * dx + dy * dy) || 1
                // Perpendicular of (dx,dy) in plane space: (-dy, dx).
                const nx = -dy / len
                const ny = dx / len
                const a = this.planeToWorld(s, px[i] + nx * hw, py[i] + ny * hw)
                const b = this.planeToWorld(s, px[i] - nx * hw, py[i] - ny * hw)
                verts.push(a.x, a.y, a.z, s.normal.x, s.normal.y, s.normal.z, 0, i / (n - 1))
                verts.push(b.x, b.y, b.z, s.normal.x, s.normal.y, s.normal.z, 1, i / (n - 1))
            }
            for (let i = 0; i < n - 1; i++) {
                const v0 = i * 2
                // Two triangles per segment (two-sided material — winding safe).
                idx.push(v0, v0 + 1, v0 + 2, v0 + 2, v0 + 1, v0 + 3)
            }
        }

        builder.appendVerticesInterleaved(verts)
        builder.appendIndices(idx)
        s.rmv.mesh = builder.getMesh()
        builder.updateMesh()
    }

    /** Small quad at plane coords (single-tap dot). */
    private emitQuad(s: StrokeState, verts: number[], idx: number[],
        x: number, y: number, hw: number): void {
        const c: vec3[] = [
            this.planeToWorld(s, x - hw, y - hw),
            this.planeToWorld(s, x + hw, y - hw),
            this.planeToWorld(s, x - hw, y + hw),
            this.planeToWorld(s, x + hw, y + hw),
        ]
        for (let i = 0; i < 4; i++) {
            verts.push(c[i].x, c[i].y, c[i].z, s.normal.x, s.normal.y, s.normal.z,
                i % 2, Math.floor(i / 2))
        }
        idx.push(0, 1, 2, 2, 1, 3)
    }

    private planeToWorld(s: StrokeState, x: number, y: number): vec3 {
        return new vec3(
            s.origin.x + s.right.x * x + s.up.x * y,
            s.origin.y + s.right.y * x + s.up.y * y,
            s.origin.z + s.right.z * x + s.up.z * y
        )
    }

    // ── Preview simulation (editor only — call from the manager) ────────

    /**
     * Stream a demo drawing through the REAL applyStroke path at a realistic
     * cadence: a circle, then an arrow, then a "tap" dot — verifies anchoring,
     * ribbon building, colors, and clear-all in the Lens Studio preview where
     * no phone exists. The manager triggers this in-editor after a call starts.
     */
    simulateDemo(): void {
        const gen = ++this.demoGeneration
        const mk = (id: string, allPts: number[], color: [number, number, number],
            startS: number, steps: number): void => {
            for (let k = 1; k <= steps; k++) {
                const evt = this.createEvent("DelayedCallbackEvent")
                const cut = Math.max(2, Math.floor((allPts.length / 2) * (k / steps)) * 2)
                const done = k === steps
                evt.bind(() => {
                    if (gen !== this.demoGeneration) return
                    this.applyStroke({
                        id, color, ar: DEFAULT_ASPECT, done,
                        pts: allPts.slice(0, cut),
                    })
                })
                evt.reset(startS + k * 0.35)
            }
        }
        // Circle around the center of view.
        const circle: number[] = []
        for (let i = 0; i <= 40; i++) {
            const a = (i / 40) * Math.PI * 2
            circle.push(0.5 + 0.12 * Math.cos(a), 0.5 + 0.16 * Math.sin(a))
        }
        // Arrow pointing into the circle from the lower-left.
        const arrow = [
            0.18, 0.82, 0.38, 0.62, 0.34, 0.66, 0.38, 0.62, 0.335, 0.615,
        ]
        mk("sim-circle", circle, PALETTE[0], 0.5, 8)
        mk("sim-arrow", arrow, PALETTE[2], 4.0, 4)
        const dot = this.createEvent("DelayedCallbackEvent")
        dot.bind(() => {
            if (gen !== this.demoGeneration) return
            this.applyStroke({
                id: "sim-dot", color: PALETTE[1], ar: DEFAULT_ASPECT, done: true,
                pts: [0.5, 0.5],
            })
        })
        dot.reset(6.0)
        print("[AnnotationRenderer] SIMULATION: demo strokes incoming (editor preview).")
    }
}
