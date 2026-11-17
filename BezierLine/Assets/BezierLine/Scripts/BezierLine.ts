/**
 * BezierLine
 * Thick, camera-facing cubic Bézier ribbon built in the mesh object's LOCAL space,
 * with Inspector UI to choose control axes & offsets per-end (world or local space).
 *
 * Standalone version of the Whiteboard connector script
 * (specs-whiteboard: Whiteboard/Assets/Scripts/Bezier/BezierLine.ts).
 * It has no external imports and no prefab dependency: add the component to a
 * scene object that has a RenderMeshVisual, or create one at runtime with
 * `BezierLine.createBezierLine()`. Object inputs are marked `@allowUndefined` so the
 * component can be created from code and wired afterwards.
 */

type AxisString = "X" | "Y" | "Z";

@component
export class BezierLine extends BaseScriptComponent {
    /**
     * Creates a ready-to-use BezierLine at runtime without a prefab.
     *
     * A new scene object named "BezierLine" is created under `parent` with a
     * RenderMeshVisual (rendered with `material`) and a BezierLine component
     * wired to it. Pass `start` / `end` to connect immediately, or call
     * `setEndpoints()` later.
     */
    public static createBezierLine(parent: SceneObject, material: Material, start?: SceneObject, end?: SceneObject): BezierLine {
        const lineObject = global.scene.createSceneObject("BezierLine");
        if (parent) {
            lineObject.setParent(parent);
        }

        const meshVisual = lineObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        if (material) {
            meshVisual.mainMaterial = material;
        }

        const line = lineObject.createComponent(BezierLine.getTypeName()) as BezierLine;
        line.meshVisual = meshVisual;
        if (start && end) {
            line.setEndpoints(start, end);
        }
        return line;
    }

    // ── Inputs ─────────────────────────────────────────────────────────────────

    // Mesh + anchors
    @input
    @allowUndefined
    meshVisual: RenderMeshVisual;

    @input
    @allowUndefined
    start: SceneObject;

    @input
    @allowUndefined
    end: SceneObject;

    // Control sources (choose: objects OR param sliders)
    @input("bool", "Use Control Objects?")
    useCtrlObjects: boolean = false;

    @input
    @showIf("useCtrlObjects")
    @allowUndefined
    startCtrl: SceneObject;

    @input
    @showIf("useCtrlObjects")
    @allowUndefined
    endCtrl: SceneObject;

    // Axis/offset params (shown when not using control objects)
    @input("bool", "Axis in Local Space")
    @showIf("useCtrlObjects", false)
    axisUseLocal: boolean = true;

    // Start handle
    @input("string")
    @label("Start Axis")
    @widget(new ComboBoxWidget([
        new ComboBoxItem("X", "X"),
        new ComboBoxItem("Y", "Y"),
        new ComboBoxItem("Z", "Z")
    ]))
    @showIf("useCtrlObjects", false)
    startAxis: string = "Z";

    @input("float")
    @label("Start Offset")
    @widget(new SliderWidget(-30, 30, 0.01))
    @showIf("useCtrlObjects", false)
    startCtrlOffset: number = 0.0;

    // End handle
    @input("string")
    @label("End Axis")
    @widget(new ComboBoxWidget([
        new ComboBoxItem("X", "X"),
        new ComboBoxItem("Y", "Y"),
        new ComboBoxItem("Z", "Z")
    ]))
    @showIf("useCtrlObjects", false)
    endAxis: string = "Z";

    @input("float")
    @label("End Offset")
    @widget(new SliderWidget(-30, 30, 0.01))
    @showIf("useCtrlObjects", false)
    endCtrlOffset: number = 0.0;

    @input("float")
    @label("Start Attach Offset")
    @widget(new SliderWidget(-10, 10, 0.01))
    startAttachOffset: number = 0.0;

    @input("float")
    @label("End Attach Offset")
    @widget(new SliderWidget(-10, 10, 0.01))
    endAttachOffset: number = 0.0;

    // Thickness / smoothness
    @input("float")
    @label("Width")
    @widget(new SliderWidget(0.01, 2, 0.001))
    width: number = 1;

    @input("int")
    @label("Segments")
    @widget(new SliderWidget(2, 128, 1))
    segments: number = 32;

    // Facing
    @input("bool")
    @label("Face Camera")
    faceCamera: boolean = true;

    @input
    @allowUndefined
    camera: Camera;

    // Debug
    @input("bool", "Draw curve & points")
    debugDraw: boolean = false;

    @input("bool", "Log mesh stats")
    debugLog: boolean = false;

    // ── Internals ──────────────────────────────────────────────────────────────

    private builder: MeshBuilder | null = null;
    private meshApplied: boolean = false;

    // Change detection cache
    private lastStartPos: vec3 | null = null;
    private lastStartRot: quat | null = null;
    private lastEndPos: vec3 | null = null;
    private lastEndRot: quat | null = null;
    private lastStartCtrlPos: vec3 | null = null;
    private lastEndCtrlPos: vec3 | null = null;

    private lastCamBackX: number = 0;
    private lastCamBackY: number = 0;
    private lastCamBackZ: number = 0;
    private hasLastCamBack: boolean = false;
    private lastFacingRebuildTime: number = 0;

    // Transform cache — avoids getTransform() overhead every frame
    private startTransform: Transform | null = null;
    private endTransform: Transform | null = null;
    private startCtrlTransform: Transform | null = null;
    private endCtrlTransform: Transform | null = null;
    private cameraTransform: Transform | null = null;
    private meshTransform: Transform | null = null;

    // Pre-allocated scratch buffers — reused every rebuild to avoid per-frame allocations
    private readonly _vtxBuf: number[] = [0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0];
    private readonly _idxBuf: number[] = [0,0,0,0,0,0];

    private static readonly MAX_HANDLE_SPAN_FRACTION: number = 0.5;

    private static readonly FACING_DOT_THRESHOLD: number = 0.99966;
    private static readonly FACING_REBUILD_MIN_INTERVAL: number = 0.1;

    // Static debug colors — allocated once, never recreated
    private static readonly _dbgCCurve = new vec4(0, 1, 1, 1);
    private static readonly _dbgCP0    = new vec4(0, 1, 0, 1);
    private static readonly _dbgCP1    = new vec4(1, 0.65, 0, 1);
    private static readonly _dbgCP2    = new vec4(1, 0.65, 0, 1);
    private static readonly _dbgCP3    = new vec4(1, 0, 0, 1);

    onAwake(): void {
        if (this.start) this.startTransform = this.start.getTransform();
        if (this.end) this.endTransform = this.end.getTransform();
        if (this.startCtrl) this.startCtrlTransform = this.startCtrl.getTransform();
        if (this.endCtrl) this.endCtrlTransform = this.endCtrl.getTransform();
        if (this.meshVisual) this.meshTransform = this.meshVisual.getSceneObject().getTransform();
        this.createEvent("LateUpdateEvent").bind(this.onLateUpdate.bind(this));
    }

    private onLateUpdate(): void {
        if (!this.start || !this.end) {
            return;
        }
        if (this.hasTransformChanged() || this.hasFacingChanged()) {
            this.rebuild();
        }
    }

    private hasFacingChanged(): boolean {
        if (!this.faceCamera || !this.camera) {
            return false;
        }
        if (!this.hasLastCamBack) {
            return true;
        }
        if (getTime() - this.lastFacingRebuildTime < BezierLine.FACING_REBUILD_MIN_INTERVAL) {
            return false;
        }
        if (!this.cameraTransform) this.cameraTransform = this.camera.getSceneObject().getTransform();
        const camBack = this.cameraTransform.back;
        const dot = camBack.x * this.lastCamBackX + camBack.y * this.lastCamBackY + camBack.z * this.lastCamBackZ;
        return dot < BezierLine.FACING_DOT_THRESHOLD;
    }

    private hasTransformChanged(): boolean {
        if (!this.start || !this.end) {
            return false;
        }

        if (!this.startTransform) this.startTransform = this.start.getTransform();
        if (!this.endTransform) this.endTransform = this.end.getTransform();

        let changed = false;
        const epsilon = 0.0001;

        // Check start transform
        const startPos = this.startTransform.getWorldPosition();
        const startRot = this.startTransform.getWorldRotation();

        if (!this.lastStartPos || !this.positionsEqual(startPos, this.lastStartPos, epsilon)) {
            this.lastStartPos = startPos;
            changed = true;
        }
        if (!this.lastStartRot || !this.rotationsEqual(startRot, this.lastStartRot, epsilon)) {
            this.lastStartRot = startRot;
            changed = true;
        }

        // Check end transform
        const endPos = this.endTransform.getWorldPosition();
        const endRot = this.endTransform.getWorldRotation();

        if (!this.lastEndPos || !this.positionsEqual(endPos, this.lastEndPos, epsilon)) {
            this.lastEndPos = endPos;
            changed = true;
        }
        if (!this.lastEndRot || !this.rotationsEqual(endRot, this.lastEndRot, epsilon)) {
            this.lastEndRot = endRot;
            changed = true;
        }

        // Check control objects if using them
        if (this.useCtrlObjects) {
            if (this.startCtrl) {
                if (!this.startCtrlTransform) this.startCtrlTransform = this.startCtrl.getTransform();
                const startCtrlPos = this.startCtrlTransform.getWorldPosition();
                if (!this.lastStartCtrlPos || !this.positionsEqual(startCtrlPos, this.lastStartCtrlPos, epsilon)) {
                    this.lastStartCtrlPos = startCtrlPos;
                    changed = true;
                }
            }
            if (this.endCtrl) {
                if (!this.endCtrlTransform) this.endCtrlTransform = this.endCtrl.getTransform();
                const endCtrlPos = this.endCtrlTransform.getWorldPosition();
                if (!this.lastEndCtrlPos || !this.positionsEqual(endCtrlPos, this.lastEndCtrlPos, epsilon)) {
                    this.lastEndCtrlPos = endCtrlPos;
                    changed = true;
                }
            }
        }

        return changed;
    }

    private positionsEqual(a: vec3, b: vec3, epsilon: number): boolean {
        return Math.abs(a.x - b.x) < epsilon &&
               Math.abs(a.y - b.y) < epsilon &&
               Math.abs(a.z - b.z) < epsilon;
    }

    private rotationsEqual(a: quat, b: quat, epsilon: number): boolean {
        return Math.abs(a.x - b.x) < epsilon &&
               Math.abs(a.y - b.y) < epsilon &&
               Math.abs(a.z - b.z) < epsilon &&
               Math.abs(a.w - b.w) < epsilon;
    }

    // ── Helper Methods ─────────────────────────────────────────────────────────

    private ensureBuilder(): void {
        if (!this.builder) {
            this.builder = new MeshBuilder([
                { name: "position", components: 3 },
                { name: "normal", components: 3 },
                { name: "texture0", components: 2 }
            ]);
            this.builder.topology = MeshTopology.Triangles;
            this.builder.indexType = MeshIndexType.UInt16;
        } else {
            // Clear previous data
            const vc = this.builder.getVerticesCount();
            if (vc > 0) this.builder.eraseVertices(0, vc);
            const ic = this.builder.getIndicesCount();
            if (ic > 0) this.builder.eraseIndices(0, ic);
        }
    }

    private axisFromStringWorld(axis: string): vec3 {
        if (axis === "X") return vec3.right();
        if (axis === "Y") return vec3.up();
        return vec3.forward(); // "Z"
    }

    private axisFromTransformLocal(t: Transform, axis: string): vec3 {
        // Returns WORLD direction of t's local axis
        if (axis === "X") return t.right;
        if (axis === "Y") return t.up;
        return t.forward; // "Z"
    }

    private computeControlPoints(tStart: Transform, tEnd: Transform): { p0: vec3; p1: vec3; p2: vec3; p3: vec3 } {
        let p0 = tStart.getWorldPosition();
        let p3 = tEnd.getWorldPosition();

        if (this.useCtrlObjects && this.startCtrl && this.endCtrl) {
            if (!this.startCtrlTransform) this.startCtrlTransform = this.startCtrl.getTransform();
            if (!this.endCtrlTransform) this.endCtrlTransform = this.endCtrl.getTransform();
            return {
                p0,
                p1: this.startCtrlTransform.getWorldPosition(),
                p2: this.endCtrlTransform.getWorldPosition(),
                p3
            };
        }

        const aStartW = (this.axisUseLocal
            ? this.axisFromTransformLocal(tStart, this.startAxis)
            : this.axisFromStringWorld(this.startAxis)
        ).normalize();

        const aEndW = (this.axisUseLocal
            ? this.axisFromTransformLocal(tEnd, this.endAxis)
            : this.axisFromStringWorld(this.endAxis)
        ).normalize();

        if (this.startAttachOffset !== 0) {
            p0 = p0.add(aStartW.uniformScale(this.startAttachOffset));
        }
        if (this.endAttachOffset !== 0) {
            p3 = p3.add(aEndW.uniformScale(this.endAttachOffset));
        }

        // Handles are capped by how far apart the ends are.
        const maxHandle = p3.distance(p0) * BezierLine.MAX_HANDLE_SPAN_FRACTION;

        return {
            p0,
            p1: p0.add(aStartW.uniformScale(BezierLine.clampHandle(this.startCtrlOffset, maxHandle))),
            p2: p3.add(aEndW.uniformScale(BezierLine.clampHandle(this.endCtrlOffset, maxHandle))),
            p3
        };
    }

    /** Shortens a handle offset to `maxHandle` cm, keeping the direction it points. */
    private static clampHandle(ctrlOffset: number, maxHandle: number): number {
        return Math.sign(ctrlOffset) * Math.min(Math.abs(ctrlOffset), maxHandle);
    }

    /**
     * Cubic Bézier: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
     */
    private bezier(p0: vec3, p1: vec3, p2: vec3, p3: vec3, t: number): vec3 {
        const u = 1.0 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        return p0.uniformScale(uuu)
            .add(p1.uniformScale(3 * uu * t))
            .add(p2.uniformScale(3 * u * tt))
            .add(p3.uniformScale(ttt));
    }

    /**
     * Cubic Bézier tangent (first derivative)
     */
    private bezierTangent(p0: vec3, p1: vec3, p2: vec3, p3: vec3, t: number): vec3 {
        const u = 1.0 - t;
        const term1 = p1.sub(p0).uniformScale(u * u);
        const term2 = p2.sub(p1).uniformScale(2 * u * t);
        const term3 = p3.sub(p2).uniformScale(t * t);
        return term1.add(term2).add(term3).uniformScale(3.0);
    }

    // ── Main Rebuild ───────────────────────────────────────────────────────────

    private rebuild(): void {
        if (!this.meshVisual || !this.start || !this.end) {
            if (this.debugLog) print("[BezierRibbon] Assign meshVisual/start/end");
            return;
        }

        this.ensureBuilder();

        if (!this.meshTransform) this.meshTransform = this.meshVisual.getSceneObject().getTransform();

        // Endpoints (world)
        if (!this.startTransform) this.startTransform = this.start.getTransform();
        if (!this.endTransform) this.endTransform = this.end.getTransform();
        const tStart = this.startTransform;
        const tEnd = this.endTransform;

        // Endpoints + control points (world)
        const ctrl = this.computeControlPoints(tStart, tEnd);
        const p0W = ctrl.p0;
        const p1W = ctrl.p1;
        const p2W = ctrl.p2;
        const p3W = ctrl.p3;

        // Place mesh at curve midpoint — bezier(t=0.5) inlined: coeffs are 0.125, 0.375, 0.375, 0.125
        this.meshTransform.setWorldPosition(new vec3(
            p0W.x * 0.125 + p1W.x * 0.375 + p2W.x * 0.375 + p3W.x * 0.125,
            p0W.y * 0.125 + p1W.y * 0.375 + p2W.y * 0.375 + p3W.y * 0.125,
            p0W.z * 0.125 + p1W.z * 0.375 + p2W.z * 0.375 + p3W.z * 0.125
        ));

        // Mesh owner (local space we build into) — computed AFTER mesh is repositioned
        const invWorld = this.meshTransform.getInvertedWorldTransform();
        const toLocalPoint = (pW: vec3): vec3 => invWorld.multiplyPoint(pW);
        const toLocalDir   = (dW: vec3): vec3 => invWorld.multiplyDirection(dW).normalize();

        // Convert all control points to mesh local space
        const p0 = toLocalPoint(p0W);
        const p1 = toLocalPoint(p1W);
        const p2 = toLocalPoint(p2W);
        const p3 = toLocalPoint(p3W);

        // Choose facing vector in local space
        let viewRefL = vec3.up();
        if (this.faceCamera && this.camera) {
            if (!this.cameraTransform) this.cameraTransform = this.camera.getSceneObject().getTransform();
            const camBack = this.cameraTransform.back;
            this.lastCamBackX = camBack.x;
            this.lastCamBackY = camBack.y;
            this.lastCamBackZ = camBack.z;
            this.hasLastCamBack = true;
            this.lastFacingRebuildTime = getTime();
            viewRefL = toLocalDir(camBack);
        }

        // Pre-extract scalars — all loop math runs allocation-free from here
        const p0x = p0.x, p0y = p0.y, p0z = p0.z;
        const p1x = p1.x, p1y = p1.y, p1z = p1.z;
        const p2x = p2.x, p2y = p2.y, p2z = p2.z;
        const p3x = p3.x, p3y = p3.y, p3z = p3.z;
        const vrx = viewRefL.x, vry = viewRefL.y, vrz = viewRefL.z;
        const halfWidth = this.width * 0.5;
        const invSeg = 1.0 / this.segments;

        // Only allocate debug structures when debug is actually on
        const debugDraw = this.debugDraw;
        const ptsDebugPairsW: vec3[] = debugDraw ? [] : null;
        const worldMat = debugDraw ? this.meshTransform.getWorldTransform() : null;
        let prevPosW: vec3 | null = null;

        const v = this._vtxBuf;
        const b = this._idxBuf;
        let idx = 0;

        for (let i = 0; i <= this.segments; i++) {
            const t = i * invSeg;
            const u = 1.0 - t;
            const uu = u * u;
            const tt = t * t;
            const uuu = uu * u;
            const ttt = tt * t;
            const w1 = 3.0 * uu * t;
            const w2 = 3.0 * u * tt;

            // Bezier position (inlined — no vec3 allocation)
            const px = p0x * uuu + p1x * w1 + p2x * w2 + p3x * ttt;
            const py = p0y * uuu + p1y * w1 + p2y * w2 + p3y * ttt;
            const pz = p0z * uuu + p1z * w1 + p2z * w2 + p3z * ttt;

            // Bezier tangent (first derivative, inlined)
            const d1 = 3.0 * uu, d2 = 6.0 * u * t, d3 = 3.0 * tt;
            let tx = d1 * (p1x - p0x) + d2 * (p2x - p1x) + d3 * (p3x - p2x);
            let ty = d1 * (p1y - p0y) + d2 * (p2y - p1y) + d3 * (p3y - p2y);
            let tz = d1 * (p1z - p0z) + d2 * (p2z - p1z) + d3 * (p3z - p2z);
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 1e-10) { tx /= tLen; ty /= tLen; tz /= tLen; }

            // Side = tangent × viewRef (scalar cross product)
            let sx = ty * vrz - tz * vry;
            let sy = tz * vrx - tx * vrz;
            let sz = tx * vry - ty * vrx;
            let sLen = Math.sqrt(sx * sx + sy * sy + sz * sz);
            if (sLen < 1e-5) {
                // Fallback: tangent × right(1,0,0) → (0, tz, -ty)
                sx = 0.0; sy = tz; sz = -ty;
                sLen = Math.sqrt(sy * sy + sz * sz);
                if (sLen < 1e-5) {
                    // Fallback: tangent × forward(0,0,-1) → (-ty, tx, 0)
                    sx = -ty; sy = tx; sz = 0.0;
                    sLen = Math.sqrt(sx * sx + sy * sy);
                }
            }
            const invSLen = halfWidth / (sLen > 1e-10 ? sLen : 1e-10);
            sx *= invSLen; sy *= invSLen; sz *= invSLen;

            // Left and right vertex positions
            const lx = px - sx, ly = py - sy, lz = pz - sz;
            const rx = px + sx, ry = py + sy, rz = pz + sz;

            // Normal = unitSide × tangent.
            // unitSide ⊥ tangent (cross product property), both unit → result is already unit, no sqrt needed.
            const invHW = 1.0 / halfWidth;
            const usx = sx * invHW, usy = sy * invHW, usz = sz * invHW;
            const nx = usy * tz - usz * ty;
            const ny = usz * tx - usx * tz;
            const nz = usx * ty - usy * tx;

            // Write into pre-allocated vertex buffer (no new array each iteration)
            v[0]  = lx; v[1]  = ly; v[2]  = lz; v[3]  = nx; v[4]  = ny; v[5]  = nz; v[6]  = 0.0; v[7]  = t;
            v[8]  = rx; v[9]  = ry; v[10] = rz; v[11] = nx; v[12] = ny; v[13] = nz; v[14] = 1.0; v[15] = t;
            this.builder!.appendVerticesInterleaved(v);

            if (i > 0) {
                b[0] = idx - 2; b[1] = idx;     b[2] = idx + 1;
                b[3] = idx - 2; b[4] = idx + 1; b[5] = idx - 1;
                this.builder!.appendIndices(b);
            }
            idx += 2;

            if (debugDraw) {
                const posW = worldMat.multiplyPoint(new vec3(px, py, pz));
                if (prevPosW) ptsDebugPairsW.push(prevPosW, posW);
                prevPosW = posW;
            }
        }

        if (!this.meshApplied) {
            if (this.builder!.isValid()) {
                this.meshVisual.mesh = this.builder!.getMesh();
                this.meshApplied = true;
            } else if (this.debugLog) {
                print("[BezierRibbon] Mesh invalid on first build");
            }
        }
        this.builder!.updateMesh();

        if (this.debugLog) {
            print(`[BezierRibbon] verts=${this.builder!.getVerticesCount()} idx=${this.builder!.getIndicesCount()}`);
        }

        if (debugDraw && global.debugRenderSystem) {
            if (ptsDebugPairsW.length >= 2) {
                (global.debugRenderSystem as any).drawBrokenLine(ptsDebugPairsW, BezierLine._dbgCCurve);
            }
            const r = Math.max(0.005, this.width * 0.75);
            (global.debugRenderSystem as any).drawSolidSphere(p0W, r, BezierLine._dbgCP0);
            (global.debugRenderSystem as any).drawSolidSphere(p1W, r, BezierLine._dbgCP1);
            (global.debugRenderSystem as any).drawSolidSphere(p2W, r, BezierLine._dbgCP2);
            (global.debugRenderSystem as any).drawSolidSphere(p3W, r, BezierLine._dbgCP3);
            (global.debugRenderSystem as any).drawLine(p0W, p1W, BezierLine._dbgCP1);
            (global.debugRenderSystem as any).drawLine(p3W, p2W, BezierLine._dbgCP2);
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Get a point on the bezier curve at parameter t (0-1).
     */
    public getPointAtT(t: number): vec3 | null {
        if (!this.start || !this.end) return null;

        const ctrl = this.computeControlPoints(this.start.getTransform(), this.end.getTransform());
        return this.bezier(ctrl.p0, ctrl.p1, ctrl.p2, ctrl.p3, t);
    }

    /**
     * Get the tangent direction at parameter t (0-1).
     */
    public getTangentAtT(t: number): vec3 | null {
        if (!this.start || !this.end) return null;

        const ctrl = this.computeControlPoints(this.start.getTransform(), this.end.getTransform());
        return this.bezierTangent(ctrl.p0, ctrl.p1, ctrl.p2, ctrl.p3, t).normalize();
    }

    /**
     * Mark the line as needing a rebuild on next update.
     * Call this when changing properties like width, segments, or offsets.
     */
    public markDirty(): void {
        this.lastStartPos = null;
        this.lastStartRot = null;
        this.lastEndPos = null;
        this.lastEndRot = null;
        this.lastStartCtrlPos = null;
        this.lastEndCtrlPos = null;
        this.hasLastCamBack = false;
    }

    /**
     * Force an immediate rebuild regardless of change detection.
     */
    public forceRebuild(): void {
        this.rebuild();
    }

    /**
     * Set the start and end points programmatically.
     */
    public setEndpoints(startObj: SceneObject, endObj: SceneObject): void {
        this.start = startObj;
        this.end = endObj;
        this.startTransform = startObj ? startObj.getTransform() : null;
        this.endTransform = endObj ? endObj.getTransform() : null;
        this.markDirty();
    }

    /**
     * Set the control point objects programmatically.
     */
    public setControlPoints(startCtrlObj: SceneObject, endCtrlObj: SceneObject): void {
        this.useCtrlObjects = true;
        this.startCtrl = startCtrlObj;
        this.endCtrl = endCtrlObj;
        this.startCtrlTransform = startCtrlObj ? startCtrlObj.getTransform() : null;
        this.endCtrlTransform = endCtrlObj ? endCtrlObj.getTransform() : null;
        this.markDirty();
    }

    /**
     * Set control offsets when not using control objects.
     */
    public setControlOffsets(startOffset: number, endOffset: number): void {
        this.useCtrlObjects = false;
        this.startCtrlOffset = startOffset;
        this.endCtrlOffset = endOffset;
        this.markDirty();
    }
}
