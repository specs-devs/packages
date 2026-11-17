# Instantiation cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you add or script a layout.

## The rules

1. **TS imports live under `Scripts/TS/`, and class names end in `TS`.**
   `import {InstantiateOn3DGridsTS} from "Instantiation.lspkg/Scripts/TS/InstantiateOn3DGridsTS"`.
   The JS twins (`Scripts/JS/<Name>JS.js`) are Script-component assets, not modules. → [components](components.md)
2. **Use one twin per layout.** Each prefab group has a TS host (enabled) and a
   JS host (disabled). Enabling both spawns everything twice. → [troubleshooting](troubleshooting.md)
3. **Layouts spawn once, at `OnStart`.** Inputs are read then, so values
   assigned right after `createComponent` (before the first frame) are used.
   Calling `instantiatePrefabs()` / `instantiateGrid()` / … yourself spawns an
   **additional** full layout. → [examples](examples.md)
4. **Copies become children of the instantiator object.** Clear a layout by
   destroying those children. Find them through
   `getChildrenCount()` / `getChild(i)` on the instantiator. → [examples](examples.md)
5. **Sizes are world cm, and the center's scale is ignored.** Radii, spacings and
   box sizes are absolute. The center's **rotation** orients the layout (except
   for lines). Keep layouts within about 40–60 cm at 1–2 m on Specs. The old
   prefab defaults (2 m circle, 4.5 m grid) didn't fit the view. → [guide](guide.md)
6. **The 2D grid is vertical (X–Y).** `gridHeight`/`spacingY` run along Y, and
   `zPosition` offsets along Z. → [components](components.md)
7. **Counts of 1 are safe.** A line with `numberOfObjects = 1` (or coincident
   endpoints) puts its copies at the start point; slicing with
   `yElementsPerSlice = 1` puts one copy per ring corner. → [components](components.md)
8. **`SimpleColliderInstantiator` fills the target's local unit cube / sphere**,
   mapped through its full world transform (scale, rotation, parents), not the
   collider shape size. `randomScaleVariation` is 0–1 and
   overwrites each copy's local scale. → [components](components.md)

## Verify

In Preview, the child count under each instantiator must equal the configured
count (not double), and the whole layout must be visible.
