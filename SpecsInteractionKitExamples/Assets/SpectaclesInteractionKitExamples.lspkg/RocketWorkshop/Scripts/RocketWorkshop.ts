import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {RocketConfigurator} from "./RocketConfigurator"
import {LaunchControlPanel} from "./LaunchControlPanel"
import {PartSelectorPanel} from "./PartSelectorPanel"
import {RocketUI} from "./RocketUI"

const TAG = "RocketWorkshop"
const log = new NativeLogger(TAG)

// Names of the authored 3D objects this example reaches into. They live in the diorama
// (the art that ships with the example); everything else is built in code. The
// AnimationPlayer is found by component type rather than name, so it doesn't matter which
// diorama object hosts it.
const ROCKET_HOLDER_OBJECT = "Rocket" // parts are instantiated under this object
const PLATFORM_OBJECT = "Platform"
const LAUNCH_SPARKS_OBJECT = "Rocket_sparks"

// Where the two code-built UI panels sit, relative to the diorama root. The rocket diorama
// lives ~100cm down the -Z axis; the panels are pulled a bit closer to the viewer so their
// text reads clearly. The part selector flanks the rocket on the left, and the launch
// controls sit to the right — out past the planet/satellite/meteor so they aren't covered.
// Both face back toward the viewer (+Z).
const PART_SELECTOR_LOCAL_POS = new vec3(-42, 2, -62)
const PART_SELECTOR_LOCAL_ROT = new vec3(0, 14, 0)
const LAUNCH_CONTROLS_LOCAL_POS = new vec3(60, -3, -62)
const LAUNCH_CONTROLS_LOCAL_ROT = new vec3(0, -16, 0)

/**
 * RocketWorkshop — the single entry point for the Rocket Workshop example.
 *
 * Attach this to the diorama root (the SceneObject holding the authored rocket art,
 * AnimationPlayer, platform, and VFX). On start it:
 *   1. locates the few authored objects it needs (by name — the only coupling to the art),
 *   2. creates the RocketConfigurator (rocket assembly + multiplayer state), and
 *   3. builds both UI panels 100% in code — no @input wiring, no UI prefabs.
 *
 * This is the reference pattern for "build a Spectacles UI + interaction in TypeScript":
 * read this file, then RocketUI.ts for the building blocks, then the two *Panel.ts files
 * for how a real interactive panel is assembled.
 */
@component
export class RocketWorkshop extends BaseScriptComponent {
  private launchPanel?: LaunchControlPanel
  private partSelector?: PartSelectorPanel

  onAwake(): void {
    // UIKit components must be created after SIK/UIKit have run their own onAwake, so build
    // on OnStartEvent rather than directly in onAwake.
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    const root = this.getSceneObject()

    const rocketHolder = RocketUI.findChild(root, ROCKET_HOLDER_OBJECT)
    const platform = RocketUI.findChild(root, PLATFORM_OBJECT)
    const launchSparks = RocketUI.findChild(root, LAUNCH_SPARKS_OBJECT)
    const anim = RocketUI.findComponentInChildren<AnimationPlayer>(root, "Component.AnimationPlayer")

    if (isNull(rocketHolder) || isNull(platform) || isNull(launchSparks) || isNull(anim)) {
      log.f("Rocket Workshop diorama is missing expected objects — check the authored art.")
      return
    }

    // 1. Rocket assembly + networked state.
    const config = root.createComponent(RocketConfigurator.getTypeName()) as RocketConfigurator
    config.setup(rocketHolder)

    // 2. Launch controls panel (right of the rocket).
    const launchRoot = RocketUI.obj(root, "LaunchControlsPanelRoot", LAUNCH_CONTROLS_LOCAL_POS)
    launchRoot.getTransform().setLocalRotation(quat.fromEulerVec(LAUNCH_CONTROLS_LOCAL_ROT.uniformScale(MathUtils.DegToRad)))
    this.launchPanel = new LaunchControlPanel(this, launchRoot, config, anim, platform, launchSparks)

    // 3. Part selector panel (left of the rocket).
    const selectorRoot = RocketUI.obj(root, "PartSelectorPanelRoot", PART_SELECTOR_LOCAL_POS)
    selectorRoot.getTransform().setLocalRotation(quat.fromEulerVec(PART_SELECTOR_LOCAL_ROT.uniformScale(MathUtils.DegToRad)))
    this.partSelector = new PartSelectorPanel(selectorRoot, config)
  }
}
