# Agnostic3DButton cheat sheet

[← Agent usage index](../README.md)

## Use when

Read this first, before you build or edit a Lens with Agnostic3DButton.

1. **Local +Y is the top of the button.** The press direction is local −Y. Rotate the SceneObject to aim the button (the examples tilt a "console" 55° toward the user). → [how it works](how-it-works.md)
2. **Sizes are in local units.** `size`, `travel` and `hoverHeight` are in the button's local units (cm at scale 1); scaling the object scales the volume. → [components](components.md#agnostic3dbutton)
3. **Fingers come from the top.** With `enterFromTopOnly` (default), a finger must enter the hover band above the top face before it can press; pushing in from the side or below does nothing. → [how it works](how-it-works.md#engaging-a-finger)
4. **Any object can be a finger.** Add SceneObjects to `fingers`, call `addFinger(obj)` / `addFingerSource(fn)`, or leave `useSIKIndexTips` on for both index tips. → [examples](examples.md#any-finger)
5. **Listen to `onClick` for actions.** It fires once per press (press past `pressThreshold`, then back under `releaseThreshold`). Use `onPressed` for "on touch down", `onPressValue` for analog control, `onToggle` with `toggle` on. → [components](components.md#events)
6. **Code-created buttons: configure the visual.** `createComponent` runs `onAwake` before you can set inputs; call `Agnostic3DButtonVisual.configure(button, capMat, glowMat, theme, label)` (the examples' `ButtonFactory` does). → [examples](examples.md#build-buttons-from-code)
7. **The visual is optional.** The core never renders (except `debugDraw`); put your own mesh on it and read `pressValue`. → [components](components.md#agnostic3dbuttonvisual)
8. **Black is transparent on SPECS.** Dark caps read as see-through; the glow uses additive blending. → [troubleshooting](troubleshooting.md)
9. **The UIKit style only copies the look.** Use real UIKit buttons when you need UIKit layout / theming; `style` UIKit gives an Agnostic3DButton the System 3.0 look for finger-pressed controls. → [components](components.md#agnostic3dbuttonvisual)
10. **Leave room for the bezel.** Each button's base is `size` + 2 × (`clearance` + `bezelWidth`) wide; space neighbours wider than that (the keypad leaves 0.5 cm) so bases and glow rings never overlap. → [examples](examples.md#keypad)
