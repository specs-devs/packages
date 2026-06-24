import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * Specs Inc. 2026
 * Random box surface instantiation utility that spawns prefabs at random points on the surface
 * of a box. Useful for decorating surfaces, creating texture effects, or wall decorations.
 */
@component
export class RandomPointsOnBoxSurfaceTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Box Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the box center and prefab to instantiate on the surface</span>')

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
    this.logger = new Logger("RandomPointsOnBoxSurfaceTS", this.enableLogging || this.enableLoggingLifecycle, true);
    
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
        this.generateRandomPointsOnSurface();
    }
    
    generateRandomPointsOnSurface(): void {
        if (!this.boxObject || !this.prefab) {
            this.logger.debug("Error: Box object or prefab not assigned!");
            return;
        }
        
        const boxPosition = this.boxObject.getTransform().getWorldPosition();
        
        for (let i = 0; i < this.numberOfPoints; i++) {
            // Generate a random point on the box surface
            const randomPoint = this.getRandomPointOnBoxSurface(boxPosition);
            
            // Create a prefab instance at the calculated position
            this.createPrefabInstance(randomPoint);
        }
    }
    
    // Helper method to generate a random point on the box surface
    private getRandomPointOnBoxSurface(boxCenter: vec3): vec3 {
        // Calculate the half-extents of the box
        const halfSizeX = this.sizeX / 2;
        const halfSizeY = this.sizeY / 2;
        const halfSizeZ = this.sizeZ / 2;
        
        // Randomly select one of the 6 faces of the box (0: +X, 1: -X, 2: +Y, 3: -Y, 4: +Z, 5: -Z)
        const randomFace = Math.floor(Math.random() * 6);
        
        let randomPoint = new vec3(0, 0, 0);
        
        switch (randomFace) {
            case 0: // +X face
                randomPoint = new vec3(
                    boxCenter.x + halfSizeX,
                    boxCenter.y + (Math.random() * 2 - 1) * halfSizeY,
                    boxCenter.z + (Math.random() * 2 - 1) * halfSizeZ
                );
                break;
                
            case 1: // -X face
                randomPoint = new vec3(
                    boxCenter.x - halfSizeX,
                    boxCenter.y + (Math.random() * 2 - 1) * halfSizeY,
                    boxCenter.z + (Math.random() * 2 - 1) * halfSizeZ
                );
                break;
                
            case 2: // +Y face
                randomPoint = new vec3(
                    boxCenter.x + (Math.random() * 2 - 1) * halfSizeX,
                    boxCenter.y + halfSizeY,
                    boxCenter.z + (Math.random() * 2 - 1) * halfSizeZ
                );
                break;
                
            case 3: // -Y face
                randomPoint = new vec3(
                    boxCenter.x + (Math.random() * 2 - 1) * halfSizeX,
                    boxCenter.y - halfSizeY,
                    boxCenter.z + (Math.random() * 2 - 1) * halfSizeZ
                );
                break;
                
            case 4: // +Z face
                randomPoint = new vec3(
                    boxCenter.x + (Math.random() * 2 - 1) * halfSizeX,
                    boxCenter.y + (Math.random() * 2 - 1) * halfSizeY,
                    boxCenter.z + halfSizeZ
                );
                break;
                
            case 5: // -Z face
                randomPoint = new vec3(
                    boxCenter.x + (Math.random() * 2 - 1) * halfSizeX,
                    boxCenter.y + (Math.random() * 2 - 1) * halfSizeY,
                    boxCenter.z - halfSizeZ
                );
                break;
        }
        
        return randomPoint;
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
