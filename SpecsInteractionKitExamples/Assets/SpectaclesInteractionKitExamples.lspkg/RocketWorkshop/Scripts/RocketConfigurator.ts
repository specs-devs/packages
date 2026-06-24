import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {ExhaustControls} from "./ExhaustControls"

const TAG = "RocketConfigurator"
const log = new NativeLogger(TAG)

/** The three swappable rocket sections. */
export type RocketPart = "Nose Cone" | "Body Tube" | "Fins"
/** The three visual styles each part can take. */
export type RocketStyle = "Sleek" | "Modern" | "Space Age"

export const ROCKET_PARTS: RocketPart[] = ["Nose Cone", "Body Tube", "Fins"]
// Display/selection order, matching the original example: Space Age (the silver-nose blue
// starter) first, then Modern, then Sleek (the yellow / Snap-logo rocket).
export const ROCKET_STYLES: RocketStyle[] = ["Space Age", "Modern", "Sleek"]
const DEFAULT_STYLE: RocketStyle = "Space Age"

// `requireAsset` only accepts static string literals (the path is resolved at compile time),
// so every part prefab is listed explicitly here, keyed by "<Style> <Part>". The prefab files
// are named to match their art (Space Age = silver starter, Sleek = yellow), so this is a
// straightforward identity mapping.
const PART_PREFABS: {[key: string]: ObjectPrefab} = {
  "Space Age Nose Cone": requireAsset("../Prefabs/Parts/Space Age Nose Cone.prefab") as ObjectPrefab,
  "Space Age Body Tube": requireAsset("../Prefabs/Parts/Space Age Body Tube.prefab") as ObjectPrefab,
  "Space Age Fins": requireAsset("../Prefabs/Parts/Space Age Fins.prefab") as ObjectPrefab,
  "Modern Nose Cone": requireAsset("../Prefabs/Parts/Modern Nose Cone.prefab") as ObjectPrefab,
  "Modern Body Tube": requireAsset("../Prefabs/Parts/Modern Body Tube.prefab") as ObjectPrefab,
  "Modern Fins": requireAsset("../Prefabs/Parts/Modern Fins.prefab") as ObjectPrefab,
  "Sleek Nose Cone": requireAsset("../Prefabs/Parts/Sleek Nose Cone.prefab") as ObjectPrefab,
  "Sleek Body Tube": requireAsset("../Prefabs/Parts/Sleek Body Tube.prefab") as ObjectPrefab,
  "Sleek Fins": requireAsset("../Prefabs/Parts/Sleek Fins.prefab") as ObjectPrefab
}

/**
 * RocketConfigurator — assembles the rocket from interchangeable part prefabs.
 *
 * Code-first: the part prefabs are loaded with `requireAsset` (no @input arrays), and the
 * rocket holder is handed in via {@link setup} by the RocketWorkshop entry point. Selection
 * *visuals* are owned by the UIKit ToggleGroup in PartSelectorPanel — this class only owns
 * the 3D assembly.
 */
@component
export class RocketConfigurator extends BaseScriptComponent {
  private rocket: SceneObject | null = null

  private topSection: SceneObject | null = null
  private middleSection: SceneObject | null = null
  private bottomSection: SceneObject | null = null

  private noseConeStyle: RocketStyle = DEFAULT_STYLE
  private bodyTubeStyle: RocketStyle = DEFAULT_STYLE
  private finsStyle: RocketStyle = DEFAULT_STYLE

  exhaustControl: ExhaustControls | null = null

  onAwake(): void {}

  /**
   * Provide the SceneObject that assembled rocket parts are instantiated under, and build
   * the default rocket. Called by the RocketWorkshop entry point after it locates the
   * authored rocket holder in the diorama.
   */
  setup(rocketHolder: SceneObject): void {
    this.rocket = rocketHolder
    this.setUpRocket()
  }

  /** Current style for a given part — used by the UI to set its initial selection. */
  getStyle(item: RocketPart): RocketStyle {
    if (item === "Nose Cone") return this.noseConeStyle
    if (item === "Body Tube") return this.bodyTubeStyle
    return this.finsStyle
  }

  /** Instantiate all three current sections onto the rocket holder. */
  private setUpRocket(): void {
    if (isNull(this.rocket)) {
      log.f("RocketConfigurator.setup() must be called before the rocket can be built.")
      return
    }
    this.topSection = this.swapSection(this.topSection, `${this.noseConeStyle} Nose Cone`)
    this.middleSection = this.swapSection(this.middleSection, `${this.bodyTubeStyle} Body Tube`)
    this.bottomSection = this.swapSection(this.bottomSection, `${this.finsStyle} Fins`)
  }

  /** Destroy the previous section (if any) and instantiate `combinedName` in its place. */
  private swapSection(previous: SceneObject | null, combinedName: string): SceneObject | null {
    const prefab = PART_PREFABS[combinedName]
    if (isNull(prefab)) {
      log.f(`Rocket part prefab not found: ${combinedName}`)
      return previous
    }
    if (previous !== null) previous.destroy()
    return prefab.instantiate(this.rocket)
  }

  /** Swap a single part to a new style (called by the part-selector UI). */
  setRocketPartSection(style: RocketStyle, item: RocketPart): void {
    if (item === "Nose Cone") {
      this.noseConeStyle = style
      this.topSection = this.swapSection(this.topSection, `${style} ${item}`)
    } else if (item === "Body Tube") {
      this.bodyTubeStyle = style
      this.middleSection = this.swapSection(this.middleSection, `${style} ${item}`)
    } else if (item === "Fins") {
      this.finsStyle = style
      this.bottomSection = this.swapSection(this.bottomSection, `${style} ${item}`)
    }
  }

  /** Cache the ExhaustControls living on the current bottom (fins) section. */
  getExhaustControl(): void {
    if (isNull(this.bottomSection)) {
      log.f("Bottom section is null; cannot get exhaust control.")
      return
    }
    this.exhaustControl = this.bottomSection.getComponent(ExhaustControls.getTypeName())
  }
}
