# GuidedInstructions examples

[← Agent usage index](../README.md)

## Use when

Consume manual step changes or pinch events without requiring an AI request.

## Manual guidance consumer

```typescript
import {GuidancePanel} from "GuidedInstructions.lspkg/Scripts/GuidancePanel"

@component
export class ReadGuidanceStep extends BaseScriptComponent {
  @input panel: GuidancePanel
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.panel.onStepChanged.add((zeroBasedIndex) => print("Step index: " + zeroBasedIndex))
      print(this.panel.currentStep.title)
      this.panel.goToNextStep()
    })
  }
}
```

setAutoStep(id) only changes a panel in AUTO mode. toggleMode() changes modes; onStepChanged reports the zero-based index, while currentStep.id is a one-based knowledge ID.

## TouchDownButton consumer

```typescript
import {TouchDownButton} from "GuidedInstructions.lspkg/Scripts/TouchDownButton"

@component
export class ObserveGuidancePinch extends BaseScriptComponent {
  @input button: TouchDownButton
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.button.onButtonPinchedDown.add(() => print("Pinch started"))
      this.button.onButtonPinchedUp.add(() => print("Pinch ended"))
    })
  }
}
```

TouchDownButton needs Interactable on the same object. For the full flow, drag GuidedInstructions__PLACE_IN_SCENE.prefab, keep all authored references and follow [setup](setup.md). Consumer examples here do not invoke native modules or network services during documentation verification.
