# InteractionKitExamples troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for failures specific to these examples. Generic Lens scripting,
scene placement and rendering issues belong to the CLAD skills. UIKit/SIK
component issues are covered by those packages' own `Docs/troubleshooting.md`.
The rows below come from the source of this revision and the Specs QA pass.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| Import under `InteractionKitExamples.lspkg/` is unresolved | Path missing `Scripts/<area>/` or `RocketWorkshop/Scripts/` | Use the full paths from [components.md](components.md); there is no barrel module |
| A panel example shows nothing, or its frame is far away (around 6 m) | `positionX/Y/Z` (default `0, 0, -110`) are local to the script's SceneObject. Older revisions of `ExampleGrid` / `ExampleGridSimple` (and the fixed-position layouts) used world positions | In this revision all builders use `setLocalPosition`. Place the host near the user (or under a parent at the origin) and tune `positionZ` |
| A panel's buttons don't react, but the panel renders | Another panel's Frame interaction plane is in front of it on the ray. The plane can be wider than the visible frame | Show one example at a time (that is why `UIController` toggles one child), or move one panel out of the other's plane. QA moved `ExampleDynamicGrid` and the Rocket's planet/satellite/meteor for this reason |
| Dynamic Grid (`ExampleGrid`, `draggable = true`) item moves a little under the pinch but doesn't swap | A pinch only becomes a drag after the item travels 1.5 cm (`GridRearrangement`). Shorter pinches are taps: the item snaps back and the button fires `onTriggerUp`. Releasing a real drag doesn't fire the tap | Move the item further before releasing; to tap, pinch and release without moving |
| A runtime-built label is hidden behind a panel or modal plate that appears after it | The installed UIKit's `ElementContent` has no private `_renderOrderOffset`, so writing it through `as any` does nothing and a standalone label (no Button host) stays at renderOrder 0. Every builder's `content()` helper (and `RocketUI`) now sets the public `hostRenderOrderOffset` instead, so the Modal's dialog title and body draw above the scrim and plate | In your own builders set `ec.hostRenderOrderOffset` (or `ec.renderOrder`) for labels that sit on a plate with a higher render order |
| `ExampleChat` keeps adding messages by itself | `testMode = true` adds a test card on a timer until its internal cap | Set `testMode = false`, which starts with one welcome bot card |
| `ExampleChat.addUserMessage` cards are misplaced if called early | The card container and base positions are created in its OnStart | Call the chat API after its OnStart (a tap, a response, a delayed callback) |
| A copied UI example crashes at script load inside UIKit's theme / visual modules | Circular import in UIKit: when a visual module loads before `ThemeService`, the theme chain reads `COLORS` before it is defined | Keep `import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"` as the first import |
| `Cannot find asset` at runtime from a copied Rocket Workshop snippet | `requireAsset` with a template string | Use static string literals, one entry per asset (see `PART_PREFABS` / `THUMBNAILS`) |
| `Rocket Workshop diorama is missing expected objects — check the authored art.` | `RocketWorkshop` didn't find a descendant named `Rocket`, `Platform` or `Rocket_sparks`, or any `AnimationPlayer` | Keep those names in the diorama under the `RocketWorkshop` host |
| `[UIController] nextButton is wired but is not a RoundButton (no onTriggerUp); skipping.` | The `nextButton` / `previousButton` inputs are typed `RoundButton`; a different component was wired | Wire the `RoundButton` components (or replace `UIController` with your own navigation using Current `Button`) |
| `InteractionModesManager` reacts to mock objects, not hands | `testMode` simulates hands. In this revision that only applies in the editor | On device, real `SIK.HandInputData` is used automatically; in the editor, turn `testMode` off to test with simulated SIK hands |
| Video audio keeps playing after you hide your copy of the player | The `VideoTextureProvider` keeps playing on its own | `ExampleVideoPlayer` pauses on `OnDisableEvent` and resumes on `OnEnableEvent`. Keep those handlers when you copy it |
| Copied code fails review for `as any` / private fields | `RocketUI` and the `Scripts/UI/` builders still write the private UIKit fields that have no public pre-initialize equivalent (Frame config, Button style/shape/toggleable, `ElementContent`) | Use UIKit's public API (see [api-status](api-status.md#internal-do-not-copy-into-new-code)) |
| Inspector shows `_styleSystem2: PrimaryNeutral` on UIKit components | Legacy serialized field. System 3.0 reads `_styleSystem3` | Harmless; ignore |
| The rocket's flight passes through the satellite | Planet/satellite/meteor sit above the rocket, between the two panels, so they stay grabbable | Visual only; move them in the prefab if you change the panel layout |

## Automated Preview testing

- When pinch or poke targets a Rocket part row by id, it can scroll the
  `ScrollWindow` instead of pressing the row. Target rows by world position and
  check the swap in the scene.
- Grid buttons can report "obstructed" by their own frame's interaction plane
  when targeted by id; targeting by world position works.

## Verification

After a fix, reproduce it in Preview with one example group enabled. Confirm
the visuals and that the example's own log line appears (for example
`GridSimple: tapped "Item 3"`, `Modal: shown`). If behavior differs from these
docs, record the package version and update the package docs.
