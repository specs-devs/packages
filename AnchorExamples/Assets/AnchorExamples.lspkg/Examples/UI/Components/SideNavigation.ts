import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {AppScreen} from "../UIController"
import {flexContainer, makeButton, FlexDirection, FlexJustify, FlexAlign, MadeButton} from "../../Shared/UIKit"

export interface SideNavConfig {
  parent: SceneObject
  eventBus: EventBus
  logger: Logger
  activeScreen?: AppScreen
}

/**
 * Reusable left-side vertical navigation with three buttons:
 * Get Started | New Area | My Areas
 *
 * Built as a FlexLayout column (UIKit 2.0) that is itself a FlexItem, so a screen can
 * drop it straight into a FlexLayout row. The active screen's button is styled "Prism" at build
 * time; the others "Primary". The active item is fixed per screen instance, so there is no
 * runtime restyle.
 */
const CELL_W = 8
const CELL_H = 3.2
const GAP = 0.9
const COLUMN_H = CELL_H * 3 + GAP * 2

export class SideNavigation {
  private container: SceneObject
  private eventBus: EventBus
  private logger: Logger
  private activeScreen: AppScreen | null = null
  private buttons: Map<AppScreen, MadeButton> = new Map()

  constructor(config: SideNavConfig) {
    this.eventBus = config.eventBus
    this.logger = config.logger
    this.activeScreen = config.activeScreen ?? null

    const navItems: {screen: AppScreen; label: string}[] = [
      {screen: AppScreen.GetStarted, label: "Get Started"},
      {screen: AppScreen.Capture, label: "New Area"},
      {screen: AppScreen.MyAreas, label: "My Areas"},
    ]

    this.container = flexContainer(
      config.parent,
      {
        name: "SideNavigation",
        direction: FlexDirection.Column,
        width: CELL_W,
        height: -1,
        gap: GAP,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
        asItem: {w: CELL_W, h: COLUMN_H},
      },
      (col) => {
        for (const item of navItems) {
          const isActive = item.screen === this.activeScreen
          const made = makeButton(col, {
            name: `NavBtn_${item.label.replace(/\s/g, "")}`,
            label: item.label,
            width: CELL_W,
            height: CELL_H,
            style: isActive ? "Prism" : "Primary",
            role: "Button",
            onTrigger: () => {
              this.logger.debug(`Nav button pressed: ${item.label}`)
              this.eventBus.emit("navigate", item.screen)
            },
          })
          this.buttons.set(item.screen, made)
        }
      }
    )
    this.logger.debug(`SideNavigation built with ${this.buttons.size} buttons`)
  }

  setActive(screen: AppScreen): void {
    // The active item is fixed per screen instance (styled at build time); store for API parity.
    this.activeScreen = screen
  }

  getContainer(): SceneObject {
    return this.container
  }

  destroy(): void {
    this.container.destroy()
  }
}
