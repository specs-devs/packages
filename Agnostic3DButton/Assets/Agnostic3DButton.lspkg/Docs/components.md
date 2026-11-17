# Agnostic3DButton components

[← Agent usage index](../README.md)

All scripts live in `Agnostic3DButton.lspkg/Scripts/`.

## Agnostic3DButton

The press logic. Put it on the SceneObject whose local +Y is the top of the button.

| Input | Default | What it does |
| --- | --- | --- |
| `fingers` | [] | SceneObjects that can press the button |
| `useSIKIndexTips` | true | Also use both SIK index fingertips (added at OnStart) |
| `shape` | Cylinder | Box or Cylinder footprint |
| `size` | (8, 8) | Box: width (x) and depth (z). Cylinder: x = diameter |
| `travel` | 1.5 | How far the top can be pushed in (local −Y) |
| `hoverHeight` | 3 | Height above the top face that counts as hovering |
| `enterFromTopOnly` | true | A finger must come in from above to press |
| `pressThreshold` | 0.7 | Press value that fires `onPressed` |
| `releaseThreshold` | 0.4 | Press value that fires `onReleased` / `onClick` (hysteresis) |
| `returnSpeed` | 28 | Spring-back speed when the finger leaves (1/s) |
| `holdMargin` | 1.0 | While a pressing finger is below the top plane it stays engaged up to this far outside the footprint (and down to `travel` × 3) |
| `releaseDelay` | 0.12 | After the pressing finger lifts off, the press value holds this long (s) before springing back. A lost or slid-off finger releases at once |
| `releaseHeight` | 0.3 | A pressing finger just above the top (within this height) still holds the press |
| `maxHoldWithoutFinger` | 0.5 | Failsafe: with no finger pushing for this long (s), the button springs back whatever else happens |
| `toggle` | false | Latching toggle: every click flips `isOn` |
| `interactable` | true | Off = ignore every finger |
| `debugDraw` / `debugMaterial` | false / — | Draw the volume as a wireframe |

State: `pressValue` (0..1), `isPressed`, `isHovered`, `isOn`, `volume`.

Methods: `addFinger(obj)`, `removeFinger(obj)`, `addFingerSource(() => vec3 | null)` (world position, null = unavailable), `setOn(on)`, `simulatePress(seconds?)`, `closestFinger(maxHeight, margin?)` (local position of the nearest finger over the footprint, or null; read-only, used by the finger shadow).

### Events

| Event | Argument | Fires when |
| --- | --- | --- |
| `onHoverEnter` / `onHoverExit` | — | A finger enters / leaves the hover band (or the press) |
| `onPressStart` | — | `pressValue` leaves 0 |
| `onPressValue` | number | `pressValue` changes |
| `onPressed` | — | `pressValue` crosses `pressThreshold` |
| `onReleased` | — | `pressValue` falls under `releaseThreshold` after a press |
| `onClick` | — | Once per completed press (right after `onReleased`) |
| `onToggle` | boolean | Toggle mode: the new `isOn` after each click, or after `setOn` |

All events are SIK `Event`s: `add(cb)` returns an unsubscribe function.

## Agnostic3DButtonVisual

The look, built in code at start: a holed base (a bezel around a well), the cap that sinks into it, a glow ring on the bezel, optional label and icon, and the finger shadow. Reads only the button's state, in LateUpdate (the same frame as the press).

| Input | Default | What it does |
| --- | --- | --- |
| `button` | — | The Agnostic3DButton to show |
| `theme` | Specs Glass | Specs Glass, Neon, Candy, Metal, UIKit Primary, UIKit Secondary or UIKit Ghost |
| `style` | Classic | Classic: bevelled cap, glow ring. UIKit: a thin slab with UIKit's 0.5 corner radius, an inset border, a left → right gradient and UIKit's state tints (use a UIKit theme). No UIKit components |
| `capMaterial` | — | Lit material (`Example/Materials/ButtonCap.mat`) for the cap and plate |
| `glowMaterial` | — | Unlit material (`Example/Materials/ButtonGlow.mat`) for the glow (drawn additive) |
| `capHeight` | 1.2 | Cap height above the plate |
| `bevel` | 0.5 | Rounded top edge radius |
| `cornerRadius` | 1.5 | Box footprint corner radius |
| `plateMargin` | 0.9 | Deprecated, unused (kept so existing scenes load); see `bezelWidth` |
| `clearance` | 0.15 | Gap between the cap and the edge of the hole |
| `bezelWidth` | 0.75 | Width of the bezel around the hole |
| `wellDepth` | 0 (auto) | Depth of the well below the bezel; auto = `travel` × 1.2, never shallower than the pressed cap needs |
| `squash` | 0.12 | Cap squash at full press |
| `label` / `labelSize` | "" / 48 | Text on the cap |
| `clickAudio` | — | AudioComponent played on every click |
| `pill` | false | UIKit style, box shape: capsule ends |
| `icon` / `iconSize` | — / 1.25 | Optional icon on the cap (left of the label, or centred), tinted like the label |
| `showShadow` | true | Flat circular shadow of the nearest finger on the cap |
| `shadowRange` | 6 | Height above the top where the shadow appears |
| `shadowMinRadius` / `shadowMaxRadius` | 0.8 / 2.5 | Shadow radius at contact / at the top of the range |
| `shadowMaxOpacity` | 0.9 | Opacity of the flat shadow circle (it fades in at the top of the range) |
| `shadowDarkness` | 0.55 | Shadow colour = the cap's current colour × this (keep it above ~0.3: black is transparent on SPECS) |

Methods: `configure(button, capMaterial, glowMaterial, theme?, label?)` (for code-created buttons), `setTheme(nameOrIndex)`, `setLabel(text)`, `getCap()`.

## Helpers

- `ButtonVolume`: the volume maths (`isInVolume`, `pressAmount`, …), usable without the component.
- `ButtonThemes`: `BUTTON_THEMES` and `findTheme`; add your own theme object.
- `ButtonMeshes`: `buildSlab` (optional planar UVs), `buildWell` (the holed base), `buildRing`, `buildVolumeWireframe` (MeshBuilder geometry).
- `ButtonStyle` (in `Agnostic3DButtonVisual`): `Classic`, `UIKit`.

## Demo scaffolding (`Example/`)

Shipped with the prefab, not part of the package API.

- `ExampleCarousel`: steps through `examples` one at a time on a UIKit Frame (`exampleInfo` = one line per example). Key inputs: `anchorExamples` (place the examples in front of the head pose, again at every step), `keepExamplesInReach` (keep authored distances, for finger-pressed examples), `panelDistance` (90; the prefab uses 100), `extraPanelDrop` (the prefab uses 20, so the panel sits below the examples), `startIndex`, `startMinimized`.
- `GuideDismissPanel`: the "Ok, I understood" guide on a UIKit Frame; `hideUntilDismissed` lists the objects shown after it closes (the prefab: `ExampleCarousel`, `Examples`).
