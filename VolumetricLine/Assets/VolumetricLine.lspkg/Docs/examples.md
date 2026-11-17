# VolumetricLine examples

[← Agent usage index](../README.md)

## Use when

Place the packaged demo or control an already wired component.

Drag `VolumetricLine__PLACE_IN_SCENE.prefab` from the package root into the intended scene. It contains four point cubes (Box … Box 3), the VolumetricLine (Rainbow.mat, radius 5, 400 steps, 20 segments) and RandomPositionAnimator. The path is about 1 m tall at z −90, so on Specs scale the root down (the QA demo uses scale 0.35 at (0, −18, −110)). Check the point references, material and [coordinate settings](lifecycle.md) before running.

## Apply appearance after authored setup

Attach this consumer component and wire `line` to an authored VolumetricLine that already has valid point/material Inspector inputs. OnStart changes color and radius, then explicitly refreshes; it does not construct a missing line or manually call lifecycle methods.

```typescript
import { VolumetricLine } from "VolumetricLine.lspkg/Scripts/VolumetricLine";

@component
export class ConfigureAuthoredLine extends BaseScriptComponent {
  @input line: VolumetricLine;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.line.color = new vec3(0.2, 0.8, 1);
      this.line.radius = 3;
      this.line.refreshPath();
    });
  }
}
```

## Select throttled updates and read diagnostics

The line remains continuously updated with smoothUpdate=false at 0.1 second intervals. This reports source-visible diagnostics; it does not certify rendered placement or prove initialization occurred.

```typescript
import { VolumetricLine } from "VolumetricLine.lspkg/Scripts/VolumetricLine";

@component
export class ThrottleAuthoredLine extends BaseScriptComponent {
  @input line: VolumetricLine;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.line.smoothUpdate = false;
      this.line.continuousUpdate = true;
      this.line.updateRate = 0.1;
      print(this.line.getPositionDiagnostics());
    });
  }
}
```

These snippets compile against source/ambient declarations. `color` only has a visible effect when `line.material` has a `baseColor` parameter; neither shipped material (Rainbow.mat, PBR.mat) does.
