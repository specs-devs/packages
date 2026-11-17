import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {AppScreen} from "../UIController"
import {SideNavigation} from "../Components/SideNavigation"
import {flexContainer, addText, FlexDirection, FlexJustify, FlexAlign} from "../../Shared/UIKit"

const WELCOME_TEXT =
  "Spatial anchor example. Create Areas where you pin information around you. Tap New Area, grab a note and drop it in your space. It reappears in the same place next time you launch the Lens. Start building your spatial notes."

const CONTENT_Z = 2

/**
 * Screen 1: Get Started — SideNavigation (left) + welcome text (right), in a FlexLayout row.
 * Frame inner size 33 x 14.
 */
export class GetStartedScreen {
  private container: SceneObject
  private sideNav: SideNavigation
  private logger: Logger

  constructor(parent: SceneObject, eventBus: EventBus, logger: Logger) {
    this.logger = logger

    this.container = global.scene.createSceneObject("GetStartedScreen")
    this.container.setParent(parent)

    flexContainer(
      this.container,
      {
        name: "GetStartedRoot",
        direction: FlexDirection.Row,
        width: 33,
        height: 14,
        gap: 2,
        padX: 1.5,
        padY: 1.5,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        zLift: CONTENT_Z,
      },
      (row) => {
        this.sideNav = new SideNavigation({parent: row, eventBus, logger, activeScreen: AppScreen.GetStarted})
        addText(row, WELCOME_TEXT, {
          name: "WelcomeText",
          role: "Body",
          width: 20,
          height: 10,
          wrap: true,
          halign: HorizontalAlignment.Left,
          valign: VerticalAlignment.Center,
          asItem: {w: 20, h: 10, grow: 1},
        })
      }
    )
    this.logger.debug("GetStartedScreen built")
  }

  show(): void {
    this.container.enabled = true
    this.sideNav.setActive(AppScreen.GetStarted)
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
