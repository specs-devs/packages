/**
 * Specs Inc. 2026
 * Billboard solver for Y-axis rotation to face a target. Automatically rotates object to face target
 * with smooth slerp interpolation, optional look-away mode, and flattened rotation on XZ plane for
 * consistent horizontal orientation without pitch or roll.
 */
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class BillboardTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Billboard Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Target selection and orientation settings</span>')

    @input
    @allowUndefined
    @hint("Is billboard looking at default direction or opposite?")
    lookAway: boolean = true;

    @input
    @allowUndefined
    @hint("Override default target mainCamera with your target")
    target!: SceneObject;

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

    private _targetRotation: quat = new quat(0, 0, 0, 1);
    private _lookDir: vec3 = new vec3(0, 0, 0);

    /**
     * Called when component wakes up - initialize logger
     */
    onAwake(): void {
        const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
        this.logger = new Logger("BillboardTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("BillboardTS Initialization");
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

        // Camera handling is simplified as we don't have direct Camera.main access
        if (!this.target) {
            // In a real implementation, we would find the main camera
            // For now, this will be handled by the user setting the target
        }
    }

    /**
     * Called every frame to update billboard orientation
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        this.billboarding();
    }
    
    /**
     * Update the billboard orientation to face the target.
     */
    billboarding(): void {
        if (!this.target) return;
        
        const myPosition = this.sceneObject.getTransform().getWorldPosition();
        const targetPosition = this.target.getTransform().getWorldPosition();
        
        // Get the direction to the target but flatten on the X and Z axes (only Y axis rotation)
        this._lookDir = new vec3(
            targetPosition.x - myPosition.x,
            0, // Keep only Y axis rotation by zeroing out the Y component
            targetPosition.z - myPosition.z
        ).normalize();
        
        if (this.lookAway) {
            this._lookDir.x *= -1;
            this._lookDir.z *= -1;
        }
        
        // Convert the direction to a quaternion (y-axis rotation)
        // For y-axis rotation, we only care about the xz plane angle
        const angle = Math.atan2(this._lookDir.x, this._lookDir.z);
        this._targetRotation = quat.fromEulerAngles(0, angle, 0);
        
        // Get current rotation
        const currentRotation = this.sceneObject.getTransform().getWorldRotation();
        
        // Slerp between current and target rotation
        const newRotation = quat.slerp(
            currentRotation,
            this._targetRotation,
            getDeltaTime() * 5 // Adjust speed as needed
        );
        
        // Apply the new rotation
        this.sceneObject.getTransform().setWorldRotation(newRotation);
        
    }
    
}
