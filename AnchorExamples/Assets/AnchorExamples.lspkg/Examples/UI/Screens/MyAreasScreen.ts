import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {AppScreen} from "../UIController"
import {SideNavigation} from "../Components/SideNavigation"
import {AreaGridBuilder, AreaInfo} from "../Components/AreaGridBuilder"
import {flexContainer, makeButton, FlexDirection, FlexJustify, FlexAlign} from "../../Shared/UIKit"

const CONTENT_Z = 2

/**
 * Screen 4: My Areas — SideNavigation (left) + a column with the area grid and a Delete-All
 * button (right), in a FlexLayout row. Frame inner size 33 x 25.
 */
export class MyAreasScreen {
  private container: SceneObject
  private sideNav: SideNavigation
  private areaGrid: AreaGridBuilder
  private eventBus: EventBus
  private logger: Logger
  private shownAt: number = 0

  constructor(parent: SceneObject, eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus
    this.logger = logger
    // A release from the previous screen must not activate this destructive button.
    this.eventBus.on<AppScreen>("screenChanged", (screen) => {
      if (screen === AppScreen.MyAreas) this.shownAt = Date.now()
    })

    this.container = global.scene.createSceneObject("MyAreasScreen")
    this.container.setParent(parent)

    flexContainer(
      this.container,
      {
        name: "MyAreasRoot",
        direction: FlexDirection.Row,
        width: 33,
        height: 25,
        gap: 2,
        padX: 1.5,
        padY: 1.5,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        zLift: CONTENT_Z,
      },
      (row) => {
        this.sideNav = new SideNavigation({parent: row, eventBus, logger, activeScreen: AppScreen.MyAreas})

        flexContainer(
          row,
          {
            name: "MyAreasRight",
            direction: FlexDirection.Column,
            width: 20,
            height: 22,
            gap: 1.5,
            justify: FlexJustify.Center,
            align: FlexAlign.Center,
            asItem: {w: 20, h: 22, grow: 1},
          },
          (col) => {
            this.areaGrid = new AreaGridBuilder({
              parent: col,
              eventBus,
              logger,
              columns: 3,
              cellSize: new vec2(6, 4),
            })
            makeButton(col, {
              label: "Delete All Areas",
              width: 13,
              height: 3.2,
              style: "Secondary",
              onTrigger: () => {
                if (Date.now() - this.shownAt < 400) return
                this.logger.debug("Delete All Areas pressed")
                this.eventBus.emit("deleteAllAreas")
              },
            })
          }
        )
      }
    )
    this.logger.debug("MyAreasScreen built")
  }

  show(): void {
    this.container.enabled = true
    this.sideNav.setActive(AppScreen.MyAreas)
  }

  hide(): void {
    this.container.enabled = false
  }

  updateAreas(areas: AreaInfo[]): void {
    this.areaGrid.updateAreas(areas)
  }

  setSelectedArea(index: number): void {
    this.areaGrid.setSelected(index)
  }

  destroy(): void {
    this.container.destroy()
  }

  getContainer(): SceneObject {
    return this.container
  }
}
