/**
 * Simple reset button handler for PrefabPlacement
 * Attach this to a button and assign the PrefabPlacement component
 */

import { PrefabPlacement } from "./PrefabPlacement"

@component
export class ResetButton extends BaseScriptComponent {
  @input
  @hint("PrefabPlacement component to reset")
  prefabPlacement: PrefabPlacement

  onAwake() {
    if (!this.prefabPlacement) {
      print("[ResetButton] ERROR: PrefabPlacement not assigned!")
      return
    }

    print("[ResetButton] Initialized")
  }

  // Call this from a button's OnTriggerEnd event
  public onResetButtonPressed() {
    if (!this.prefabPlacement) {
      print("[ResetButton] ERROR: Cannot reset - PrefabPlacement not assigned!")
      return
    }

    print("[ResetButton] Reset button pressed - restarting placement")
    this.prefabPlacement.resetPlacement()
  }

  // Alternative: call this if you want to manually trigger it
  public resetPlacement() {
    this.onResetButtonPressed()
  }
}
