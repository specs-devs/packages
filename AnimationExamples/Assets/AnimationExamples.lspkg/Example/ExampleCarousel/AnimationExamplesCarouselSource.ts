import {ExampleCarousel} from "./ExampleCarousel"

// Names of the containers AnimationExamplesManager spawns under its own SceneObject.
const ANIMATIONS_CONTAINER = "Animations"
const MANAGER_UI_CONTAINER = "UI"

/**
 * Demo-only bridge between AnimationExamplesManager and the ExampleCarousel on this SceneObject.
 *
 * The manager spawns its example prefabs at runtime (in its onAwake), so they can't be listed in
 * the carousel's `examples` in the editor. This script runs when the carousel object is enabled
 * (after the guide is dismissed, long after the manager's onAwake), hides the manager's own arrow
 * cycler so the carousel is the only navigator, and hands the spawned examples to the carousel.
 *
 * Each example is wrapped in a holder object: several examples animate their own absolute local
 * position (TransformPosition tracks), so the carousel has to place a parent, not the example.
 */
@component
export class AnimationExamplesCarouselSource extends BaseScriptComponent {
  @input
  @hint("The AnimationExamples__PLACE_IN_SCENE instance (holds AnimationExamplesManager)")
  manager: SceneObject

  @input
  @hint("Order of the steps: names of the spawned examples (prefab root names). Unlisted examples follow in spawn order.")
  exampleNames: string[] = []

  @input
  @hint("What each example shows, in the same order as `exampleNames`")
  exampleInfo: string[] = []

  @input
  @hint("Holder position of every example, in the manager's Animations container (cm)")
  holderOffset: vec3 = new vec3(0, 0, 0)

  onAwake(): void {
    const carousel = this.sceneObject.getComponent(ExampleCarousel.getTypeName()) as ExampleCarousel
    const animations = this.findChild(this.manager, ANIMATIONS_CONTAINER)
    if (!carousel || !animations) {
      print("AnimationExamplesCarouselSource: carousel or the manager's Animations container not found")
      return
    }
    const managerUI = this.findChild(this.manager, MANAGER_UI_CONTAINER)
    if (managerUI) {
      managerUI.enabled = false
    }

    const spawned: SceneObject[] = []
    for (let i = 0; i < animations.getChildrenCount(); i++) {
      spawned.push(animations.getChild(i))
    }
    const rank = (example: SceneObject) => {
      const index = this.exampleNames.indexOf(example.name)
      return index >= 0 ? index : this.exampleNames.length + spawned.indexOf(example)
    }
    const examples = spawned.slice().sort((a, b) => rank(a) - rank(b))
    carousel.exampleInfo = examples.map((example) => {
      const index = this.exampleNames.indexOf(example.name)
      return index >= 0 ? this.exampleInfo[index] || "" : ""
    })
    carousel.examples = examples.map((example) => {
      const holder = global.scene.createSceneObject(example.name.replace(/Example$/, ""))
      holder.setParent(animations)
      holder.getTransform().setLocalPosition(this.holderOffset)
      example.setParent(holder)
      example.getTransform().setLocalPosition(vec3.zero())
      // The manager leaves only its current example enabled; the carousel toggles the holders.
      example.enabled = true
      return holder
    })
  }

  private findChild(parent: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      if (parent.getChild(i).name === name) {
        return parent.getChild(i)
      }
    }
    return null
  }
}
