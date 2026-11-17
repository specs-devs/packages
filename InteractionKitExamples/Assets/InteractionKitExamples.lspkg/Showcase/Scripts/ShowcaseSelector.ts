import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {ToggleGroup} from "UIKit.lspkg/Scripts/Components/Toggle/ToggleGroup"
import {ChainControls} from "./ChainControls"
import {JellyfishControls} from "./JellyfishControls"

/**
 * Shows one showcase at a time, picked by the far panel's ToggleGroup.
 *
 * The lists are matched by position: toggle 0 shows showcase 0 and control
 * section 0, and so on. Each control section carries its own description and
 * controls in the hierarchy, so this script only switches sections on and off and
 * resets the movable objects.
 * It starts on whichever toggle is set "Default On" in the Inspector.
 *
 * Hierarchy order matters twice here. This object sits below FarPanel, so the
 * toggles have started (and know which one is on) by the time this starts. The
 * Showcases sit above both panels, so they render first and show through the glass.
 */
@component
export class ShowcaseSelector extends BaseScriptComponent {
  @input
  toggleGroup: ToggleGroup

  // The interactable each toggle presents.
  @input
  showcases: SceneObject[] = []

  // The far panel controls for each showcase.
  @input
  controlSections: SceneObject[] = []

  // The showcases with movable objects. Switching showcase puts those objects back.
  @input
  jellyfishControls: JellyfishControls

  @input
  chainControls: ChainControls

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    const toggles = this.toggleGroup.toggleables
    this.show(Math.max(0, toggles.findIndex((toggle) => toggle.isOn)))

    this.toggleGroup.onToggleSelected.add((args) => {
      this.show(toggles.indexOf(args.toggleable))
      this.jellyfishControls.reset()
      this.chainControls.regroup()
    })
  }

  private show(index: number): void {
    if (index < 0) return
    for (let i = 0; i < this.showcases.length; i++) {
      this.showcases[i].enabled = i === index
      this.controlSections[i].enabled = i === index
    }
  }
}
