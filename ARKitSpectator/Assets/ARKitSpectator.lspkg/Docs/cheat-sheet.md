# ARKitSpectator cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again before wiring the package into a Lens. These are the rules that
most often break a spectator setup. Each links to the detail.

## The rules

1. **Credentials come only from a `SupabaseProject` asset** on the prefab's `SnapCloudRequirements`
   (wired into `ARKitSpectator.snapCloudRequirements`; Window → Supabase → Import Credentials). Never put a URL or key in a script, a string input
   or a committed scene. → [setup](setup.md)
2. **The backend must be installed first.** Run `setup.sql` once on the same project and enable
   **Anonymous Sign-Ins**; otherwise room creation or the phone's join fails. → [setup](setup.md),
   [troubleshooting](troubleshooting.md)
3. **Poses are relative to the Stage Origin** (empty = the `ARKitSpectator` SceneObject), in cm,
   +Y up. Put streamed objects where they belong relative to that origin (usually as its
   children), and don't scale the origin unless you mean it: its world scale divides every
   entity's scale. The phone puts the origin where the viewer taps and turns its +Z toward them.
   → [protocol](protocol.md)
4. **Ids must be unique and stable.** Ids default to the SceneObject name (max 80 characters).
   Duplicate ids are suffixed `#2`, `#3`… with a warning, and that suffix depends on order. Set
   `entityId` explicitly on `SpectatorEntity`. → [components](components.md)
5. **Limits are enforced server-side**: 64 entities, 128 KB per update, entity `data` ≤ 2 KB, room
   `data` ≤ 8 KB, `asset` https only (≤ 512 characters). Over-limit entities are skipped with a
   `[ARKitSpectator]` warning, not an error. → [protocol](protocol.md)
6. **Models are glTF/GLB served over https** from the project's public Storage (`Asset Url` =
   `<bucket>/<path>`) or a host the viewer allowed in the app. Units are glTF metres; placeholder
   primitives are 10 cm reference shapes × the object's scale. → [components](components.md)
7. **Use `playClip()` for one-shot animations.** Calling it again with the same name re-triggers
   the clip (new `clip.id`). `Loop Clip` / `playClip(name, true)` loops. → [examples](examples.md)
8. **The iOS app ships zipped** (`ExtractAtProjectRoot/iOS.zip`): unzip at the project root,
   build in Xcode with your own signing team, and enter the same project URL and **public** key in
   its Settings. → [setup](setup.md)
9. **Spectators are read-only and anonymous.** The 4-digit code is an invitation, not a password.
   Don't stream private data. → [protocol](protocol.md)

## Verify

A compile-clean Lens can still stream nothing. Check that the status Text shows
`Room <code> · waiting for spectators`, that the Logger has no `[ARKitSpectator]` warnings, and
that objects appear and move on a phone. → [troubleshooting](troubleshooting.md)
