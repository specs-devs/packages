# AccessComponents minimal examples

[← Agent usage index](../README.md)

## Use when

Copy the smallest snippet that matches the access pattern you need. Generic
component lookup and lifecycle rules are covered by the Lens Studio documentation; these
snippets only show the package's example classes and paths.

## Prefab path (no code)

1. Drag `AccessComponents__PLACE_IN_SCENE.prefab` into the Scene Hierarchy.
2. Disable `[AccessComponentOnChildSceneObjectTS]` and enable the one group you
   want to watch (only one at a time).
3. Nothing to switch on: the prefab already wires `enableLogging` (TS) and
   `debug` (TS and JS) to `true` on every example script.
4. Run Preview and read the Logger. See [components](components.md) for what
   each group prints.

## Engine component on another object (null-checked)

```ts
@component
export class HasMesh extends BaseScriptComponent {
  @input target: SceneObject

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      const mesh = this.target.getComponent("Component.RenderMeshVisual")
      print(mesh ? `${this.target.name} has a RenderMeshVisual` : `${this.target.name} has no RenderMeshVisual`)
    })
  }
}
```

The package's own TS example uses the same check.

## A TS component by type

```ts
import {CustomComponentTS} from "AccessComponents.lspkg/AccessCustomComponentsUsingRequired/CustomComponentTS"

@component
export class ReadCustom extends BaseScriptComponent {
  @input target: SceneObject

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      const custom = this.target.getComponent(CustomComponentTS.getTypeName()) as CustomComponentTS
      if (!custom) {
        print("CustomComponentTS not found")
        return
      }
      print(`hasTexture=${custom.hasTexture()} textureSize=${custom.textureSize}`)
    })
  }
}
```

## A TS component through a typed input (TS → TS)

```ts
import {AccessTSfromTS_TSComponentA} from "AccessComponents.lspkg/AccessTSfromTS/AccessTSfromTS_TSComponentA"

@component
export class UseComponentA extends BaseScriptComponent {
  @input componentA: AccessTSfromTS_TSComponentA

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      print(`average = ${this.componentA.calculateAverage(this.componentA.arrayVal)}`)
      print(`counter = ${this.componentA.incrementCounter(2)}`)
    })
  }
}
```

## A JS component from TS with a declaration

```ts
import {JSComponentA} from "AccessComponents.lspkg/AccessJSfromTSwithDeclaration/AccessJSfromTSwithDeclaration_JSComponentA_Declaration"

@component
export class UseJsComponent extends BaseScriptComponent {
  @input("Component.ScriptComponent") jsComponent: JSComponentA

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      print(`2 + 3 = ${this.jsComponent.add(2, 3)}`)
      this.jsComponent.onValueChanged((v) => print(`value changed to ${v}`))
      this.jsComponent.updateValue(7)
    })
  }
}
```

Wire `jsComponent` to the `AccessJSfromTSwithDeclaration_JSComponentA` script
component. The interface is not checked against the JS file.
