import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {flexContainer, addText, makeButton, FlexDirection, FlexJustify, FlexAlign} from "../../Shared/UIKit"

const STATUS_TEXT =
  "Saving the area needs a spatial map.\n\nWalk slowly, pan your head and look at walls and floor for 30-90+ seconds. The percentage can stay at 0 for a while — that is normal. Capture finishes at a mapping checkpoint."

const CONTENT_Z = 2

/**
 * Screen 3: In-Capture — status text + a single Exit Capture button, in a FlexLayout column.
 * Frame inner size 33 x 20.
 */
export class InCaptureScreen {
  private container: SceneObject
  private eventBus: EventBus
  private logger: Logger
  private statusTextComp: Text

  constructor(parent: SceneObject, eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus
    this.logger = logger

    this.container = global.scene.createSceneObject("InCaptureScreen")
    this.container.setParent(parent)

    flexContainer(
      this.container,
      {
        name: "InCaptureRoot",
        direction: FlexDirection.Column,
        width: 33,
        height: 20,
        gap: 2,
        padX: 2,
        padY: 2,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        zLift: CONTENT_Z,
      },
      (col) => {
        this.statusTextComp = addText(col, STATUS_TEXT, {
          name: "CaptureStatusText",
          role: "Body",
          width: 28,
          height: 11,
          wrap: true,
          asItem: {w: 28, h: 11},
        })
        makeButton(col, {
          label: "Exit Capture",
          width: 9,
          height: 3.4,
          style: "Primary",
          onTrigger: () => {
            this.logger.debug("Exit Capture pressed (during active capture)")
            this.eventBus.emit("exitCapture")
          },
        })
      }
    )
    this.logger.debug("InCaptureScreen built")
  }

  show(): void {
    this.container.enabled = true
  }

  hide(): void {
    this.container.enabled = false
  }

  setStatusText(text: string): void {
    if (this.statusTextComp) this.statusTextComp.text = text
  }

  destroy(): void {
    this.container.destroy()
  }

  getContainer(): SceneObject {
    return this.container
  }
}
