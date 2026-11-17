/**
 * SPECS Inc. 2027
 * Automatic, self-calibrating floor-height estimation for Spectacles. Continuously estimates the
 * real-world floor using batched WorldQuery raycasts with hit plausibility bounds, height-jump
 * hysteresis, and an Acquiring -> Tracking -> Locked calibration lifecycle: after enough stable
 * cycles the estimate locks and raycasting drops to low-frequency revalidation, unlocking
 * automatically on drift. Pin objects to the floor via targetObjects, or consume the height through
 * the query API (hasFloor / getFloorWorldY / getSmoothedFloorWorldY) and the onFloorUpdated /
 * onCalibrationStateChanged events. The WorldQuery module is acquired internally; only worldCamera
 * must be wired — the component fails fast in onAwake when it is missing (no scene scanning).
 * Target objects are not written until the first floor commit, so authored placement holds during
 * acquisition. Default hit acceptance assumes a standing wearer (90-250 cm camera-to-floor);
 * lower minUserToFloorDistanceCm for seated experiences. Advanced estimator tuning (cycle cadence,
 * ray fan, lock/unlock thresholds, experimental classification) is intentionally not exposed in the
 * Inspector — set the corresponding public fields from a script that runs before this component's
 * onAwake (a SceneObject higher in the hierarchy).
 */
import { bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

const WorldQueryModuleProvider = require("LensStudio:WorldQueryModule");

/** Hit acceptance strategies. Classification is experimental; PositionOnly is the robust default. */
export enum FloorHitAcceptanceMode {
    ClassificationOnly = 0,
    PositionOnly = 1,
    ClassificationWithNearFloorFallback = 2,
}

/** Calibration lifecycle stage reported by getCalibrationState / onCalibrationStateChanged. */
export enum FloorCalibrationState {
    Acquiring = 0,
    Tracking = 1,
    Locked = 2,
}

/** Handler for floor-height commits: receives the new committed floor world Y (cm). */
export type FloorUpdatedHandler = (floorWorldY: number) => void;
/** Handler for calibration stage changes: receives the new FloorCalibrationState. */
export type CalibrationStateChangedHandler = (state: FloorCalibrationState) => void;

@component
export class AutoFloorFinder extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Setup</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Camera basis and optional floor-pinned objects</span>')
    @input
    @hint("Required: camera whose transform provides the ray origin/direction basis (your main camera). The component throws in onAwake if this is not set.")
    worldCamera: Camera;
    @input
    @hint("Optional: scene objects whose world Y is pinned to the estimated floor height. Leave empty to consume the floor purely through the script API.")
    targetObjects: SceneObject[] = [];

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Floor Behavior</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Output smoothing and plausible camera-to-floor bounds</span>')
    @input
    @hint("If true, writes smoothed floor height to targets; if false, writes raw committed floor height.")
    useSmoothedHeight: boolean = true;
    @input
    @hint("Smoothing factor [0..1] for floor updates. Higher = faster response, lower = more damping.")
    smoothCoefficient: number = 0.4;
    @input
    @hint("Minimum plausible camera-to-floor distance (cm). Hits closer than this are rejected. Defaults assume a standing wearer — LOWER THIS for seated experiences.")
    minUserToFloorDistanceCm: number = 90.0;
    @input
    @hint("Maximum plausible camera-to-floor distance (cm). Hits farther below the camera than this are rejected.")
    maxUserToFloorDistanceCm: number = 250.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Debug</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Logging output for this script instance</span>')
    @input
    @hint("Enable logging (tuning stats, cycle diagnostics, floor commits, lifecycle transitions).")
    enableLogging: boolean = false;

    // --- Advanced tuning (not exposed in the Inspector) ---
    // Estimator internals with defaults validated for Spectacles. To override, set these public
    // fields from a script that runs before this component's onAwake (a SceneObject higher in
    // the Scene Hierarchy).

    /**
     * Floor Y reported by getFloorWorldY()/getSmoothedFloorWorldY() before the first commit, and the
     * pre-acquisition near-floor reference for the experimental classification path. Target objects
     * are never moved to this value — they keep their authored positions until a floor is committed.
     */
    initialHeight: number = -100.0;
    /** Delay between floor-estimation cycles (seconds). */
    updateFrequencySec: number = 2.5;
    /** Attempts per cycle. Each attempt casts the configured ray batch once. */
    afterSuccessTries: number = 6;
    /** Spacing between attempts inside a cycle (seconds). */
    afterSuccessDelaySec: number = 0.08;
    /** Minimum successful attempts required in a cycle before accepting/committing a floor estimate. */
    afterSuccessNeedAttempts: number = 3;
    /** Minimum accepted ray hits required within one attempt to compute an attempt height. */
    needHits: number = 2;
    /**
     * Per-ray pitch offsets (degrees) from camera forward. 0 = straight ahead, negative pitches
     * downward, positive upward. One ray is cast per entry each attempt; a downward fan biases
     * toward floor hits. Read once during onAwake.
     */
    rayAnglesDegrees: number[] = [0, -10, -20, -30];
    /** When true, negative-angle rays are clamped to include a minimum downward world-Y component while acquiring initial floor. */
    enforceDownwardForNegativeAngles: boolean = true;
    /** Minimum downward world-Y component [0..1] enforced on negative-angle rays during initial acquisition. */
    minDownwardWorldY: number = 0.2;
    /** Raycast length in world units (cm). */
    rayLength: number = 500.0;
    /** Shifts ray origin forward from camera position before casting (world units). */
    moveCameraPosForwardAmount: number = 0.0;
    /** Maximum allowed height spread for grouped hits/attempts to be considered consistent (cm). */
    maxDiff: number = 18.0;
    /** Minimum Y delta required before writing updated target positions (reduces tiny write jitter). */
    targetWriteEpsilon: number = 0.01;
    /** Consecutive successful cycles required before locking floor calibration. */
    lockAfterConsecutiveSuccessfulCycles: number = 2;
    /** Maximum per-cycle spread (cm) allowed to consider lock stability. */
    stableSpreadThresholdCm: number = 10.0;
    /** Maximum drift from committed floor (cm) allowed to consider lock stability. */
    stableDriftThresholdCm: number = 10.0;
    /** Minimum accepted hits in cycle required before locking. */
    minAcceptedHitsForLock: number = 4;
    /** When locked, how often to run low-frequency revalidation cycles (seconds). */
    lockedRevalidationIntervalSec: number = 20.0;
    /** Unlock when camera-to-floor distance shifts beyond this delta from lock baseline (cm). */
    unlockUserDistanceDeltaCm: number = 30.0;
    /** Unlock when revalidation estimate differs from locked floor by this amount (cm). */
    relockGroundDeltaCm: number = 15.0;
    /** Unlock after this many consecutive failed locked revalidation cycles. */
    unlockConsecutiveFailedCycles: number = 4;
    /** Cadence (seconds) for periodic tuning logs when logging is enabled. */
    tuningLogIntervalSec: number = 2.0;

    // --- Experimental classification (not exposed in the Inspector) ---
    // Depends on experimental WorldQuery APIs; ships off. Session options are read once during
    // onAwake, so overrides must happen before this component initializes.

    /**
     * EXPERIMENTAL: enables WorldQuery surface classification as a hit filter. When off (default),
     * hits are accepted by position only and none of the classification fields below apply. If
     * classification quality degrades at runtime, the component auto-falls back to position-only.
     */
    useExperimentalClassificationApi: boolean = false;
    /** How classified hits are accepted; see FloorHitAcceptanceMode. */
    hitAcceptanceMode: number = FloorHitAcceptanceMode.PositionOnly;
    /** How close to the known floor (cm) an unclassified hit must be to count as 'near floor' for fallback acceptance and degradation tracking. */
    nearFloorToleranceCm: number = 12.0;
    /** Length (seconds) of each classification-quality observation window. */
    degradationWindowSec: number = 5.0;
    /** Minimum classified samples in a window before its quality is judged (smaller windows are skipped). */
    degradationMinSamples: number = 8;
    /** A window counts as degraded when near-floor-but-unclassified hits exceed this fraction of (unclassified + Ground) hits. */
    degradationThreshold: number = 0.5;
    /** Consecutive degraded windows before permanently falling back to position-only acceptance for this session. */
    degradationConsecutiveWindowsToFallback: number = 2;
    /** EXPERIMENTAL: WorldQuery session-level hit filtering; the estimator's own voting/plausibility checks handle raw-hit noise. */
    enableHitFilter: boolean = false;

    private logger: Logger;
    private worldQuery: WorldQueryModule | undefined = undefined;
    private worldCameraTransform: Transform;
    private targetTransforms: Transform[] = [];
    private targetWriteScratch: vec3[] = [];

    private hitSession: HitTestSession | undefined = undefined;

    private rayCount: number = 0;
    private rayAngleRad: number[] = [];
    private rayStarts: vec3[] = [];
    private rayEnds: vec3[] = [];
    private rayCallbacks: Array<(hit: WorldQueryHitTestResult) => void> = [];

    private queryInFlight: boolean = false;
    private pendingRayCallbacks: number = 0;
    private currentAttemptHitCount: number = 0;
    private currentAttemptRawHitCount: number = 0;
    private currentAttemptClassRejectedCount: number = 0;
    private currentAttemptHitY: number[] = [];
    private currentAttemptCameraY: number = 0;

    private cycleActive: boolean = false;
    private cycleAttemptIndex: number = 0;
    private cycleSuccessfulAttemptCount: number = 0;
    private cycleAttemptHeights: number[] = [];
    private cycleSortedHeights: number[] = [];
    private cycleLastCameraY: number = 0;
    private cycleRawHitCount: number = 0;
    private cycleAcceptedHitCount: number = 0;
    private cycleClassRejectedHitCount: number = 0;
    private nextCycleTimeSec: number = 0;
    private nextAttemptTimeSec: number = 0;

    private hasGround: boolean = false;
    private groundHeight: number = 0;
    private smoothedGroundHeight: number = 0;
    private lastAppliedTargetY: number | undefined = undefined;
    private candidateGroundHeight: number | undefined = undefined;
    private candidateUserHeight: number | undefined = undefined;
    private prevUserHeight: number = 0;

    private queryCount: number = 0;
    private acceptedQueryCount: number = 0;
    private rejectedQueryCount: number = 0;
    private commitCount: number = 0;
    private applyWriteCount: number = 0;
    private lastTuningLogTimeSec: number = -9999;
    private calibrationState: FloorCalibrationState = FloorCalibrationState.Acquiring;
    private consecutiveSuccessfulCycles: number = 0;
    private consecutiveFailedCycles: number = 0;
    private nextLockedRevalidationTimeSec: number = 0;
    private lockedGroundHeight: number = 0;
    private lockedUserDistance: number = 0;
    private classificationWindowStartTimeSec: number = 0;
    private classificationWindowNearFloorNoneHits: number = 0;
    private classificationWindowGroundHits: number = 0;
    private classificationDegradedWindowStreak: number = 0;
    private classificationFallbackToPositionOnly: boolean = false;

    private readonly floorUpdatedHandlers: FloorUpdatedHandler[] = [];
    private readonly calibrationStateChangedHandlers: CalibrationStateChangedHandler[] = [];

    private readonly maxDistanceToGroundDelta: number = 30.0;
    private readonly maxGroundHeightJump: number = 10.0;
    private readonly degToRad: number = Math.PI / 180.0;

    // --- Public API ---

    /** True once a first floor estimate has been committed. */
    hasFloor(): boolean {
        return this.hasGround;
    }

    /** Last committed floor height (world Y, cm). Returns initialHeight until hasFloor() is true. */
    getFloorWorldY(): number {
        return this.groundHeight;
    }

    /** Exponentially smoothed floor height (world Y, cm) — what targets follow when useSmoothedHeight is on. */
    getSmoothedFloorWorldY(): number {
        return this.smoothedGroundHeight;
    }

    /** Current calibration lifecycle stage (Acquiring / Tracking / Locked). */
    getCalibrationState(): FloorCalibrationState {
        return this.calibrationState;
    }

    /** True while calibration is locked (low-frequency revalidation mode). */
    isLocked(): boolean {
        return this.calibrationState === FloorCalibrationState.Locked;
    }

    /** Subscribe to floor-height commits. Fires with the new committed floor world Y. */
    addOnFloorUpdated(handler: FloorUpdatedHandler): void {
        this.floorUpdatedHandlers.push(handler);
    }

    /** Unsubscribe a previously added floor-updated handler. */
    removeOnFloorUpdated(handler: FloorUpdatedHandler): void {
        const index = this.floorUpdatedHandlers.indexOf(handler);
        if (index >= 0) {
            this.floorUpdatedHandlers.splice(index, 1);
        }
    }

    /** Subscribe to calibration stage changes (Acquiring -> Tracking -> Locked and unlocks). */
    addOnCalibrationStateChanged(handler: CalibrationStateChangedHandler): void {
        this.calibrationStateChangedHandlers.push(handler);
    }

    /** Unsubscribe a previously added calibration-state handler. */
    removeOnCalibrationStateChanged(handler: CalibrationStateChangedHandler): void {
        const index = this.calibrationStateChangedHandlers.indexOf(handler);
        if (index >= 0) {
            this.calibrationStateChangedHandlers.splice(index, 1);
        }
    }

    // --- Lifecycle ---

    onAwake(): void {
        this.logger = new Logger("AutoFloorFinder", this.enableLogging, true);
        this.logLifecycle("onAwake() - Component waking up");
        this.validateInputs();
        this.acquireWorldQueryModule();
        this.cacheTransforms();
        this.initializeRays();
        this.initializeSession();
        this.initializeGroundState();
        this.classificationWindowStartTimeSec = getTime();
        this.nextCycleTimeSec = getTime();
        this.nextAttemptTimeSec = this.nextCycleTimeSec;
        this.logLifecycle("awake complete; rays=" + this.rayCount + " rayLength=" + this.rayLength.toFixed(1));
    }

    onDestroy(): void {
        if (this.hitSession) {
            this.hitSession.stop();
            this.hitSession = undefined;
        }
        this.floorUpdatedHandlers.length = 0;
        this.calibrationStateChangedHandlers.length = 0;
        this.logLifecycle("destroyed; q=" + this.queryCount + " ok=" + this.acceptedQueryCount + " rej=" + this.rejectedQueryCount);
    }

    @bindUpdateEvent
    private onUpdateFrame(): void {
        if (!this.hitSession) {
            return;
        }
        const now = getTime();
        this.updateSmoothedHeight();
        this.applyHeightToTargets();
        this.maybeEvaluateClassificationDegradation(now);
        this.maybeEmitTuningLog(now);
        if (this.calibrationState === FloorCalibrationState.Locked && now < this.nextLockedRevalidationTimeSec) {
            return;
        }
        if (this.queryInFlight) {
            return;
        }
        if (!this.cycleActive) {
            if (now < this.nextCycleTimeSec) {
                return;
            }
            this.startCycle(now);
        }
        if (now < this.nextAttemptTimeSec) {
            return;
        }
        this.issueAttempt(now);
    }

    private validateInputs(): void {
        if (!this.worldCamera) {
            throw new Error("AutoFloorFinder: worldCamera is not set — wire your main (Device Tracking) camera in the Inspector");
        }
    }

    private acquireWorldQueryModule(): void {
        this.worldQuery = WorldQueryModuleProvider as WorldQueryModule;
        if (!this.worldQuery) {
            // Always visible: capability errors must surface even with logging off.
            print("AutoFloorFinder ERROR: WorldQueryModule unavailable - floor estimation disabled (requires Spectacles / WorldQuery support)");
        }
    }

    private cacheTransforms(): void {
        this.worldCameraTransform = this.worldCamera.getSceneObject().getTransform();
        const targetCount = this.targetObjects ? this.targetObjects.length : 0;
        this.targetTransforms.length = 0;
        this.targetWriteScratch.length = 0;
        for (let i = 0; i < targetCount; i++) {
            const target = this.targetObjects[i];
            if (!target) {
                continue;
            }
            this.targetTransforms.push(target.getTransform());
            this.targetWriteScratch.push(new vec3(0, 0, 0));
        }
    }

    private initializeRays(): void {
        this.rayCount = Math.max(1, this.rayAnglesDegrees ? this.rayAnglesDegrees.length : 0);
        this.rayAngleRad = new Array(this.rayCount);
        this.rayStarts = new Array(this.rayCount);
        this.rayEnds = new Array(this.rayCount);
        this.rayCallbacks = new Array(this.rayCount);
        this.currentAttemptHitY = new Array(this.rayCount);
        this.cycleAttemptHeights = new Array(Math.max(1, this.afterSuccessTries + 1));
        this.cycleSortedHeights = new Array(this.rayCount);

        for (let i = 0; i < this.rayCount; i++) {
            const angle = this.rayAnglesDegrees && i < this.rayAnglesDegrees.length ? this.rayAnglesDegrees[i] : 0;
            this.rayAngleRad[i] = angle * this.degToRad;
            this.rayStarts[i] = new vec3(0, 0, 0);
            this.rayEnds[i] = new vec3(0, 0, 0);
            this.currentAttemptHitY[i] = 0;
            this.rayCallbacks[i] = (hit: WorldQueryHitTestResult) => this.onRayHit(i, hit);
        }
    }

    private initializeSession(): void {
        if (!this.worldQuery) {
            return;
        }
        try {
            const options = HitTestSessionOptions.create();
            if (this.useExperimentalClassificationApi) {
                options.classification = true;
            }
            options.filter = this.enableHitFilter;
            this.hitSession = this.worldQuery.createHitTestSessionWithOptions(options);
            this.hitSession.start();
            this.logLifecycle("hit session started; classificationApi=" + (this.useExperimentalClassificationApi ? "1" : "0"));
        } catch (e) {
            this.hitSession = undefined;
            // Always visible: capability errors must surface even with logging off.
            print(
                "AutoFloorFinder ERROR: WorldQuery hit-test session unavailable - floor estimation disabled. " +
                    "Set the Preview device to Spectacles (or run on device); WorldQuery is not simulated on other platforms. (" +
                    e +
                    ")"
            );
        }
    }

    private initializeGroundState(): void {
        this.groundHeight = this.initialHeight;
        this.smoothedGroundHeight = this.initialHeight;
        this.prevUserHeight = this.worldCameraTransform.getWorldPosition().y;
    }

    private startCycle(now: number): void {
        this.cycleActive = true;
        this.cycleAttemptIndex = 0;
        this.cycleSuccessfulAttemptCount = 0;
        this.cycleRawHitCount = 0;
        this.cycleAcceptedHitCount = 0;
        this.cycleClassRejectedHitCount = 0;
        this.nextAttemptTimeSec = now;
    }

    private issueAttempt(now: number): void {
        if (!this.hitSession) {
            return;
        }
        this.prepareRayBatch();
        this.queryInFlight = true;
        this.pendingRayCallbacks = this.rayCount;
        this.currentAttemptHitCount = 0;
        this.currentAttemptRawHitCount = 0;
        this.currentAttemptClassRejectedCount = 0;
        this.currentAttemptCameraY = this.worldCameraTransform.getWorldPosition().y;
        this.queryCount++;
        for (let i = 0; i < this.rayCount; i++) {
            this.hitSession.hitTest(this.rayStarts[i], this.rayEnds[i], this.rayCallbacks[i]);
        }
        this.nextAttemptTimeSec = now + this.sanitizePositive(this.afterSuccessDelaySec, 0.08);
    }

    private prepareRayBatch(): void {
        const cameraPos = this.worldCameraTransform.getWorldPosition();
        const viewForward = this.getViewForward();
        const up = this.worldCameraTransform.up;
        const fwdX = viewForward.x;
        const fwdY = viewForward.y;
        const fwdZ = viewForward.z;

        const rayLength = this.sanitizePositive(this.rayLength, 500.0);
        const originX = cameraPos.x + fwdX * this.moveCameraPosForwardAmount;
        const originY = cameraPos.y + fwdY * this.moveCameraPosForwardAmount;
        const originZ = cameraPos.z + fwdZ * this.moveCameraPosForwardAmount;

        for (let i = 0; i < this.rayCount; i++) {
            const start = this.rayStarts[i];
            start.x = originX;
            start.y = originY;
            start.z = originZ;

            // 0 deg = camera forward (-Z). Negative angles pitch downward toward -up.
            const pitchDownRad = -this.rayAngleRad[i];
            const sinA = Math.sin(pitchDownRad);
            const cosA = Math.cos(pitchDownRad);
            const dirX = fwdX * cosA + (-up.x) * sinA;
            let dirY = fwdY * cosA + (-up.y) * sinA;
            const dirZ = fwdZ * cosA + (-up.z) * sinA;
            if (this.enforceDownwardForNegativeAngles && !this.hasGround && this.rayAngleRad[i] < 0) {
                const minDownY = this.clamp01(this.minDownwardWorldY);
                if (dirY > -minDownY) {
                    dirY = -minDownY;
                }
            }
            const lenSq = dirX * dirX + dirY * dirY + dirZ * dirZ;
            const invLen = lenSq > 1e-8 ? 1.0 / Math.sqrt(lenSq) : 1.0;

            const end = this.rayEnds[i];
            end.x = start.x + dirX * invLen * rayLength;
            end.y = start.y + dirY * invLen * rayLength;
            end.z = start.z + dirZ * invLen * rayLength;
        }
    }

    private onRayHit(rayIndex: number, hit: WorldQueryHitTestResult): void {
        if (!this.queryInFlight) {
            return;
        }
        if (hit) {
            this.currentAttemptRawHitCount++;
            this.cycleRawHitCount++;
            const hitClass = this.useExperimentalClassificationApi ? hit.classification : undefined;
            this.updateClassificationWindowStats(hit.position.y, hitClass);
        }
        if (hit && this.acceptHit(hit)) {
            const y = hit.position.y;
            if (this.currentAttemptHitCount < this.currentAttemptHitY.length) {
                this.currentAttemptHitY[this.currentAttemptHitCount] = y;
                this.currentAttemptHitCount++;
            }
            this.cycleAcceptedHitCount++;
            this.invalidateCandidateIfTooLow(y);
        } else if (hit) {
            this.currentAttemptClassRejectedCount++;
            this.cycleClassRejectedHitCount++;
        }
        this.pendingRayCallbacks--;
        if (this.pendingRayCallbacks <= 0) {
            this.finalizeAttempt();
        }
    }

    private finalizeAttempt(): void {
        this.queryInFlight = false;
        const attemptHeight = this.computeAttemptHeight();
        if (attemptHeight !== undefined) {
            this.acceptedQueryCount++;
            if (this.cycleSuccessfulAttemptCount < this.cycleAttemptHeights.length) {
                this.cycleAttemptHeights[this.cycleSuccessfulAttemptCount] = attemptHeight;
                this.cycleSuccessfulAttemptCount++;
            }
            this.cycleLastCameraY = this.currentAttemptCameraY;
        } else {
            this.rejectedQueryCount++;
        }

        this.cycleAttemptIndex++;
        const maxAttempts = Math.max(1, Math.floor(this.afterSuccessTries));
        if (this.cycleAttemptIndex >= maxAttempts) {
            this.finishCycle();
        }
    }

    private finishCycle(): void {
        const minNeeded = this.clampInt(this.afterSuccessNeedAttempts, 1, Math.max(1, Math.floor(this.afterSuccessTries)));
        let cycleSucceeded = false;
        if (this.cycleSuccessfulAttemptCount >= minNeeded) {
            let minV = this.cycleAttemptHeights[0];
            let maxV = this.cycleAttemptHeights[0];
            let sumV = 0;
            for (let i = 0; i < this.cycleSuccessfulAttemptCount; i++) {
                const v = this.cycleAttemptHeights[i];
                if (v < minV) {
                    minV = v;
                }
                if (v > maxV) {
                    maxV = v;
                }
                sumV += v;
            }
            // Do not gate first acquisition by maxDiff; initialHeight can be far from real floor.
            const skipSpreadCheck = !this.hasGround;
            if (skipSpreadCheck || maxV - minV <= this.sanitizeNonNegative(this.maxDiff)) {
                const proposedHeight = sumV / this.cycleSuccessfulAttemptCount;
                const spread = maxV - minV;
                const priorGround = this.groundHeight;
                const drift = this.hasGround ? this.abs(proposedHeight - priorGround) : 0;
                if (this.calibrationState === FloorCalibrationState.Locked) {
                    this.handleLockedCycleSuccess(proposedHeight, this.cycleLastCameraY);
                } else {
                    this.onNewGroundHeight(proposedHeight, this.cycleLastCameraY);
                    this.handleUnlockedCycleSuccess(spread, drift, this.cycleAcceptedHitCount, this.cycleLastCameraY);
                }
                cycleSucceeded = true;
            } else {
                this.logInfo("cycle rejected: spread=" + (maxV - minV).toFixed(2));
            }
        } else {
            this.logInfo("cycle rejected: successAttempts=" + this.cycleSuccessfulAttemptCount + " need=" + minNeeded);
        }
        if (!cycleSucceeded) {
            this.handleCycleFailure();
        }

        if (this.enableLogging) {
            this.logger.info(
                "cycle stats: attempts=" +
                    this.cycleAttemptIndex +
                    " rawHits=" +
                    this.cycleRawHitCount +
                    " acceptedHits=" +
                    this.cycleAcceptedHitCount +
                    " classRejected=" +
                    this.cycleClassRejectedHitCount
            );
            if (
                this.cycleRawHitCount > 0 &&
                this.cycleAcceptedHitCount === 0 &&
                this.getEffectiveAcceptanceMode() === FloorHitAcceptanceMode.ClassificationOnly
            ) {
                this.logger.warn("all hits filtered by ClassificationOnly mode; consider PositionOnly or fallback mode");
            }
            if (this.cycleRawHitCount === 0) {
                this.logger.warn("zero raw hits from World Query; likely unavailable tracking/runtime or bad ray origin");
            }
        }

        this.cycleActive = false;
        const now = getTime();
        this.nextCycleTimeSec = now + this.sanitizePositive(this.updateFrequencySec, 2.5);
        if (this.calibrationState === FloorCalibrationState.Locked) {
            this.nextLockedRevalidationTimeSec = now + this.sanitizePositive(this.lockedRevalidationIntervalSec, 20.0);
        }
    }

    private computeAttemptHeight(): number | undefined {
        const needed = this.clampInt(this.needHits, 1, this.rayCount);
        if (this.currentAttemptHitCount < needed) {
            return undefined;
        }

        for (let i = 0; i < this.currentAttemptHitCount; i++) {
            this.cycleSortedHeights[i] = this.currentAttemptHitY[i];
        }
        for (let i = 1; i < this.currentAttemptHitCount; i++) {
            const key = this.cycleSortedHeights[i];
            let j = i - 1;
            while (j >= 0 && this.cycleSortedHeights[j] > key) {
                this.cycleSortedHeights[j + 1] = this.cycleSortedHeights[j];
                j--;
            }
            this.cycleSortedHeights[j + 1] = key;
        }

        const overallMin = this.cycleSortedHeights[0];
        // Do not use maxDiff before first committed floor; only enforce once baseline is acquired.
        const maxDiff = this.hasGround ? this.sanitizeNonNegative(this.maxDiff) : Number.POSITIVE_INFINITY;
        let rollingSum = 0;
        for (let i = 0; i < needed - 1; i++) {
            rollingSum += this.cycleSortedHeights[i];
        }
        for (let i = needed - 1; i < this.currentAttemptHitCount; i++) {
            rollingSum += this.cycleSortedHeights[i];
            const minV = this.cycleSortedHeights[i - needed + 1];
            const maxV = this.cycleSortedHeights[i];
            if (maxV - minV <= maxDiff) {
                const result = rollingSum / needed;
                if (result - maxDiff < overallMin) {
                    return result;
                }
            }
            rollingSum -= minV;
        }
        return undefined;
    }

    private onNewGroundHeight(height: number, cameraHeight: number): void {
        if (!this.hasGround) {
            this.setNewGround(height, cameraHeight);
            return;
        }
        if (!this.canUpdateGround(height, cameraHeight)) {
            this.candidateGroundHeight = height;
            this.candidateUserHeight = cameraHeight;
            return;
        }
        this.setNewGround(height, cameraHeight);
    }

    private canUpdateGround(newGroundHeight: number, cameraHeight: number): boolean {
        let usedGround = this.groundHeight;
        let usedDistance = this.prevUserHeight - this.groundHeight;
        if (this.candidateGroundHeight !== undefined && this.candidateUserHeight !== undefined) {
            usedGround = this.candidateGroundHeight;
            usedDistance = this.candidateUserHeight - this.candidateGroundHeight;
        }
        const curDistance = cameraHeight - newGroundHeight;
        if (usedGround + this.maxGroundHeightJump > newGroundHeight) {
            return true;
        }
        return this.abs(curDistance - usedDistance) < this.maxDistanceToGroundDelta;
    }

    private invalidateCandidateIfTooLow(hitY: number): void {
        if (this.candidateGroundHeight === undefined) {
            return;
        }
        if (hitY < this.candidateGroundHeight - this.maxGroundHeightJump) {
            this.candidateGroundHeight = undefined;
            this.candidateUserHeight = undefined;
        }
    }

    private setNewGround(height: number, cameraHeight: number): void {
        this.hasGround = true;
        this.groundHeight = height;
        this.prevUserHeight = cameraHeight;
        this.candidateGroundHeight = undefined;
        this.candidateUserHeight = undefined;
        if (this.calibrationState === FloorCalibrationState.Acquiring) {
            this.setCalibrationState(FloorCalibrationState.Tracking);
        }
        this.commitCount++;
        this.logInfo("ground updated: " + height.toFixed(3));
        this.fireFloorUpdated(height);
    }

    private updateSmoothedHeight(): void {
        if (!this.hasGround) {
            return;
        }
        const t = this.clamp01(this.smoothCoefficient);
        this.smoothedGroundHeight = this.smoothedGroundHeight + (this.groundHeight - this.smoothedGroundHeight) * t;
    }

    private applyHeightToTargets(): void {
        // Targets keep their authored positions until the first floor commit.
        if (!this.hasGround || this.targetTransforms.length === 0) {
            return;
        }
        const targetY = this.useSmoothedHeight ? this.smoothedGroundHeight : this.groundHeight;
        const eps = this.sanitizeNonNegative(this.targetWriteEpsilon);
        if (this.lastAppliedTargetY !== undefined && this.abs(targetY - this.lastAppliedTargetY) <= eps) {
            return;
        }
        this.lastAppliedTargetY = targetY;
        for (let i = 0; i < this.targetTransforms.length; i++) {
            const transform = this.targetTransforms[i];
            const current = transform.getWorldPosition();
            const writePos = this.targetWriteScratch[i];
            writePos.x = current.x;
            writePos.y = targetY;
            writePos.z = current.z;
            transform.setWorldPosition(writePos);
        }
        this.applyWriteCount += this.targetTransforms.length;
    }

    private acceptHit(hit: WorldQueryHitTestResult): boolean {
        const y = hit.position.y;
        if (!this.isUserToFloorDistancePlausible(this.currentAttemptCameraY, y)) {
            return false;
        }
        const mode = this.getEffectiveAcceptanceMode();
        if (mode === FloorHitAcceptanceMode.PositionOnly) {
            return true;
        }
        if (this.isGroundClassification(hit.classification)) {
            return true;
        }
        if (mode === FloorHitAcceptanceMode.ClassificationWithNearFloorFallback) {
            return this.isNearFloor(y);
        }
        return false;
    }

    private maybeEmitTuningLog(now: number): void {
        if (!this.enableLogging) {
            return;
        }
        const interval = this.sanitizePositive(this.tuningLogIntervalSec, 2.0);
        if (now - this.lastTuningLogTimeSec < interval) {
            return;
        }
        this.lastTuningLogTimeSec = now;
        const total = Math.max(1, this.queryCount);
        const okPct = (this.acceptedQueryCount * 100.0) / total;
        this.logger.info(
            "tune q=" +
                this.queryCount +
                " ok=" +
                this.acceptedQueryCount +
                " rej=" +
                this.rejectedQueryCount +
                " ok%=" +
                okPct.toFixed(1) +
                " floor=" +
                (this.hasGround ? this.groundHeight.toFixed(3) : "none") +
                " smoothed=" +
                this.smoothedGroundHeight.toFixed(3) +
                " commits=" +
                this.commitCount +
                " state=" +
                this.calibrationState +
                " mode=" +
                this.getEffectiveAcceptanceMode() +
                " classFallback=" +
                (this.classificationFallbackToPositionOnly ? "1" : "0")
        );
    }

    private getConfiguredAcceptanceMode(): FloorHitAcceptanceMode {
        const mode = this.clampInt(
            this.hitAcceptanceMode,
            FloorHitAcceptanceMode.ClassificationOnly,
            FloorHitAcceptanceMode.ClassificationWithNearFloorFallback
        );
        return mode as FloorHitAcceptanceMode;
    }

    private getEffectiveAcceptanceMode(): FloorHitAcceptanceMode {
        if (!this.useExperimentalClassificationApi || this.classificationFallbackToPositionOnly) {
            return FloorHitAcceptanceMode.PositionOnly;
        }
        return this.getConfiguredAcceptanceMode();
    }

    private isGroundClassification(hitClass: SurfaceClassification | undefined): boolean {
        if (hitClass === undefined) {
            return false;
        }
        return hitClass === SurfaceClassification.Ground;
    }

    private isNearFloor(hitY: number): boolean {
        const refFloor = this.hasGround ? this.groundHeight : this.initialHeight;
        return this.abs(hitY - refFloor) <= this.sanitizeNonNegative(this.nearFloorToleranceCm);
    }

    private isUserToFloorDistancePlausible(cameraY: number, hitY: number): boolean {
        const distance = cameraY - hitY;
        const minD = this.sanitizeNonNegative(this.minUserToFloorDistanceCm);
        const maxD = Math.max(minD, this.sanitizeNonNegative(this.maxUserToFloorDistanceCm));
        return distance >= minD && distance <= maxD;
    }

    private updateClassificationWindowStats(hitY: number, hitClass: SurfaceClassification | undefined): void {
        if (!this.useExperimentalClassificationApi) {
            return;
        }
        if (hitClass === undefined) {
            return;
        }
        if (this.isGroundClassification(hitClass)) {
            this.classificationWindowGroundHits++;
            return;
        }
        if (hitClass === SurfaceClassification.None && this.isNearFloor(hitY)) {
            this.classificationWindowNearFloorNoneHits++;
        }
    }

    private maybeEvaluateClassificationDegradation(now: number): void {
        if (!this.useExperimentalClassificationApi || this.classificationFallbackToPositionOnly) {
            return;
        }
        const windowSec = this.sanitizePositive(this.degradationWindowSec, 5.0);
        if (now - this.classificationWindowStartTimeSec < windowSec) {
            return;
        }
        const nearNone = this.classificationWindowNearFloorNoneHits;
        const ground = this.classificationWindowGroundHits;
        const total = nearNone + ground;
        const minSamples = Math.max(1, this.clampInt(this.degradationMinSamples, 1, 1000000));
        if (total >= minSamples) {
            const ratio = nearNone / total;
            const threshold = this.clamp01(this.degradationThreshold);
            if (ratio > threshold) {
                this.classificationDegradedWindowStreak++;
            } else {
                this.classificationDegradedWindowStreak = 0;
            }
            const needed = Math.max(
                1,
                this.clampInt(this.degradationConsecutiveWindowsToFallback, 1, 1000000)
            );
            if (this.classificationDegradedWindowStreak >= needed) {
                this.classificationFallbackToPositionOnly = true;
                this.logger.warn(
                    "classification degraded; auto-fallback to PositionOnly ratio=" +
                        ratio.toFixed(2) +
                        " nearNone=" +
                        nearNone +
                        " ground=" +
                        ground
                );
            }
        }
        this.classificationWindowNearFloorNoneHits = 0;
        this.classificationWindowGroundHits = 0;
        this.classificationWindowStartTimeSec = now;
    }

    private handleUnlockedCycleSuccess(spread: number, drift: number, acceptedHits: number, cameraY: number): void {
        this.consecutiveSuccessfulCycles++;
        this.consecutiveFailedCycles = 0;
        if (this.calibrationState === FloorCalibrationState.Acquiring && this.hasGround) {
            this.setCalibrationState(FloorCalibrationState.Tracking);
        }
        if (this.calibrationState !== FloorCalibrationState.Tracking) {
            return;
        }
        const neededSuccess = Math.max(1, this.clampInt(this.lockAfterConsecutiveSuccessfulCycles, 1, 1000000));
        if (this.consecutiveSuccessfulCycles < neededSuccess) {
            return;
        }
        if (spread > this.sanitizeNonNegative(this.stableSpreadThresholdCm)) {
            return;
        }
        if (drift > this.sanitizeNonNegative(this.stableDriftThresholdCm)) {
            return;
        }
        const minHits = Math.max(1, this.clampInt(this.minAcceptedHitsForLock, 1, 1000000));
        if (acceptedHits < minHits) {
            return;
        }
        this.lockCalibration(cameraY);
    }

    private handleLockedCycleSuccess(proposedHeight: number, cameraY: number): void {
        this.consecutiveFailedCycles = 0;
        const currentUserDistance = cameraY - this.groundHeight;
        const userDelta = this.abs(currentUserDistance - this.lockedUserDistance);
        if (userDelta > this.sanitizeNonNegative(this.unlockUserDistanceDeltaCm)) {
            this.unlockCalibration("userDistanceShift");
            this.onNewGroundHeight(proposedHeight, cameraY);
            return;
        }
        const relockDelta = this.abs(proposedHeight - this.lockedGroundHeight);
        if (relockDelta > this.sanitizeNonNegative(this.relockGroundDeltaCm)) {
            this.unlockCalibration("revalidationDelta");
            this.onNewGroundHeight(proposedHeight, cameraY);
        }
    }

    private handleCycleFailure(): void {
        this.consecutiveSuccessfulCycles = 0;
        this.consecutiveFailedCycles++;
        if (this.calibrationState !== FloorCalibrationState.Locked) {
            return;
        }
        const unlockFails = Math.max(1, this.clampInt(this.unlockConsecutiveFailedCycles, 1, 1000000));
        if (this.consecutiveFailedCycles >= unlockFails) {
            this.unlockCalibration("consecutiveFailures");
        }
    }

    private lockCalibration(cameraY: number): void {
        this.setCalibrationState(FloorCalibrationState.Locked);
        this.lockedGroundHeight = this.groundHeight;
        this.lockedUserDistance = cameraY - this.groundHeight;
        this.nextLockedRevalidationTimeSec = getTime() + this.sanitizePositive(this.lockedRevalidationIntervalSec, 20.0);
        this.logLifecycle(
            "calibration locked floor=" +
                this.lockedGroundHeight.toFixed(3) +
                " userDist=" +
                this.lockedUserDistance.toFixed(3)
        );
    }

    private unlockCalibration(reason: string): void {
        this.setCalibrationState(FloorCalibrationState.Tracking);
        this.consecutiveSuccessfulCycles = 0;
        this.consecutiveFailedCycles = 0;
        this.logLifecycle("calibration unlocked reason=" + reason);
    }

    private setCalibrationState(state: FloorCalibrationState): void {
        if (this.calibrationState === state) {
            return;
        }
        this.calibrationState = state;
        for (let i = 0; i < this.calibrationStateChangedHandlers.length; i++) {
            try {
                this.calibrationStateChangedHandlers[i](state);
            } catch (e) {
                this.logger.error("onCalibrationStateChanged handler threw: " + e);
            }
        }
    }

    private fireFloorUpdated(floorWorldY: number): void {
        for (let i = 0; i < this.floorUpdatedHandlers.length; i++) {
            try {
                this.floorUpdatedHandlers[i](floorWorldY);
            } catch (e) {
                this.logger.error("onFloorUpdated handler threw: " + e);
            }
        }
    }

    private getViewForward(): vec3 {
        return this.worldCameraTransform.back;
    }

    private clamp01(v: number): number {
        if (v < 0) {
            return 0;
        }
        if (v > 1) {
            return 1;
        }
        return v;
    }

    private clampInt(v: number, min: number, max: number): number {
        const f = Math.floor(v);
        if (f < min) {
            return min;
        }
        if (f > max) {
            return max;
        }
        return f;
    }

    private sanitizePositive(v: number, fallback: number): number {
        if (!isFinite(v) || v <= 0) {
            return fallback;
        }
        return v;
    }

    private sanitizeNonNegative(v: number): number {
        if (!isFinite(v) || v < 0) {
            return 0;
        }
        return v;
    }

    private abs(v: number): number {
        return v < 0 ? -v : v;
    }

    private logInfo(message: string): void {
        if (!this.enableLogging) {
            return;
        }
        this.logger.info(message);
    }

    private logLifecycle(message: string): void {
        if (!this.enableLogging) {
            return;
        }
        this.logger.debug("LIFECYCLE: " + message);
    }
}
