# WorldQueryHit cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before setting up surface detection.

1. The TS placement class is **NewScript** from `Scripts/WorldQueryHitExampleTS`; classification is **HitTestClassification** from `Scripts/HitTestClassificationTS`. Preserve these actual identifiers. → [Components](components.md)
2. Placement inputs use SceneObject sources with valid parents, not ObjectPrefab assets. Wire targetObject, objectsToSpawn and an in-range index before awake. → [Lifecycle](lifecycle.md)
3. detectCategory hides nonmatching labels only; it never blocks placement. → [Lifecycle](lifecycle.md)
4. Classification events fire on name changes and retain last information through null hits/targeting loss. They do not prove a fresh hit. → [Examples](examples.md)
5. TS setObjectEnabled ignores its parameter and uses indexToSpawn. JS setObjectEnabled uses its parameter but does not update indexToSpawn. Set the index, then update visibility explicitly. → [Components](components.md)
6. Semantic enum names are resolved at runtime; a named category/color input does not promise the device reports it. Refine is a defensive request, not a guarantee. → [API status](api-status.md)
7. The ray-start offset is fixed world Z+30 cm in source. filterEnabled and detectCategory are different concepts. → [Lifecycle](lifecycle.md)
8. The hit test pauses while the ray targets UI (an Interactable) and a pinch released on UI never places. Keep panels out of the way of the surfaces users should point at. → [Lifecycle](lifecycle.md)
9. Do not call setupTriggerEndCallback repeatedly or re-run JS constructor exports; subscriptions have no shipped cleanup. → [Troubleshooting](troubleshooting.md)
