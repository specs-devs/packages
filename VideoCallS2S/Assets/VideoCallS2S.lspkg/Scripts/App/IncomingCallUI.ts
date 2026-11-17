// IncomingCallUI — accept/deny dialog shown when another Glasses rings this one.
// BackPlate + caption + ACCEPT / DENY buttons. Tethers ahead-center of the
// wearer, slightly above eye line so it clears the home screen. The manager
// owns the outcome via onAccept / onDeny.

import { BackPlate } from "UIKit.lspkg/Scripts/BackPlate"
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const PANEL_W = 26
const PANEL_H = 10
const CONTENT_Z = 0.6
const BTN_W = 10.5
const BTN_H = 3.4
const BTN_Y = -2.2
const CAPTION_Y = 2.4

// Ahead-center and lifted — 10 cm nearer than the home screen (z = -110) so the
// dialog always renders in front of it.
const TETHER_DIST_CM = 110
const TETHER_UP_CM = 14
const FOLLOW_LERP_RATE = 6
const YAW_SMOOTH_RATE = 6

const COL_ACCEPT = new vec4(0.55, 1, 0.75, 1)
const COL_DENY = new vec4(1, 0.6, 0.55, 1)

@component
export class IncomingCallUI extends BaseScriptComponent {
    private _onAccept = new Event<void>()
    private _onDeny = new Event<void>()
    get onAccept(): PublicApi<void> { return this._onAccept.publicApi() }
    get onDeny(): PublicApi<void> { return this._onDeny.publicApi() }

    private caption!: Text
    private cameraProvider = WorldCameraFinderProvider.getInstance()
    private placed = false

    onAwake(): void {
        this.sceneObject.createComponent("Component.Canvas")
        const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
        backPlate.size = new vec2(PANEL_W, PANEL_H)

        this.caption = this.makeText("Caption", new vec3(0, CAPTION_Y, CONTENT_Z),
            "Incoming video call…", 34, new vec4(1, 1, 1, 0.95), PANEL_W - 2)

        this.makeButton("Deny", -BTN_W / 2 - 0.9, "✕  DENY", COL_DENY,
            () => this._onDeny.invoke())
        this.makeButton("Accept", BTN_W / 2 + 0.9, "✓  ACCEPT", COL_ACCEPT,
            () => this._onAccept.invoke())

        this.createEvent("UpdateEvent").bind(() => this.updateTether())
    }

    /** Show who is calling — their pairing code. */
    setCaller(code: string): void {
        this.caption.text = "INCOMING CALL · from " + code
    }

    // ── Composition helpers ──────────────────────────────────────────────

    private makeButton(name: string, x: number, label: string, color: vec4,
        onTrigger: () => void): void {
        const obj = global.scene.createSceneObject(name)
        obj.setParent(this.sceneObject)
        obj.getTransform().setLocalPosition(new vec3(x, BTN_Y, CONTENT_Z))
        const btn = obj.createComponent(Button.getTypeName()) as Button
        btn.onInitialized.add(() => { btn.size = new vec3(BTN_W, BTN_H, 1) })
        const lbl = this.makeText(name + "Label", new vec3(x, BTN_Y, CONTENT_Z + 0.08),
            label, 32, color, BTN_W)
        lbl.layoutRect = Rect.create(-BTN_W / 2, BTN_W / 2, -1.2, 1.2)
        btn.onTriggerUp.add(onTrigger)
    }

    private makeText(name: string, pos: vec3, initial: string, size: number,
        color: vec4, widthCm: number): Text {
        const obj = global.scene.createSceneObject(name)
        obj.setParent(this.sceneObject)
        obj.getTransform().setLocalPosition(pos)
        const t = obj.createComponent("Component.Text") as Text
        t.text = initial
        t.size = size
        t.depthTest = true
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Overflow
        t.verticalOverflow = VerticalOverflow.Overflow
        t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.2, 1.2)
        t.textFill.color = color
        return t
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

        const desired = new vec3(
            camPos.x + fx * TETHER_DIST_CM,
            camPos.y + TETHER_UP_CM,
            camPos.z + fz * TETHER_DIST_CM
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
