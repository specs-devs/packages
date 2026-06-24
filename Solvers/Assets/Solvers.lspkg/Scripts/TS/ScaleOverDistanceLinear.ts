/**
 * Specs Inc. 2026
 * Linear scaling based on distance to target. Automatically adjusts object scale using linear
 * interpolation between min/max distance thresholds, with configurable scale range and real-time
 * distance calculation for distance-based size adjustments and depth perception effects.
 */
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class ScaleOverDistanceLinearTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Target object to measure distance from</span>')

    @input
    @allowUndefined
    @hint("Override default target mainCamera")
    target!: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distance Range</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Minimum and maximum distance thresholds for scaling</span>')

    @input
    @allowUndefined
    @hint("Minimum distance to map the scaling")
    minDistance: number = 1.0;

    @input
    @allowUndefined
    @hint("Maximum distance to map the scaling")
    maxDistance: number = 10.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Scale Range</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Scale values at minimum and maximum distances</span>')

    @input
    @allowUndefined
    @hint("Minimum scale value")
    minScale: number = 0.5;

    @input
    @allowUndefined
    @hint("Maximum scale value")
    maxScale: number = 2.0;

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

    private _distance: number = 0;

    /**
     * Called when component wakes up - initialize logger
     */
    onAwake(): void {
        const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
        this.logger = new Logger("ScaleOverDistanceLinearTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("ScaleOverDistanceLinearTS Initialization");
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
                this.logger.warn("No target set for ScaleOverDistanceLinear - please set a target object");
            } else {
                print("No target set for ScaleOverDistanceLinear - please set a target object");
            }
        }
    }

    /**
     * Called every frame to update scale based on distance
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        if (!this.target) return;

        this.updateScale();
    }
    
    /**
     * Update the scale based on distance to target.
     */
    private updateScale(): void {
        // Get positions
        const myPosition = this.sceneObject.getTransform().getWorldPosition();
        const targetPosition = this.target.getTransform().getWorldPosition();
        
        // Calculate distance
        this._distance = myPosition.distance(targetPosition);

        // Calculate scale value based on distance - clamp and remap
        const clampedDist = Math.max(this.minDistance, Math.min(this.maxDistance, this._distance));
        const t = (clampedDist - this.minDistance) / (this.maxDistance - this.minDistance);
        const scale = this.minScale + t * (this.maxScale - this.minScale);
        
        // Apply uniform scale
        this.sceneObject.getTransform().setLocalScale(new vec3(scale, scale, scale));
    }
    
}
