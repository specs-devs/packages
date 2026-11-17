# RuntimeGizmos cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you add or script a gizmo.

## The rules

1. **Author gizmos in the scene or a prefab, or call `rebuild()` after `createComponent`.**
   Every gizmo builds its lines in `onAwake`, which runs inside
   `createComponent`, before you can assign anything. From code: assign the
   references, call `setLineMaterial(mat)` (and optionally `setLineWidth(w)`),
   then `rebuild()`. → [examples](examples.md), [guide](guide.md)
2. **Import named exports from `Scripts/`**:
   `import {Circle} from "RuntimeGizmos.lspkg/Scripts/Circle"`. → [components](components.md)
3. **Line and ClosedPolyline use local positions.** Keep the gizmo object and its
   point objects as siblings under one parent, with the gizmo object at identity
   (the prefab's `…Manager` pattern). Circle, Spline and Spiral use world
   positions. → [components](components.md)
4. **A ClosedPolyline doesn't track its points.** Call `refreshLine()` (or
   `setPoints()`) after moving them. Line, Circle, Spline and Spiral update
   their points when their targets move. → [components](components.md)
5. **Missing references draw nothing, silently.** A gizmo with no endpoints,
   center, control points or material skips the build. The message goes to
   `logger.debug`. Only a ClosedPolyline with exactly 1 point **throws**.
   Assign the references and call `rebuild()`. → [troubleshooting](troubleshooting.md)
6. **Use real property names.** `startPointObject`/`endPointObject`,
   `beginColor`/`endColor` (Line). `_color` input + `color` setter (Circle,
   Spline, Spiral). `setColor()` (ClosedPolyline). Older docs used
   `startObject`/`color`/`controlPoints` names that don't exist on these classes. → [api-status](api-status.md)
7. **Hide with `isEnabled` (every gizmo) or with the SceneObject.** → [components](components.md)
8. **Sizes are in cm.** The prefab draws 0.1–0.5 cm wide lines at about 2 m. At that
   distance a 20 cm shape spans only about 5°, so bring it closer or scale it up. → [troubleshooting](troubleshooting.md)

## Verify

In Preview: each gizmo is visible, and it follows its targets when you move
them. At start, the log shows no `ClosedPolylineVisual requires at least 2 points`
and no null-transform errors.
