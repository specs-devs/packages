# WorldQueryHit lifecycle and placement

[← Agent usage index](../README.md)

## Use when

Understand setup, freshness and copy behavior.

## Setup and sessions

Both variants create a session on awake. The TS placement class initializes Logger, maps runtime enum names/colors, obtains SIK WorldCameraFinderProvider, creates a session, then validates targetObject, disables it, selects a source, creates optional label/hint and subscribes all currently available interactors. TS onUpdate is independently bound by SnapDecorators; returning early for a missing target does not make later update access safe. JS binds its UpdateEvent only after successful setup. No source/session destruction or interactor unsubscription is implemented.

Input changes to filterEnabled/classificationEnabled/refineEnabled after awake do not update the active session. Public TS createHitTestSession returns a new session but does not replace the private active session; repeated calls need external ownership and are not a configuration setter. Color map and label geometry/scale are also seeded at setup; assigning Inspector color fields later does not rebuild the map.

Only smoothingEnabled/smoothingSpeed/showIntroHint/introHintText/introHintDuration are normalized for older serialized components. Other missing inputs are not comprehensively normalized. The packaged TS prefab wires four SceneObject sources, index1, filter=false, classification=true, showSurfaceLabel=true, refine=false, detectCategory0, labelScale1, smoothing=true/speed10 and the 2-second intro hint. Inspector color decorators and prefab values specify RGBA colors; the color fields have no TS initializer.

## Ray selection and freshness

Every update selects the first targeting interactor (`getTargetingInteractors().shift()`) and checks active/targeting, and that it is not targeting an Interactable (`currentInteractable` null — pointing at UI suppresses the hit test and the cursor). Ray start is startPoint plus world Z30 cm; end is endPoint. This offset is not exposed as an input. Every active update requests a hit without cancellation/generation IDs; callback ordering with asynchronous data is not guarded.

Placement null-hit callback hides cursor/label and clears lastHitResult. Losing an active targeting interactor (or pointing at UI) also hides cursor/label and clears lastHitResult. Trigger release places only with a retained hit, when the releasing interactor is primaryInteractor and it is not on an Interactable, so pinching a button never drops a copy behind it. A hit result still in flight from the previous frame can arrive after the clear (async callbacks have no generation id). Classification-only components keep currentClassification/currentInfo through null hits and inactive targeting and emit no loss/freshness signal. Equal classification names suppress new events, even when position/time changes. SurfaceClassificationInfo.classification is typed number, but missing runtime classification can flow through while name becomes None.

## Cursor and copies

A first/reappearing cursor snaps. Otherwise smoothing uses t=1-exp(-max(smoothingSpeed,.01)*deltaTime) for position lerp/rotation slerp. Placement uses smoothed pose when enabled, otherwise last raw hit position and normal-aligned rotation. Horizontal normals use vec3.forward as tangent; other normals use normal.cross(up), then quat.lookAt.

Copies come from `source.getParent().copyWholeHierarchy(source)` and are detached preserving world transform, then positioned/rotated. Sources therefore require valid parents, and copying can include source child components/scripts. No source index bounds/null checks, duplicate-copy limit, undo, object cleanup, semantic placement gating, or independent collision validation is implemented. setObjectIndex changes only index; call the corresponding visibility method afterward. TS visibility uses indexToSpawn regardless of its argument, while JS visibility uses the argument regardless of indexToSpawn.

## Labels and hints

Category selection indices are 0 All,1 Ground,2 Wall,3 Ceiling,4 Table,5 None/Unknown; an out-of-range index falls back All. It only filters the label, never cursor or copy permission. Label appears at smoothed cursor +normal5cm +worldUp10cm, billboarded toward the world camera. It inherits the component layer and uses Text size96/background/outline. Color/name only update when the name changes; None displays UNKNOWN, other values uppercase. Unknown names use unknownColor. showSurfaceLabel=true after a start that disabled creation cannot create a label; changing it to false early-returns rather than explicitly hiding an existing one.

The optional size48 intro Text is parented to camera at (0,-14,-60), rotated PI around Y and destroyed after max(duration,.1) seconds. Text wraps at 34 characters unless author-provided newlines exist. These coordinates/readability claims require actual stereo preview/device inspection. If your Lens has its own onboarding (guide panel, carousel), set showIntroHint = false to avoid two instructions at once.
