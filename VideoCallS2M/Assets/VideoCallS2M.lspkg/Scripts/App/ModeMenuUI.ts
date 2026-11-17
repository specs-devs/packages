// ModeMenuUI — VIDEO CALL S2M start menu (Glasses, UIKit).
//
// VIDEO CALL S2M is the Glasses ↔ iPhone video-call slice of the Friend Finder
// crowd, all driven from the glasses with an iPhone companion doing the
// phone-side work:
//
//   FIND YOUR FRIEND — default OFF. Turn it on to guide yourself to a friend
//     with a 3D arrow + world marker + minimap. Self-location can come from the
//     iPhone ("Mobile application", the default) or from Glasses' own GPS —
//     the GPS SOURCE switch below the toggle picks which. Precise final-approach
//     ranging uses UWB (NearbyInteraction), so it is iOS-only.
//   CALL FRIEND — stream your Glasses POV to your friend's phone and pull their
//     POV back onto a panel in your lens, plus two-way voice. Peer-to-peer
//     WebRTC (H.264 video + Opus audio); the media never touches a server.
//   WATCH YOUR BACK — stream your OWN phone's rear camera onto a panel in your
//     lens so you can see who is behind you. No friend needed.
//
// CALL FRIEND and WATCH YOUR BACK are mutually exclusive "POV modes"; FIND YOUR
// FRIEND combines with either. A live summary line spells out what START will
// launch. Emits onStartSelected(ModeSelection) then hides.

import { FlexLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import { Switch } from "UIKit.lspkg/Scripts/Components/Switch/Switch"
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"
import { ModeSelection } from "./Types"

const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08

// ── Typography: single source of truth for text size + weight ──────────────
const FONT_SIZE_SCALE = 1.0
type TextRole = "Title" | "Headline2" | "Subheadline" | "Button" | "Callout" | "Body" | "Caption" | "Micro"
const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
    Title:       { size: 54, weight: 700 },
    Headline2:   { size: 44, weight: 700 },
    Subheadline: { size: 33, weight: 600 },
    Button:      { size: 39, weight: 600 },
    Callout:     { size: 38, weight: 700 },
    Body:        { size: 34, weight: 600 },
    Caption:     { size: 28, weight: 500 },
    Micro:       { size: 24, weight: 500 },
}
function applyTextRole(t: Text, role: TextRole): void {
    t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE
    ;(t as Text & { weight?: number }).weight = TYPE_SCALE[role].weight
}

// ── Palette ─────────────────────────────────────────────────────────────
const COLOR_ACCENT = new vec4(0.45, 0.9, 0.85, 1)   // cyan-teal — brand + active state
const COLOR_PRIMARY = new vec4(1, 1, 1, 1)
const COLOR_DIM = new vec4(1, 1, 1, 0.75)
const COLOR_FAINT = new vec4(1, 1, 1, 0.55)
const COLOR_WARN = new vec4(1, 0.75, 0.4, 0.95)
const COLOR_GO = new vec4(0.55, 1, 0.75, 0.98)

const PANEL_W = 34
const PANEL_H = 48
const ROW_W = PANEL_W - 3
const ROW_H = 2.8
const LABEL_W = ROW_W - 7.5
const SWITCH_W = 5.6
const SWITCH_H = 2.6

@component
export class ModeMenuUI extends BaseScriptComponent {
    private _onStartSelected = new Event<ModeSelection>()
    get onStartSelected(): PublicApi<ModeSelection> { return this._onStartSelected.publicApi() }

    // Selection state. Find defaults OFF (nothing renders until the wearer opts
    // in); GPS self-location defaults to the phone ("Mobile application").
    private wyb = false
    private call = false
    private find = false
    private usePhone = true

    private findSwitch!: Switch
    private wybSwitch!: Switch
    private callSwitch!: Switch
    private gpsSwitch!: Switch
    private findLabel!: Text
    private callLabel!: Text
    private wybLabel!: Text
    private gpsCaption!: Text
    private summaryText!: Text

    onAwake(): void {
        this.sceneObject.createComponent("Component.Canvas")

        const frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
        frame.autoShowHide = false
        frame.autoScaleContent = false
        frame.allowScaling = false
        frame.onInitialized.add(() => {
            frame.innerSize = new vec2(PANEL_W, PANEL_H)
            this.buildContent(frame.contentTransform.getSceneObject())
        })
    }

    hide(): void { this.sceneObject.enabled = false }
    show(): void { this.sceneObject.enabled = true }

    // ── Content ─────────────────────────────────────────────────────────

    private buildContent(contentRoot: SceneObject): void {
        const holder = this.obj(contentRoot, "MenuContent", new vec3(0, 0, 0.4))
        const col = this.flexColumn(holder, PANEL_W - 1.5, 0, {
            gap: 0.4, padY: 0.9, padX: 0.8,
            justify: FlexJustify.Center, align: FlexAlign.Center,
        })

        // ── Header: brand + one-line pitch + what the lens is ──────────────
        this.flexChild(col, { w: ROW_W, h: 3.4 }, (cell) => {
            const t = this.cellText(cell, "VIDEO CALL S2M", "Title", ROW_W)
            t.textFill.color = COLOR_ACCENT
        })
        this.flexChild(col, { w: ROW_W, h: 1.7 }, (cell) => {
            const t = this.cellText(cell, "A suite of tools to find your friend", "Subheadline", ROW_W)
            t.textFill.color = COLOR_PRIMARY
        })
        this.wrapRow(col,
            "Find a friend in a crowd, video-call them, or watch your own back — all from your Glasses, with your iPhone doing the phone-side work.",
            2.8, COLOR_DIM)

        // ── FIND YOUR FRIEND — independent toggle, default OFF ─────────────
        const fr = this.switchRow(col, "FIND YOUR FRIEND", this.find, (on) => {
            this.find = on
            this.paintLabel(this.findLabel, on)
            this.refreshSummary()
        })
        this.findSwitch = fr.sw
        this.findLabel = fr.label
        this.captionRow(col, "Enable to use GPS: a 3D arrow, world marker + minimap steer you to your friend. Location rides Bluetooth + UWB ranging — iOS only.", 2.8)

        // GPS source sub-option (applies to Find Your Friend). Default = Mobile.
        const gr = this.switchRow(col, "└  GPS SOURCE", this.usePhone, (on) => {
            this.usePhone = on
            this.updateGpsCaption()
            this.refreshSummary()
        }, { labelRole: "Caption", labelColor: COLOR_DIM })
        this.gpsSwitch = gr.sw
        this.flexChild(col, { w: ROW_W, h: 1.3 }, (cell) => {
            this.gpsCaption = this.cellText(cell, "", "Micro", ROW_W - 1)
            this.gpsCaption.horizontalAlignment = HorizontalAlignment.Left
            this.gpsCaption.textFill.color = COLOR_FAINT
        })
        this.updateGpsCaption()

        // ── POV MODES · PICK ONE ───────────────────────────────────────────
        this.flexChild(col, { w: ROW_W, h: 1.5 }, (cell) => {
            const t = this.cellText(cell, "───  POV MODES · PICK ONE  ───", "Caption", ROW_W)
            t.textFill.color = COLOR_FAINT
        })

        const cr = this.switchRow(col, "CALL FRIEND", this.call, (on) => {
            this.call = on
            this.paintLabel(this.callLabel, on)
            if (on && this.wyb) {
                this.wyb = false
                this.wybSwitch.isOn = false // mutually exclusive (silent set)
                this.paintLabel(this.wybLabel, false)
            }
            this.refreshSummary()
        })
        this.callSwitch = cr.sw
        this.callLabel = cr.label
        this.captionRow(col, "Two-way live POV + voice: your Glasses camera to your friend's phone, theirs back onto a panel here. Peer-to-peer WebRTC (H.264 + Opus) — no Snap Cloud. Needs a pair of Glasses + two UWB-capable iPhones.", 3.6)

        const wr = this.switchRow(col, "WATCH YOUR BACK", this.wyb, (on) => {
            this.wyb = on
            this.paintLabel(this.wybLabel, on)
            if (on && this.call) {
                this.call = false
                this.callSwitch.isOn = false
                this.paintLabel(this.callLabel, false)
            }
            this.refreshSummary()
        })
        this.wybSwitch = wr.sw
        this.wybLabel = wr.label
        this.captionRow(col, "Stream your OWN phone's rear camera onto a panel here so you can see who's behind you. Streamed live over Snap Cloud. No friend needed.", 2.8)

        // ── Live summary: exactly what START will launch ───────────────────
        this.flexChild(col, { w: ROW_W, h: 1.8 }, (cell) => {
            this.summaryText = this.cellText(cell, "", "Caption", ROW_W)
        })

        // ── Under-the-hood transparency line ───────────────────────────────
        this.wrapRow(col,
            "Under the hood — media is either peer-to-peer WebRTC (Call Friend: H.264 + Opus, no server) or streamed via Snap Cloud (Watch Your Back). Location: GPS + UWB over Bluetooth.",
            2.8, COLOR_FAINT, "Micro")

        // ── START ──────────────────────────────────────────────────────────
        this.flexChild(col, { w: ROW_W, h: 4.0 }, (cell) => {
            const b = cell.createComponent(Button.getTypeName()) as Button
            b.onInitialized.add(() => { b.size = new vec3(ROW_W, 4.0, 1) })
            this.cellText(cell, "▶   START", "Callout", ROW_W - 0.5, BUTTON_LABEL_Z)
            b.onTriggerUp.add(() => this.handleStart())
        })

        this.paintLabel(this.findLabel, this.find)
        this.refreshSummary()
    }

    /** Multi-line explanatory paragraph, left-aligned, dim. */
    private wrapRow(col: SceneObject, text: string, h: number, color: vec4, role: TextRole = "Caption"): void {
        this.flexChild(col, { w: ROW_W, h }, (cell) => {
            const t = this.cellText(cell, text, role, ROW_W - 1)
            t.textFill.color = color
            t.horizontalAlignment = HorizontalAlignment.Center
            t.horizontalOverflow = HorizontalOverflow.Wrap
        })
    }

    /** Dim explainer line under a toggle row (wraps, left-aligned). */
    private captionRow(col: SceneObject, text: string, h: number = 2.8): void {
        this.flexChild(col, { w: ROW_W, h }, (cell) => {
            const t = this.cellText(cell, text, "Caption", ROW_W - 1)
            t.textFill.color = COLOR_DIM
            t.horizontalAlignment = HorizontalAlignment.Left
            t.horizontalOverflow = HorizontalOverflow.Wrap
        })
    }

    /** A label + Switch row. Returns both for later state updates. */
    private switchRow(col: SceneObject, label: string, initialOn: boolean,
        onChange: (on: boolean) => void,
        opts?: { labelRole?: TextRole, labelColor?: vec4 }): { sw: Switch, label: Text } {
        let sw!: Switch
        let labelText!: Text
        this.flexChild(col, { w: ROW_W, h: ROW_H }, (row) => {
            const rowFlex = this.flexRow(row, ROW_W, ROW_H, {
                justify: FlexJustify.SpaceBetween, align: FlexAlign.Center,
            })
            this.flexChild(rowFlex, { w: LABEL_W, h: 2.6 }, (cell) => {
                labelText = this.cellText(cell, label, opts?.labelRole ?? "Body", LABEL_W)
                labelText.horizontalAlignment = HorizontalAlignment.Left
                if (opts?.labelColor) labelText.textFill.color = opts.labelColor
            })
            this.flexChild(rowFlex, { w: SWITCH_W, h: SWITCH_H }, (cell) => {
                sw = cell.createComponent(Switch.getTypeName()) as Switch
                // Switch (and Slider) require the explicit _size + initialize()
                // pattern — the public size setter doesn't refresh visuals
                // post-init (specs-build-ui gotcha).
                ;(sw as Switch & { _size?: vec3 })._size = new vec3(SWITCH_W, SWITCH_H, 1)
                sw.initialize()
                sw.isOn = initialOn
                // onFinished passes the "explicit" flag, not the new state — read isOn.
                sw.onFinished.add(() => onChange(sw.isOn))
            })
        })
        return { sw: sw, label: labelText }
    }

    /** Active mode labels glow accent; inactive fall back to primary white. */
    private paintLabel(label: Text | undefined, on: boolean): void {
        if (label) label.textFill.color = on ? COLOR_ACCENT : COLOR_PRIMARY
    }

    private updateGpsCaption(): void {
        if (!this.gpsCaption) return
        this.gpsCaption.text = this.usePhone
            ? "Mobile application — iPhone GPS (UWB-refined). Default."
            : "Glasses — the glasses' own GPS."
    }

    private refreshSummary(): void {
        if (!this.summaryText) return
        const parts: string[] = []
        if (this.find) parts.push("guidance arrow · " + (this.usePhone ? "phone GPS" : "Glasses GPS"))
        if (this.call) parts.push("call friend (WebRTC)")
        if (this.wyb) parts.push("watch your back")
        if (parts.length === 0) {
            this.summaryText.text = "Flip on a mode to begin"
            this.summaryText.textFill.color = COLOR_WARN
        } else {
            this.summaryText.text = "START → " + parts.join("  +  ")
            this.summaryText.textFill.color = COLOR_GO
        }
    }

    private handleStart(): void {
        if (!this.wyb && !this.call && !this.find) {
            return // nothing selected — keep the menu up (summary explains why)
        }
        const selection: ModeSelection = {
            watchYourBack: this.wyb,
            callFriend: this.call,
            findFriend: this.find,
            // Watch Your Back always streams YOUR OWN (bonded) phone.
            source: "phoneA",
            usePhoneLocation: this.usePhone,
        }
        this.hide()
        this._onStartSelected.invoke(selection)
    }

    // ── Layout helpers (specs-build-ui conventions) ─────────────────────

    private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
        const so = global.scene.createSceneObject(name)
        so.setParent(parent)
        if (position) so.getTransform().setLocalPosition(position)
        return so
    }

    private liftInZ(so: SceneObject, z: number): void {
        const t = so.getTransform()
        const p = t.getLocalPosition()
        t.setLocalPosition(new vec3(p.x, p.y, p.z + z))
    }

    private flexColumn(parent: SceneObject, width: number, height: number,
        opts?: { gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign }): SceneObject {
        return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
    }

    private flexRow(parent: SceneObject, width: number, height: number,
        opts?: { gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign }): SceneObject {
        return this.makeFlex(parent, FlexDirection.Row, width, height, opts)
    }

    private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number,
        opts?: { gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign }): SceneObject {
        const container = this.obj(parent, "Flex")
        this.liftInZ(container, LAYOUT_Z_LIFT)
        const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
        // Children are registered explicitly via addItems() during composition
        // — auto-discovery must be off or addItems throws pre-init.
        flexLayout.autoDiscoverItemsOnStart = false
        const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
        if (width > 0) flexItem.overrideWidth = width
        if (height > 0) flexItem.overrideHeight = height
        flexLayout.onInitialized.add(() => {
            flexLayout.width = width
            flexLayout.height = height
            flexLayout.direction = direction
            if (direction === FlexDirection.Row) {
                flexLayout.columnGap = opts?.gap ?? 0
            } else {
                flexLayout.rowGap = opts?.gap ?? 0
            }
            flexLayout.paddingTop = opts?.padY ?? 0
            flexLayout.paddingBottom = opts?.padY ?? 0
            flexLayout.paddingLeft = opts?.padX ?? 0
            flexLayout.paddingRight = opts?.padX ?? 0
            flexLayout.justifyContent = opts?.justify ?? FlexJustify.Start
            flexLayout.alignItems = opts?.align ?? FlexAlign.Stretch
        })
        return container
    }

    private flexChild(parent: SceneObject, size: { w?: number, h?: number, grow?: number },
        builder: (childObject: SceneObject) => void): SceneObject {
        const child = this.obj(parent, "Item")
        this.liftInZ(child, LAYOUT_Z_LIFT)
        const flexItem = child.createComponent(FlexItem.getTypeName()) as FlexItem
        if (size.w !== undefined && size.w > 0) flexItem.overrideWidth = size.w
        if (size.h !== undefined && size.h > 0) flexItem.overrideHeight = size.h
        flexItem.flexGrow = size.grow ?? 0
        flexItem.flexShrink = 0
        builder(child)
        const parentFlexLayout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
        if (parentFlexLayout) parentFlexLayout.addItems([flexItem])
        return child
    }

    private cellText(cell: SceneObject, str: string, role: TextRole, widthCM: number, zLift = 0): Text {
        const so = this.obj(cell, "Text", new vec3(0, 0, zLift))
        const t = so.createComponent("Component.Text") as Text
        t.text = str
        t.depthTest = true
        applyTextRole(t, role)
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Overflow
        t.verticalOverflow = VerticalOverflow.Overflow
        t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.2, 1.2)
        return t
    }
}
