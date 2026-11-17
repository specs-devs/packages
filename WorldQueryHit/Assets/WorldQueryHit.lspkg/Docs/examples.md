# WorldQueryHit examples

[← Agent usage index](../README.md)

## Use when

Place the installed prefab or use the classification API.

Drag `WorldQueryHit__PLACE_IN_SCENE.prefab` from the package root. It brings its own guide and example carousel, and its `World Query Hit` group uses the TS NewScript component, a target preview and four source objects. Wire the camera/SIK/tracking environment according to the Lens Studio documentation. Preserve valid source parents. Do not assume a preview with no environment data can prove surface acquisition.

## Observe classification changes

Attach this consumer, wire `detector` to an authored HitTestClassification, and wire `status` to a Text. Each event means the name changed; a missed hit leaves the last value. This snippet intentionally does not infer placement permission or fresh tracking from the event.

```typescript
import { HitTestClassification, SurfaceClassificationInfo } from "WorldQueryHit.lspkg/Scripts/HitTestClassificationTS";

@component
export class ShowSurfaceName extends BaseScriptComponent {
  @input detector: HitTestClassification;
  @input status: Text;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.detector.onClassificationChanged.add((info: SurfaceClassificationInfo) => {
        this.status.text = info.displayName;
        this.status.textFill.color = info.color;
      });
      const latest = this.detector.currentClassification;
      if (latest !== null) {
        this.status.text = latest.displayName;
      }
    });
  }
}
```

## Update the authored TS source selection

This complete consumer validates its own chosen index. The package's setObjectIndex does not update visibility; TS setObjectEnabled reads the stored index regardless of its argument. Initial placement component inputs must already be valid before awake.

```typescript
import { NewScript } from "WorldQueryHit.lspkg/Scripts/WorldQueryHitExampleTS";

@component
export class SelectPlacementSource extends BaseScriptComponent {
  @input placement: NewScript;
  @input sourceIndex: number = 0;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      const index = Math.floor(this.sourceIndex);
      if (index < 0 || index >= this.placement.objectsToSpawn.length) {
        print("Placement source index is outside the wired array");
        return;
      }
      this.placement.setObjectIndex(index);
      this.placement.setObjectEnabled(index);
    });
  }
}
```

The event listener example uses one scene-lifetime subscription. If a consumer destroys/recreates itself, implement subscription ownership using installed SIK Event APIs. No live classification, trigger action, copy or camera rendering was exercised by the docs type checker.
