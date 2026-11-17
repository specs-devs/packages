# BezierLine troubleshooting

[← Agent usage index](../README.md)

## Use when

A connector is missing, does not follow a change, or the board behaves differently than expected. The causes below are derived from source; rows marked *(Preview)* were observed in the Lens Studio Preview with the declared InteractionKit / UIKit dependencies.

| Symptom | Source cause | Action |
|---|---|---|
| No ribbon | Missing `meshVisual`, `start` or `end`; no material; unsupported or degenerate subdivisions | Wire required inputs and visual material. Use a finite integer segment count in 2–128 and positive width. Check logs with `debugLog`. |
| Ribbon appears only after moving an endpoint | Direct settings do not invalidate the curve | Call `markDirty()` after direct property changes, or use a provided setter. |
| New endpoint/control object is not followed | Transforms are cached | Change references through `setEndpoints()` / `setControlPoints()`. |
| Attachment offset seems ignored | Explicit control-object path bypasses axis/attachment calculations | Use axis mode or move the explicit endpoint/control objects yourself. |
| Explicit-control flag seems ineffective | One control object is absent | Assign both `startCtrl` and `endCtrl`; otherwise source falls back to axis mode. |
| Ribbon changes facing slowly or not after camera translation | Orientation-based check, minimum 0.1 s rebuild interval | Assign the intended camera before first build, test camera rotation, and understand that translation alone is not detected. |
| Swapping the camera does not change facing | Camera transform is cached with no camera setter to clear it | Configure camera before first build; recreate the connector if it must change camera ownership. |
| Repeated mesh-invalid log | Builder validation or degenerate inputs | Inspect `[BezierRibbon] Mesh invalid on first build`, endpoints, tangent geometry and segment values. Do not hide errors with casts. |
| Card or dot cannot be pinched | Example relies on SIK interaction initialization | Ensure a compatible SIK prefab is present and compile imported SIK classes. Exercise direct and indirect interaction on device. |
| Connecting a pair deletes an old connector | Board enforces one line per unordered card pair | Expected. Use a different pair, or implement a different ownership policy in your consumer. |
| Dropping a dot does not connect | Target must belong to another card; hover is read from the active interactor | Hover an anchor on another card before release. Same-card connections are rejected. |
| Quick anchor release clears lines | No target and drag target ends within 1.5 cm of anchor | Expected tap behavior. Move beyond that distance to cancel a loose drag without clearing. |
| Card recolor leaves anchors/lines unchanged | `setColor()` changes face material only | Own updates to the separately cloned anchor and connector materials, or rebuild your own board content. |
| Panel does not control the board | `board` input is absent | Wire `BezierExamplesPanel.board`; check `[BezierExamplesPanel] Assign the 'board' input (BezierExamples component).` |
| Stats seem too simple | `vertexCount` is calculated from connection count and configured segments | It is an estimate excluding the temporary line, not a query of generated buffers. |
| *(Preview)* A switch turns a feature on but never off | UIKit `Switch.onFinished` passes the explicit-change flag (always `true` from a tap), not the on/off state | Read `sw.isOn` inside the handler, as the example panel does in this revision. |
| *(Preview)* Ribbons disappear when Camera facing is off | Without a camera the side vector is `tangent × local up`; on a vertical (XY) board that points along Z, so the ribbon is seen edge-on | Expected. Keep `faceCamera` on for upright boards, or lay the board out horizontally. |
| *(Preview)* Debug switch shows nothing | Debug drawing goes through `global.debugRenderSystem`; nothing appeared in the Lens Studio Preview | Treat debug drawing as a development aid; check on device or use `getPointAtT()` markers instead. |
| *(Preview)* Added card overlaps the starter cards | `addCard()` spawns near the board center with a small jitter, 6–9 cm in front | Expected; pinch it and move it. |
| *(Preview)* Top cards or the panel are out of view | Board (~60 × 34 cm) and panel (~26 × 30 cm) side by side or at ~130 cm overflow the portrait Specs view | Stack the panel under the board and place both ~150 cm away, slightly below eye level. |
| *(Preview)* Agent preview tooling cannot pinch anything | Project uses an older InteractionKit than the preview tooling drives | Install the InteractionKit / UIKit builds declared in `package_dependencies.json`. |
| Board and panel don't appear | The prefab's `Guide` hides `BezierDemo` and `ExampleCarousel` until it's dismissed | Press "Ok, I understood" on the guide, or delete `Guide` from the instance and enable `BezierDemo`. |

## Pending validation

The Preview pass covered the interactions in [README verification](../README.md#verification). Still open: dragging the Curve and Segments sliders, direct vs far-field hand interaction and comfort on device, debug-render output on device, and camera/tangent degeneracy with near-coincident endpoints.
