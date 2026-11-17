# Raymarching troubleshooting

[← Agent usage index](../README.md)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Nothing renders, log says "set `material` and `proxyMesh`" | The field has no material or mesh. | Assign `Shaders/MetaballField.mat` and `Meshes/UnitSphere`, or call `configure()` for code-created fields. |
| Nothing renders, no log | No active source: sources have radius 0, are disabled, or joined another field. | Check `MetaballSource.radius` and `field`; `getSources()` on the field. |
| Some balls missing | More than 8 active balls in one field (logged once). | Split them into two fields. |
| Goo is cut flat on one side | The volume is too tight for a custom shape or a big smoothness. | Raise `fitMargin`. |
| Balls don't melt together | Smoothness too low, or the balls are in different fields. | Raise `smoothness`; put them in the same field. |
| Everything is one blob | Smoothness too high for the ball spacing. | Lower `smoothness` or space the balls out. |
| Looks see-through on SPECS | SPECS displays are additive: dark colours are transparent. | Raise `intensity` or use a brighter preset. |
| Goo doubles or swims between eyes on device | Eye position mismatch on this build. | Set the material's `eyeMode` to 1 (and `eyeOffset` ≈ 3.25 cm). |
| Changing the material asset at runtime does nothing | Each field uses its own clone of the material. | Use the field's setters, or `getVisual().mainMaterial`. |
| Hand Goo shows only three idle balls | No hand is tracked (the preview without hand simulation, or hands out of view). | Use the Preview's hand simulation, or raise your hands on SPECS. |
| Pinch & Merge orbs can't be grabbed | SIK components were created before OnStart, or the collider after the Interactable. | Create them in OnStart; collider first. |
| Frame rate drops | The field covers a lot of the view. | See [performance](performance.md). |
