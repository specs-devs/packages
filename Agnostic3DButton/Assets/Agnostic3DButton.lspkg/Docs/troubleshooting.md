# Agnostic3DButton troubleshooting

[← Agent usage index](../README.md)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Nothing happens when I press | The finger never engaged: it came in from the side, or `fingers` is empty and `useSIKIndexTips` is off | Approach from above; add fingers or turn `useSIKIndexTips` on |
| The button presses "upside down" | Local +Y points away from the user | Rotate the SceneObject so +Y is the top face |
| Volume is too big / too small | Sizes are in local units and the object is scaled | Adjust `size` / `travel`, or reset the scale; turn on `debugDraw` to see the volume |
| A click fires twice | `releaseThreshold` is too close to `pressThreshold` | Keep a gap (default 0.7 / 0.4) |
| Clicks are hard to trigger | `travel` is deep or `pressThreshold` high | Lower `pressThreshold` or `travel` |
| The cap pops back abruptly | `returnSpeed` too high | Lower it (e.g. 12; the Pressure example uses 12 for a smooth lamp) |
| The button feels sticky | `releaseDelay` / `holdMargin` raised a lot | Keep `releaseDelay` ≈ 0.1 s and `holdMargin` ≈ 1; `maxHoldWithoutFinger` always releases after 0.5 s without a finger |
| Neighbouring bases or glow rings overlap | Buttons closer than their base width | Space them wider than `size` + 2 × (`clearance` + `bezelWidth`), or lower `bezelWidth` |
| No finger shadow | `showShadow` off, the finger is higher than `shadowRange`, or outside the cap's flat top | Lower the finger / raise `shadowRange`; the shadow is clipped at the cap edge |
| Neighbouring keys press together | Footprints overlap | Space the buttons wider than `size` |
| The button is invisible | `Agnostic3DButtonVisual` has no materials, or it was created from code without `configure()` | Assign `capMaterial` / `glowMaterial`, or call `configure(...)` |
| The cap looks see-through | Dark colours are transparent on SPECS | Use a brighter theme (Specs Glass, Candy) |
| Any Finger ball doesn't press | The ball is held beside the footprint, or released before reaching the top | Push it straight down onto the cap |
