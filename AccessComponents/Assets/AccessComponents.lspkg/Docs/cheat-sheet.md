# AccessComponents cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again before you copy one of the examples into a
lens. Each rule points to the detail.

## The rules

1. **Imports include the example folder.** `AccessComponents.lspkg/AccessTSfromTS/AccessTSfromTS_TSComponentA`,
   not `AccessComponents.lspkg/AccessTSfromTS_TSComponentA`. The "without
   declaration" folder is spelled `AccessJSfromTSwithouthDeclaration`. → [components](components.md)
2. **Example classes are named after their file.** `AccessTSfromTS_TSComponentA`,
   `AccessTSfromTS_TSComponentB`, …; the old shared names `TSComponentA` /
   `TSComponentB` remain only as deprecated per-file aliases. → [components](components.md)
3. **TS logging is off in the script, on in the prefab.** Every TS example
   prints only when `enableLogging` or `enableLoggingLifecycle` is on (script
   default `false`), and that includes its error lines. TS scripts with a
   `debug` input also need `debug` on. JS scripts print when `debug` is on. The
   prefab wires `enableLogging` and `debug` to `true` on every example script,
   so a fresh prefab instance prints; a script you add yourself prints nothing
   until you turn them on. → [components](components.md)
4. **Typed lookup for TS components, typename string for built-ins.**
   `obj.getComponent(MyScript.getTypeName())` for a TS component;
   `obj.getComponent("Component.RenderMeshVisual")` for an engine component.
   From JS, use `requireType("./File")` or an `//@typename` input. → [guide](guide.md)
5. **Read other scripts in `OnStartEvent`, not at awake.** The examples wait for
   `OnStartEvent` (TS `@bindStartEvent`, JS `createEvent("OnStartEvent")`) so the
   other component has initialized its members. Exception: the TS→JS example's
   JS script runs at load time. → [guide](guide.md)
6. **A JS component's members are untyped in TS.** Either declare an
   `interface … extends ScriptComponent` (the "with declaration" example) or
   type the input `any` (the "without declaration" example). A declaration is
   not checked against the JS file: keep them in sync by hand. → [components](components.md)
7. **`getComponent` returns null when the component is missing.** The TS
   "OnSceneObject"/"OnChildSceneObject" scripts null-check the result before
   using it; do the same in your own code. → [guide](guide.md)

## Verify

One example group enabled, logging on, expected lines in the Logger, no
unexpected `Error:` line. → [troubleshooting](troubleshooting.md)
