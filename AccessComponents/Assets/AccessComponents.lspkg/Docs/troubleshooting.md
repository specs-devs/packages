# AccessComponents troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table when an Access Components example, or code copied from one,
misbehaves. Generic null-reference and lifecycle bugs are covered by
the Lens Studio documentation.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| An example prints nothing | The group is disabled; or, on a script added outside the prefab, `enableLogging` / `enableLoggingLifecycle` are still at their script default `false` (and `debug` is off on scripts that have one). The prefab wires `enableLogging` and `debug` to `true` | Enable the group; on your own copies turn on `enableLogging` (and `debug`) |
| Re-enabling a group prints nothing new | Each example runs once, on its first `OnStartEvent` (TS→JS: at load) | Restart Preview to run it again |
| Import under `AccessComponents.lspkg/` unresolved | Folder segment missing, or "without" spelled the usual way (the folder is spelled "withouth") | Use `AccessComponents.lspkg/<ExampleFolder>/<File>`; the folder is `AccessJSfromTSwithouthDeclaration` |
| `TSComponentA` / `TSComponentB` resolves to a different class than expected | The example classes now have unique names (`AccessTSfromTS_TSComponentA`, …); the old names are deprecated per-file aliases | Import the new class name from the exact file |
| `parentSceneObject` input missing on the TS child example | The TS input is `parentSceneobject` (lowercase "o"); the JS twin uses `parentSceneObject` | Use the exact name per language |
| JS→JS ComponentA never prints | Its `//@input` line is malformed (no type/name), so `script.debug` is undefined | Expected; ComponentB's prints carry the example |
| `Error: setText requires a string parameter` in JS→JS | Deliberate bad call in ComponentB | Not a bug |
| Stray typename slot named after comment text | Lens Studio parses "@typename" anywhere in a JS file, comments included | Keep "@typename" out of comments in your copy |
| Deprecation warning "This API is deprecated…" from `getAllComponents()` | Older revision of the Required TS example | Use `getComponents("Component")` (this revision) |
| A copied declaration-based call fails at runtime though it compiles | The `JSComponentA` interface is hand-written and not checked against the JS file | Keep the interface in sync with the JS members |
| Picking "GuideDismissPanel" by name attaches the wrong script | Two scripts share the class name: this package's `Example/GuideDismissPanel/GuideDismissPanel.ts` (used by the prefab) and the one in SnapDecorators (a dependency) | Assign the script by asset path, not by name |

## Verification

After a fix, enable only the affected group, turn logging on, run Preview and
compare the Logger with [components](components.md).
