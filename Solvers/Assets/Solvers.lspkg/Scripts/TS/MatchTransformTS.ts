/**
 * Specs Inc. 2026
 * Transform matching utility with optional position, rotation, and scale synchronization. Follows
 * target transform with configurable per-axis constraints, smooth lerp interpolation, position offset,
 * and independent speed controls for position, rotation, and scale matching.
 */
import { MathUtils } from "Utilities.lspkg/Scripts/Utils/MathUtils";
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class MatchTransformTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Target object to match transform from</span>')

    @input
    @allowUndefined
    @hint("Override default target mainCamera")
    target!: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Position Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Position offset, lerp, and speed configuration</span>')

    @input
    @allowUndefined
    @hint("Position offset for matching the target's position")
    positionOffset: vec3 = new vec3(0, 0, 0);

    @input
    @allowUndefined
    @hint("Use lerping for smooth position transitions")
    usePositionLerp: boolean = true;

    @input
    @allowUndefined
    @hint("Speed for moving towards the target's position (when lerping is enabled)")
    positionLerpSpeed: number = 1.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Rotation and Scale Speeds</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Lerp speed for rotation and scale matching</span>')

    @input
    @allowUndefined
    @hint("Speed for rotating towards the target's rotation")
    rotationLerpSpeed: number = 1.0;

    @input
    @allowUndefined
    @hint("Speed for scaling towards the target's scale")
    scaleLerpSpeed: number = 1.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Position Constraints</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable to freeze position on specific axes</span>')

    @input
    @allowUndefined
    @hint("Toggle to constrain movement on specific axes")
    constrainPositionX: boolean = false;

    @input
    @allowUndefined
    constrainPositionY: boolean = false;

    @input
    @allowUndefined
    constrainPositionZ: boolean = false;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Rotation Constraints</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable to freeze rotation on specific axes</span>')

    @input
    @allowUndefined
    @hint("Toggle to constrain rotation on specific axes")
    constrainRotationX: boolean = false;

    @input
    @allowUndefined
    constrainRotationY: boolean = false;

    @input
    @allowUndefined
    constrainRotationZ: boolean = false;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Scale Constraints</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable to freeze scaling on specific axes</span>')

    @input
    @allowUndefined
    @hint("Toggle to constrain scaling on specific axes")
    constrainScaleX: boolean = false;

    @input
    @allowUndefined
    constrainScaleY: boolean = false;

    @input
    @allowUndefined
    constrainScaleZ: boolean = false;

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
        this.logger = new Logger("MatchTransformTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("MatchTransformTS Initialization");
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
                this.logger.info("No target set for MatchTransform - please set a target object");
            } else {
                print("No target set for MatchTransform - please set a target object");
            }
        }
    }

    /**
     * Called every frame
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        if (!this.target) return;

        this.updateTransform();
    }
    
    /**
     * Update this object's transform to match the target's transform with constraints.
     */
    private updateTransform(): void {
        // Get current transform details
        const myTransform = this.sceneObject.getTransform();
        const targetTransform = this.target.getTransform();
        
        // Handle position matching with optional constraints
        this.updatePosition(myTransform, targetTransform);
        
        // Handle rotation matching with optional constraints
        this.updateRotation(myTransform, targetTransform);
        
        // Handle scale matching with optional constraints
        this.updateScale(myTransform, targetTransform);
    }
    
    /**
     * Update the position based on target and constraints.
     */
    private updatePosition(myTransform: Transform, targetTransform: Transform): void {
        // Get target position
        const targetPos = targetTransform.getWorldPosition();
        
        // Apply offset in world space
        // Note: In a real implementation with proper transform hierarchy,
        // we would need to transform the offset from local to world space
        const targetPosition = new vec3(
            targetPos.x + this.positionOffset.x,
            targetPos.y + this.positionOffset.y,
            targetPos.z + this.positionOffset.z
        );
        
        const currentPosition = myTransform.getWorldPosition();
        
        // Apply constraints
        let newPosition = new vec3(
            this.constrainPositionX ? currentPosition.x : targetPosition.x,
            this.constrainPositionY ? currentPosition.y : targetPosition.y,
            this.constrainPositionZ ? currentPosition.z : targetPosition.z
        );
        
        // Apply lerp if enabled, otherwise use direct position matching
        if (this.usePositionLerp) {
            // Smooth transition with lerp
            const t = Math.min(1.0, this.positionLerpSpeed * getDeltaTime());
            newPosition = vec3.lerp(currentPosition, newPosition, t);
        } else {
            // Direct 1:1 position matching (no lerp)
            // newPosition is already set correctly from constraints
        }
        
        // Set the new position
        myTransform.setWorldPosition(newPosition);
    }
    
    /**
     * Update the rotation based on target and constraints.
     */
    private updateRotation(myTransform: Transform, targetTransform: Transform): void {
        const targetRotation = targetTransform.getWorldRotation();
        const currentRotation = myTransform.getWorldRotation();
        
        // Convert to Euler angles for constraints (MathUtils returns radians)
        const targetEuler = MathUtils.quaternionToEuler(targetRotation);
        const currentEuler = MathUtils.quaternionToEuler(currentRotation);
        
        // Apply constraints
        const newEuler = new vec3(
            this.constrainRotationX ? currentEuler.x : targetEuler.x,
            this.constrainRotationY ? currentEuler.y : targetEuler.y,
            this.constrainRotationZ ? currentEuler.z : targetEuler.z
        );
        
        // Convert back to quaternion
        const newRotation = quat.fromEulerAngles(newEuler.x, newEuler.y, newEuler.z);
        
        // Apply lerp
        const lerpedRotation = quat.slerp(
            currentRotation,
            newRotation,
            this.rotationLerpSpeed * getDeltaTime()
        );
        
        // Set the new rotation
        myTransform.setWorldRotation(lerpedRotation);
    }
    
    /**
     * Update the scale based on target and constraints.
     */
    private updateScale(myTransform: Transform, targetTransform: Transform): void {
        const targetScale = targetTransform.getWorldScale();
        const currentScale = myTransform.getLocalScale();
        
        // Apply constraints
        const newScale = new vec3(
            this.constrainScaleX ? currentScale.x : targetScale.x,
            this.constrainScaleY ? currentScale.y : targetScale.y,
            this.constrainScaleZ ? currentScale.z : targetScale.z
        );
        
        // Apply lerp
        const t = Math.min(1.0, this.scaleLerpSpeed * getDeltaTime());
        const lerpedScale = vec3.lerp(currentScale, newScale, t);
        
        // Set the new scale
        myTransform.setLocalScale(lerpedScale);
    }
    
}
