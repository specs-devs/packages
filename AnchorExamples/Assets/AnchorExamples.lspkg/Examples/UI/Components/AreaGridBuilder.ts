import {Logger} from "../../../Scripts/Logger"
import {EventBus} from "../../Shared/EventBus"
import {ElementContent, gridContainer, addGridCell, makeButton, MadeButton, FlexAlignSelf} from "../../Shared/UIKit"

export interface AreaGridConfig {
  parent: SceneObject
  eventBus: EventBus
  logger: Logger
  columns?: number
  maxSlots?: number
  cellSize?: vec2
}

export interface AreaInfo {
  index: number
  name: string
  occupied: boolean
}

const DEFAULT_COLUMNS = 3
const DEFAULT_MAX_SLOTS = 9
const DEFAULT_CELL_SIZE = new vec2(6.2, 4)
const GAP = 0.8

/**
 * Grid of area buttons for the My Areas screen (SpectaclesUIKit 2.0 GridLayout, itself a FlexItem).
 * Occupied slots show the area name; the next slot is always "New Area"; the rest are hidden.
 * A single neutral style is used for every cell — the label ("Area N" vs "New Area") carries the
 * meaning, which avoids the UIKit runtime-restyle gap. Emits "areaSelected" with AreaInfo on tap.
 */
export class AreaGridBuilder {
  private container: SceneObject
  private eventBus: EventBus
  private logger: Logger
  private columns: number
  private maxSlots: number
  private cellSize: vec2

  private cellObjs: SceneObject[] = []
  private labels: ElementContent[] = []
  private areaData: AreaInfo[] = []
  private selectedIndex: number = -1

  constructor(config: AreaGridConfig) {
    this.eventBus = config.eventBus
    this.logger = config.logger
    this.columns = config.columns ?? DEFAULT_COLUMNS
    this.maxSlots = config.maxSlots ?? DEFAULT_MAX_SLOTS
    this.cellSize = config.cellSize ?? DEFAULT_CELL_SIZE

    const rows = Math.ceil(this.maxSlots / this.columns)
    const gridW = this.columns * this.cellSize.x + (this.columns - 1) * GAP
    const gridH = rows * this.cellSize.y + (rows - 1) * GAP

    this.container = gridContainer(
      config.parent,
      {
        name: "AreaGrid",
        columns: this.columns,
        cellW: this.cellSize.x,
        cellH: this.cellSize.y,
        gap: GAP,
        asItem: {w: gridW, h: gridH, alignSelf: FlexAlignSelf.Center},
      },
      (grid) => {
        for (let i = 0; i < this.maxSlots; i++) {
          const cell = addGridCell(grid, `Area_${i}`, this.cellSize.x, this.cellSize.y)
          const made = this.buildCell(cell, i)
          this.cellObjs.push(made.obj)
          this.labels.push(made.labelText)
          made.obj.enabled = false // updateAreas reveals the right ones
        }
      }
    )
    this.logger.debug(`AreaGrid built: ${this.columns} cols, ${this.maxSlots} slots`)
  }

  /** Reflect the current areas: occupied slots show a name, one "New Area" slot, the rest hidden. */
  updateAreas(areas: AreaInfo[]): void {
    this.areaData = areas
    const occupiedCount = areas.filter((a) => a.occupied).length

    for (let i = 0; i < this.maxSlots; i++) {
      const obj = this.cellObjs[i]
      const label = this.labels[i]
      if (!obj || !label) continue

      if (i < occupiedCount) {
        obj.enabled = true
        label.text = areas[i].name
      } else if (i === occupiedCount) {
        obj.enabled = true
        label.text = "New Area"
      } else {
        obj.enabled = false
      }
    }
    this.logger.debug(`AreaGrid updated: ${occupiedCount} areas + New Area`)
  }

  setSelected(index: number): void {
    // Retained for API parity; selection is conveyed by navigation, not a per-cell restyle.
    this.selectedIndex = index
  }

  getContainer(): SceneObject {
    return this.container
  }

  destroy(): void {
    this.container.destroy()
  }

  private buildCell(cell: SceneObject, index: number): MadeButton {
    return makeButton(cell, {
      name: `AreaBtn_${index}`,
      label: `Area ${index + 1}`,
      width: this.cellSize.x,
      height: this.cellSize.y,
      style: "Primary",
      role: "Button",
      onTrigger: () => {
        const occupiedCount = this.areaData.filter((a) => a.occupied).length
        if (index < occupiedCount) {
          this.logger.debug(`Area button pressed: ${this.areaData[index].name}`)
          this.eventBus.emit("areaSelected", this.areaData[index])
        } else {
          this.logger.debug("New Area button pressed")
          this.eventBus.emit("areaSelected", {index, name: "New Area", occupied: false} as AreaInfo)
        }
      },
    })
  }
}
