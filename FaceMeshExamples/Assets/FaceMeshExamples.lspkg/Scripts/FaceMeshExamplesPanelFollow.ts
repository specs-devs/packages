import { resolveCamera } from "./FaceMeshExamplesSceneContracts"
// FaceMeshExamplesPanelFollow — keeps the selector panel with the wearer, low in front of them,
// tilted to face their eyes. It is lazy: the panel stays put while the wearer looks
// around and only re-centres once they turn past turnThresholdDeg or walk past
// moveThresholdCm. Only yaw counts, so looking down at the panel doesn't move it.

@component
export class FaceMeshExamplesPanelFollow extends BaseScriptComponent {
    @input
    @allowUndefined
    @hint("Main Camera SceneObject (empty: SIK's world camera is used)")
    camera: SceneObject

    @input
    @widget(new SliderWidget(25, 90, 1))
    @hint("Distance in front of the wearer (cm)")
    distanceCm: number = 45

    @input
    @widget(new SliderWidget(-45, 10, 1))
    @hint("Height relative to the eyes (cm, negative = below)")
    heightCm: number = -30

    @input
    @widget(new SliderWidget(0.5, 12, 0.5))
    @hint("How quickly the panel catches up (higher = snappier)")
    followSpeed: number = 3

    @input
    @widget(new SliderWidget(5, 90, 1))
    @hint("Turn the head this far (deg) before the panel re-centres")
    turnThresholdDeg: number = 30

    @input
    @widget(new SliderWidget(5, 100, 1))
    @hint("Walk this far (cm) before the panel re-centres")
    moveThresholdCm: number = 20

    private initialized = false
    /** Wearer yaw frame the panel is currently placed against (updated lazily). */
    private anchor: { pos: vec3; right: vec3; fwd: vec3 } | null = null
    private dragging = false
    /** Panel offset in the wearer's yaw frame (x right, y up, z forward), cm. */
    private offset: vec3 | null = null

    onAwake(): void {
        this.createEvent("LateUpdateEvent").bind(() => this.follow())
        // Dragging (UIKit Frame's InteractableManipulation): stop following while held,
        // then keep the dropped spot relative to the wearer.
        this.createEvent("OnStartEvent").bind(() => {
            const manip = this.findManipulation(this.getSceneObject())
            if (!manip) {
                print("FaceMeshExamplesPanelFollow: no InteractableManipulation found — panel is not draggable")
                return
            }
            manip.onManipulationStart.add(() => (this.dragging = true))
            manip.onManipulationEnd.add(() => {
                this.dragging = false
                this.captureOffset()
            })
        })
    }

    private findManipulation(o: SceneObject): any {
        const comps = o.getComponents("Component.ScriptComponent") as any[]
        for (const c of comps) if (c && c.onManipulationStart && c.onManipulationEnd) return c
        for (let i = 0; i < o.getChildrenCount(); i++) {
            const r = this.findManipulation(o.getChild(i))
            if (r) return r
        }
        return null
    }

    private yawFrame(): { pos: vec3; right: vec3; fwd: vec3 } {
        const camT = this.camera.getTransform()
        const f = camT.forward.uniformScale(-1) // camera looks down its -Z
        let flat = new vec3(f.x, 0, f.z)
        if (flat.length < 1e-4) flat = new vec3(0, 0, -1)
        flat = flat.normalize()
        return { pos: camT.getWorldPosition(), right: flat.cross(vec3.up()).normalize(), fwd: flat }
    }

    private captureOffset(): void {
        this.camera = resolveCamera(this.camera)
        if (!this.camera) return
        const fr = this.yawFrame()
        this.anchor = fr
        const d = this.getTransform().getWorldPosition().sub(fr.pos)
        this.offset = new vec3(d.dot(fr.right), d.y, d.dot(fr.fwd))
    }

    private follow(): void {
        this.camera = resolveCamera(this.camera)
        if (!this.camera || this.dragging) return
        const fr = this.yawFrame()
        if (!this.anchor) this.anchor = fr
        const turned = Math.acos(Math.max(-1, Math.min(1, this.anchor.fwd.dot(fr.fwd)))) * 180 / Math.PI
        const moved = fr.pos.sub(this.anchor.pos).length
        if (turned > this.turnThresholdDeg || moved > this.moveThresholdCm) this.anchor = fr
        const a = this.anchor
        const o = this.offset || new vec3(0, this.heightCm, this.distanceCm)
        const target = a.pos
            .add(a.right.uniformScale(o.x)).add(new vec3(0, o.y, 0)).add(a.fwd.uniformScale(o.z))

        const t = this.getTransform()
        const pos = this.initialized
            ? vec3.lerp(t.getWorldPosition(), target, 1 - Math.exp(-this.followSpeed * getDeltaTime()))
            : target
        // Face the eyes, pitch included, so a low panel tilts up toward the wearer.
        const toWearer = fr.pos.sub(pos).normalize()
        const rot = quat.lookAt(toWearer, vec3.up())
        t.setWorldPosition(pos)
        t.setWorldRotation(this.initialized ? quat.slerp(t.getWorldRotation(), rot, 1 - Math.exp(-8 * getDeltaTime())) : rot)
        this.initialized = true
    }
}
