// MiniMapUI — north-up debug minimap for Find Friend mode.
//
// Renders the same facts the iPhone app's map shows — self dot, friend dot,
// their GPS accuracy circles, and the distance between them — plus the two
// values the phone map can never test: the wearer's heading (blue wedge) and
// the computed bearing to the friend (teal ray). If the dots match the phone
// map but the arrow is wrong, the bug is heading; if the dots differ, it's
// position data. Tethers ahead-right of the wearer (mirror of PovPanelUI).
//
// All geometry is built at runtime with MeshBuilder (flat XY-plane discs,
// rings, rays) tinted via clones of MarkerMat's unlit `baseColor` parameter.
// The map auto-ranges so friend + accuracy circles always fit the outer ring;
// the live ring radius in meters is printed in the footer.

import { BackPlate } from "UIKit.lspkg/Scripts/BackPlate"
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { toRad, shortestAngleDeg, FEET_PER_METER, FEET_PER_MILE } from "./GeoMath"

const BASE_MAT = requireAsset("../../Materials/MarkerMat.mat") as Material

// Panel geometry (cm, local space).
const PANEL_W = 18
const PANEL_H = 26.5
const MAP_R = 6.6
const MAP_CENTER_Y = 2.8
const CONTENT_Z = 0.6
const BTN_W = 10
const BTN_H = 2.8
// Map auto-range steps (feet — display matches the iOS app's road units;
// 5280 ft = 1 mi). Ring radius snaps to the first step that fits the friend
// plus both accuracy circles.
const RANGES_FT = [15, 30, 60, 150, 300, 600, 1500, 3000, 5280, 15840, 52800]
const METERS_PER_DEG_LAT = 111320

// Tether — mirror of PovPanelUI, parked just RIGHT of center so the map and the
// call POV frame sit as a tight, readable side-by-side pair (POV is at -11, this
// at +11 → ~5 cm gap at 110 cm) instead of straddling the whole FOV. Same UP as
// the POV panel so their centers line up in a row.
const TETHER_DIST_CM = 110
const TETHER_RIGHT_CM = 11
const TETHER_UP_CM = 10
const FOLLOW_LERP_RATE = 6
const YAW_SMOOTH_RATE = 6

// Self is blue (dot, accuracy, heading wedge); friend + bearing are the
// cyan-teal accent shared with the destination pointer.
const COL_SELF = new vec4(0.4, 0.65, 1.0, 1)
const COL_SELF_ACC = new vec4(0.4, 0.65, 1.0, 0.16)
const COL_WEDGE = new vec4(0.4, 0.65, 1.0, 0.35)
const COL_FRIEND = new vec4(0.45, 0.9, 0.85, 1)
const COL_FRIEND_STALE = new vec4(0.45, 0.9, 0.85, 0.35)
const COL_FRIEND_ACC = new vec4(0.45, 0.9, 0.85, 0.14)
const COL_BEARING = new vec4(0.45, 0.9, 0.85, 0.8)
// The iPhone's own compass — drawn alongside the active heading so the two
// compasses can be compared live (they should roughly agree when the phone's
// top points where the wearer faces).
const COL_PHONE_HDG = new vec4(1, 0.72, 0.35, 0.9)
const COL_RING = new vec4(1, 1, 1, 0.28)
// UWB distance circle: the friend is somewhere ON this ring (exact distance,
// unknown direction) — where it crosses the friend dot, GPS and UWB agree.
const COL_UWB_RING = new vec4(0.45, 0.9, 0.85, 0.6)
const COL_TEXT = new vec4(1, 1, 1, 0.65)

// A friend fix older than this renders dimmed.
const STALE_FIX_S = 5

export interface MiniMapData {
    selfLat: number
    selfLon: number
    selfAccM: number | null
    selfSource: string
    selfAgeS: number | null
    friendLat: number
    friendLon: number
    friendAccM: number | null
    friendAgeS: number | null
    /** Fresh UWB phone-to-phone distance (m); null when out of range/stale. */
    uwbDistM: number | null
    headingDeg: number
    headingSource: string
    phoneHeadingDeg: number | null
    bearingDeg: number
    distanceM: number
}

@component
export class MiniMapUI extends BaseScriptComponent {
    private _onClose = new Event<void>()
    /** EXIT pressed — the manager returns to the mode menu. */
    get onClose(): PublicApi<void> { return this._onClose.publicApi() }

    private cameraProvider = WorldCameraFinderProvider.getInstance()
    private placed = false

    private mapRoot!: SceneObject
    private selfAccObj!: SceneObject
    private friendAccObj!: SceneObject
    private uwbRingObj!: SceneObject
    private wedgeObj!: SceneObject
    private bearingObj!: SceneObject
    private phoneHdgObj!: SceneObject
    private selfDotObj!: SceneObject
    private friendDotObj!: SceneObject
    private friendDotMat!: Material
    private friendDimmed = false
    private footer1!: Text
    private footer2!: Text
    private footer3!: Text
    private lastWaitingMsg: string | null = null

    onAwake(): void {
        this.sceneObject.createComponent("Component.Canvas")
        const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
        backPlate.size = new vec2(PANEL_W, PANEL_H)

        // Map layer — all geo elements live here, centered on the self dot.
        this.mapRoot = this.child(this.sceneObject, "Map", new vec3(0, MAP_CENTER_Y, CONTENT_Z))

        const discMesh = this.buildDisc(40)
        const ringMesh = this.buildRing(0.955, 56)
        const rayMesh = this.buildRay()
        const wedgeMesh = this.buildWedge(24, 10)

        // Paint order = creation order (later siblings draw on top).
        this.selfAccObj = this.makeElement("SelfAccuracy", discMesh, COL_SELF_ACC, 0.02)
        this.friendAccObj = this.makeElement("FriendAccuracy", discMesh, COL_FRIEND_ACC, 0.03)
        this.makeElement("RangeRing", ringMesh, COL_RING, 0.05).getTransform()
            .setLocalScale(new vec3(MAP_R, MAP_R, 1))
        this.uwbRingObj = this.makeElement("UwbRing", ringMesh, COL_UWB_RING, 0.055)
        this.wedgeObj = this.makeElement("HeadingWedge", wedgeMesh, COL_WEDGE, 0.06)
        this.wedgeObj.getTransform().setLocalScale(new vec3(4.2, 4.2, 1))
        this.phoneHdgObj = this.makeElement("PhoneHeadingRay", rayMesh, COL_PHONE_HDG, 0.07)
        this.phoneHdgObj.getTransform().setLocalScale(new vec3(0.14, MAP_R, 1))
        this.bearingObj = this.makeElement("BearingRay", rayMesh, COL_BEARING, 0.08)
        this.selfDotObj = this.makeElement("SelfDot", discMesh, COL_SELF, 0.1)
        this.selfDotObj.getTransform().setLocalScale(new vec3(0.45, 0.45, 1))
        this.friendDotObj = this.makeElement("FriendDot", discMesh, COL_FRIEND, 0.12)
        this.friendDotObj.getTransform().setLocalScale(new vec3(0.55, 0.55, 1))
        this.friendDotMat = (this.friendDotObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual)
            .mainMaterial

        // Chrome: title, north tick, two footer stat lines.
        this.makeText("Title", new vec3(0, PANEL_H / 2 - 1.4, CONTENT_Z), "FIND · DEBUG MAP", 30,
            new vec4(1, 1, 1, 0.85))
        this.makeText("North", new vec3(0, MAP_CENTER_Y + MAP_R + 0.85, CONTENT_Z), "N", 26, COL_TEXT)
        this.footer1 = this.makeText("Footer1",
            new vec3(0, MAP_CENTER_Y - MAP_R - 1.1, CONTENT_Z), "waiting…", 24, COL_TEXT)
        this.footer2 = this.makeText("Footer2",
            new vec3(0, MAP_CENTER_Y - MAP_R - 2.5, CONTENT_Z), "", 24, COL_TEXT)
        this.footer3 = this.makeText("Footer3",
            new vec3(0, MAP_CENTER_Y - MAP_R - 3.9, CONTENT_Z), "", 24, COL_TEXT)

        // EXIT — the only way out of a find-only session (no POV panel exists
        // to host CHANGE MODES there).
        const btnObj = this.child(this.sceneObject, "ExitFind",
            new vec3(0, -PANEL_H / 2 + 1.9, CONTENT_Z))
        const btn = btnObj.createComponent(Button.getTypeName()) as Button
        btn.onInitialized.add(() => { btn.size = new vec3(BTN_W, BTN_H, 1) })
        const lbl = this.makeText("ExitLabel",
            new vec3(0, -PANEL_H / 2 + 1.9, CONTENT_Z + 0.08), "✕  EXIT", 30,
            new vec4(1, 1, 1, 0.95))
        lbl.layoutRect = Rect.create(-BTN_W / 2, BTN_W / 2, -1.2, 1.2)
        btn.onTriggerUp.add(() => this._onClose.invoke())

        this.setWaiting("waiting for GPS fixes…")
        this.createEvent("UpdateEvent").bind(() => this.updateTether())
    }

    // ── Public API ───────────────────────────────────────────────────────

    /** No usable fixes yet: hide the geo layer, park a status line. */
    setWaiting(message: string): void {
        if (this.lastWaitingMsg === message) return
        this.lastWaitingMsg = message
        this.selfAccObj.enabled = false
        this.friendAccObj.enabled = false
        this.uwbRingObj.enabled = false
        this.wedgeObj.enabled = false
        this.phoneHdgObj.enabled = false
        this.bearingObj.enabled = false
        this.friendDotObj.enabled = false
        this.footer1.text = message
        this.footer2.text = ""
        this.footer3.text = ""
    }

    setData(d: MiniMapData): void {
        this.lastWaitingMsg = null

        // Equirectangular offsets (meters) — exact enough below a few km.
        const northM = (d.friendLat - d.selfLat) * METERS_PER_DEG_LAT
        const eastM = (d.friendLon - d.selfLon) * METERS_PER_DEG_LAT * Math.cos(toRad(d.selfLat))

        // Range: the GPS friend dot + its accuracy circle, self's circle, and
        // the UWB ring must all fit. (d.distanceM may be UWB-sourced, so the
        // dot's fit uses the raw GPS offset instead.)
        const gpsOffsetM = Math.sqrt(eastM * eastM + northM * northM)
        const neededFt = Math.max(
            gpsOffsetM + (d.friendAccM ?? 0),
            d.selfAccM ?? 0,
            d.uwbDistM ?? 0
        ) * FEET_PER_METER
        let rangeFt = RANGES_FT[RANGES_FT.length - 1]
        for (const r of RANGES_FT) {
            if (r >= Math.max(neededFt, RANGES_FT[0])) { rangeFt = r; break }
        }
        const scale = MAP_R / (rangeFt / FEET_PER_METER) // cm per meter

        // Friend dot + its accuracy disc (clamped to the ring for >max range).
        const rawX = eastM * scale
        const rawY = northM * scale
        const rawLen = Math.sqrt(rawX * rawX + rawY * rawY)
        const clampK = rawLen > MAP_R ? MAP_R / rawLen : 1
        const friendPos = new vec3(rawX * clampK, rawY * clampK, 0.12)
        this.friendDotObj.enabled = true
        this.friendDotObj.getTransform().setLocalPosition(friendPos)
        const stale = d.friendAgeS !== null && d.friendAgeS > STALE_FIX_S
        if (stale !== this.friendDimmed) {
            this.friendDimmed = stale
            this.friendDotMat.mainPass.baseColor = stale ? COL_FRIEND_STALE : COL_FRIEND
        }
        this.placeAccuracyDisc(this.friendAccObj, friendPos, d.friendAccM, scale)
        this.placeAccuracyDisc(this.selfAccObj, new vec3(0, 0, 0.02), d.selfAccM, scale)

        // UWB ring: exact distance, unknown direction — friend is ON the ring.
        const uwbRadiusCm = d.uwbDistM !== null ? d.uwbDistM * scale : 0
        this.uwbRingObj.enabled = uwbRadiusCm > 0.4
        if (this.uwbRingObj.enabled) {
            this.uwbRingObj.getTransform().setLocalScale(new vec3(uwbRadiusCm, uwbRadiusCm, 1))
        }

        // Heading wedge and bearing ray: compass degrees are clockwise from
        // north; local +Y is north and +Z faces the wearer, so screen-clockwise
        // is a negative rotation about Z.
        this.wedgeObj.enabled = true
        this.wedgeObj.getTransform().setLocalRotation(
            quat.fromEulerAngles(0, 0, -toRad(d.headingDeg)))
        this.phoneHdgObj.enabled = d.phoneHeadingDeg !== null
        if (d.phoneHeadingDeg !== null) {
            this.phoneHdgObj.getTransform().setLocalRotation(
                quat.fromEulerAngles(0, 0, -toRad(d.phoneHeadingDeg)))
        }
        this.bearingObj.enabled = true
        this.bearingObj.getTransform().setLocalRotation(
            quat.fromEulerAngles(0, 0, -toRad(d.bearingDeg)))
        this.bearingObj.getTransform().setLocalScale(
            new vec3(0.22, Math.min(rawLen, MAP_R), 1))

        const relDeg = shortestAngleDeg(0, d.bearingDeg - d.headingDeg)
        const ringLabel = rangeFt >= FEET_PER_MILE
            ? (rangeFt / FEET_PER_MILE).toFixed(0) + "mi"
            : rangeFt + "ft"
        this.footer1.text = "⌀" + ringLabel + " · self " + d.selfSource +
            this.accText(d.selfAccM) + " · frnd" + this.accText(d.friendAccM)
        this.footer2.text = "hdg " + d.headingDeg.toFixed(0) + "°(" + d.headingSource +
            ") · phone hdg " + (d.phoneHeadingDeg !== null
                ? d.phoneHeadingDeg.toFixed(0) + "°"
                : "—") +
            (d.uwbDistM !== null
                ? " · uwb " + (d.uwbDistM * FEET_PER_METER).toFixed(0) + "ft"
                : "")
        this.footer3.text = "brg " + d.bearingDeg.toFixed(0) + "° rel " + relDeg.toFixed(0) +
            "° · fix " + this.ageText(d.selfAgeS) + "/" + this.ageText(d.friendAgeS)
    }

    // ── Internals ────────────────────────────────────────────────────────

    private accText(accM: number | null): string {
        return accM !== null ? " ±" + (accM * FEET_PER_METER).toFixed(0) + "ft" : " ±?"
    }

    private ageText(ageS: number | null): string {
        return ageS !== null ? ageS.toFixed(1) + "s" : "?"
    }

    private placeAccuracyDisc(obj: SceneObject, center: vec3, accM: number | null, scale: number): void {
        const radiusCm = accM !== null ? accM * scale : 0
        // Hide when unknown or smaller than the dot itself (meaningless).
        if (radiusCm < 0.5) {
            obj.enabled = false
            return
        }
        obj.enabled = true
        const t = obj.getTransform()
        t.setLocalPosition(new vec3(center.x, center.y, t.getLocalPosition().z))
        t.setLocalScale(new vec3(radiusCm, radiusCm, 1))
    }

    private child(parent: SceneObject, name: string, pos: vec3): SceneObject {
        const obj = global.scene.createSceneObject(name)
        obj.setParent(parent)
        obj.getTransform().setLocalPosition(pos)
        return obj
    }

    private makeElement(name: string, mesh: RenderMesh, color: vec4, zLift: number): SceneObject {
        const obj = this.child(this.mapRoot, name, new vec3(0, 0, zLift))
        const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
        rmv.mesh = mesh
        const mat = BASE_MAT.clone()
        mat.mainPass.baseColor = color
        mat.mainPass.depthTest = true
        mat.mainPass.depthWrite = false
        mat.mainPass.twoSided = true
        if (color.w < 0.999) {
            mat.mainPass.blendMode = BlendMode.Normal
        }
        rmv.mainMaterial = mat
        return obj
    }

    private makeText(name: string, pos: vec3, initial: string, size: number, color: vec4): Text {
        const obj = this.child(this.sceneObject, name, pos)
        const t = obj.createComponent("Component.Text") as Text
        t.text = initial
        t.size = size
        t.depthTest = true
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Overflow
        t.verticalOverflow = VerticalOverflow.Overflow
        t.layoutRect = Rect.create(-PANEL_W / 2 + 0.4, PANEL_W / 2 - 0.4, -0.8, 0.8)
        t.textFill.color = color
        return t
    }

    // ── Flat XY-plane meshes (unit-sized; elements scale/rotate them) ────

    private newBuilder(): MeshBuilder {
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "texture0", components: 2 },
        ])
        builder.topology = MeshTopology.Triangles
        builder.indexType = MeshIndexType.UInt16
        return builder
    }

    private vert(x: number, y: number): number[] {
        return [x, y, 0, 0, 0, 1, 0, 0]
    }

    /** Unit-radius filled circle (triangle fan around a center vertex). */
    private buildDisc(segments: number): RenderMesh {
        const b = this.newBuilder()
        const verts: number[] = this.vert(0, 0)
        const idx: number[] = []
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2
            verts.push(...this.vert(Math.cos(a), Math.sin(a)))
            if (i > 0) idx.push(0, i, i + 1)
        }
        b.appendVerticesInterleaved(verts)
        b.appendIndices(idx)
        b.updateMesh()
        return b.getMesh()
    }

    /** Unit-outer-radius annulus (the map's range ring). */
    private buildRing(innerRatio: number, segments: number): RenderMesh {
        const b = this.newBuilder()
        const verts: number[] = []
        const idx: number[] = []
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2
            const c = Math.cos(a)
            const s = Math.sin(a)
            verts.push(...this.vert(c, s), ...this.vert(c * innerRatio, s * innerRatio))
            if (i > 0) {
                const o = i * 2
                idx.push(o - 2, o - 1, o, o - 1, o + 1, o)
            }
        }
        b.appendVerticesInterleaved(verts)
        b.appendIndices(idx)
        b.updateMesh()
        return b.getMesh()
    }

    /** 1-unit-wide, 1-unit-long strip pointing +Y from the origin. */
    private buildRay(): RenderMesh {
        const b = this.newBuilder()
        b.appendVerticesInterleaved([
            ...this.vert(-0.5, 0), ...this.vert(0.5, 0),
            ...this.vert(0.5, 1), ...this.vert(-0.5, 1),
        ])
        b.appendIndices([0, 1, 2, 0, 2, 3])
        b.updateMesh()
        return b.getMesh()
    }

    /** Unit-radius wedge fanning ±halfAngle around +Y (heading cone). */
    private buildWedge(halfAngleDeg: number, segments: number): RenderMesh {
        const b = this.newBuilder()
        const verts: number[] = this.vert(0, 0)
        const idx: number[] = []
        const half = toRad(halfAngleDeg)
        for (let i = 0; i <= segments; i++) {
            // Sweep from +Y-half to +Y+half (angles from +X axis).
            const a = Math.PI / 2 - half + (i / segments) * half * 2
            verts.push(...this.vert(Math.cos(a), Math.sin(a)))
            if (i > 0) idx.push(0, i, i + 1)
        }
        b.appendVerticesInterleaved(verts)
        b.appendIndices(idx)
        b.updateMesh()
        return b.getMesh()
    }

    // ── Continuous follow + yaw billboard (PovPanelUI idiom, right side) ─

    private updateTether(): void {
        const dt = getDeltaTime()
        const camT = this.cameraProvider.getTransform()
        const camPos = camT.getWorldPosition()
        const fwd = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
        const flat = Math.sqrt(fwd.x * fwd.x + fwd.z * fwd.z)
        if (flat < 0.05) return
        const fx = fwd.x / flat
        const fz = fwd.z / flat
        const rx = -fz
        const rz = fx

        const desired = new vec3(
            camPos.x + fx * TETHER_DIST_CM + rx * TETHER_RIGHT_CM,
            camPos.y + TETHER_UP_CM,
            camPos.z + fz * TETHER_DIST_CM + rz * TETHER_RIGHT_CM
        )

        const t = this.sceneObject.getTransform()
        if (!this.placed) {
            this.placed = true
            t.setWorldPosition(desired)
        } else {
            t.setWorldPosition(vec3.lerp(
                t.getWorldPosition(), desired, 1 - Math.exp(-FOLLOW_LERP_RATE * dt)
            ))
        }

        const pos = t.getWorldPosition()
        const targetYaw = Math.atan2(camPos.x - pos.x, camPos.z - pos.z)
        const targetRot = quat.fromEulerAngles(0, targetYaw, 0)
        t.setWorldRotation(quat.slerp(
            t.getWorldRotation(), targetRot, 1 - Math.exp(-YAW_SMOOTH_RATE * dt)
        ))
    }
}
