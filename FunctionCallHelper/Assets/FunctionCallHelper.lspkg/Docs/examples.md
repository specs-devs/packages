# FunctionCallHelper minimal examples

[← Agent usage index](../README.md)

## Use when

Copy the smallest example that gets a working panel. Compose larger
experiences with UIKit and your own scripts rather than treating this
file as an application template.

## Prefab path (no code)

1. Make sure the SIK prefab is in the scene (buttons are pinched through SIK).
2. Drag `FunctionCallHelper__PLACE_IN_SCENE.prefab` into the Scene Hierarchy.
3. Add your script component(s), e.g. under `YOUR-SCRIPTS-HERE`.
4. On the root's `FunctionCallHelper` (ButtonClickEvent) component, edit
   `triggerableFunctions`: for each entry pick the script component and type
   the exact method name.
5. Preview and pinch the buttons.

## A target script

```ts
@component
export class ResetActions extends BaseScriptComponent {
  @input statusText: Text

  // Called by ButtonClickEvent with a single "" argument.
  public resetScene(_arg: string): void {
    this.statusText.text = "Scene reset"
  }

  // Optional: button label. A no-argument getFunctionName() is used only when
  // this component backs a single entry (see below).
  public getFunctionName(): string {
    return "Reset Scene"
  }
}
```

## Configure the panel from code

Set every input synchronously right after `createComponent`, before the
component's first `OnStartEvent`; the buttons are built then. To change the
list later, re-assign `triggerableFunctions` and call `panel.rebuild()`.

```ts
import {ButtonClickEvent, TriggerableFunction} from "FunctionCallHelper.lspkg/FunctionCallHelper"

@component
export class DebugMenu extends BaseScriptComponent {
  @input targets: ScriptComponent
  @input buttonPrefab: ObjectPrefab   // e.g. FunctionCallHelper.lspkg/CapsuleButton.prefab
  @input gridObject: SceneObject      // the GridLayout node inside a ScrollWindow

  onAwake() {
    const functions: TriggerableFunction[] = [
      {script: this.targets, functionName: "resetScene"},
      {script: this.targets, functionName: "toggleStats"},
    ]

    const panel = this.sceneObject.createComponent(ButtonClickEvent.getTypeName()) as ButtonClickEvent
    panel.triggerableFunctions = functions
    panel.buttonPrefab = this.buttonPrefab
    panel.parentObject = this.gridObject
  }
}
```

Both buttons here target the same component. A no-argument
`getFunctionName()` is skipped for them, so each shows its method name split
into words; declare `getFunctionName(functionName: string)` to return a label
per function.
