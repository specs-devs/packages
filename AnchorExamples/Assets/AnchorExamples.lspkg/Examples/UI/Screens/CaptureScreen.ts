import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {flexContainer, addText, makeButton, FlexDirection, FlexJustify, FlexAlign} from "../../Shared/UIKit"

const INSTRUCTION_TEXT =
  "Tap Start Capturing and keep looking around until the capture completes on its own. An area about the size of your desk works well."

const CONTENT_Z = 2

/**
 * Screen 2: Capture (New Area) — instruction text + a row of two buttons, in a FlexLayout column.
 * Frame inner size 33 x 20.
 */
export class CaptureScreen {
  private container: SceneObject
  private eventBus: EventBus
  private logger: Logger

  constructor(parent: SceneObject, eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus
    this.logger = logger

    this.container = global.scene.createSceneObject("CaptureScreen")
    this.container.setParent(parent)

    flexContainer(
      this.container,
      {
        name: "CaptureRoot",
        direction: FlexDirection.Column,
        width: 33,
        height: 20,
        gap: 2.5,
        padX: 2,
        padY: 2,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        zLift: CONTENT_Z,
      },
      (col) => {
        addText(col, INSTRUCTION_TEXT, {
          name: "CaptureInstructions",
          role: "Body",
          width: 28,
          height: 8,
          wrap: true,
          asItem: {w: 28, h: 8},
        })
        flexContainer(
          col,
          {
            name: "CaptureButtons",
            direction: FlexDirection.Row,
            gap: 2,
            justify: FlexJustify.Center,
            align: FlexAlign.Center,
            asItem: {w: 24, h: 4},
          },
          (row) => {
            makeButton(row, {
              label: "Start Capturing",
              width: 11,
              height: 3.4,
              style: "Prism",
              onTrigger: () => {
                this.logger.debug("Start Capture pressed")
                this.eventBus.emit("startCapture")
              },
            })
            makeButton(row, {
              label: "Exit Capture",
              width: 9,
              height: 3.4,
              style: "Primary",
              onTrigger: () => {
                this.logger.debug("Exit Capture pressed")
                this.eventBus.emit("exitCapture")
              },
            })
          }
        )
      }
    )
    this.logger.debug("CaptureScreen built")
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
}
