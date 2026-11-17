# Instantiation minimal examples

[← Agent usage index](../README.md)

## Use when

You need the smallest working setup. Longer recipes are in [guide](guide.md).

## Prefab (no code)

1. Drag `Instantiation.lspkg/Instantiation__PLACE_IN_SCENE.prefab` into the
   scene. As is, it shows the guide and then the carousel, which steps through
   all 15 groups under `Examples`. To keep a single layout, delete `Guide` and
   `ExampleCarousel` from the instance and enable only the group you want (in
   the file only `[InstantiateOn3DGrids]` is enabled).
2. In that group, keep the `…TS` host enabled and the `…JS` host disabled (or
   the other way round, but never both).
3. Set the host's `prefab` to your prefab, and move the group's center object
   where the layout should appear.

## Inspector setup on your own objects (TS or JS)

1. Create `Spawner` (the copies become its children) and `Center` (place it
   about 1 m in front of the user).
2. On `Spawner`, add either the `CirclePerimeterInstantiatorTS` script (TS) or the
   `Scripts/JS/CirclePerimeterInstantiatorJS.js` asset (JS). Set `center` =
   `Center`, `prefab` = `ExamplePrefabInstantiateSphere`, `numberOfPrefabs` = 12,
   and `radius` = 20.
3. Preview: 12 copies on a 20 cm ring, facing the same way as `Center`.

## Create a layout from TypeScript

```typescript
import {InstantiateOn3DGridsTS} from "Instantiation.lspkg/Scripts/TS/InstantiateOn3DGridsTS";

@component
export class GridSpawner extends BaseScriptComponent {
  @input prefab: ObjectPrefab;
  @input centerObject: SceneObject;

  onAwake() {
    const grid = this.sceneObject.createComponent(InstantiateOn3DGridsTS.getTypeName()) as InstantiateOn3DGridsTS;
    // Inputs are read on the component's OnStart, so assigning them now is enough.
    grid.prefab = this.prefab;
    grid.gridCenter = this.centerObject;
    grid.gridWidth = 4;
    grid.gridHeight = 3;
    grid.gridDepth = 2;
    grid.spacingX = 8;
    grid.spacingY = 8;
    grid.spacingZ = 8;
    // Do not call grid.instantiateGrid() as well: that would spawn a second grid.
  }
}
```

## Post-process the spawned copies

There's no "instantiated" event. Read the instantiator's children once its
OnStart has run, for example on the first update:

```typescript
@component
export class RandomizeHeights extends BaseScriptComponent {
  @input instantiator: SceneObject; // the object carrying the instantiator script

  private done = false;

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => {
      if (this.done) return;
      this.done = true;
      const count = this.instantiator.getChildrenCount();
      for (let i = 0; i < count; i++) {
        const t = this.instantiator.getChild(i).getTransform();
        const s = t.getLocalScale();
        t.setLocalScale(new vec3(s.x, s.y * (1 + Math.random() * 3), s.z));
      }
    });
  }
}
```

If the instantiator object already has authored children (none of the shipped
groups put content on the host itself), skip them by name.

## Clear and respawn

```typescript
import {CirclePerimeterInstantiatorTS} from "Instantiation.lspkg/Scripts/TS/CirclePerimeterInstantiatorTS";

@component
export class RingRespawner extends BaseScriptComponent {
  @input ring: CirclePerimeterInstantiatorTS;

  respawn(newRadius: number) {
    const host = this.ring.getSceneObject();
    for (let i = host.getChildrenCount() - 1; i >= 0; i--) {
      host.getChild(i).destroy();
    }
    this.ring.radius = newRadius;
    this.ring.instantiatePrefabs(); // spawns one more layout (the old one was destroyed above)
  }
}
```
