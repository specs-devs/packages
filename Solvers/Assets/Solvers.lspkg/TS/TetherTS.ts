/**
 * Specs Inc. 2026
 * Basic tethering system with distance-based repositioning. Follows target with automatic repositioning
 * when vertical or horizontal distance thresholds are exceeded, optional rotation synchronization,
 * Y-axis flattening for horizontal-only orientation, smooth lerp transitions, and configurable offset.
 */
import { MathUtils } from "Utilities.lspkg/Scripts/Utils/MathUtils";
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class TetherTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Target object and follow settings</span>')

    @input
    @allowUndefined
    @hint("Override default target mainCamera")
    target!: SceneObject;

    @input
    @allowUndefined
    @hint("Offset for tethering the content in relation to the target")
    offset: vec3 = new vec3(0, 0, 0);

    @input
    @allowUndefined
    @hint("Lerp speed for smooth movement")
    lerpSpeed: number = 5.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distance Thresholds</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Minimum movement required to trigger repositioning</span>')

    @input
    @allowUndefined
    @hint("Minimum vertical movement to recalculate position")
    verticalDistanceFromTarget: number = 0.1;

    @input
    @allowUndefined
    @hint("Minimum horizontal movement to recalculate position")
    horizontalDistanceFromTarget: number = 0.1;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Rotation Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control rotation synchronization with target</span>')

    @input
    @allowUndefined
    @hint("Should the content rotate and reposition with the target")
    reorientDuringTargetRotation: boolean = true;

    @input
    @allowUndefined
    @hint("Flatten Y-axis rotation during target rotation")
    flattenDuringTargetRotation: boolean = true;

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
    private _currentAngle: number = 0;
    private _flatAngle: number = 0;
    private _targetDir: vec3 = new vec3(0, 0, 0);
    private _flatForward: vec3 = new vec3(0, 0, 0);
    
    /**
     * Called when component wakes up - initialize logger
     */
    onAwake(): void {
        const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
        this.logger = new Logger("TetherTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("TetherTS Initialization");
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
                this.logger.warn("No target set for Tether - please set a target object");
            } else {
                print("No target set for Tether - please set a target object");
            }
            return;
        }

        // Initialize target position
        this._targetPosition = this.calculateNewTargetPosition();
    }
    
    /**
     * Called every frame to update tether position
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        if (!this.target) return;

        // Calculate the angles
        this._currentAngle = this.calculateAngle();
        this._flatAngle = this.calculateFlatAngle();

        // Check if we need to reposition
        if (this.shouldReposition()) {
            this._targetPosition = this.calculateNewTargetPosition();
        }

        // Update position with lerping
        this.updateContentPosition();

    }
    
    /**
     * Calculate the new target position based on offset and rotation settings.
     */
    private calculateNewTargetPosition(): vec3 {
        const targetTransform = this.target.getTransform();
        const targetPos = targetTransform.getWorldPosition();
        
        if (this.reorientDuringTargetRotation) {
            if (this.flattenDuringTargetRotation) {
                // Get target's forward and right, but flatten them
                const targetRotation = targetTransform.getWorldRotation();
                
                // Get the forward direction
                const forward = this.getForwardVector(targetRotation);
                const flattenedForward = new vec3(forward.x, 0, forward.z).normalize();

                // Get the right direction
                const right = this.getRightVector(targetRotation);
                const flattenedRight = new vec3(right.x, 0, right.z).normalize();
                
                // Calculate new position using the flattened directions
                return new vec3(
                    targetPos.x + flattenedRight.x * this.offset.x + this.offset.y * 0 + flattenedForward.x * this.offset.z,
                    targetPos.y + flattenedRight.y * this.offset.x + this.offset.y * 1 + flattenedForward.y * this.offset.z,
                    targetPos.z + flattenedRight.z * this.offset.x + this.offset.y * 0 + flattenedForward.z * this.offset.z
                );
            } else {
                // Apply offset in target's local space
                const targetRot = targetTransform.getWorldRotation();

                // Transform offset by target's rotation
                const rotatedOffset = targetRot.multiplyVec3(this.offset);

                // Add to target position
                return targetPos.add(rotatedOffset);
            }
        }
        
        // Simple offset in world space
        return new vec3(
            targetPos.x + this.offset.x,
            targetPos.y + this.offset.y,
            targetPos.z + this.offset.z
        );
    }
    
    /**
     * Check if the content should be repositioned.
     */
    private shouldReposition(): boolean {
        const myPos = this.sceneObject.getTransform().getWorldPosition();
        const targetPos = this.target.getTransform().getWorldPosition();
        
        // Calculate displacement vector to target
        const toTarget = new vec3(
            myPos.x - targetPos.x,
            myPos.y - targetPos.y,
            myPos.z - targetPos.z
        );
        
        // Calculate vertical and horizontal distances
        const verticalDistance = Math.abs(toTarget.y);
        const horizontalDistance = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
        

        // Check if any threshold is exceeded
        return verticalDistance > this.verticalDistanceFromTarget || 
               horizontalDistance > this.horizontalDistanceFromTarget 
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
     * Calculate the angle between target's forward and direction to the object on XZ plane.
     */
    private calculateFlatAngle(): number {
        // Calculate direction from target to object
        const myPos = this.sceneObject.getTransform().getWorldPosition();
        const targetPos = this.target.getTransform().getWorldPosition();
        
        this._targetDir = new vec3(
            myPos.x - targetPos.x,
            0, // Ignore Y component for flat angle calculation
            myPos.z - targetPos.z
        );
        
        // Get target's forward vector and flatten it
        const targetRotation = this.target.getTransform().getWorldRotation();
        const forward = this.getForwardVector(targetRotation);
        this._flatForward = new vec3(forward.x, 0, forward.z).normalize();
        
        // Calculate the signed angle
        return this.signedAngle(this._targetDir, this._flatForward);
    }
    
    /**
     * Calculate the signed angle between two vectors on the XZ plane.
     */
    private signedAngle(from: vec3, to: vec3): number {
        // Ensure vectors are normalized
        const normalizedFrom = from.normalize();
        const normalizedTo = to.normalize();

        // Calculate the angle using dot product
        const dot = normalizedFrom.dot(normalizedTo);
        let angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

        // Determine the sign using cross product
        const cross = normalizedFrom.cross(normalizedTo);
        if (cross.y < 0) angle = -angle;

        return angle;
    }
    
    /**
     * Calculate the angle between target's forward and our forward.
     */
    private calculateAngle(): number {
        const myTransform = this.sceneObject.getTransform();
        const targetTransform = this.target.getTransform();

        // Get forward vectors (rotate local forward (0,0,1) by rotation)
        const myForward = myTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, 1));
        const targetForward = targetTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, 1));

        // Calculate the angle between them using dot product
        const dot = myForward.dot(targetForward);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

        return angle;
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
