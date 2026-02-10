/**
 * Specs Inc. 2026
 * Enhanced 3D volumetric line component with Catmull-Rom spline interpolation. Creates smooth tube
 * geometry by extruding circular cross-sections along path defined by scene objects, provides
 * configurable radius, circle segment count, and interpolation steps for quality control, supports
 * programmatic creation via createComponent(), and enables dynamic path updates for animated lines.
 */
import {
  withAlpha,
  withoutAlpha,
} from "SpectaclesInteractionKit.lspkg/Utils/color";

/**
 * Enhanced 3D Line component with smooth spline interpolation
 * Creates a 3D tube by extruding a circular cross-section along a path defined by scene objects.
 */
@component
export class VolumetricLine extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Path Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define line path using scene objects</span>')

  @input
  @allowUndefined
  @hint("Array of scene objects that define the path of the 3D line")
  public pathPoints: SceneObject[];

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Geometry Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control line thickness and smoothness</span>')

  @input
  @hint("Radius of the circular cross-section")
  private _radius: number = 10.0;

  @input
  @hint("Number of segments around the circle (higher = smoother)")
  private _circleSegments: number = 16;

  @input
  @hint(
    "Number of interpolated points between each path point for smooth curves"
  )
  private _interpolationSteps: number = 10;

  @input
  @hint("Smoothing factor for spline interpolation (0=linear, 1=smooth)")
  @widget(new SliderWidget(0, 1, 0.01))
  private _smoothness: number = 0.5;

  @input
  @allowUndefined
  @hint("Material to apply to the 3D line mesh")
  public material: Material;

  @input("vec3", "{1, 1, 0}")
  @widget(new ColorWidget())
  public _color: vec3 = new vec3(1, 1, 0);

  @input
  @hint("Whether to cap the ends of the tube")
  public capEnds: boolean = true;

  @input
  @hint("Manual Z-axis offset to compensate for position alignment issues")
  private _zOffset: number = 0.0;

  @input
  @hint(
    "Use world position instead of local position (fixes most offset issues)"
  )
  private _useWorldPosition: boolean = true;

  @input
  @hint("Enable automatic position offset detection and correction")
  private _autoCorrectOffset: boolean = true;

  @input
  @hint(
    "Apply additional coordinate space transformation relative to this component's transform"
  )
  private _useRelativeToComponent: boolean = true;

  @input
  @hint("Debug: Show position information in console")
  private _debugPositions: boolean = false;

  @input
  @hint("Debug: Show mesh generation logs")
  private _debugLogs: boolean = false;

  @input
  @hint("Continuously update mesh based on path point positions")
  private _continuousUpdate: boolean = true;

  @input
  @hint("Update rate in seconds (higher = less frequent updates, better performance)")
  private _updateRate: number = 0.05;

  @input
  @hint("Update every frame for smooth animation (may impact performance)")
  private _smoothUpdate: boolean = true;

  @input
  @hint("Enable position smoothing to reduce jitter during animation")
  @widget(new SliderWidget(0, 1, 0.01))
  private _positionSmoothing: number = 0.3;

  // Internal state for position offset detection
  private detectedOffset: vec3 = vec3.zero();
  private offsetCalculated: boolean = false;
  private timeSinceLastUpdate: number = 0;

  // Previous positions for smooth interpolation
  private previousPathPositions: vec3[] = [];
  private currentPathPositions: vec3[] = [];
  private smoothingT: number = 1.0;

  // Property getters and setters
  get radius(): number {
    return this._radius;
  }
  set radius(value: number) {
    this._radius = value;
    this.updateMesh();
  }

  get circleSegments(): number {
    return this._circleSegments;
  }
  set circleSegments(value: number) {
    this._circleSegments = value;
    this.updateMesh();
  }

  get interpolationSteps(): number {
    return this._interpolationSteps;
  }
  set interpolationSteps(value: number) {
    this._interpolationSteps = Math.max(1, Math.floor(value));
    this.updateMesh();
  }

  get smoothness(): number {
    return this._smoothness;
  }
  set smoothness(value: number) {
    this._smoothness = Math.max(0, Math.min(1, value));
    this.updateMesh();
  }

  get color(): vec3 {
    return this._color;
  }
  set color(color: vec3) {
    this._color = color;
    this.updateMaterial();
  }

  get zOffset(): number {
    return this._zOffset;
  }
  set zOffset(value: number) {
    this._zOffset = value;
    this.updateMesh();
  }

  get useWorldPosition(): boolean {
    return this._useWorldPosition;
  }
  set useWorldPosition(value: boolean) {
    this._useWorldPosition = value;
    this.updateMesh();
  }

  get debugPositions(): boolean {
    return this._debugPositions;
  }
  set debugPositions(value: boolean) {
    this._debugPositions = value;
    this.updateMesh();
  }

  get useRelativeToComponent(): boolean {
    return this._useRelativeToComponent;
  }
  set useRelativeToComponent(value: boolean) {
    this._useRelativeToComponent = value;
    this.updateMesh();
  }

  get autoCorrectOffset(): boolean {
    return this._autoCorrectOffset;
  }
  set autoCorrectOffset(value: boolean) {
    this._autoCorrectOffset = value;
    this.resetOffsetDetection();
  }

  get smoothUpdate(): boolean {
    return this._smoothUpdate;
  }
  set smoothUpdate(value: boolean) {
    this._smoothUpdate = value;
    // Reset smooth interpolation when toggling
    this.previousPathPositions = [];
    this.currentPathPositions = [];
  }

  get positionSmoothing(): number {
    return this._positionSmoothing;
  }
  set positionSmoothing(value: number) {
    this._positionSmoothing = Math.max(0, Math.min(1, value));
  }

  get continuousUpdate(): boolean {
    return this._continuousUpdate;
  }
  set continuousUpdate(value: boolean) {
    this._continuousUpdate = value;
  }

  get updateRate(): number {
    return this._updateRate;
  }
  set updateRate(value: number) {
    this._updateRate = Math.max(0.01, value);
  }

  private _enabled = true;
  private meshVisual!: RenderMeshVisual;
  private meshBuilder!: MeshBuilder;
  private generatedMesh!: RenderMesh;

  get isEnabled(): boolean {
    return this._enabled;
  }
  set isEnabled(isEnabled: boolean) {
    this._enabled = isEnabled;
    if (this.meshVisual) this.meshVisual.enabled = isEnabled;
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }
  onStart(): void {
    if (!this.pathPoints || this.pathPoints.length < 2) {
      return;
    }
    this.setupMeshVisual();
    this.generateMesh();

    // Set up continuous update if enabled
    if (this._continuousUpdate) {
      this.createEvent("UpdateEvent").bind(() => {
        this.onUpdate();
      });
    }
  }

  onUpdate(): void {
    if (this._continuousUpdate && this.pathPoints && this.pathPoints.length >= 2) {
      if (this._smoothUpdate) {
        // Update every frame for smooth animation
        this.updateMeshSmooth();
      } else {
        // Use throttled updates for better performance
        this.timeSinceLastUpdate += getDeltaTime();
        if (this.timeSinceLastUpdate >= this._updateRate) {
          this.updateMesh();
          this.timeSinceLastUpdate = 0;
        }
      }
    }
  }

  private setupMeshVisual(): void {
    this.meshVisual = this.sceneObject.createComponent(
      "Component.RenderMeshVisual"
    );
    this.updateMaterial();
  }

  private updateMaterial(): void {
    if (this.meshVisual) {
      if (this.material) {
        this.meshVisual.mainMaterial = this.material;
        try {
          this.material.mainPass.baseColor = new vec4(
            this._color.x,
            this._color.y,
            this._color.z,
            1.0
          );
          print(
            "Line3D: Material applied successfully with color (" +
              this._color.x +
              ", " +
              this._color.y +
              ", " +
              this._color.z +
              ")"
          );
        } catch (e) {
          print("Line3D: Could not update material color - " + e);
        }
      } else {
        print(
          "Line3D: Warning - No material assigned. Please assign a material in the Inspector."
        );
      }
    }
  }

  private generateMesh(): void {
    if (!this.pathPoints || this.pathPoints.length < 2) {
      print("Line3D: Need at least 2 path points to generate mesh");
      return;
    }

    this.meshBuilder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3 },
      { name: "texture0", components: 2 },
    ]);

    this.meshBuilder.topology = MeshTopology.Triangles;
    this.meshBuilder.indexType = MeshIndexType.UInt16;

    const pathPositions = this.getPathPositions();
    if (this._debugLogs) {
      print(
        "Line3D: Generating mesh with " +
          pathPositions.length +
          " interpolated points from " +
          this.pathPoints.length +
          " control points"
      );
      print(
        "Line3D: Using " +
          (this._useWorldPosition ? "WORLD" : "LOCAL") +
          " coordinate space"
      );
      if (this._zOffset !== 0) {
        print(
          "Line3D: Applied Z-axis offset of " +
            this._zOffset +
            " to all path points"
        );
      }
    }

    this.generateTubeGeometry(pathPositions);

    if (this.meshBuilder.isValid()) {
      this.generatedMesh = this.meshBuilder.getMesh();
      this.meshVisual.mesh = this.generatedMesh;
      this.meshBuilder.updateMesh();
      this.updateMaterial();
      if (this._debugLogs) {
        print(
          "Line3D: Mesh generated successfully with " +
            this.meshBuilder.getVerticesCount() +
            " vertices"
        );
      }
    } else {
      print("Line3D: Generated mesh data is invalid");
    }
  }

  private getPathPositions(): vec3[] {
    if (this._debugPositions) {
      print("Line3D: --- Enhanced Position Debug Info ---");
      print(
        "Line3D: Using " +
          (this._useWorldPosition ? "WORLD" : "LOCAL") +
          " positions"
      );
      print("Line3D: Auto-correct offset: " + this._autoCorrectOffset);
      print(
        "Line3D: Use relative to component: " + this._useRelativeToComponent
      );
      print("Line3D: Manual Z-offset = " + this._zOffset);
    }

    // Get component's transform for relative positioning
    const componentTransform = this.getTransform();
    const componentWorldPos = componentTransform.getWorldPosition();
    const componentWorldRot = componentTransform.getWorldRotation();

    const originalPositions = this.pathPoints.map((point, index) => {
      const transform = point.getTransform();
      let pos = this._useWorldPosition
        ? transform.getWorldPosition()
        : transform.getLocalPosition();

      if (this._debugPositions) {
        const worldPos = transform.getWorldPosition();
        const localPos = transform.getLocalPosition();
        print(
          "Line3D: Point " +
            index +
            " - World: (" +
            worldPos.x.toFixed(2) +
            ", " +
            worldPos.y.toFixed(2) +
            ", " +
            worldPos.z.toFixed(2) +
            ") Local: (" +
            localPos.x.toFixed(2) +
            ", " +
            localPos.y.toFixed(2) +
            ", " +
            localPos.z.toFixed(2) +
            ")"
        );
      }

      // Apply coordinate space transformation relative to component
      if (this._useRelativeToComponent && this._useWorldPosition) {
        // Transform to component's local space
        pos = pos.sub(componentWorldPos);
        // Apply inverse rotation to align with component's coordinate system
        const invRotation = componentWorldRot.invert();
        pos = invRotation.multiplyVec3(pos);

        if (this._debugPositions) {
          print(
            "Line3D: Point " +
              index +
              " after component transform: (" +
              pos.x.toFixed(2) +
              ", " +
              pos.y.toFixed(2) +
              ", " +
              pos.z.toFixed(2) +
              ")"
          );
        }
      }

      // Apply manual offset
      pos = new vec3(pos.x, pos.y, pos.z + this._zOffset);

      // Apply automatic offset detection if enabled
      if (this._autoCorrectOffset && !this.offsetCalculated && index === 0) {
        this.calculateAutomaticOffset(pos);
      }

      return pos.add(this.detectedOffset);
    });

    // Auto-detect offset on first run
    if (this._autoCorrectOffset && !this.offsetCalculated) {
      this.offsetCalculated = true;
      if (this._debugPositions) {
        print(
          "Line3D: Auto-detected offset: (" +
            this.detectedOffset.x.toFixed(2) +
            ", " +
            this.detectedOffset.y.toFixed(2) +
            ", " +
            this.detectedOffset.z.toFixed(2) +
            ")"
        );
      }
    }

    if (originalPositions.length < 2) {
      return originalPositions;
    }

    if (originalPositions.length === 2 || this._interpolationSteps <= 1) {
      return originalPositions;
    }

    const splinePoints = this.generateSmoothSpline(originalPositions);
    return splinePoints;
  }

  private calculateAutomaticOffset(firstPosition: vec3): void {
    // When using world positions with relative-to-component transformation,
    // we usually don't need automatic offset correction as the coordinate transformation
    // already handles proper positioning
    if (this._useWorldPosition && this._useRelativeToComponent) {
      this.detectedOffset = vec3.zero();
      if (this._debugPositions) {
        print(
          "Line3D: Auto-offset disabled when using world positions with component transformation"
        );
      }
      return;
    }

    // For other cases, we can still attempt automatic offset detection
    const componentPos = this.getTransform().getWorldPosition();

    // Calculate potential offset based on the difference between first path point and component position
    const potentialOffset = componentPos.sub(firstPosition);

    // Apply more conservative heuristics to determine if this offset makes sense
    const offsetMagnitude = potentialOffset.length;

    // Be more restrictive about when to apply automatic offsets
    // Only apply if the offset is significant but not too large, and only use a small fraction
    if (offsetMagnitude > 50.0 && offsetMagnitude < 500.0) {
      // Use a much smaller fraction (2% instead of 10%) to avoid overcorrection
      this.detectedOffset = potentialOffset.uniformScale(0.02);

      if (this._debugPositions) {
        print(
          "Line3D: Auto-offset detected - Component: (" +
            componentPos.x.toFixed(2) +
            ", " +
            componentPos.y.toFixed(2) +
            ", " +
            componentPos.z.toFixed(2) +
            ") First point: (" +
            firstPosition.x.toFixed(2) +
            ", " +
            firstPosition.y.toFixed(2) +
            ", " +
            firstPosition.z.toFixed(2) +
            ") Applying conservative offset: (" +
            this.detectedOffset.x.toFixed(2) +
            ", " +
            this.detectedOffset.y.toFixed(2) +
            ", " +
            this.detectedOffset.z.toFixed(2) +
            ")"
        );
      }
    } else {
      this.detectedOffset = vec3.zero();
      if (this._debugPositions) {
        print(
          "Line3D: Auto-offset calculation - offset magnitude (" +
            offsetMagnitude.toFixed(2) +
            ") outside acceptable range (50-500), using zero offset"
        );
      }
    }
  }

  private generateSmoothSpline(controlPoints: vec3[]): vec3[] {
    const interpolatedPoints: vec3[] = [];
    interpolatedPoints.push(controlPoints[0]);

    for (let i = 0; i < controlPoints.length - 1; i++) {
      const p0 = i > 0 ? controlPoints[i - 1] : controlPoints[i];
      const p1 = controlPoints[i];
      const p2 = controlPoints[i + 1];
      const p3 =
        i < controlPoints.length - 2
          ? controlPoints[i + 2]
          : controlPoints[i + 1];

      for (let step = 1; step <= this._interpolationSteps; step++) {
        const t = step / this._interpolationSteps;
        const interpolatedPoint = this.catmullRomSpline(
          p0,
          p1,
          p2,
          p3,
          t,
          this._smoothness
        );
        interpolatedPoints.push(interpolatedPoint);
      }
    }

    if (this._debugLogs) {
      print(
        "Line3D: Generated " +
          interpolatedPoints.length +
          " interpolated points from " +
          controlPoints.length +
          " control points"
      );
    }
    return interpolatedPoints;
  }

  private catmullRomSpline(
    p0: vec3,
    p1: vec3,
    p2: vec3,
    p3: vec3,
    t: number,
    tension: number
  ): vec3 {
    const t2 = t * t;
    const t3 = t2 * t;
    const tensionFactor = tension * 0.5;

    const v0 = p2.sub(p0).uniformScale(tensionFactor);
    const v1 = p3.sub(p1).uniformScale(tensionFactor);

    const a = p1.uniformScale(2).sub(p2.uniformScale(2)).add(v0).add(v1);
    const b = p2
      .uniformScale(3)
      .sub(p1.uniformScale(3))
      .sub(v0.uniformScale(2))
      .sub(v1);
    const c = v0;
    const d = p1;

    return a
      .uniformScale(t3)
      .add(b.uniformScale(t2))
      .add(c.uniformScale(t))
      .add(d);
  }

  private generateTubeGeometry(pathPositions: vec3[]): void {
    const pathLength = pathPositions.length;

    // Calculate forward vectors for all segments
    const forwards: vec3[] = [];
    for (let i = 0; i < pathLength; i++) {
      let forward: vec3;

      if (i === 0) {
        forward = pathPositions[1].sub(pathPositions[0]).normalize();
      } else if (i === pathLength - 1) {
        forward = pathPositions[i].sub(pathPositions[i - 1]).normalize();
      } else {
        forward = pathPositions[i + 1].sub(pathPositions[i - 1]).normalize();
      }

      forwards.push(forward);
    }

    // Compute rotation-minimizing frames for smooth tube
    const frames = this.computeRotationMinimizingFrames(forwards);

    for (let i = 0; i < pathLength; i++) {
      this.generateCircleVertices(
        pathPositions[i],
        frames[i].right,
        frames[i].up,
        i / (pathLength - 1)
      );
    }

    this.generateTubeIndices(pathLength);

    if (this.capEnds) {
      this.generateEndCaps(pathPositions);
    }
  }

  private computeRotationMinimizingFrames(forwards: vec3[]): Array<{right: vec3, up: vec3}> {
    const frames: Array<{right: vec3, up: vec3}> = [];

    // Initialize first frame
    const worldUp = vec3.up();
    const worldRight = vec3.right();
    const firstForward = forwards[0];

    let right: vec3;
    let up: vec3;

    const forwardDotUp = Math.abs(firstForward.dot(worldUp));

    if (forwardDotUp > 0.99) {
      right = worldRight;
      up = firstForward.cross(right).normalize();
    } else {
      right = firstForward.cross(worldUp).normalize();
      up = right.cross(firstForward).normalize();
    }

    frames.push({ right, up });

    // Propagate frames using parallel transport (rotation minimizing)
    for (let i = 1; i < forwards.length; i++) {
      const prevForward = forwards[i - 1];
      const currForward = forwards[i];
      const prevRight = frames[i - 1].right;
      const prevUp = frames[i - 1].up;

      // Calculate the rotation axis and angle between consecutive forward vectors
      const angle = Math.acos(Math.max(-1, Math.min(1, prevForward.dot(currForward))));

      // If the angle is very small, just use the previous frame
      if (angle < 0.001) {
        frames.push({ right: prevRight, up: prevUp });
        continue;
      }

      // Rotation axis
      const axis = prevForward.cross(currForward).normalize();

      // Check if axis is valid
      if (isNaN(axis.x) || isNaN(axis.y) || isNaN(axis.z)) {
        frames.push({ right: prevRight, up: prevUp });
        continue;
      }

      // Rotate the previous right and up vectors around the axis
      const newRight = this.rotateVectorAroundAxis(prevRight, axis, angle);
      const newUp = this.rotateVectorAroundAxis(prevUp, axis, angle);

      frames.push({
        right: newRight.normalize(),
        up: newUp.normalize()
      });
    }

    return frames;
  }

  private rotateVectorAroundAxis(v: vec3, axis: vec3, angle: number): vec3 {
    // Rodrigues' rotation formula
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    const term1 = v.uniformScale(cosAngle);
    const term2 = axis.cross(v).uniformScale(sinAngle);
    const term3 = axis.uniformScale(axis.dot(v) * (1 - cosAngle));

    return term1.add(term2).add(term3);
  }

  private generateCircleVertices(
    center: vec3,
    right: vec3,
    up: vec3,
    vCoord: number
  ): void {
    for (let i = 0; i < this._circleSegments; i++) {
      const angle = (i / this._circleSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const localPos = right
        .uniformScale(cos * this._radius)
        .add(up.uniformScale(sin * this._radius));
      const worldPos = center.add(localPos);
      const normal = localPos.normalize();
      const uCoord = i / this._circleSegments;

      this.meshBuilder.appendVerticesInterleaved([
        worldPos.x,
        worldPos.y,
        worldPos.z,
        normal.x,
        normal.y,
        normal.z,
        uCoord,
        vCoord,
      ]);
    }
  }

  private generateTubeIndices(pathLength: number): void {
    for (let segment = 0; segment < pathLength - 1; segment++) {
      for (let i = 0; i < this._circleSegments; i++) {
        const current = segment * this._circleSegments + i;
        const next =
          segment * this._circleSegments + ((i + 1) % this._circleSegments);
        const currentNext = (segment + 1) * this._circleSegments + i;
        const nextNext =
          (segment + 1) * this._circleSegments +
          ((i + 1) % this._circleSegments);

        this.meshBuilder.appendIndices([
          current,
          currentNext,
          next,
          next,
          currentNext,
          nextNext,
        ]);
      }
    }
  }

  private generateEndCaps(pathPositions: vec3[]): void {
    const pathLength = pathPositions.length;
    const startVertexOffset = pathLength * this._circleSegments;

    // Start cap
    const startPos = pathPositions[0];
    const startForward = pathPositions[1].sub(pathPositions[0]).normalize();

    this.meshBuilder.appendVerticesInterleaved([
      startPos.x,
      startPos.y,
      startPos.z,
      -startForward.x,
      -startForward.y,
      -startForward.z,
      0.5,
      0.5,
    ]);

    for (let i = 0; i < this._circleSegments; i++) {
      const current = i;
      const next = (i + 1) % this._circleSegments;
      this.meshBuilder.appendIndices([startVertexOffset, next, current]);
    }

    // End cap
    const endPos = pathPositions[pathLength - 1];
    const endForward = pathPositions[pathLength - 1]
      .sub(pathPositions[pathLength - 2])
      .normalize();

    this.meshBuilder.appendVerticesInterleaved([
      endPos.x,
      endPos.y,
      endPos.z,
      endForward.x,
      endForward.y,
      endForward.z,
      0.5,
      0.5,
    ]);

    const endCenterIndex = startVertexOffset + 1;
    const endCapOffset = (pathLength - 1) * this._circleSegments;

    for (let i = 0; i < this._circleSegments; i++) {
      const current = endCapOffset + i;
      const next = endCapOffset + ((i + 1) % this._circleSegments);
      this.meshBuilder.appendIndices([endCenterIndex, current, next]);
    }
  }

  public updateMesh(): void {
    if (this.meshVisual && this.pathPoints && this.pathPoints.length >= 2) {
      this.generateMesh();
    }
  }

  private updateMeshSmooth(): void {
    if (!this.meshVisual || !this.pathPoints || this.pathPoints.length < 2) {
      return;
    }

    // Get target positions
    const targetPositions = this.getPathPositions();

    // Initialize previous positions on first run
    if (this.previousPathPositions.length === 0) {
      this.previousPathPositions = targetPositions.map(p => new vec3(p.x, p.y, p.z));
      this.currentPathPositions = targetPositions.map(p => new vec3(p.x, p.y, p.z));
      this.generateMesh();
      return;
    }

    // Check if we need to rebuild mesh (control point count changed)
    if (targetPositions.length !== this.currentPathPositions.length) {
      this.previousPathPositions = targetPositions.map(p => new vec3(p.x, p.y, p.z));
      this.currentPathPositions = targetPositions.map(p => new vec3(p.x, p.y, p.z));
      this.generateMesh();
      return;
    }

    // Smooth interpolation between previous and target positions
    const smoothingFactor = Math.min(1.0, this._positionSmoothing);
    for (let i = 0; i < targetPositions.length; i++) {
      this.currentPathPositions[i] = vec3.lerp(
        this.currentPathPositions[i],
        targetPositions[i],
        1.0 - smoothingFactor
      );
    }

    // Update mesh with smoothed positions
    this.updateMeshGeometry(this.currentPathPositions);
  }

  private updateMeshGeometry(pathPositions: vec3[]): void {
    if (!this.meshBuilder || !this.generatedMesh) {
      // First time - need full mesh generation
      this.generateMesh();
      return;
    }

    // Rebuild mesh with new positions (keeping same topology)
    this.meshBuilder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3 },
      { name: "texture0", components: 2 },
    ]);

    this.meshBuilder.topology = MeshTopology.Triangles;
    this.meshBuilder.indexType = MeshIndexType.UInt16;

    this.generateTubeGeometry(pathPositions);

    if (this.meshBuilder.isValid()) {
      // Get new mesh data and update the visual
      this.generatedMesh = this.meshBuilder.getMesh();
      this.meshVisual.mesh = this.generatedMesh;
      this.meshBuilder.updateMesh();
    }
  }

  public refreshPath(): void {
    this.updateMesh();
  }

  public forceRefresh(): void {
    print("Line3D: Force refreshing mesh...");
    this.generateMesh();
  }

  public setTestPositions(): void {
    const testPositions = [
      new vec3(0, 0, 0), // Start
      new vec3(40, 20, -30), // Curve up and right
      new vec3(10, 60, -80), // Curve left and up
      new vec3(-30, 30, -120), // Curve left and down
      new vec3(20, 10, -160), // End right and down
    ];

    print(
      "Line3D: Setting spline test positions for smooth curve visualization"
    );
    print(
      "Line3D: Interpolation steps = " +
        this._interpolationSteps +
        ", Smoothness = " +
        this._smoothness
    );

    for (let i = 0; i < testPositions.length; i++) {
      print(
        "Line3D: Control point " +
          i +
          ": (" +
          testPositions[i].x +
          ", " +
          testPositions[i].y +
          ", " +
          testPositions[i].z +
          ")"
      );
    }

    if (this.pathPoints.length < testPositions.length) {
      print(
        "Line3D Warning: Not enough pathPoints (" +
          this.pathPoints.length +
          ") for all test positions (" +
          testPositions.length +
          "). Consider adding more cubes."
      );
    }

    for (
      let i = 0;
      i < Math.min(this.pathPoints.length, testPositions.length);
      i++
    ) {
      if (this.pathPoints[i] && this.pathPoints[i].getTransform()) {
        this.pathPoints[i].getTransform().setWorldPosition(testPositions[i]);
      }
    }

    this.updateMesh();
  }

  // Enhanced debugging and diagnostic methods
  public resetOffsetDetection(): void {
    this.offsetCalculated = false;
    this.detectedOffset = vec3.zero();
    print(
      "Line3D: Offset detection reset. Will recalculate on next mesh generation."
    );
    this.updateMesh();
  }

  public testPositionModes(): void {
    print("Line3D: === Testing Different Position Modes ===");

    // Test world positions
    print("Line3D: Testing WORLD positions...");
    this._useWorldPosition = true;
    this._useRelativeToComponent = false;
    this.resetOffsetDetection();

    // Test local positions
    print("Line3D: Testing LOCAL positions...");
    this._useWorldPosition = false;
    this._useRelativeToComponent = false;
    this.resetOffsetDetection();

    // Test world positions with component relative
    print("Line3D: Testing WORLD positions with component transformation...");
    this._useWorldPosition = true;
    this._useRelativeToComponent = true;
    this.resetOffsetDetection();
  }

  public setManualOffset(offset: vec3): void {
    this.detectedOffset = offset;
    this.offsetCalculated = true;
    print(
      "Line3D: Manual offset set to (" +
        offset.x +
        ", " +
        offset.y +
        ", " +
        offset.z +
        ")"
    );
    this.updateMesh();
  }

  public getPositionDiagnostics(): string {
    let diagnostics = "Line3D Position Diagnostics:\n";
    diagnostics += "- Use World Position: " + this._useWorldPosition + "\n";
    diagnostics +=
      "- Use Relative to Component: " + this._useRelativeToComponent + "\n";
    diagnostics += "- Auto Correct Offset: " + this._autoCorrectOffset + "\n";
    diagnostics += "- Manual Z Offset: " + this._zOffset + "\n";
    diagnostics +=
      "- Detected Offset: (" +
      this.detectedOffset.x.toFixed(2) +
      ", " +
      this.detectedOffset.y.toFixed(2) +
      ", " +
      this.detectedOffset.z.toFixed(2) +
      ")\n";
    diagnostics += "- Offset Calculated: " + this.offsetCalculated + "\n";

    if (this.pathPoints && this.pathPoints.length > 0) {
      diagnostics +=
        "- Number of Path Points: " + this.pathPoints.length + "\n";
      const firstPoint = this.pathPoints[0].getTransform();
      const worldPos = firstPoint.getWorldPosition();
      const localPos = firstPoint.getLocalPosition();
      diagnostics +=
        "- First Point World: (" +
        worldPos.x.toFixed(2) +
        ", " +
        worldPos.y.toFixed(2) +
        ", " +
        worldPos.z.toFixed(2) +
        ")\n";
      diagnostics +=
        "- First Point Local: (" +
        localPos.x.toFixed(2) +
        ", " +
        localPos.y.toFixed(2) +
        ", " +
        localPos.z.toFixed(2) +
        ")\n";
    }

    return diagnostics;
  }
}