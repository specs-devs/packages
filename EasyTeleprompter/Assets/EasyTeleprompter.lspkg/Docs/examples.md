# EasyTeleprompter examples

[← Agent usage index](../README.md)

## Use when

Place the local example or connect project-owned controls to installed public APIs with correct imports.

## Prefab setup

Drag `EasyTeleprompter.lspkg/EasyTeleprompter__PLACE_IN_SCENE.prefab` into a Specs scene with its required SIK/UIKit setup. `[StaticPresentationExample]` is enabled in the prefab; `[GooglePresentationExample]` and its GoogleSlideBridge/WebSocketController components are serialized disabled. The source also supplies `Prefabs/Slide.prefab` and `Prefabs/HandRef.prefab`.

PresentationSwitcher chooses each direct child of parentObject as a slide, in child order. If parentObject is unassigned it uses its own SceneObject. Keep only slides beneath that parent. Adding children after onAwake does not recollect the deck.

## Route a project control to local navigation

Wire switcher to the PresentationSwitcher **component**, then invoke advance/goBack from your project's UI callbacks. These calls wrap in both directions. This does not create or install another navigation UI.

```typescript
import {PresentationSwitcher} from "EasyTeleprompter.lspkg/Scripts/PresentationSwitcher"

@component
export class LocalSlideControls extends BaseScriptComponent {
  @input switcher: PresentationSwitcher

  public advance(): void {
    this.switcher.next()
  }

  public goBack(): void {
    this.switcher.previous()
  }
}
```

## Consume WebSocket receipts explicitly

No shipped controller consumes received commands. For a receiver-only project role, wire relay to an enabled configured WebSocketController and switcher to the local component. This complete project-owned adapter handles each newly stored next/previous receipt at most once according to its epoch timestamp.

```typescript
import {PresentationSwitcher} from "EasyTeleprompter.lspkg/Scripts/PresentationSwitcher"
import {WebSocketController} from "EasyTeleprompter.lspkg/Scripts/WebSocketController"

@component
export class ReceiveSlideCommands extends BaseScriptComponent {
  @input relay: WebSocketController
  @input switcher: PresentationSwitcher
  private lastTimestamp = 0

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      const receipt = this.relay.getLastCommand()
      if (receipt.timestamp <= this.lastTimestamp) return
      this.lastTimestamp = receipt.timestamp
      if (receipt.command === "next") this.switcher.next()
      if (receipt.command === "previous") this.switcher.previous()
    })
  }
}
```

Receipts use `Date.now()/1000` epoch seconds, not Lens elapsed getTime. The relay returns sender confirmations with type command too; a sender that already changes its own slides must not also apply the echo as a second navigation. Rapid commands with identical timestamps or commands overwritten between updates are not queued by the current controller. The adapter exposes this limitation rather than adding a hidden protocol guarantee.

## Voice selection

Import the voice class as `SpeechToText` from `EasyTeleprompter.lspkg/Scripts/VoiceController`. Configure its text and chosen navigation-component inputs, leave useGoogleSlide false for the local deck, and call toggleListening through your own UI. Only final exact normalized command phrases qualify, then the displayed text must stay identical through commandDelay. SimpleAsrTest is a separate always-listening diagnostic and should not also own the same ASR session by accident.

## Remote example

Read [setup](setup.md) before enabling the Google prefab branch or network components. A compile-correct method call is not a successful authenticated API request or proof of browser synchronization. The docs add no credentials and execute no server setup.
