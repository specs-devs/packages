/**
 * Specs Inc. 2026
 * Smart tethering system with angle and distance-based repositioning triggers. Follows target with
 * conditional updates only when angle threshold, vertical distance, or horizontal distance is exceeded,
 * smooth lerp transitions, position offset in target space, and detailed debug visualization.
 */
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class TetherBetweenAngleRangeTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Target object and follow settings</span>')

    @input
    @allowUndefined
    @hint("Target object that the content should follow")
    target!: SceneObject;

    @input
    @allowUndefined
    @hint("Offset for positioning content relative to target")
    offset: vec3 = new vec3(0, 0, -100.0);

    @input
    @allowUndefined
    @hint("Speed of position lerping")
    lerpSpeed: number = 5.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Reposition Thresholds</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Angle and distance thresholds that trigger repositioning</span>')

    @input
    @allowUndefined
    @hint("Minimum angle (in degrees) required to trigger repositioning")
    angleThreshold: number = 45.0;

    @input
    @allowUndefined
    @hint("Minimum vertical distance required to trigger repositioning")
    verticalDistanceThreshold: number = 150.0;

    @input
    @allowUndefined
    @hint("Minimum horizontal distance required to trigger repositioning")
    horizontalDistanceThreshold: number = 150.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Debug Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable detailed logging for troubleshooting</span>')

    @input
    @allowUndefined
    @hint("Show debug information")
    showDebug: boolean = false;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (operations, events, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    private logger: Logger;

    private _targetPosition: vec3 = new vec3(0, 0, 0);
    private _lastRepositionTime: number = 0;
    private _currentAngle: number = 0;
    private _verticalDistance: number = 0;
    private _horizontalDistance: number = 0;
    private _needsRepositioning: boolean = false;

    /**
     * Called when component wakes up - initialize logger
     */
    onAwake(): void {
        const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
        this.logger = new Logger("TetherBetweenAngleRangeTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("TetherBetweenAngleRangeTS Initialization");
            this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
        }
    }

    /**
     * Called on the first frame when the scene starts
     * Automatically bound to OnStartEvent via SnapDecorators
     */
    @bindStartEvent
    onStart(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onStart() - Scene started");
        }

        if (!this.target) {
            if (this.enableLogging) {
                this.logger.warn("No target set - please set a target object");
            } else {
                print("TetherBetweenAngleRangeTS: No target set - please set a target object");
            }
            return;
        }

        // Initialize target position
        this._targetPosition = this.calculateNewTargetPosition();
    }

    /**
     * Called every frame to evaluate tethering conditions
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        if (!this.target) return;

        // Evaluate current conditions
        this.evaluateConditions();

        // Only recalculate target position if needed
        if (this._needsRepositioning) {
            // Calculate new position
            this._targetPosition = this.calculateNewTargetPosition();

            // Reset state
            this._needsRepositioning = false;
            this._lastRepositionTime = getTime();

            if (this.showDebug) {
                if (this.enableLogging) {
                    this.logger.info("REPOSITIONING TO NEW POSITION");
                } else {
                    print(`TetherBetweenAngleRangeTS: REPOSITIONING TO NEW POSITION`);
                }
            }
        }

        // Always update position with lerping (fixed: this was inside the if block before)
        this.updateContentPosition();
    }

    /**
     * Evaluate all conditions that could trigger repositioning
     */
    private evaluateConditions(): void {
        const myPos = this.sceneObject.getTransform().getWorldPosition();
        const targetPos = this.target.getTransform().getWorldPosition();

        // Calculate vector from target to object
        const targetToObject = new vec3(
            myPos.x - targetPos.x,
            myPos.y - targetPos.y,
            myPos.z - targetPos.z
        );
        
        // Calculate distances
        this._verticalDistance = Math.abs(targetToObject.y);
        this._horizontalDistance = Math.sqrt(
            targetToObject.x * targetToObject.x + 
            targetToObject.z * targetToObject.z
        );
        
        // Extra check for zero-length vectors to avoid NaN
        if (this._horizontalDistance < 0.0001) {
            // We're directly above/below the target, so angle is undefined
            // Set to 0 by convention
            this._currentAngle = 0;
            return;
        }
        
        // Calculate angle between target's forward and direction to object
        // on the horizontal plane (XZ plane)
        
        // 1. Get target's forward vector and flatten to XZ plane
        const targetRotation = this.target.getTransform().getWorldRotation();
        const targetForward = this.getForwardVector(targetRotation);
        const flatForward = new vec3(targetForward.x, 0, targetForward.z).normalize();

        // 2. Get direction vector FROM target TO object, flattened to XZ plane
        const flatToObject = new vec3(targetToObject.x, 0, targetToObject.z).normalize();

        // 3. Calculate dot product between these normalized vectors
        const dotProduct = flatForward.dot(flatToObject);
        
        // 4. Convert dot product to angle in degrees
        // Note: dot(a,b) = |a|*|b|*cos(θ) = cos(θ) when vectors are normalized
        // When vectors align perfectly: cos(0°) = 1
        // When vectors are perpendicular: cos(90°) = 0
        // When vectors point opposite: cos(180°) = -1
        this._currentAngle = 180 - Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
        
        if (this.showDebug) {
            if (this.enableLogging) {
                this.logger.info(`Forward vector: (${flatForward.x.toFixed(2)}, ${flatForward.z.toFixed(2)})`);
                this.logger.info(`Direction to object: (${flatToObject.x.toFixed(2)}, ${flatToObject.z.toFixed(2)})`);
                this.logger.info(`Dot product: ${dotProduct.toFixed(3)} → Angle: ${this._currentAngle.toFixed(1)}°`);
            } else {
                print(`Forward vector: (${flatForward.x.toFixed(2)}, ${flatForward.z.toFixed(2)})`);
                print(`Direction to object: (${flatToObject.x.toFixed(2)}, ${flatToObject.z.toFixed(2)})`);
                print(`Dot product: ${dotProduct.toFixed(3)} → Angle: ${this._currentAngle.toFixed(1)}°`);
            }
        }

        // Evaluate all conditions
        const angleTrigger = this._currentAngle > this.angleThreshold;
        const verticalTrigger = this._verticalDistance > this.verticalDistanceThreshold;
        const horizontalTrigger = this._horizontalDistance > this.horizontalDistanceThreshold;

        // Need repositioning if ANY condition is met
        this._needsRepositioning = angleTrigger || verticalTrigger || horizontalTrigger;

        // Debug output
        if (this.showDebug) {
            if (this.enableLogging) {
                this.logger.info(`Angle: ${this._currentAngle.toFixed(1)}° > ${this.angleThreshold}°? ${angleTrigger}`);
                this.logger.info(`VertDist: ${this._verticalDistance.toFixed(1)} > ${this.verticalDistanceThreshold}? ${verticalTrigger}`);
                this.logger.info(`HorizDist: ${this._horizontalDistance.toFixed(1)} > ${this.horizontalDistanceThreshold}? ${horizontalTrigger}`);

                if (this._needsRepositioning) {
                    this.logger.info("NEEDS REPOSITIONING due to: " +
                        (angleTrigger ? "ANGLE " : "") +
                        (verticalTrigger ? "VERTICAL " : "") +
                        (horizontalTrigger ? "HORIZONTAL" : ""));
                } else {
                    this.logger.info("All conditions within thresholds - no repositioning needed");
                }
            } else {
                print(`Angle: ${this._currentAngle.toFixed(1)}° > ${this.angleThreshold}°? ${angleTrigger}`);
                print(`VertDist: ${this._verticalDistance.toFixed(1)} > ${this.verticalDistanceThreshold}? ${verticalTrigger}`);
                print(`HorizDist: ${this._horizontalDistance.toFixed(1)} > ${this.horizontalDistanceThreshold}? ${horizontalTrigger}`);

                if (this._needsRepositioning) {
                    print("NEEDS REPOSITIONING due to: " +
                        (angleTrigger ? "ANGLE " : "") +
                        (verticalTrigger ? "VERTICAL " : "") +
                        (horizontalTrigger ? "HORIZONTAL" : ""));
                } else {
                    print("All conditions within thresholds - no repositioning needed");
                }
            }
        }
    }

    /**
     * Calculate the new target position with offset.
     */
    private calculateNewTargetPosition(): vec3 {
        const targetTransform = this.target.getTransform();
        const targetPos = targetTransform.getWorldPosition();
        const targetRot = targetTransform.getWorldRotation();

        // Get the forward and right vectors
        const forward = this.getForwardVector(targetRot);
        const right = this.getRightVector(targetRot);

        // Apply offset in target's local space
        return new vec3(
            targetPos.x + right.x * this.offset.x + forward.x * this.offset.z,
            targetPos.y + this.offset.y,
            targetPos.z + right.z * this.offset.x + forward.z * this.offset.z
        );
    }

    /**
     * Update the content's position with lerping.
     */
    private updateContentPosition(): void {
        const myTransform = this.sceneObject.getTransform();
        const currentPos = myTransform.getWorldPosition();

        // Lerp to the target position
        const t = Math.min(1.0, this.lerpSpeed * getDeltaTime());
        const newPos = vec3.lerp(currentPos, this._targetPosition, t);

        // Apply the new position
        myTransform.setWorldPosition(newPos);
    }

    /**
     * Get the forward vector from a rotation.
     */
    private getForwardVector(rotation: quat): vec3 {
        // Transform the local forward vector (0,0,1) by the rotation
        return rotation.multiplyVec3(new vec3(0, 0, 1));
    }

    /**
     * Get the right vector from a rotation.
     */
    private getRightVector(rotation: quat): vec3 {
        // Transform the local right vector (1,0,0) by the rotation
        return rotation.multiplyVec3(new vec3(1, 0, 0));
    }
}
