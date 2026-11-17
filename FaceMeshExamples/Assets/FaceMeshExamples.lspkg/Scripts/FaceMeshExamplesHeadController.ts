// FaceMeshExamplesHeadController.ts
// Owns: the HeadSlots SceneObject (the one this component sits on) — which slot
//   is active, and whether HeadSlots rides the tracked face (HeadAnchor) or the
//   world-anchored fallback stage (HeadStage). Optional jaw-open drive on the
//   active slot's Placeholder child.
// @inputs: headAnchor, headBinding, headStage, slots, followFace,
//   jawDriveEnabled, jawScaleAmount.
// Must not: touch imported heads under slots (only the Placeholder child may be
//   scaled by the jaw drive), call other ScriptComponents, or use UI/Text.

import { SCENE_NAMES, FACE_INDEX, wrapIndex } from "./FaceMeshExamplesSceneContracts";

@component
export class FaceMeshExamplesHeadController extends BaseScriptComponent {
    @input
    @allowUndefined
    @hint("HeadAnchor under Camera, carries the Head Binding")
    headAnchor: SceneObject;

    @input
    @allowUndefined
    @hint("Head Binding component (faceIndex 0, Candide Center)")
    headBinding: Head;

    @input
    @hint("World-anchored fallback stage, default parent of HeadSlots")
    headStage: SceneObject;

    @input
    @hint("Slot_Capybara, Slot_EggWithEyes, Slot_Frog, Slot_PirateShark in order")
    slots: SceneObject[] = [];

    @input followFace: boolean = true;
    @input jawDriveEnabled: boolean = false;

    @input
    @widget(new SliderWidget(0, 0.5, 0.01))
    jawScaleAmount: number = 0.2;

    @input
    @widget(new SliderWidget(0.1, 5, 0.1))
    @hint("Stabilization: lower = steadier when the person is still (Hz)")
    minCutoff: number = 0.8;

    @input
    @widget(new SliderWidget(0, 0.1, 0.002))
    @hint("Stabilization: higher = less lag when the person moves fast")
    speedResponse: number = 0.02;

    @input
    @widget(new SliderWidget(0, 1.5, 0.05))
    @hint("Keep the head in place this long after tracking drops (s)")
    lostGraceSec: number = 0.4;

    private activeIndex = 0;
    private faceBound = false;
    private faceAvailable = false;
    private pollingEnabled = true;
    private pollTimer = 0;
    private jawSupported = true;
    private jawPlaceholder: SceneObject | null = null;
    private jawBaseScale: vec3 | null = null;
    private lostAt = -1;
    private fPos: vec3 | null = null;
    private fPosVel = vec3.zero();
    private fRot: quat | null = null;

    onAwake(): void {
        if (!this.headStage) print("FaceMeshExamplesHeadController: headStage is not set — reparenting disabled");
        if (!this.headAnchor || !this.headBinding) {
            print("FaceMeshExamplesHeadController: headAnchor/headBinding missing — staying in stage mode");
        }
        if (!this.slots || this.slots.length === 0) print("FaceMeshExamplesHeadController: slots array is empty");

        this.attachToStage();

        const found = this.createEvent("FaceFoundEvent") as FaceFoundEvent;
        found.faceIndex = FACE_INDEX;
        found.bind(() => this.onFaceState(true));

        const lost = this.createEvent("FaceLostEvent") as FaceLostEvent;
        lost.faceIndex = FACE_INDEX;
        lost.bind(() => this.onFaceState(false));

        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
        this.createEvent("LateUpdateEvent").bind(() => this.followFiltered());
    }

    // ---- Public API (called by FaceMeshExamplesMain from its OnStartEvent) ----

    setActive(index: number): void {
        const count = this.slots ? this.slots.length : 0;
        if (count === 0) return;
        const next = wrapIndex(index, count);
        this.restorePlaceholder();
        this.activeIndex = next;
        for (let i = 0; i < count; i++) {
            const slot = this.slots[i];
            if (slot && !isNull(slot)) slot.enabled = i === next;
        }
    }

    getActiveIndex(): number {
        return this.activeIndex;
    }

    getSlotCount(): number {
        return this.slots ? this.slots.length : 0;
    }

    getSlot(index: number): SceneObject | null {
        if (!this.slots || index < 0 || index >= this.slots.length) return null;
        const slot = this.slots[index];
        return slot && !isNull(slot) ? slot : null;
    }

    isFaceBound(): boolean {
        return this.faceBound;
    }

    // ---- Face / stage mode ----

    private onFaceState(available: boolean): void {
        this.faceAvailable = available;
        if (!this.followFace) {
            this.attachToStage();
            return;
        }
        if (available) {
            this.lostAt = -1;
            this.attachToFace();
        } else if (this.faceBound && this.lostAt < 0) {
            this.lostAt = getTime(); // hold the last pose briefly; see followFiltered
        }
    }

    private attachToFace(): void {
        if (!this.headAnchor || isNull(this.headAnchor) || !this.headBinding) return;
        if (!this.faceBound) {
            // Detach to world space; followFiltered() drives the pose each frame.
            this.getSceneObject().setParent(null);
            this.getTransform().setLocalScale(vec3.one());
            this.fPos = null;
            this.fRot = null;
            print("FaceMeshExamplesHeadController: face found — HeadSlots follows the face (stabilized)");
        }
        this.faceBound = true;
    }

    private attachToStage(): void {
        this.lostAt = -1;
        if (!this.headStage || isNull(this.headStage)) return;
        this.reparent(this.headStage);
        if (this.faceBound) print("FaceMeshExamplesHeadController: face lost — HeadSlots back on the stage");
        this.faceBound = false;
        this.restorePlaceholder();
    }

    /** Returns true when a reparent actually happened. */
    private reparent(target: SceneObject): boolean {
        const so = this.getSceneObject();
        const parent = so.getParent();
        if (parent && !isNull(parent) && parent === target) return false;
        so.setParent(target);
        const t = so.getTransform();
        t.setLocalPosition(vec3.zero());
        t.setLocalRotation(quat.quatIdentity());
        t.setLocalScale(vec3.one());
        return true;
    }

    // ---- Update: polling backup + jaw drive ----

    private onUpdate(): void {
        this.pollTimer += getDeltaTime();
        if (this.pollingEnabled && this.pollTimer >= 0.25) {
            this.pollTimer = 0;
            this.poll();
        }
        this.driveJaw();
    }

    private poll(): void {
        if (!this.headBinding || !this.headAnchor) return;
        let count = 0;
        try {
            count = this.headBinding.getFacesCount();
        } catch (e) {
            this.pollingEnabled = false;
            print("FaceMeshExamplesHeadController: getFacesCount unavailable — polling disabled");
            return;
        }
        const available = count > FACE_INDEX;
        const wantFace = available && this.followFace;
        if (wantFace && !this.faceBound) this.onFaceState(true);
        else if (!wantFace && this.faceBound && this.lostAt < 0) this.onFaceState(false);
    }

    private driveJaw(): void {
        if (!this.jawSupported || !this.jawDriveEnabled || !this.faceBound) return;
        const binding = this.headBinding as any;
        const fn = binding ? binding.getExpressionWeightByName : undefined;
        if (typeof fn !== "function") {
            this.jawSupported = false;
            print("FaceMeshExamplesHeadController: expression weights not on Head in this SDK — jaw drive disabled");
            return;
        }
        let w = 0;
        try {
            w = fn.call(binding, "JawOpen");
        } catch (e) {
            this.jawSupported = false;
            print("FaceMeshExamplesHeadController: JawOpen read failed — jaw drive disabled");
            return;
        }
        const ph = this.findPlaceholder(this.getSlot(this.activeIndex));
        if (!ph) return;
        if (ph !== this.jawPlaceholder) {
            this.restorePlaceholder();
            this.jawPlaceholder = ph;
            this.jawBaseScale = ph.getTransform().getLocalScale();
        }
        const b = this.jawBaseScale;
        ph.getTransform().setLocalScale(new vec3(b.x, b.y * (1 + w * this.jawScaleAmount), b.z));
    }

    // ---- Stabilized face follow (One Euro filter) ----

    private static alpha(cutoffHz: number, dt: number): number {
        const tau = 1 / (2 * Math.PI * cutoffHz);
        return 1 / (1 + tau / Math.max(dt, 1e-4));
    }

    private followFiltered(): void {
        if (!this.faceBound) return;
        if (this.lostAt >= 0) {
            if (getTime() - this.lostAt >= this.lostGraceSec) this.attachToStage();
            return; // within the grace period: hold the last filtered pose
        }
        if (!this.headAnchor || isNull(this.headAnchor) || !this.headAnchor.isEnabledInHierarchy) return;
        const src = this.headAnchor.getTransform();
        const pos = src.getWorldPosition();
        const rot = src.getWorldRotation();
        const dt = getDeltaTime();
        const t = this.getTransform();
        if (!this.fPos || !this.fRot) {
            this.fPos = pos;
            this.fRot = rot;
            this.fPosVel = vec3.zero();
        } else {
            // Speed estimate (cm/s), itself lightly filtered, sets the cutoff.
            const vel = pos.sub(this.fPos).uniformScale(1 / Math.max(dt, 1e-4));
            const aV = FaceMeshExamplesHeadController.alpha(1.0, dt);
            this.fPosVel = vec3.lerp(this.fPosVel, vel, aV);
            const speed = this.fPosVel.length;
            const aP = FaceMeshExamplesHeadController.alpha(this.minCutoff + this.speedResponse * speed, dt);
            this.fPos = vec3.lerp(this.fPos, pos, aP);
            // Rotation: angular speed (deg/s) drives its own cutoff.
            const angDeg = quat.angleBetween(this.fRot, rot) * 180 / Math.PI;
            const aR = FaceMeshExamplesHeadController.alpha(this.minCutoff + this.speedResponse * 2 * (angDeg / Math.max(dt, 1e-4)), dt);
            this.fRot = quat.slerp(this.fRot, rot, aR);
        }
        t.setWorldPosition(this.fPos);
        t.setWorldRotation(this.fRot);
    }

    private findPlaceholder(slot: SceneObject | null): SceneObject | null {
        if (!slot) return null;
        const n = slot.getChildrenCount();
        for (let i = 0; i < n; i++) {
            const c = slot.getChild(i);
            if (c && !isNull(c) && c.name === SCENE_NAMES.placeholder) return c;
        }
        return null;
    }

    private restorePlaceholder(): void {
        if (this.jawPlaceholder && !isNull(this.jawPlaceholder) && this.jawBaseScale) {
            this.jawPlaceholder.getTransform().setLocalScale(this.jawBaseScale);
        }
        this.jawPlaceholder = null;
        this.jawBaseScale = null;
    }
}
