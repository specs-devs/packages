import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {ElementContent, flexContainer, addText, makeButton, FlexDirection, FlexJustify, FlexAlign} from "../../Shared/UIKit"

const INSTRUCTION_TEXT =
  "Tap a top-row button to create widgets. Position them freely or let them snap to the closest surface. Use Minimize to gather them all in front of you."

const CONTENT_Z = 2

const WIDGET_TYPE_MAP: Record<string, string> = {
  "Note Widgets": "note",
  "Watch Widgets": "watch",
  "Photo Widgets": "photo",
}

/**
 * Screen 5: In-Area (widget panel) — a FlexLayout column of: localization status line, instruction
 * text, a row of three widget-spawn buttons, and a row of three action buttons.
 * Frame inner size 30 x 22.
 */
export class InAreaScreen {
  private container: SceneObject
  private eventBus: EventBus
  private logger: Logger
  private localizationStatusComp: Text | null = null
  private recallLabel: ElementContent | null = null
  private snapLabel: ElementContent | null = null

  constructor(parent: SceneObject, eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus
    this.logger = logger

    this.container = global.scene.createSceneObject("InAreaScreen")
    this.container.setParent(parent)

    flexContainer(
      this.container,
      {
        name: "InAreaRoot",
        direction: FlexDirection.Column,
        width: 30,
        height: 22,
        gap: 1.2,
        padX: 1.2,
        padY: 1.2,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        zLift: CONTENT_Z,
      },
      (col) => {
        this.localizationStatusComp = addText(col, "Searching for area...", {
          name: "LocalizationStatus",
          role: "Caption",
          width: 27,
          height: 2.4,
          wrap: true,
          color: new vec4(1, 0.85, 0.4, 1),
          asItem: {w: 27, h: 2.4},
        })

        addText(col, INSTRUCTION_TEXT, {
          name: "InAreaInstructions",
          role: "Caption",
          width: 27,
          height: 4.5,
          wrap: true,
          asItem: {w: 27, h: 4.5},
        })

        this.buildButtonRow(col, "TopRow", [
          {label: "Note Widgets", style: "Prism"},
          {label: "Watch Widgets", style: "Prism"},
          {label: "Photo Widgets", style: "Prism"},
        ])

        this.buildButtonRow(col, "BottomRow", [
          {label: "Minimize", style: "Primary"},
          {label: "Snap Off", style: "Primary"},
          {label: "Exit Area", style: "Secondary"},
        ])
      }
    )
    this.logger.debug("InAreaScreen built")
  }

  show(): void {
    this.container.enabled = true
  }

  hide(): void {
    this.container.enabled = false
  }

  destroy(): void {
    this.container.destroy()
  }

  getContainer(): SceneObject {
    return this.container
  }

  setRecallActive(active: boolean): void {
    if (this.recallLabel) this.recallLabel.text = active ? "Release" : "Minimize"
  }

  setSnapActive(active: boolean): void {
    if (this.snapLabel) this.snapLabel.text = active ? "Snap On" : "Snap Off"
  }

  setLocalizationStatus(text: string): void {
    if (this.localizationStatusComp) this.localizationStatusComp.text = text
  }

  // ── Internal ───────────────────────────────────────────

  private buildButtonRow(
    parent: SceneObject,
    name: string,
    items: {label: string; style: "Prism" | "Primary" | "Secondary"}[]
  ): void {
    flexContainer(
      parent,
      {
        name,
        direction: FlexDirection.Row,
        gap: 0.8,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        asItem: {w: items.length * 8.5 + (items.length - 1) * 0.8, h: 4},
      },
      (row) => {
        for (const cfg of items) {
          const made = makeButton(row, {
            label: cfg.label,
            width: 8.5,
            height: 3.8,
            style: cfg.style,
            role: "Button",
            onTrigger: () => this.onButton(cfg.label),
          })
          if (cfg.label === "Minimize") this.recallLabel = made.labelText
          if (cfg.label === "Snap Off") this.snapLabel = made.labelText
        }
      }
    )
  }

  private onButton(label: string): void {
    this.logger.debug(`InArea button pressed: ${label}`)
    const widgetType = WIDGET_TYPE_MAP[label]
    if (widgetType) {
      this.eventBus.emit("spawnWidget", {type: widgetType})
      return
    }
    if (label === "Minimize") {
      this.eventBus.emit("recallWidgets")
    } else if (label === "Snap Off") {
      this.eventBus.emit("toggleSnapToSurface")
    } else if (label === "Exit Area") {
      this.eventBus.emit("exitArea")
    }
  }
}
