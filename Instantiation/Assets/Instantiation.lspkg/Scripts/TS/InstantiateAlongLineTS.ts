import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * Specs Inc. 2026
 * Linear instantiation utility that spawns objects evenly spaced along a line between two points.
 * Ideal for creating paths, borders, fences, or any linear object arrangements.
 */
@component
export class InstantiateAlongLineTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Line Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the prefab and start/end points for the line</span>')

    @input
    @hint("The prefab to instantiate")
    prefab!: ObjectPrefab;

    @input
    @hint("The start point of the line")
    startPoint!: SceneObject;

    @input
    @hint("The end point of the line")
    endPoint!: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify how many objects to place along the line</span>')

    @input
    @hint("Number of objects to instantiate along the line")
    numberOfObjects: number = 10;

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
    this.logger = new Logger("InstantiateAlongLineTS", this.enableLogging || this.enableLoggingLifecycle, true);
    
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
        this.instantiateObjectsAlongLine();
    }

    instantiateObjectsAlongLine(): void {
        if (this.numberOfObjects <= 0 || !this.prefab || !this.startPoint || !this.endPoint) {
            this.logger.debug("Please set all necessary references and ensure the number of objects is greater than zero.");
            return;
        }

        const startPosition = this.startPoint.getTransform().getWorldPosition();
        const endPosition = this.endPoint.getTransform().getWorldPosition();

        // Calculate direction vector
        const dx = endPosition.x - startPosition.x;
        const dy = endPosition.y - startPosition.y;
        const dz = endPosition.z - startPosition.z;

        // Calculate line length
        const lineLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Normalize direction vector
        const directionX = dx / lineLength;
        const directionY = dy / lineLength;
        const directionZ = dz / lineLength;

        // Calculate step size
        const step = lineLength / (this.numberOfObjects - 1);

        for (let i = 0; i < this.numberOfObjects; i++) {
            // Calculate the position for each object along the line
            const position = new vec3(
                startPosition.x + directionX * step * i,
                startPosition.y + directionY * step * i,
                startPosition.z + directionZ * step * i
            );

            // Create a prefab instance at the calculated position
            this.createPrefabInstance(position);
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
