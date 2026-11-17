// ModeMenuUI — REMOTE ASSISTANCE start menu (Glasses, UIKit).
//
// One mode: the remote-assistance call. A helper joins from a WEB BROWSER
// (the package's web/ portal) — they see the wearer's POV live, talk both
// ways, and DRAW on the video; the strokes appear as 3D lines anchored in
// the wearer's world.
//
// Pairing is the SESSION CODE shown on this menu: the wearer presses START,
// the helper enters the code in the portal. Emits onStartCall then hides.

import { FlexLayout } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import { Button } from "UIKit.lspkg/Scripts/Components/Button/Button"
import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"

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

const PANEL_W = 34
const PANEL_H = 30
const ROW_W = PANEL_W - 3

@component
export class ModeMenuUI extends BaseScriptComponent {
    private _onStartCall = new Event<void>()
    get onStartCall(): PublicApi<void> { return this._onStartCall.publicApi() }

    private sessionCode = ""
    private codeText: Text | null = null

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

    /** The pairing code the helper types into the web portal. Set by the
     *  manager before the frame initializes; applied when the row is built. */
    setSessionCode(code: string): void {
        this.sessionCode = code
        if (this.codeText) this.codeText.text = code
    }

    // ── Content ─────────────────────────────────────────────────────────

    private buildContent(contentRoot: SceneObject): void {
        const holder = this.obj(contentRoot, "MenuContent", new vec3(0, 0, 0.4))
        const col = this.flexColumn(holder, PANEL_W - 1.5, 0, {
            gap: 0.4, padY: 0.9, padX: 0.8,
            justify: FlexJustify.Center, align: FlexAlign.Center,
        })

        // ── Header: brand + one-line pitch + what the lens is ──────────────
        this.flexChild(col, { w: ROW_W, h: 3.4 }, (cell) => {
            const t = this.cellText(cell, "REMOTE ASSISTANCE", "Title", ROW_W)
            t.textFill.color = COLOR_ACCENT
        })
        this.flexChild(col, { w: ROW_W, h: 1.7 }, (cell) => {
            const t = this.cellText(cell, "Live help, drawn into your world", "Subheadline", ROW_W)
            t.textFill.color = COLOR_PRIMARY
        })
        this.wrapRow(col,
            "A helper joins from a web browser: they see your POV live, talk with you both ways, and draw guidance that appears as 3D lines right in front of you.",
            2.8, COLOR_DIM)

        // ── Session code: the pairing secret the helper types in ──────────
        this.flexChild(col, { w: ROW_W, h: 1.5 }, (cell) => {
            const t = this.cellText(cell, "───  YOUR SESSION CODE  ───", "Caption", ROW_W)
            t.textFill.color = COLOR_FAINT
        })
        this.flexChild(col, { w: ROW_W, h: 3.0 }, (cell) => {
            this.codeText = this.cellText(cell, this.sessionCode || "…", "Headline2", ROW_W)
            this.codeText.textFill.color = COLOR_ACCENT
        })
        this.wrapRow(col,
            "Helper: serve the package's web/ folder (./serve.sh), open http://localhost:8000, paste your Snap Cloud URL + anon key and this code.",
            2.8, COLOR_DIM)

        // ── Under-the-hood transparency line ───────────────────────────────
        this.wrapRow(col,
            "Under the hood — media is peer-to-peer WebRTC (H.264 + Opus, no server in the media path). Call signaling and drawing strokes ride Snap Cloud.",
            2.8, COLOR_FAINT, "Micro")

        // ── START ──────────────────────────────────────────────────────────
        this.flexChild(col, { w: ROW_W, h: 4.0 }, (cell) => {
            const b = cell.createComponent(Button.getTypeName()) as Button
            b.onInitialized.add(() => { b.size = new vec3(ROW_W, 4.0, 1) })
            this.cellText(cell, "▶   START CALL", "Callout", ROW_W - 0.5, BUTTON_LABEL_Z)
            b.onTriggerUp.add(() => {
                this.hide()
                this._onStartCall.invoke()
            })
        })
    }

    /** Multi-line explanatory paragraph, centered, dim. */
    private wrapRow(col: SceneObject, text: string, h: number, color: vec4, role: TextRole = "Caption"): void {
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
