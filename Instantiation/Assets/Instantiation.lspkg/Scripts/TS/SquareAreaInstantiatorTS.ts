import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * Specs Inc. 2026
 * Square area instantiation utility that spawns prefabs within a square area with random
 * placement. Perfect for creating scattered patterns in rectangular regions.
 */
@component
export class SquareAreaInstantiatorTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Square Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the center point and prefab to instantiate within the square area</span>')

    @input
    @hint("Center of the square area")
    center!: SceneObject;

    @input
    @hint("Prefab to instantiate")
    prefab!: ObjectPrefab;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure the number of objects and square size</span>')

    @input
    @hint("Number of prefabs to instantiate")
    numberOfPrefabs: number = 10;

    @input
    @hint("Size of the square (half-width/half-height)")
    size: number = 5.0;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;

    
    // Initialize with the proper pattern
    onAwake(): void {
    // Initialize logger
    this.logger = new Logger("SquareAreaInstantiatorTS", this.enableLogging || this.enableLoggingLifecycle, true);
    
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

        this.createEvent("OnStartEvent").bind(() => {
            this.onStart();
            this.logger.debug("Onstart event triggered");
        });
    }
    
    @bindStartEvent

    
    onStart(): void {
        this.instantiatePrefabs();
    }
    
    // Method to instantiate prefabs within the square area
    instantiatePrefabs(): void {
        if (!this.center || !this.prefab) {
            this.logger.debug("Error: Center or prefab not assigned!");
            return;
        }
        
        const centerPosition = this.center.getTransform().getWorldPosition();
        
        for (let i = 0; i < this.numberOfPrefabs; i++) {
            // Random position within the square area
            const randomPosition = new vec3(
                centerPosition.x + (Math.random() * 2 - 1) * this.size,
                centerPosition.y + (Math.random() * 2 - 1) * this.size,
                centerPosition.z
            );
            
            // Create a prefab instance at the calculated position
            this.createPrefabInstance(randomPosition);
        }
    }
    
    // Helper method to create a prefab instance at a specific position
    private createPrefabInstance(position: vec3): void {
        if (this.prefab) {
            const instance = this.prefab.instantiate(this.sceneObject);
            instance.getTransform().setWorldPosition(position);
            this.logger.debug(`Created prefab instance at position: ${position.x}, ${position.y}, ${position.z}`);
        }
    }
}
