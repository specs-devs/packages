/**
 * Specs Inc. 2026
 * Sharp turn detection system using position history and dot product analysis. Tracks movement path
 * over configurable frame buffer, detects directional changes via normalized vector comparison,
 * triggers callbacks on sharp turns (dot product < -0.1), and provides debug logging for tuning.
 */
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class SharpTurnTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Tracking Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Frame buffer and sampling settings for turn detection</span>')

    @input
    @allowUndefined
    @hint("Number of frames to skip between position checks")
    step: number = 10;

    @input
    @allowUndefined
    @hint("Number of frames to store for tracking movement")
    frameCount: number = 30;

    @input
    @allowUndefined
    @hint("Minimum distance between vertices to record a new position")
    minVertexDistance: number = 0.001;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Debug Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable detailed logging for troubleshooting</span>')

    @input
    @allowUndefined
    @hint("Enable debug logging")
    debug: boolean = false;

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

    // Events
    private _onTurn: (() => void)[] = [];
    
    // Internal tracking variables
    private _positions: vec3[] = [];
    private _currentIndex: number = 0;
    private _newestDirection: vec3 = new vec3(0, 0, 0);
    private _oldestDirection: vec3 = new vec3(0, 0, 0);
    
    /**
     * Called when component wakes up - initialize logger
     */
    onAwake(): void {
        const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
        this.logger = new Logger("SharpTurnTS", shouldLog, true);

        if (this.enableLoggingLifecycle) {
            this.logger.header("SharpTurnTS Initialization");
            this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
        }

        // Initialize positions array
        this._positions = new Array(this.frameCount).fill(null).map(() => new vec3(0, 0, 0));
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

        // Initialize the first position
        this._positions[this._currentIndex] = this.sceneObject.getTransform().getWorldPosition();
    }
    
    /**
     * Called every frame to detect sharp turns
     * Automatically bound to UpdateEvent via SnapDecorators
     */
    @bindUpdateEvent
    onUpdate(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onUpdate() - Update event");
        }

        // Get current position
        const currentPos = this.sceneObject.getTransform().getWorldPosition();

        // Only record position if moved enough
        if (currentPos.distance(this._positions[this._currentIndex]) > this.minVertexDistance) {
            // Move to the next index, looping around if necessary
            this._currentIndex = (this._currentIndex + 1) % this.frameCount;
            this._positions[this._currentIndex] = currentPos;

            // Ensure there are enough points for direction calculations
            if (this._currentIndex >= this.step) {
                // Calculate directions
                const prevIndex = (this._currentIndex - 1 + this.frameCount) % this.frameCount;
                const oldIndex = (this._currentIndex - this.step + this.frameCount) % this.frameCount;

                this._newestDirection = this._positions[this._currentIndex].sub(
                    this._positions[prevIndex]
                );

                this._oldestDirection = this._positions[this._currentIndex].sub(
                    this._positions[oldIndex]
                );

                // Detect sharp turn using dot product
                const dotProduct = this.detectDotProduct(this._newestDirection, this._oldestDirection);

                if (this.debug) {
                    if (this.enableLogging) {
                        this.logger.info("Dot Product: " + dotProduct.toFixed(4));
                    } else {
                        print("Dot Product: " + dotProduct.toFixed(4));
                    }
                }

                // Check if a sharp turn has occurred (dot product < -0.1)
                if (dotProduct < -0.1) {
                    if (this.debug) {
                        if (this.enableLogging) {
                            this.logger.info("Transform has sharp turned!");
                        } else {
                            print("Transform has sharp turned!");
                        }
                    }

                    // Trigger the turn event
                    this.triggerOnTurn();
                }
            }
        }
    }
    
    /**
     * Calculate the dot product between two direction vectors.
     * @param newestDirection The newest direction vector
     * @param oldestDirection The oldest direction vector
     * @returns The dot product (negative values indicate sharp turns)
     */
    private detectDotProduct(newestDirection: vec3, oldestDirection: vec3): number {
        // Normalize the vectors
        const normalized1 = newestDirection.normalize();
        const normalized2 = oldestDirection.normalize();

        // Calculate dot product
        return normalized1.dot(normalized2);
    }
    
    /**
     * Add a listener for the turn event.
     * @param callback The function to call when a sharp turn is detected
     */
    addOnTurnListener(callback: () => void): void {
        this._onTurn.push(callback);
    }
    
    /**
     * Remove a listener for the turn event.
     * @param callback The function to remove
     */
    removeOnTurnListener(callback: () => void): void {
        this._onTurn = this._onTurn.filter(cb => cb !== callback);
    }
    
    /**
     * Trigger all registered turn callbacks.
     */
    private triggerOnTurn(): void {
        for (const callback of this._onTurn) {
            callback();
        }
    }
}
