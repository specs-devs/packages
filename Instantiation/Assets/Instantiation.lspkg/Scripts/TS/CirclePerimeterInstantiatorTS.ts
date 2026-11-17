import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * SPECS Inc. 2027
 * Circle perimeter instantiation utility that spawns prefabs evenly spaced along the circumference
 * of a circle. Perfect for creating circular patterns, rings, or radial UI layouts.
 */
@component
export class CirclePerimeterInstantiatorTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Circle Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the center point and prefab to instantiate along the circle perimeter</span>')

    @input
    @hint("Center of the circle")
    center!: SceneObject;

    @input
    @hint("Prefab to instantiate")
    prefab!: ObjectPrefab;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure the number of objects and radius of the circle</span>')

    @input
    @hint("Number of prefabs to instantiate")
    numberOfPrefabs: number = 10;

    @input
    @hint("Radius of the circle")
    radius: number = 5.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Spawn the ring one prefab at a time so the order around the circle is visible</span>')

    @input
    @hint("Seconds between two spawns (0 = all at once)")
    spawnInterval: number = 0.12;

    @input
    @hint("Seconds each prefab takes to pop in from zero scale")
    popDuration: number = 0.3;

    @input
    @hint("When the ring is complete, wait, clear it and spawn it again")
    loop: boolean = true;

    @input
    @hint("Seconds the complete ring stays before it is cleared (when looping)")
    holdTime: number = 1.5;

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
    this.logger = new Logger("CirclePerimeterInstantiatorTS", this.enableLogging || this.enableLoggingLifecycle, true);
    
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

        this.createEvent("OnStartEvent").bind(() => {
            this.onStart();
            this.logger.debug("Onstart event triggered");
        });
    }
    

    
    // Spawned instances with their pop-in start time and target scale.
    private spawned: {obj: SceneObject; start: number; scale: vec3}[] = [];
    private nextIndex = 0;
    private nextSpawnTime = 0;
    private ringDoneTime = -1;

    onStart(): void {
        this.nextSpawnTime = getTime();
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }

    private onUpdate(): void {
        if (!this.center || !this.prefab) {
            return;
        }
        const now = getTime();
        const count = Math.max(1, Math.floor(this.numberOfPrefabs));
        // Spawn every prefab that is due (all at once when spawnInterval is 0).
        while (this.nextIndex < count && now >= this.nextSpawnTime) {
            this.spawnAt(this.nextIndex, count, now);
            this.nextIndex++;
            this.nextSpawnTime += Math.max(0, this.spawnInterval);
            if (this.nextIndex === count) {
                this.ringDoneTime = now;
            }
        }
        // Pop-in: scale from zero to the prefab's own scale with a small overshoot.
        for (const item of this.spawned) {
            const k = this.popDuration > 0 ? Math.min(1, (now - item.start) / this.popDuration) : 1;
            item.obj.getTransform().setLocalScale(item.scale.uniformScale(easeOutBack(k)));
        }
        // Loop: hold the full ring, clear it, start again.
        if (this.loop && this.ringDoneTime >= 0 && now - this.ringDoneTime > this.holdTime + this.popDuration) {
            this.clear();
            this.nextIndex = 0;
            this.nextSpawnTime = now;
            this.ringDoneTime = -1;
        }
    }

    // Method to instantiate all prefabs along the circle perimeter at once
    instantiatePrefabs(): void {
        const count = Math.max(1, Math.floor(this.numberOfPrefabs));
        const now = getTime();
        for (let i = 0; i < count; i++) {
            this.spawnAt(i, count, now);
        }
    }

    private spawnAt(i: number, count: number, now: number): void {
        if (!this.center || !this.prefab) {
            this.logger.debug("Error: Center or prefab not assigned!");
            return;
        }
        // Angle for this prefab (evenly spaced), offset in the center's local XY plane.
        const angle = i * Math.PI * 2 / count;
        const offset = new vec3(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius, 0);
        const centerTransform = this.center.getTransform();
        const instance = this.prefab.instantiate(this.sceneObject);
        const transform = instance.getTransform();
        transform.setWorldPosition(centerTransform.getWorldPosition().add(centerTransform.getWorldRotation().multiplyVec3(offset)));
        const scale = transform.getLocalScale();
        transform.setLocalScale(vec3.zero());
        this.spawned.push({obj: instance, start: now, scale: scale});
        this.logger.debug(`Created prefab instance ${i + 1}/${count}`);
    }

    private clear(): void {
        for (const item of this.spawned) {
            item.obj.destroy();
        }
        this.spawned = [];
    }

    // For visualization in the editor
    onDrawGizmos(): void {
        if (!this.center) return;
        
        const centerPos = this.center.getTransform().getWorldPosition();
        
        // Print visualization info
        this.logger.debug(`Drawing circle perimeter with radius ${this.radius} at center position ${centerPos.x}, ${centerPos.y}, ${centerPos.z}`);
    }
}

// 0 -> 1 with a small overshoot at the end, so each prefab "pops" into place.
function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
