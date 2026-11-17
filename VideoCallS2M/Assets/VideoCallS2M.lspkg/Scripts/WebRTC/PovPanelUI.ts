// PovPanelUI — a portrait 9:16 video panel showing a streamed POV (Watch Your
// Back / Call Friend). BackPlate + Component.Image + status caption + CHANGE
// MODES button. The image quad aspect-fits the incoming texture inside the
// video box (letterboxed, never stretched) — phones send 9:16 portrait, the
// Glasses camera sends landscape, both display undistorted. Tethers to the
// wearer like the destination arrow (dead zone + lazy lerp, yaw-billboarded),
// parked slightly left of center view.

import { BackPlate } from "UIKit.lspkg/Scripts/BackPlate"
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const IMAGE_MATERIAL = requireAsset("../../Materials/ImageMaterial.mat") as Material

const VIDEO_W = 27
const VIDEO_H = 48 // 9:16 portrait — scaled 1.5× (was 18×32) for a bigger frame
const PAD = 1.2
const CAPTION_H = 3.4 // two wrapped lines
const BTN_W = 18
const BTN_H = 3.4
const BTN_GAP = 0.5
const PANEL_H = PAD * 2 + VIDEO_H + CAPTION_H + BTN_GAP + BTN_H

// Continuous follow (same idiom as the destination arrow): every frame the
// panel eases toward its anchor point ahead-left of the wearer — no dead
// zone, no parked-then-jump. Critically-damped feel via exponential lerp.
const TETHER_DIST_CM = 110
// Parked just left of center so it sits side-by-side with the Find minimap
// (which mirrors this at +11) — a tight, readable pair instead of straddling
// the whole FOV.
const TETHER_RIGHT_CM = -11 // negative = left of view
const TETHER_UP_CM = 0 // was 10 — the 1.5× panel reached too high in view
const FOLLOW_LERP_RATE = 6
const YAW_SMOOTH_RATE = 6

@component
export class PovPanelUI extends BaseScriptComponent {
    private _onClose = new Event<void>()
    get onClose(): PublicApi<void> { return this._onClose.publicApi() }
    /** Quality button tapped — the manager cycles the preset and calls
     *  setQualityLabel with the applied one. */
    private _onQualityToggle = new Event<void>()
    get onQualityToggle(): PublicApi<void> { return this._onQualityToggle.publicApi() }

    private image!: Image
    private imageObj!: SceneObject
    private imageMat!: Material
    private caption!: Text
    private qualityLbl: Text | null = null
    private haveFrame = false
    private lastAspect = 0

    private cameraProvider = WorldCameraFinderProvider.getInstance()
    private placed = false

    onAwake(): void {
        this.sceneObject.createComponent("Component.Canvas")

        const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
        backPlate.size = new vec2(VIDEO_W + PAD * 2, PANEL_H)

        const content = global.scene.createSceneObject("Content")
        content.setParent(this.sceneObject)
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

        const top = PANEL_H / 2
        const videoY = top - PAD - VIDEO_H / 2
        const captionY = videoY - VIDEO_H / 2 - CAPTION_H / 2
        const btnY = captionY - CAPTION_H / 2 - BTN_GAP - BTN_H / 2

        // Video image (rescaled per-texture to aspect-fit the 9:16 box).
        this.imageObj = global.scene.createSceneObject("PovImage")
        this.imageObj.setParent(content)
        this.imageObj.getTransform().setLocalPosition(new vec3(0, videoY, 0))
        this.image = this.imageObj.createComponent("Component.Image") as Image
        this.imageMat = IMAGE_MATERIAL.clone()
        this.imageMat.mainPass.depthTest = true
        this.imageMat.mainPass.depthWrite = false
        this.image.clearMaterials()
        this.image.addMaterial(this.imageMat)
        this.imageObj.getTransform().setLocalScale(new vec3(VIDEO_W, VIDEO_H, 1))
        this.image.enabled = false // hidden until the first frame

        // Caption under the video.
        const capObj = global.scene.createSceneObject("Caption")
        capObj.setParent(content)
        capObj.getTransform().setLocalPosition(new vec3(0, captionY, 0.05))
        this.caption = capObj.createComponent("Component.Text") as Text
        this.caption.text = "Waiting for stream…"
        this.caption.size = 32
        this.caption.depthTest = true
        this.caption.horizontalAlignment = HorizontalAlignment.Center
        this.caption.verticalAlignment = VerticalAlignment.Center
        this.caption.horizontalOverflow = HorizontalOverflow.Wrap
        this.caption.verticalOverflow = VerticalOverflow.Overflow
        this.caption.layoutRect = Rect.create(
            -(VIDEO_W + PAD) / 2, (VIDEO_W + PAD) / 2, -CAPTION_H / 2, CAPTION_H / 2)
        this.caption.textFill.color = new vec4(1, 1, 1, 0.6)

        // Button row: QUIT CALL (left) + video-quality cycler (right). The
        // quality button reports the CURRENT preset and each tap asks the
        // manager for the next one (1K → 2K → MAX), applied live to the POV
        // encoder and mirrored to the phones.
        const quitW = 15
        const qualW = 10.5
        const rowW = quitW + qualW + 1
        const quitX = -rowW / 2 + quitW / 2
        const qualX = rowW / 2 - qualW / 2

        const quitLbl = this.makeRowButton(content, "QuitCall", quitX, btnY, quitW,
            "✕  QUIT CALL", () => this._onClose.invoke())
        quitLbl.size = 36

        this.qualityLbl = this.makeRowButton(content, "Quality", qualX, btnY, qualW,
            "VIDEO · 1K", () => this._onQualityToggle.invoke())
        this.qualityLbl.size = 32

        this.createEvent("UpdateEvent").bind(() => this.updateTether())
    }

    /** One button in the bottom row; returns its label Text for live updates. */
    private makeRowButton(parent: SceneObject, name: string, x: number, y: number,
        width: number, label: string, onTrigger: () => void): Text {
        const btnObj = global.scene.createSceneObject(name)
        btnObj.setParent(parent)
        btnObj.getTransform().setLocalPosition(new vec3(x, y, 0))
        const btn = btnObj.createComponent(Button.getTypeName()) as Button
        btn.onInitialized.add(() => { btn.size = new vec3(width, BTN_H, 1) })
        const lblObj = global.scene.createSceneObject(name + "Label")
        lblObj.setParent(btnObj)
        lblObj.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
        const lbl = lblObj.createComponent("Component.Text") as Text
        lbl.text = label
        lbl.size = 38
        lbl.depthTest = true
        lbl.horizontalAlignment = HorizontalAlignment.Center
        lbl.verticalAlignment = VerticalAlignment.Center
        lbl.horizontalOverflow = HorizontalOverflow.Overflow
        lbl.verticalOverflow = VerticalOverflow.Overflow
        lbl.layoutRect = Rect.create(-width / 2 + 0.25, width / 2 - 0.25, -1.2, 1.2)
        btn.onTriggerUp.add(onTrigger)
        return lbl
    }

    /** Reflect the applied quality preset on the button ("VIDEO · 1K"). */
    setQualityLabel(text: string): void {
        if (this.qualityLbl) this.qualityLbl.text = text
    }

    setFrameTexture(texture: Texture): void {
        this.imageMat.mainPass.baseTex = texture
        this.fitImageToTexture(texture)
        if (!this.haveFrame) {
            this.haveFrame = true
            this.image.enabled = true
        }
    }

    /** Aspect-fit the image quad inside the VIDEO_W x VIDEO_H box (letterbox,
     *  never stretch) — resizes only when the incoming aspect changes. */
    private fitImageToTexture(texture: Texture): void {
        const tw = texture.getWidth()
        const th = texture.getHeight()
        if (tw <= 0 || th <= 0) return
        const aspect = tw / th
        if (Math.abs(aspect - this.lastAspect) < 0.01) return
        this.lastAspect = aspect
        const boxAspect = VIDEO_W / VIDEO_H
        let w: number
        let h: number
        if (aspect > boxAspect) {
            w = VIDEO_W
            h = VIDEO_W / aspect
        } else {
            h = VIDEO_H
            w = VIDEO_H * aspect
        }
        this.imageObj.getTransform().setLocalScale(new vec3(w, h, 1))
    }

    setCaption(text: string): void {
        if (this.caption) this.caption.text = text
    }

    // ── Continuous follow + yaw billboard ───────────────────────────────

    private updateTether(): void {
        const dt = getDeltaTime()
        const camT = this.cameraProvider.getTransform()
        const camPos = camT.getWorldPosition()
        const fwd = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
        const flat = Math.sqrt(fwd.x * fwd.x + fwd.z * fwd.z)
        if (flat < 0.05) return
        const fx = fwd.x / flat
        const fz = fwd.z / flat
        // Flattened right vector: forward × up.
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
            // Ease toward the anchor every frame — smooth, always following.
            t.setWorldPosition(vec3.lerp(
                t.getWorldPosition(), desired, 1 - Math.exp(-FOLLOW_LERP_RATE * dt)
            ))
        }

        // Yaw-only billboard toward the wearer.
        const pos = t.getWorldPosition()
        const targetYaw = Math.atan2(camPos.x - pos.x, camPos.z - pos.z)
        const targetRot = quat.fromEulerAngles(0, targetYaw, 0)
        t.setWorldRotation(quat.slerp(
            t.getWorldRotation(), targetRot, 1 - Math.exp(-YAW_SMOOTH_RATE * dt)
        ))
    }
}
