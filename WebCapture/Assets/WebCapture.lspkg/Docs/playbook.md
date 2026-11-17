# Web Capture playbook

[← Agent usage index](../README.md)

## Use when

Read after the [guide](guide.md), when you want to get the most out of the package: how to shoot a
capture that edits well, why the backend is Snap Cloud, and how the replay reproduces UIKit and
Interaction Kit so that what you post looks like what you wore.

## Use it to your advantage

**Shoot once, cut many times.** A recording is layers, not a flat video. One capture gives you the
original 1464×1098 view, a 9:16 for TikTok, Reels, Shorts and Spotlight, a 4:5 for LinkedIn and
Reddit and a 1:1 for X, each with its own crop, and the virtual objects stay registered on the real
world in every one. Don't re-record for a format: change **Output format** and the crop.

**Fix it in post.** Things that would need a retake in a screen recording are edits here:

- The virtual layer is too faint or too heavy → **Virtual opacity** and **Camera tint**, or switch
  **Composite** between the glasses' additive display and solid.
- The room looks too blue or too yellow → **Cold ↔ Warm** tints the camera picture only; exposure,
  contrast and saturation grade the whole frame.
- Your hand disappears behind a panel → **Hands in front**.
- An object is in the way → hide it, move it or recolour it per object. The recorded tracks are never
  changed, so every edit is reversible.
- The content drifts against the room → **Lock to environment** (it runs on open) and **Camera sync**.

**Habits that make a capture edit well**

- Record **60 s** when you can (the panel's **Length** button): you get slack before and after the
  moment you want, and the first seconds after Start are the least stable. Trim in the editor.
- Move your head slowly for the first second. The lock measures the camera against the head pose
  there, and a clean start gives a tighter lock.
- Keep the hand you interact with in the camera's view if you want it to cover virtual objects.
- Light the room. The lock and the hand model both read the camera picture.
- Give captured objects a stable **Target Id**. The portal's per-object edits are keyed by it.
- Call `WebCapture.mark("label")` at the moments you care about; markers show on the timeline.
- **Close the Lens before you push a new build.** A Lens killed mid-session can leave its camera
  stream running in the glasses' camera service; later captures then stop after about 22 frames until
  the glasses are rebooted (see [troubleshooting](troubleshooting.md)).

**From capture to post** without leaving the portal: Recordings → Edit → Export per format →
Schedule. The Schedule tab knows each platform's shape, length and caption limit, shows the post in
a phone, and its *Edit & export 9:16* buttons open the recording at the right format.

**Build on it.** The portal is plain ES modules with tests (`npm test`); the scheduler takes a
pluggable engine; new capture layers follow the camera layer's pattern (see the guide).

## Why Snap Cloud

On the glasses a Lens cannot write files you can pick up, cannot reach your laptop's `localhost`, and
a 30 to 90 s capture with camera video is 15 to 45 MB. Web Capture needs a place that a published
or pushed Lens can reach from anywhere, that holds large files, and that your browser can read a
moment later. Snap Cloud is that place, and it is **your own project**:

| Need | What Snap Cloud gives |
|---|---|
| Save from Specs, on any network | The Lens signs in (Snapchat, or anonymously) and calls the package's RPCs |
| Big recordings | Storage holds the camera video and meshes; the database row stays small |
| See it immediately | The portal reads the same project with the public key and lists the recording as soon as it is saved |
| One place for every run | A fixed **Capture Code** per project, so nobody types a code per session |
| Yours, not ours | Nothing is hosted by the package; recordings stay in your project and you delete them there |

What to keep in mind:

- Run `setup.sql`, `storage.sql` and `fixed-code.sql` once per project (they are safe to re-run).
- The Lens gets its credentials only from the `SupabaseProject` asset; the portal uses the **public**
  key. Never put a service-role key in either.
- The Capture Code is the key to the recordings and their camera frames. Make it long and random and
  share it like a link.
- Storage's default limit is 50 MB per file. A 90 s capture can exceed it; 60 s is the safe length,
  or raise the limit in your project.
- You don't need Snap Cloud while building in Lens Studio: the WebCapture plugin saves recordings
  locally (Experimental APIs on). You need it as soon as you capture on the glasses.

## Replicating UIKit and Interaction Kit

The replay is a re-render, so UI only looks right if the portal draws it the way the Lens does. The
package gives you a base for that and a way to keep it honest.

**What the replay draws today**

| In the Lens | In the replay | How |
|---|---|---|
| Meshes (`RenderMeshVisual`) | The real geometry, base colour texture, culling | Capture Geometry |
| `Text` | A flat quad on the object: it takes the object's position, rotation and scale, at the Lens's text size | Text is part of the object, never a billboard |
| UIKit `Frame`, buttons, plates | Flat rounded rectangles (`panel` shapes) with UIKit's colours, margin and radius | `WebCapture.addPanelShape(object, {size, radius, color, border, layer})` |
| Interaction Kit cursor | A small round shape at the cursor, facing the camera, smaller while pinching | `CursorCapture` (started by `CapturePanel`) |
| The wearer's hands | The real hands from the camera, in front of the virtual layer | Hands in front (portal) |
| The display | Additive light on a dimmed camera picture, with a soft shadow | Composite: Glasses display |

**Why UIKit is recorded as shapes.** UIKit visuals are unit meshes sized by their shader. Replayed
as meshes they come out as tiny white squares. So a UIKit element is recorded as the rectangle it
*looks like*: you register an object with the size, corner radius and colour UIKit gives it, and the
portal draws that. `CapturePanel.ts` is the reference: copy its `shape(...)` calls for your own
panels and buttons.

**Why the cursor is recorded separately.** On Specs the cursor is drawn by the system, not by a Lens
mesh, so it is not among the scene's objects. `CursorCapture` asks the Interaction Kit for every
cursor's position each frame (`CursorControllerProvider.getAllCursors()`, `cursorPosition`,
`cursorAlpha`) and records it as a round shape. Use it without the panel with
`new CursorCapture(webCapture, parent)` and `update()` in a `LateUpdateEvent`.

**Keeping it faithful, systematically.** Design values are not typed from memory:

1. `node tools/extract_uikit_tokens.mjs` reads the real values out of the installed UIKit package
   (panel colour, frame margin, primary button fill, border size, selected and hover gradients, text
   colours) into `WebCapturePortal/src/uikit-tokens.json`.
2. `npm test` (`tests/uikit.test.mjs`) fails when `CapturePanel.ts` uses a colour or margin that is
   not UIKit's. Re-run the extractor when UIKit updates, then fix what the test reports.
3. Add a check there for every new replicated element, so drift is caught by a test and not by eye.

**Known gaps** (the replay is close, not pixel-identical):

- UIKit gradients (hover, pressed, selected) and gradient borders are drawn as one flat colour: the
  selected state uses the middle stop of UIKit's gradient.
- Hover and pressed states are not recorded; only what you toggle yourself (as `CapturePanel` does
  for its recording state).
- The targeting ray and hand visuals are not drawn; the cursor is, and the real hands come from the
  camera.
- Text uses a system font, not the Lens font.

To add an element: give it an object, register its shape with the values from the tokens file, toggle
`enabled` for states, and add a test line. That is the whole pattern.
