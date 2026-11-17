# Utilities examples

[← Agent usage index](../README.md)

## Use when

Read for small, compile-correct snippets with this package's import paths.
Import the classes from your own scripts; the package's prefab is only the demo
(see [Demo project](#demo-project)).

## Validate inputs in onAwake

```typescript
import {ValidationUtils} from "Utilities.lspkg/Scripts/Utils/ValidationUtils"

@component
export class Spawner extends BaseScriptComponent {
  @input
  prefab: ObjectPrefab

  @input
  parent: SceneObject

  onAwake(): void {
    // Throws "Required input 'parent' is missing or null" when it isn't set.
    ValidationUtils.validateInputs({prefab: this.prefab, parent: this.parent}, ["prefab", "parent"])
    this.prefab.instantiate(this.parent)
  }
}
```

## Find components

```typescript
import {ComponentUtils} from "Utilities.lspkg/Scripts/Utils/ComponentUtils"
import {SceneObjectUtils} from "Utilities.lspkg/Scripts/Utils/SceneObjectUtils"

export function findParts(root: SceneObject, self: SceneObject): void {
  // Engine components: pass the runtime type string.
  const text = SceneObjectUtils.getOrCreateComponent<Text>(root, "Component.Text")
  const camera = ComponentUtils.getRootCamera() // throws if no ROOT object has a Camera
  const script = ComponentUtils.findInParents<ScriptComponent>(self, "Component.ScriptComponent")
  print(`${text.text} ${camera.name} ${script ? script.getSceneObject().name : "none"}`)
}

// Your own TypeScript component: pass String(MyComponent.getTypeName()).
//   SceneObjectUtils.findComponentInHierarchy<MyComponent>(root, String(MyComponent.getTypeName()))
```

## Logger

```typescript
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"

const log = new Logger("MyLens")
log.header("Setup") // ====== / | SETUP / ======
log.info("Ready") // 20:48:56 | MyLens | INFO | Ready
log.setDebugEnabled(false) // silences every level
```

## Parse user input

```typescript
import {TypeConversionUtils} from "Utilities.lspkg/Scripts/Utils/TypeConversionUtils"

const price = TypeConversionUtils.safeParseNumber("3,14", 0) // 3.14
const count = TypeConversionUtils.safeParseInt("7.9") // 7
const flag = TypeConversionUtils.toBoolean("yes") // true
```

## Distance and bearing

```typescript
import {MathUtils, GeoCoordinate} from "Utilities.lspkg/Scripts/Utils/MathUtils"

const london: GeoCoordinate = {latitude: 51.5007, longitude: -0.1246, altitude: 0}
const paris: GeoCoordinate = {latitude: 48.8584, longitude: 2.2945, altitude: 0}
const km = MathUtils.haversineDistance(london, paris) / 1000 // ≈ 341
const degrees = MathUtils.calculateBearing(london, paris) / MathUtils.DegToRad // ≈ 149
```

## Draw a circle and a rounded line strip

```typescript
import {MeshUtils} from "Utilities.lspkg/Scripts/Utils/MeshUtils"

@component
export class Shapes extends BaseScriptComponent {
  @input
  @hint("Unlit material (the meshes have positions only)")
  material: Material

  onAwake(): void {
    const circle = global.scene.createSceneObject("Circle")
    circle.setParent(this.sceneObject)
    MeshUtils.addRenderMeshVisual(circle, MeshUtils.makeCircle2DMesh(vec3.zero(), 5), this.material, 0)

    const line = global.scene.createSceneObject("Line")
    line.setParent(this.sceneObject)
    const points = [new vec3(-9, -4, 0), new vec3(-3, 6, 0), new vec3(3, -4, 0)]
    const tinted = this.material.clone() // addRenderMeshVisual does not clone
    tinted.mainPass.baseColor = new vec4(1, 0.65, 0.3, 1)
    MeshUtils.addRenderMeshVisual(line, MeshUtils.makeLineStrip2DMeshWithJoints(points, 2), tinted, 0)
  }
}
```

Units are centimeters; the shapes lie in the object's XY plane and face +Z.

Tweens and scale animations: see [animation](animation.md).

## Demo project

`Utilities__PLACE_IN_SCENE.prefab` runs every helper group live: drop it into
a Specs scene, close the guide and step through the carousel. Its scripts ship
in `Utilities.lspkg/Example/UtilitiesDemo/`:

| Example (carousel step) | Script | Shows |
|---|---|---|
| Math And Conversion | `MathConversionDemo.ts` | MathUtils, TypeConversionUtils and ValidationUtils results; `easeOutElastic` recomputed every frame |
| Mesh Shapes | `MeshShapesDemo.ts` | `makeCircle2DMesh`, two `makeLineStrip2DMeshWithJoints` strips |
| Animation | `AnimationDemo.ts` | looping `makeTween` + `easeOutElastic`, `animateVisualFeedback`, `pingPong`, easing map |
| Scene And Components | `SceneComponentsDemo.ts` | SceneObjectUtils / ComponentUtils on a runtime rig, Logger output |
