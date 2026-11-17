// FaceMeshExamplesMain.ts
// Owns: FaceMeshExamples lifecycle and the only piece of state (activeIndex). Wires the
// selector UI's onPrev/onNext -> cycle() -> HeadController.setActive + UI
// setters + audio. Places HeadStage in front of the camera on start and makes
// sure every slot has a Placeholder (runtime fallback only).
// @inputs: headController, selectorUI, headStage, camera, clickAudio, swapAudio
//          + startIndex / stageDistanceCm / stageHeightOffsetCm / volumes.
// Must not: create semantic roots, touch imported heads, render text or use
//           UIKit directly, or call sibling components from onAwake.

import { FaceMeshExamplesHeadController } from "./FaceMeshExamplesHeadController";
import { FaceMeshExamplesHeadSelectorUI } from "./FaceMeshExamplesHeadSelectorUI";
import { FaceMeshExamplesAudioController } from "./FaceMeshExamplesAudioController";
import { ensurePlaceholder } from "./FaceMeshExamplesSceneBuild";
import { CHARACTERS, PLACEHOLDER_DIAMETER_CM, wrapIndex, resolveCamera } from "./FaceMeshExamplesSceneContracts";
import { FaceMeshExamplesDebugFaceMesh } from "./FaceMeshExamplesDebugFaceMesh";

@component
export class FaceMeshExamplesMain extends BaseScriptComponent {
    @input
    @hint("HeadSlots' FaceMeshExamplesHeadController")
    headController!: FaceMeshExamplesHeadController;

    @input
    @hint("HeadSelectorUI's FaceMeshExamplesHeadSelectorUI")
    selectorUI!: FaceMeshExamplesHeadSelectorUI;

    @input
    @hint("World-anchored fallback stage (scene root)")
    headStage!: SceneObject;

    @input
    @allowUndefined
    @hint("HeadAnchor (the Head binding). Face tracking needs it under the camera: if the prefab ships it elsewhere, it is moved under `camera` on awake, keeping its local transform")
    headAnchor: SceneObject;

    @input
    @allowUndefined
    @hint("Main Camera SceneObject (empty: SIK's world camera is used)")
    camera: SceneObject;

    @input
    @hint("AudioComponent with ButtonClick.wav")
    clickAudio!: AudioComponent;

    @input
    @hint("AudioComponent with HeadSwap.wav")
    swapAudio!: AudioComponent;

    @input
    @allowUndefined
    @hint("ExpressionSource's FaceMeshExamplesDebugFaceMesh: the panel's Option button toggles it on face-mesh heads")
    debugFaceMesh: FaceMeshExamplesDebugFaceMesh;

    @input
    @hint("Head visuals using the HeadFade material: the panel's fade - / + sets how much of each head fades to black")
    fadeHeads: RenderMeshVisual[] = [];

    @input
    @widget(new SliderWidget(0, 0.7, 0.01))
    @hint("Fraction of each head's height (from the bottom) that fades out")
    fadeAmount: number = 0.3;

    @input
    @widget(new SliderWidget(0, 3, 1))
    startIndex: number = 0;

    @input
    @widget(new SliderWidget(0.02, 0.25, 0.01))
    @hint("Scale step for the panel's − / + buttons")
    scaleStep: number = 0.1;

    @input
    @widget(new SliderWidget(40, 150, 1))
    stageDistanceCm: number = 110;

    @input
    @widget(new SliderWidget(-30, 30, 1))
    stageHeightOffsetCm: number = 0;

    @input
    @widget(new SliderWidget(0, 1, 0.05))
    clickVolume: number = 0.6;

    @input
    @widget(new SliderWidget(0, 1, 0.05))
    swapVolume: number = 0.8;

    // Inspector toggle (Hard Rule 6.7). FaceMeshExamples has no colliders today, but the
    // walker keeps the debug path uniform if the user adds some.
    @input
    debugColliders: boolean = false;

    private activeIndex = 0;
    private scales: number[] = [];
    private started = false;
    private refsOk = false;
    private audio: FaceMeshExamplesAudioController | null = null;

    onAwake(): void {
        this.mountHeadAnchor();
        this.refsOk = this.validateRefs();
        // Own-field construction only: the audio wrapper owns no ScriptComponent.
        this.audio = new FaceMeshExamplesAudioController(
            this.clickAudio || null, this.swapAudio || null, this.clickVolume, this.swapVolume);
        this.activeIndex = this.startIndex; // wrapped in onStart
        // Everything cross-component waits for OnStartEvent (siblings not awake yet).
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        if (this.debugColliders) {
            this.setColliderDebugAll(this.getSceneObject(), true);
        }
    }

    /**
     * The package prefab is self-contained, so it carries the Head binding (HeadAnchor) itself.
     * A Head binding only tracks faces as a child of the camera: move it there before anything starts.
     */
    private mountHeadAnchor(): void {
        this.camera = resolveCamera(this.camera);
        if (!this.headAnchor || !this.camera) return;
        const parent = this.headAnchor.getParent();
        if (parent && parent.isSame(this.camera)) return;
        const t = this.headAnchor.getTransform();
        const pos = t.getLocalPosition();
        const rot = t.getLocalRotation();
        const scale = t.getLocalScale();
        this.headAnchor.setParent(this.camera);
        t.setLocalPosition(pos);
        t.setLocalRotation(rot);
        t.setLocalScale(scale);
    }

    private validateRefs(): boolean {
        const missing: string[] = [];
        if (!this.headController) missing.push("headController");
        if (!this.selectorUI) missing.push("selectorUI");
        if (!this.headStage) missing.push("headStage");
        if (!this.clickAudio) missing.push("clickAudio");
        if (!this.swapAudio) missing.push("swapAudio");
        if (missing.length > 0) {
            print("FaceMeshExamplesMain: required @input not wired: " + missing.join(", ") + ". Check bootstrap wiring.");
        }
        // Audio is optional for function; controller + UI + stage are not.
        return !!this.headController && !!this.selectorUI && !!this.headStage;
    }

    private onStart(): void {
        if (!this.refsOk) return;
        // SIK may find the world camera only after awake: mount the Head binding now if onAwake couldn't.
        if (!this.camera) this.mountHeadAnchor();
        if (!this.camera) print("FaceMeshExamplesMain: no camera found (wire `camera`, or keep the SIK prefab in the scene).");
        this.recenterStage();
        // Camera pose from device tracking settles a few frames after start; re-place once it has.
        const settle = this.createEvent("DelayedCallbackEvent");
        settle.bind(() => this.recenterStage());
        settle.reset(0.5);
        this.ensurePlaceholders();

        this.selectorUI.onPrev.add(() => this.onUserCycle(-1));
        this.selectorUI.onNext.add(() => this.onUserCycle(1));
        this.selectorUI.onFadeDown.add(() => this.onUserFade(-1));
        this.selectorUI.onFadeUp.add(() => this.onUserFade(1));
        this.applyFade();
        this.selectorUI.onScaleDown.add(() => this.onUserScale(-1));
        this.selectorUI.onScaleUp.add(() => this.onUserScale(1));
        this.selectorUI.onNextOption.add(() => {
            if (this.audio) this.audio.playClick();
            if (this.debugFaceMesh) {
                this.debugFaceMesh.setDebugVisible(!this.debugFaceMesh.isDebugVisible());
                this.updateDebugLabel();
            }
        });

        this.activeIndex = wrapIndex(this.activeIndex, this.entryCount());
        this.started = true;
        this.applyActive(false);
    }

    /** Re-places HeadStage stageDistanceCm in front of the camera at eye height, facing it. */
    recenterStage(): void {
        if (!this.headStage || !this.camera) return;
        const camT = this.camera.getTransform();
        const camPos = camT.getWorldPosition();
        const look = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1));
        let flat = new vec3(look.x, 0, look.z);
        if (flat.length < 1e-4) flat = new vec3(0, 0, -1);
        flat = flat.normalize();
        const pos = camPos.add(flat.uniformScale(this.stageDistanceCm))
            .add(new vec3(0, this.stageHeightOffsetCm, 0));
        const stageT = this.headStage.getTransform();
        stageT.setWorldPosition(pos);
        // Stage +Z points back at the wearer (identity when the camera faces -Z).
        const faceRot = quat.lookAt(flat.uniformScale(-1), vec3.up());
        stageT.setWorldRotation(faceRot);
        // The selector panel positions itself (FaceMeshExamplesPanelFollow keeps it with the wearer).
    }

    private ensurePlaceholders(): void {
        const count = Math.min(this.headController.getSlotCount(), CHARACTERS.length);
        for (let i = 0; i < count; i++) {
            const slot = this.headController.getSlot(i);
            if (!slot) continue;
            ensurePlaceholder(slot, CHARACTERS[i].placeholderColor, PLACEHOLDER_DIAMETER_CM);
        }
    }

    /** Switch head without the button click sound (e.g. from a hand wave). */
    cycle(delta: number): void {
        if (!this.started) return;
        this.activeIndex = wrapIndex(this.activeIndex + delta, this.entryCount());
        this.applyActive(true);
    }

    private onUserCycle(delta: number): void {
        if (!this.started) return;
        if (this.audio) this.audio.playClick();
        this.activeIndex = wrapIndex(this.activeIndex + delta, this.entryCount());
        this.applyActive(true);
    }

    /** One entry per Face Mesh head (CHARACTERS order = slot order). */
    private entryCount(): number {
        return CHARACTERS.length;
    }

    /** The slot that holds the active head. */
    private activeSlotIndex(): number {
        return this.activeIndex;
    }

    private onUserFade(dir: number): void {
        if (!this.started) return;
        if (this.audio) this.audio.playClick();
        this.fadeAmount = Math.max(0, Math.min(0.7, Math.round((this.fadeAmount + dir * 0.05) * 100) / 100));
        this.applyFade();
    }

    /** Fade-to-black toward the neck, as a fraction of each head's own height (object space). */
    private applyFade(): void {
        for (const v of this.fadeHeads) {
            if (!v || !v.mesh || !v.mainMaterial) continue;
            const lo = v.mesh.aabbMin.y;
            const hi = v.mesh.aabbMax.y;
            const pass = v.mainMaterial.mainPass as any;
            pass.fadeBottom = lo - 0.001;
            pass.fadeTop = lo + this.fadeAmount * (hi - lo);
        }
        this.selectorUI.setFadeLabel("Fade " + Math.round(this.fadeAmount * 100) + "%");
    }

    private updateDebugLabel(): void {
        if (!this.debugFaceMesh) return;
        this.selectorUI.setOptionLabel(this.debugFaceMesh.isDebugVisible() ? "Debug: On" : "Debug: Off");
    }

    private onUserScale(dir: number): void {
        if (!this.started) return;
        if (this.audio) this.audio.playClick();
        const cur = this.scales[this.activeIndex] || 1;
        this.scales[this.activeIndex] = Math.max(0.5, Math.min(2.0, Math.round((cur + dir * this.scaleStep) * 100) / 100));
        this.applyScale();
    }

    private applyScale(): void {
        const s = this.scales[this.activeIndex] || 1;
        const slot = this.headController.getSlot(this.activeSlotIndex());
        if (slot) slot.getTransform().setLocalScale(new vec3(s, s, s));
        this.selectorUI.setScaleLabel(Math.round(s * 100) + "%");
    }

    private applyActive(playSwap: boolean): void {
        if (!this.started) return;
        const total = this.entryCount();
        this.headController.setActive(this.activeSlotIndex());
        const name = CHARACTERS[this.activeIndex].displayName;
        this.selectorUI.setSource("Face Mesh");
        // The Option button toggles the debug Face Mesh.
        this.selectorUI.setOptionVisible(!!this.debugFaceMesh);
        this.updateDebugLabel();
        this.selectorUI.setCharacterName(name);
        this.selectorUI.setIndex(this.activeIndex + 1, total);
        this.applyScale();
        if (playSwap && this.audio) this.audio.playSwap();
        print("FaceMeshExamplesMain: active head " + (this.activeIndex + 1) + "/" + total + " " + name);
    }

    private setColliderDebugAll(obj: SceneObject, enable: boolean): void {
        const c = obj.getComponent("Physics.ColliderComponent") as ColliderComponent | null;
        if (c) c.debugDrawEnabled = enable;
        const b = obj.getComponent("Physics.BodyComponent") as ColliderComponent | null;
        if (b) b.debugDrawEnabled = enable;
        for (let i = 0; i < obj.getChildrenCount(); i++) {
            this.setColliderDebugAll(obj.getChild(i), enable);
        }
    }
}
