import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * Specs Inc. 2026
 * Random box volume instantiation utility that spawns prefabs at random points inside a
 * box-shaped volume. Perfect for filling spaces with particles, debris, or scattered objects.
 */
@component
export class RandomPointsInsideBoxTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Box Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the box center and prefab to instantiate inside the volume</span>')

    @input
    @hint("Reference to the box (a SceneObject that defines the box center)")
    boxObject!: SceneObject;

    @input
    @hint("Prefab to instantiate")
    prefab!: ObjectPrefab;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure the number of random points and box dimensions</span>')

    @input
    @hint("Number of random points to generate")
    numberOfPoints: number = 10;

    @input
    @hint("Size of the box in x direction")
    sizeX: number = 1.0;

    @input
    @hint("Size of the box in y direction")
    sizeY: number = 1.0;

    @input
    @hint("Size of the box in z direction")
    sizeZ: number = 1.0;

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
    this.logger = new Logger("RandomPointsInsideBoxTS", this.enableLogging || this.enableLoggingLifecycle, true);
    
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
        this.generateRandomPointsInside();
    }
    
    generateRandomPointsInside(): void {
        if (!this.boxObject || !this.prefab) {
            this.logger.debug("Error: Box object or prefab not assigned!");
            return;
        }
        
        const boxPosition = this.boxObject.getTransform().getWorldPosition();
        
        // For the TypeScript version, we're using four SceneObjects as the vertices
        // of the box instead of a direct box collider.
        // We'll use the provided sizeX, sizeY, sizeZ parameters for the box dimensions
        
        for (let i = 0; i < this.numberOfPoints; i++) {
            // Generate random point within the box volume
            const randomPoint = new vec3(
                boxPosition.x + (Math.random() - 0.5) * this.sizeX,
                boxPosition.y + (Math.random() - 0.5) * this.sizeY,
                boxPosition.z + (Math.random() - 0.5) * this.sizeZ
            );
            
            // Create a prefab instance at the calculated position
            this.createPrefabInstance(randomPoint);
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
