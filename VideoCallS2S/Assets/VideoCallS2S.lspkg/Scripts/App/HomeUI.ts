// HomeUI — the placeholder home screen (UIKit Frame).
//
// Shows this Glasses' 4-digit pairing code, a field to type a friend's code, and
// one CALL FRIEND button. Emits onCall(friendCode) — the manager owns the call.
// A status line at the bottom reports Snap Cloud readiness / call outcomes.

import { FlexLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import { TextInputField } from "UIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"
import { APP_TITLE, PAIRING_CODE_LENGTH } from "./Types"

const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08

// ── Typography: single source of truth for text size + weight ──────────────
const FONT_SIZE_SCALE = 1.0
type TextRole = "Title" | "Display" | "Subheadline" | "Callout" | "Body" | "Caption" | "Micro"
const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
    Title:       { size: 54, weight: 700 },
    Display:     { size: 96, weight: 700 },
    Subheadline: { size: 33, weight: 600 },
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
const COLOR_ACCENT = new vec4(0.45, 0.9, 0.85, 1)
const COLOR_PRIMARY = new vec4(1, 1, 1, 1)
const COLOR_DIM = new vec4(1, 1, 1, 0.75)
const COLOR_FAINT = new vec4(1, 1, 1, 0.55)
const COLOR_WARN = new vec4(1, 0.75, 0.4, 0.95)
const COLOR_GO = new vec4(0.55, 1, 0.75, 0.98)

const PANEL_W = 34
const PANEL_H = 30
const ROW_W = PANEL_W - 3
const FIELD_W = 13
const CALL_W = ROW_W - FIELD_W - 1
const ROW_H = 3.6

export type StatusTone = "info" | "ok" | "warn"

@component
export class HomeUI extends BaseScriptComponent {
    private _onCall = new Event<string>()
    /** Fired with the raw text of the code field when CALL FRIEND is tapped (or Return pressed). */
    get onCall(): PublicApi<string> { return this._onCall.publicApi() }

    private codeText: Text | null = null
    private statusText: Text | null = null
    private callLabel: Text | null = null
    private field: TextInputField | null = null
    private callEnabled = true
    // Values pushed before the Frame finished building are applied in buildContent.
    private pendingCode = "----"
    private pendingStatus: { text: string; tone: StatusTone } = { text: "Starting…", tone: "info" }

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

    /** This Glasses' own pairing code. */
    setCode(code: string): void {
        this.pendingCode = code
        if (this.codeText) this.codeText.text = code.split("").join(" ")
    }

    /** Bottom status line. */
    setStatus(text: string, tone: StatusTone = "info"): void {
        this.pendingStatus = { text, tone }
        if (this.statusText) {
            this.statusText.text = text
            this.statusText.textFill.color =
                tone === "ok" ? COLOR_GO : tone === "warn" ? COLOR_WARN : COLOR_DIM
        }
    }

    /** Grey out CALL FRIEND while calling is impossible (no Snap Cloud). */
    setCallEnabled(enabled: boolean): void {
        this.callEnabled = enabled
        if (this.callLabel) this.callLabel.textFill.color = enabled ? COLOR_PRIMARY : COLOR_FAINT
    }

    /** Clear the typed friend code (after a call ends). */
    clearInput(): void {
        if (this.field) this.field.text = ""
    }

    // ── Content ─────────────────────────────────────────────────────────

    private buildContent(contentRoot: SceneObject): void {
        const holder = this.obj(contentRoot, "HomeContent", new vec3(0, 0, 0.4))
        const col = this.flexColumn(holder, PANEL_W - 1.5, 0, {
            gap: 0.5, padY: 0.9, padX: 0.8,
            justify: FlexJustify.Center, align: FlexAlign.Center,
        })

        // Header
        this.flexChild(col, { w: ROW_W, h: 3.2 }, (cell) => {
            const t = this.cellText(cell, APP_TITLE, "Title", ROW_W)
            t.textFill.color = COLOR_ACCENT
        })
        this.flexChild(col, { w: ROW_W, h: 1.7 }, (cell) => {
            const t = this.cellText(cell, "Glasses-to-Glasses video call", "Subheadline", ROW_W)
            t.textFill.color = COLOR_PRIMARY
        })

        // Your code
        this.flexChild(col, { w: ROW_W, h: 1.6 }, (cell) => {
            const t = this.cellText(cell, "YOUR CODE", "Caption", ROW_W)
            t.textFill.color = COLOR_FAINT
        })
        this.flexChild(col, { w: ROW_W, h: 5.2 }, (cell) => {
            this.codeText = this.cellText(cell, this.pendingCode.split("").join(" "), "Display", ROW_W, 0, 2.6)
            this.codeText.textFill.color = COLOR_ACCENT
        })
        this.captionRow(col,
            "Tell your friend this code. To call them, type THEIR code below and tap CALL FRIEND.",
            2.6)

        // Friend code field + CALL FRIEND
        this.flexChild(col, { w: ROW_W, h: ROW_H }, (row) => {
            const rowFlex = this.flexRow(row, ROW_W, ROW_H, {
                justify: FlexJustify.SpaceBetween, align: FlexAlign.Center,
            })
            this.flexChild(rowFlex, { w: FIELD_W, h: ROW_H }, (cell) => {
                const field = cell.createComponent(TextInputField.getTypeName()) as TextInputField
                field.inputType = "numeric"
                field.onInitialized.add(() => {
                    field.size = new vec3(FIELD_W, ROW_H - 0.4, 1)
                    field.placeholderText = "Friend's code"
                })
                field.onReturnKeyPressed.add(() => this.handleCall())
                this.field = field
            })
            this.flexChild(rowFlex, { w: CALL_W, h: ROW_H }, (cell) => {
                const b = cell.createComponent(Button.getTypeName()) as Button
                b.onInitialized.add(() => { b.size = new vec3(CALL_W, ROW_H, 1) })
                this.callLabel = this.cellText(cell, "📞  CALL FRIEND", "Callout", CALL_W - 0.5, BUTTON_LABEL_Z)
                this.callLabel.textFill.color = this.callEnabled ? COLOR_PRIMARY : COLOR_FAINT
                b.onTriggerUp.add(() => this.handleCall())
            })
        })
        this.captionRow(col,
            "Video + voice go peer-to-peer over WebRTC. Snap Cloud only carries the pairing handshake and call signaling.",
            2.6, "Micro", COLOR_FAINT)

        // Status line
        this.flexChild(col, { w: ROW_W, h: 1.8 }, (cell) => {
            this.statusText = this.cellText(cell, "", "Caption", ROW_W)
            this.setStatus(this.pendingStatus.text, this.pendingStatus.tone)
        })
    }

    private handleCall(): void {
        if (!this.callEnabled) return
        const raw = this.field ? this.field.text : ""
        this._onCall.invoke(raw)
    }

    /** Dim explainer line (wraps, centered). */
    private captionRow(col: SceneObject, text: string, h: number,
        role: TextRole = "Caption", color: vec4 = COLOR_DIM): void {
        this.flexChild(col, { w: ROW_W, h }, (cell) => {
            const t = this.cellText(cell, text, role, ROW_W - 1)
            t.textFill.color = color
            t.horizontalAlignment = HorizontalAlignment.Center
            t.horizontalOverflow = HorizontalOverflow.Wrap
        })
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

    private cellText(cell: SceneObject, str: string, role: TextRole, widthCM: number,
        zLift = 0, halfHeight = 1.2): Text {
        const so = this.obj(cell, "Text", new vec3(0, 0, zLift))
        const t = so.createComponent("Component.Text") as Text
        t.text = str
        t.depthTest = true
        applyTextRole(t, role)
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Overflow
        t.verticalOverflow = VerticalOverflow.Overflow
        t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -halfHeight, halfHeight)
        return t
    }
}
