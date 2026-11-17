# InteractionKitExamples minimal examples

[← Agent usage index](../README.md)

## Use when

Use these to place the shipped examples, or to drive one from your own script.
They show this package's members and import paths only. For new UI
controls follow UIKit's own `Docs/examples.md`, not the deprecated surfaces some
examples use ([api-status](api-status.md)).

## Prefab (no code)

1. Make sure the scene has the InteractionKit prefab and a camera with World device tracking
   (see InteractionKit's installed README).
2. Drag `InteractionKitExamples.lspkg/InteractionKitExamples__PLACE_IN_SCENE.prefab` into
   the Scene Hierarchy.
3. Press Play. The `Guide` panel shows first; it hides the `ExampleCarousel`
   and the three `[EXAMPLES]` groups until you press "Ok, I understood". The
   carousel starts on the Interaction Showcase and steps through the 15
   examples one at a time with Previous /
   Next (it enables the current step and its parent group and hides the rest),
   so don't toggle the groups by hand while the carousel is in the scene.
4. To work without the carousel, delete (or disable) `Guide` and
   `ExampleCarousel`. The groups' serialized states then apply: `[EXAMPLES] UI`
   is enabled and shows its first example (Menu Horizontal) with a ◀ ▶ menu
   (`UIController`); `[EXAMPLES] Showcase` is enabled too and
   `[EXAMPLES] Interaction` is disabled. Keep only one group enabled.
5. To use a single example outside the menu, enable just that child (for example
   `ExampleGridWide`), then disable the group's `UIController` (otherwise
   it re-enables its first entry on start) and the group's `Menu` object.

## Feed a simple grid from your own script

`ExampleGridSimple` builds in its OnStart. Items added in `onAwake` (or before the
grid starts) replace the test data, because test items are only generated when
`items` is empty.

```ts
import {ExampleGridSimple} from "InteractionKitExamples.lspkg/Scripts/UI/ExampleGridSimple"

@component
export class GridFeeder extends BaseScriptComponent {
  @input grid: ExampleGridSimple

  onAwake(): void {
    this.grid.testMode = false
    this.grid.addItem({label: "Play", subtitle: "Start a round", callback: () => print("Play tapped")})
    this.grid.addItem({label: "Settings", callback: () => print("Settings tapped")})
  }
}
```

After the grid is built, `addItem` rebuilds the grid. To attach handlers to existing
buttons, use `setButtonCallback(index, cb)` (index **1** = first button).

## Populate a tabbed menu

```ts
import {ExampleMenuHorizontalLayout} from "InteractionKitExamples.lspkg/Scripts/UI/ExampleMenuHorizontalLayout"

@component
export class MenuFeeder extends BaseScriptComponent {
  @input menu: ExampleMenuHorizontalLayout
  @input thumbnail: Texture

  onAwake(): void {
    this.menu.homeItems = [
      {text: "Open", image: this.thumbnail, method: () => print("Open")},
      {text: "Share", image: undefined, method: () => print("Share")}
    ]
  }
}
```

The same `homeItems` / `galleryItems` / `settingsItems` shape works for
`ExampleMenuVerticalLayout`. Any list you leave empty is filled with mock cards
while `testMode` is on.

## Video playback

The video player moved to its own package, **VideoPlayer** (hardware decoding through the SpecsNDK `specs-player` library, with a VideoTexture fallback in the Lens Studio Preview). Install it from the Asset Library.

## Add cards and chat messages at runtime

```ts
import {ExampleDeck} from "InteractionKitExamples.lspkg/Scripts/UI/ExampleDeck"
import {ExampleChat} from "InteractionKitExamples.lspkg/Scripts/UI/ExampleChat"

@component
export class ContentFeeder extends BaseScriptComponent {
  @input deck: ExampleDeck
  @input chat: ExampleChat

  onAwake(): void {
    // Before the deck starts: the card is queued and built once at the deck's start.
    this.deck.addCard("Welcome", "Swipe left or right to browse.")
  }

  // After the deck and chat have started (e.g. from a tap or a response):
  addLater(title: string, text: string): void {
    this.deck.addCard(title, text)
    this.chat.addBotMessage(text)
  }
}
```

`addCard` works before or after the deck starts. Before start it only queues
the card in `deckCards`, which the deck builds once at start.

## Interaction Showcase: reset it from your own script

The Showcase's control scripts expose their reset actions, so another script
(a button of yours, a game state change) can put the showcase back.

```ts
import {CrystalChain} from "InteractionKitExamples.lspkg/Showcase/Scripts/CrystalChain"
import {JellyfishControls} from "InteractionKitExamples.lspkg/Showcase/Scripts/JellyfishControls"

@component
export class ResetShowcase extends BaseScriptComponent {
  // Showcase_Chain's CrystalChain and Controls_Jellyfish's JellyfishControls.
  @input
  chain: CrystalChain

  @input
  jellyfishControls: JellyfishControls

  resetAll(): void {
    this.chain.regroup()
    this.jellyfishControls.reset()
  }
}
```

Both objects live under `[EXAMPLES] Showcase` in the prefab
(`Showcases/Showcase_Chain` and `FarPanelPlacement/.../Controls_Jellyfish`).
`ShowcaseSelector` calls the same two methods whenever the far panel switches
showcase.
