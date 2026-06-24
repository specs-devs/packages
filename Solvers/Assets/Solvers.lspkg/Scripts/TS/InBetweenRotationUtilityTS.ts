/**
 * Specs Inc. 2026
 * Rotation utility for calculating in-between orientations of two targets. Computes the midpoint
 * rotation between two objects' forward directions using quaternion slerp interpolation, useful for
 * smooth camera positioning, look-at averaging, and balanced directional calculations.
 */
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class InBetweenRotationUtilityTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Two targets for in-between rotation calculation</span>')

    @input
    @allowUndefined
    @hint("First target for rotation calculation")
    target1!: SceneObject;

    @input
    @allowUndefined
    @hint("Second target for rotation calculation")
    target2!: SceneObject;

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

    /**
     * Called when component wakes up - initialize logger
     */
    onAwake(): void {
        const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
        this.logger = new Logger("InBetweenRotationUtilityTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("InBetweenRotationUtilityTS Initialization");
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

        if (!this.target1 || !this.target2) {
            this.logger.warn("Both targets must be set for InBetweenRotationUtility");
        }
    }
    
    /**
     * Called every frame to calculate in-between rotation
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        if (!this.target1 || !this.target2) return;

        const target1Forward = this.getForwardVector(this.target1);
        const target2Forward = this.getForwardVector(this.target2);

        // Apply the in-between rotation to this object
        const newRotation = this.getInBetweenRotation(target1Forward, target2Forward);
        this.sceneObject.getTransform().setWorldRotation(newRotation);
    }
    
    /**
     * Gets the in-between rotation between two transforms.
     * @param a The first transform
     * @param b The second transform
     * @returns The rotation exactly in between the forward directions of the two objects
     */
    getInBetweenRotationFromTransforms(a: SceneObject, b: SceneObject): quat {
        if (!a || !b) {
            this.logger.warn("Can't calculate in-between rotation - one or both objects are null");
            return new quat(0, 0, 0, 1); // Identity quaternion
        }
        
        // Get the forward vectors of both objects
        const forwardA = this.getForwardVector(a);
        const forwardB = this.getForwardVector(b);
        
        // Get the in-between rotation
        return this.getInBetweenRotation(forwardA, forwardB);
    }
    
    /**
     * Gets the in-between rotation between two arbitrary directions.
     * @param directionA The first direction as a vec3
     * @param directionB The second direction as a vec3
     * @returns The rotation exactly in between the two directions
     */
    getInBetweenRotation(directionA: vec3, directionB: vec3): quat {
        // Normalize the directions
        const normalizedA = directionA.normalize();
        const normalizedB = directionB.normalize();
        
        // Create quaternions based on the directions
        const rotationA = this.lookRotation(normalizedA);
        const rotationB = this.lookRotation(normalizedB);
        
        // Slerp between the two directions (50% interpolation for in-between)
        return quat.slerp(rotationA, rotationB, 0.5);
    }
    
    /**
     * Gets the forward vector from a transform.
     * @param obj The SceneObject to get the forward vector from
     * @returns The forward vector of the transform
     */
    private getForwardVector(obj: SceneObject): vec3 {
        if (!obj) return new vec3(0, 0, 1); // Default forward
        
        const transform = obj.getTransform();
        const worldRotation = transform.getWorldRotation();
        
        // Calculate forward vector (local Z axis in world space)
        // For a quat rotation, if we transform (0,0,1), we get the forward vector
        const forward = new vec3(0, 0, 1);
        return worldRotation.multiplyVec3(forward);
    }
    
    /**
     * Creates a quaternion that represents a rotation looking in a specified direction.
     * @param direction The direction to look at (forward vector)
     * @returns A quaternion representing the rotation
     */
    private lookRotation(direction: vec3): quat {
        // Simplified implementation of Quaternion.LookRotation
        // Default up vector is (0,1,0) - world up
        const up = new vec3(0, 1, 0);
        
        // Normalize direction
        const normalizedDirection = direction.normalize();

        // Handle the case when direction is parallel to up
        if (Math.abs(normalizedDirection.x) < 0.0001 &&
            Math.abs(normalizedDirection.z) < 0.0001) {
            // Looking straight up or down
            if (normalizedDirection.y > 0) {
                // Looking up, rotate 180 degrees around X axis
                return quat.fromEulerAngles(Math.PI, 0, 0);
            } else {
                // Looking down, no rotation needed
                return new quat(0, 0, 0, 1);
            }
        }

        // Calculate right vector (cross product of up and forward)
        const right = up.cross(normalizedDirection).normalize();

        // Recalculate up vector (cross product of forward and right)
        const newUp = normalizedDirection.cross(right);
        
        // Create rotation matrix from the orthonormal basis
        // Convert to quaternion
        const trace = right.x + newUp.y + normalizedDirection.z;
        
        if (trace > 0) {
            const s = 0.5 / Math.sqrt(trace + 1.0);
            return new quat(
                (newUp.z - normalizedDirection.y) * s,
                (normalizedDirection.x - right.z) * s,
                (right.y - newUp.x) * s,
                0.25 / s
            );
        } else {
            // Use the appropriate formula based on which diagonal element is largest
            if (right.x > newUp.y && right.x > normalizedDirection.z) {
                const s = 2.0 * Math.sqrt(1.0 + right.x - newUp.y - normalizedDirection.z);
                return new quat(
                    0.25 * s,
                    (right.y + newUp.x) / s,
                    (normalizedDirection.x + right.z) / s,
                    (newUp.z - normalizedDirection.y) / s
                );
            } else if (newUp.y > normalizedDirection.z) {
                const s = 2.0 * Math.sqrt(1.0 + newUp.y - right.x - normalizedDirection.z);
                return new quat(
                    (right.y + newUp.x) / s,
                    0.25 * s,
                    (newUp.z + normalizedDirection.y) / s,
                    (normalizedDirection.x - right.z) / s
                );
            } else {
                const s = 2.0 * Math.sqrt(1.0 + normalizedDirection.z - right.x - newUp.y);
                return new quat(
                    (normalizedDirection.x + right.z) / s,
                    (newUp.z + normalizedDirection.y) / s,
                    0.25 * s,
                    (right.y - newUp.x) / s
                );
            }
        }
    }
    
}
