# Raymarching cheat sheet

[← Agent usage index](../README.md)

## Use when

Read this first, before you build or edit a Lens with Raymarching.

1. **A field needs its material and proxy mesh.** Set `MetaballField.material` to `Shaders/MetaballField.mat` and `proxyMesh` to `Meshes/UnitSphere`. A field created from code gets them through `configure(material, mesh)`, because `createComponent` runs `onAwake` before you can set inputs. → [components](components.md#metaballfield)
2. **8 balls per field, at most.** Extra active sources are ignored (the log says so once). Need more? Use a second field — balls only melt with balls of the same field. → [components](components.md#metaballsource)
3. **Sizes are in cm and smoothness is relative.** `MetaballSource.radius` is in cm; `MetaballField.smoothness` is relative to the mean ball radius (0 = hard spheres, ~0.35 = gooey, 1 = very gooey), so the look doesn't change when the balls spread out. → [components](components.md)
4. **Move the source objects, not the volume.** The field moves and scales its own `MetaballVolume` child every LateUpdate to enclose the balls. Don't parent things under it or edit its transform. → [shader](shader.md#the-proxy-volume)
5. **Keep balls together.** The cost is per covered pixel: balls far apart make one big volume of mostly empty pixels. Split distant groups into separate fields. → [performance](performance.md)
6. **Don't share the material between fields.** Each field clones `material` on start; set looks through the field (`setPreset`, `intensity`, …), not on the material asset at runtime. → [components](components.md#metaballfield)
7. **Black is transparent on SPECS.** Dark presets read as see-through; raise `intensity` for a more solid look. → [troubleshooting](troubleshooting.md)
8. **Hands only exist after OnStart.** Read SIK `HandInputData` in OnStart or later (Hand Goo does), and drop a hand's balls (radius 0) while it is untracked. → [examples](examples.md#goo-on-your-hands)
