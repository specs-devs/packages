# WorldQueryHit

A comprehensive surface detection and interaction system for Spectacles that integrates with the Spectacles Interaction Kit to enable real-world surface placement and spatial awareness. This package provides ray-casting hit testing against detected surfaces in the physical environment, allowing users to place virtual objects on tables, walls, floors, and other real-world surfaces. With support for surface classification, filtering, and continuous tracking, WorldQueryHit transforms Spectacles into a powerful spatial computing platform.

## Features

- **Real-World Surface Detection** - Ray-cast against detected environmental surfaces
- **SIK Integration** - Seamless integration with Spectacles Interaction Kit for hand/controller input
- **Surface Classification** - Distinguish between ground, walls, and other surface types
- **Interactive Placement** - Tap to place objects on detected surfaces
- **Surface Normal Alignment** - Automatically orients placed objects to match surface angles
- **Hit Result Filtering** - Optional filtering for more reliable hit detection
- **Continuous Preview** - Real-time preview of placement position before confirmation
- **Multi-Object Support** - Switch between different prefabs to place
- **Distance-Based Raycasting** - Configurable ray start offset for optimal detection range

## Quick Start

```typescript
import { InteractorTriggerType, InteractorInputType } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

const WorldQueryModule = require("LensStudio:WorldQueryModule");

@component
export class WorldQueryExample extends BaseScriptComponent {
    @input
    targetObject: SceneObject;

    @input
    objectsToPlace: ObjectPrefab[];

    private hitTestSession: HitTestSession;
    private primaryInteractor: any;

    onAwake() {
        // Create hit test session with filtering enabled
        const options = HitTestSessionOptions.create();
        options.filter = true;
        this.hitTestSession = WorldQueryModule.createHitTestSessionWithOptions(options);

        // Hide preview until surface detected
        this.targetObject.enabled = false;

        // Set up placement on trigger release
        this.setupPlacementInteraction();

        // Update every frame
        this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
    }

    setupPlacementInteraction() {
        const allInteractors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All);

        for (const interactor of allInteractors) {
            interactor.onTriggerEnd.add(() => {
                this.placeObject();
            });
        }
    }

    onUpdate() {
        // Get the primary targeting interactor
        this.primaryInteractor = SIK.InteractionManager.getTargetingInteractors().shift();

        if (this.primaryInteractor && this.primaryInteractor.isActive() && this.primaryInteractor.isTargeting()) {
            // Create ray from interactor
            const rayStart = this.primaryInteractor.startPoint;
            const rayEnd = this.primaryInteractor.endPoint;

            // Perform hit test
            this.hitTestSession.hitTest(rayStart, rayEnd, (result: WorldQueryHitTestResult) => {
                if (result === null) {
                    this.targetObject.enabled = false;
                    return;
                }

                // Show preview at hit location
                this.targetObject.enabled = true;
                this.targetObject.getTransform().setWorldPosition(result.position);

                // Align to surface normal
                const lookDirection = this.calculateLookDirection(result.normal);
                const rotation = quat.lookAt(lookDirection, result.normal);
                this.targetObject.getTransform().setWorldRotation(rotation);
            });
        } else {
            this.targetObject.enabled = false;
        }
    }

    placeObject() {
        // Place object at current preview location
        if (!this.targetObject.enabled) return;

        const newObject = this.objectsToPlace[0].instantiate(null);
        newObject.getTransform().setWorldPosition(this.targetObject.getTransform().getWorldPosition());
        newObject.getTransform().setWorldRotation(this.targetObject.getTransform().getWorldRotation());

        print("Object placed!");
    }

    calculateLookDirection(normal: vec3): vec3 {
        const EPSILON = 0.01;
        if (1 - Math.abs(normal.normalize().dot(vec3.up())) < EPSILON) {
            return vec3.forward();
        }
        return normal.cross(vec3.up());
    }
}
```

## Script Highlights

### WorldQueryHitExampleTS

The WorldQueryHitExample script demonstrates the complete workflow for surface-aware object placement using ray-casting and the Spectacles Interaction Kit. It creates a HitTestSession with configurable filtering options, sets up interactor callbacks for trigger events, and continuously updates the hit test based on the user's targeting ray. The script maintains a preview object that follows the hit point in real-time, showing users where their placement will occur. When the user releases the trigger, the script instantiates a copy of the selected prefab at the preview location with the correct orientation. The implementation includes sophisticated surface normal handling to ensure objects are properly aligned even on angled surfaces like walls or slopes.

### HitTestClassificationTS

The HitTestClassification script extends the basic hit testing system with surface type detection, allowing developers to respond differently based on whether the user is targeting ground, walls, or other surface classifications. This script creates a HitTestSession with classification enabled and provides a callback that receives not just position and normal data, but also the SurfaceClassification enum value. This enables use cases like restricting placement to only floor surfaces, changing object appearance based on surface type, or triggering different behaviors when interacting with different environmental features. The classification system uses Spectacles' built-in computer vision to analyze detected surfaces and categorize them automatically.

### Hit Test Session Configuration

The WorldQueryModule provides flexible configuration through HitTestSessionOptions, allowing developers to balance detection reliability against performance. The filter option enables more robust surface detection by applying additional validation to hit results, reducing false positives from transient features or unstable tracking. Ray parameters include start and end points that define the 3D line segment to test against detected surfaces. The system efficiently handles multiple concurrent hit tests and automatically manages the underlying computer vision pipeline. Understanding these configuration options is crucial for creating responsive, reliable AR placement experiences.

### Surface Normal Alignment

Proper surface normal alignment is essential for making placed objects look grounded in the real world. The package includes helper methods for calculating appropriate look directions based on surface normals, handling edge cases like horizontal surfaces where the cross product with the up vector becomes undefined. The implementation uses a small epsilon value to detect near-parallel cases and falls back to a forward direction. For general cases, it calculates the cross product of the normal with the world up vector to get a tangent direction, then uses quat.lookAt to create a rotation that aligns the object's up vector with the surface normal while maintaining a stable forward direction.

## Core API Methods

### WorldQueryModule API

```typescript
// Create hit test session with default options
createHitTestSession(): HitTestSession;

// Create hit test session with custom options
createHitTestSessionWithOptions(options: HitTestSessionOptions): HitTestSession;

// Options configuration
HitTestSessionOptions.create(): HitTestSessionOptions;
options.filter: boolean;           // Enable more reliable hit detection
options.classification: boolean;   // Enable surface type classification
```

### HitTestSession API

```typescript
// Perform ray-cast hit test
hitTest(
    rayStart: vec3,
    rayEnd: vec3,
    callback: (result: WorldQueryHitTestResult | null) => void
): void;
```

### WorldQueryHitTestResult

```typescript
position: vec3;                    // World space hit point
normal: vec3;                      // Surface normal at hit point
classification: SurfaceClassification; // Surface type (if enabled)
```

### SurfaceClassification Enum

```typescript
SurfaceClassification.None         // Unknown surface type
SurfaceClassification.Ground       // Floor or ground plane
```

### SIK Integration

```typescript
// Get active targeting interactors
SIK.InteractionManager.getTargetingInteractors(): Interactor[];

// Get interactors by input type
SIK.InteractionManager.getInteractorsByType(type: InteractorInputType): Interactor[];

// Interactor properties
interactor.startPoint: vec3;       // Ray origin (hand/controller position)
interactor.endPoint: vec3;         // Ray target point
interactor.isActive(): boolean;
interactor.isTargeting(): boolean;

// Interactor events
interactor.onTriggerEnd.add(callback: () => void);
```

## Advanced Usage

### Example 1: Basic Object Placement with Preview

Create a simple placement system with real-time preview:

```typescript
const WorldQueryModule = require("LensStudio:WorldQueryModule");
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class SimplePlacement extends BaseScriptComponent {
    @input
    previewObject: SceneObject;

    @input
    prefabToPlace: ObjectPrefab;

    private hitTestSession: HitTestSession;
    private lastHitResult: WorldQueryHitTestResult | null = null;

    onAwake() {
        // Create basic hit test session
        this.hitTestSession = WorldQueryModule.createHitTestSession();
        this.previewObject.enabled = false;

        // Set up placement interaction
        const interactors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All);
        for (const interactor of interactors) {
            interactor.onTriggerEnd.add(() => {
                if (this.lastHitResult) {
                    this.placeObjectAt(this.lastHitResult);
                }
            });
        }

        this.createEvent("UpdateEvent").bind(this.updatePreview.bind(this));
    }

    updatePreview() {
        const interactor = SIK.InteractionManager.getTargetingInteractors().shift();

        if (!interactor || !interactor.isActive() || !interactor.isTargeting()) {
            this.previewObject.enabled = false;
            this.lastHitResult = null;
            return;
        }

        // Perform hit test with offset ray start for better range
        const rayStart = new vec3(
            interactor.startPoint.x,
            interactor.startPoint.y,
            interactor.startPoint.z + 30
        );
        const rayEnd = interactor.endPoint;

        this.hitTestSession.hitTest(rayStart, rayEnd, (result) => {
            if (result === null) {
                this.previewObject.enabled = false;
                this.lastHitResult = null;
                return;
            }

            // Update preview
            this.lastHitResult = result;
            this.previewObject.enabled = true;

            const transform = this.previewObject.getTransform();
            transform.setWorldPosition(result.position);

            // Align to surface
            const lookDir = this.getLookDirection(result.normal);
            const rotation = quat.lookAt(lookDir, result.normal);
            transform.setWorldRotation(rotation);
        });
    }

    placeObjectAt(hitResult: WorldQueryHitTestResult) {
        const newObject = this.prefabToPlace.instantiate(null);
        const transform = newObject.getTransform();

        transform.setWorldPosition(hitResult.position);

        const lookDir = this.getLookDirection(hitResult.normal);
        const rotation = quat.lookAt(lookDir, result.normal);
        transform.setWorldRotation(rotation);

        print("Placed object at: " + hitResult.position);
    }

    getLookDirection(normal: vec3): vec3 {
        const EPSILON = 0.01;
        const normalizedNormal = normal.normalize();

        if (1 - Math.abs(normalizedNormal.dot(vec3.up())) < EPSILON) {
            return vec3.forward();
        }

        return normalizedNormal.cross(vec3.up());
    }
}
```

**Key Points:**
- Ray start offset improves detection range
- Preview updates every frame for responsive feedback
- LastHitResult cached for placement on trigger release
- Surface alignment uses cross product for proper orientation

### Example 2: Multi-Object Palette with Switching

Allow users to choose between multiple objects to place:

```typescript
const WorldQueryModule = require("LensStudio:WorldQueryModule");
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class MultiObjectPlacement extends BaseScriptComponent {
    @input
    previewObjects: SceneObject[];

    @input
    prefabs: ObjectPrefab[];

    @input
    buttonNextObject: SceneObject;

    private hitTestSession: HitTestSession;
    private currentIndex: number = 0;
    private lastHitResult: WorldQueryHitTestResult | null = null;

    onAwake() {
        // Set up hit testing
        const options = HitTestSessionOptions.create();
        options.filter = true;
        this.hitTestSession = WorldQueryModule.createHitTestSessionWithOptions(options);

        // Hide all previews initially
        for (const preview of this.previewObjects) {
            preview.enabled = false;
        }

        // Show first object
        this.setActiveObject(0);

        // Set up object switching button
        if (this.buttonNextObject) {
            const interactable = this.buttonNextObject.getComponent("Component.InteractableComponent");
            if (interactable) {
                interactable.onTriggerEnd.add(() => {
                    this.nextObject();
                });
            }
        }

        // Set up placement
        const interactors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All);
        for (const interactor of interactors) {
            interactor.onTriggerEnd.add(() => {
                if (this.lastHitResult) {
                    this.placeCurrentObject();
                }
            });
        }

        this.createEvent("UpdateEvent").bind(this.updatePreview.bind(this));
    }

    setActiveObject(index: number) {
        // Hide all previews
        for (let i = 0; i < this.previewObjects.length; i++) {
            this.previewObjects[i].enabled = false;
        }

        // Show selected preview
        this.currentIndex = index;
        print(`Selected object: ${this.currentIndex + 1}/${this.previewObjects.length}`);
    }

    nextObject() {
        this.currentIndex = (this.currentIndex + 1) % this.previewObjects.length;
        this.setActiveObject(this.currentIndex);
    }

    updatePreview() {
        const interactor = SIK.InteractionManager.getTargetingInteractors().shift();

        if (!interactor || !interactor.isActive() || !interactor.isTargeting()) {
            this.previewObjects[this.currentIndex].enabled = false;
            this.lastHitResult = null;
            return;
        }

        const rayStart = new vec3(
            interactor.startPoint.x,
            interactor.startPoint.y,
            interactor.startPoint.z + 30
        );

        this.hitTestSession.hitTest(rayStart, interactor.endPoint, (result) => {
            if (result === null) {
                this.previewObjects[this.currentIndex].enabled = false;
                this.lastHitResult = null;
                return;
            }

            this.lastHitResult = result;
            const preview = this.previewObjects[this.currentIndex];
            preview.enabled = true;

            this.updateObjectTransform(preview, result);
        });
    }

    placeCurrentObject() {
        if (!this.lastHitResult) return;

        const newObject = this.prefabs[this.currentIndex].instantiate(null);
        this.updateObjectTransform(newObject, this.lastHitResult);

        print(`Placed object ${this.currentIndex + 1}`);
    }

    updateObjectTransform(obj: SceneObject, hitResult: WorldQueryHitTestResult) {
        const transform = obj.getTransform();
        transform.setWorldPosition(hitResult.position);

        const EPSILON = 0.01;
        let lookDir: vec3;

        if (1 - Math.abs(hitResult.normal.normalize().dot(vec3.up())) < EPSILON) {
            lookDir = vec3.forward();
        } else {
            lookDir = hitResult.normal.cross(vec3.up());
        }

        const rotation = quat.lookAt(lookDir, hitResult.normal);
        transform.setWorldRotation(rotation);
    }
}
```

**Key Points:**
- Multiple preview objects for visual feedback
- Button interaction for cycling through options
- Consistent transform logic shared between preview and placement
- Modulo arithmetic for wrapping object selection

### Example 3: Surface Classification for Conditional Placement

Only allow placement on specific surface types:

```typescript
const WorldQueryModule = require("LensStudio:WorldQueryModule");
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class ClassificationPlacement extends BaseScriptComponent {
    @input
    previewObject: SceneObject;

    @input
    prefab: ObjectPrefab;

    @input
    allowGroundOnly: boolean = true;

    private hitTestSession: HitTestSession;
    private lastValidHit: WorldQueryHitTestResult | null = null;

    onAwake() {
        // Enable classification
        const options = HitTestSessionOptions.create();
        options.classification = true;
        options.filter = true;
        this.hitTestSession = WorldQueryModule.createHitTestSessionWithOptions(options);

        this.previewObject.enabled = false;

        // Set up placement
        const interactors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All);
        for (const interactor of interactors) {
            interactor.onTriggerEnd.add(() => {
                if (this.lastValidHit) {
                    this.placeObject();
                }
            });
        }

        this.createEvent("UpdateEvent").bind(this.updatePreview.bind(this));
    }

    updatePreview() {
        const interactor = SIK.InteractionManager.getTargetingInteractors().shift();

        if (!interactor || !interactor.isActive() || !interactor.isTargeting()) {
            this.previewObject.enabled = false;
            this.lastValidHit = null;
            return;
        }

        const rayStart = new vec3(
            interactor.startPoint.x,
            interactor.startPoint.y,
            interactor.startPoint.z + 30
        );

        this.hitTestSession.hitTest(rayStart, interactor.endPoint, (result) => {
            if (result === null) {
                this.showInvalidPlacement();
                return;
            }

            // Check surface classification
            if (this.isValidSurface(result.classification)) {
                this.showValidPlacement(result);
            } else {
                this.showInvalidPlacement();
                print(`Invalid surface: ${result.classification}`);
            }
        });
    }

    isValidSurface(classification: SurfaceClassification): boolean {
        if (this.allowGroundOnly) {
            return classification === SurfaceClassification.Ground;
        }

        // Allow all classified surfaces (not None)
        return classification !== SurfaceClassification.None;
    }

    showValidPlacement(result: WorldQueryHitTestResult) {
        this.lastValidHit = result;
        this.previewObject.enabled = true;

        // Make preview green for valid placement
        const mesh = this.previewObject.getComponent("Component.RenderMeshVisual");
        if (mesh) {
            const material = mesh.getMaterial(0);
            material.mainPass.baseColor = new vec4(0, 1, 0, 0.5);
        }

        this.updateObjectTransform(this.previewObject, result);
    }

    showInvalidPlacement() {
        this.lastValidHit = null;
        this.previewObject.enabled = false;
    }

    placeObject() {
        if (!this.lastValidHit) return;

        const newObject = this.prefab.instantiate(null);
        this.updateObjectTransform(newObject, this.lastValidHit);

        print(`Placed on ${this.lastValidHit.classification} surface`);
    }

    updateObjectTransform(obj: SceneObject, hitResult: WorldQueryHitTestResult) {
        const transform = obj.getTransform();
        transform.setWorldPosition(hitResult.position);

        const EPSILON = 0.01;
        let lookDir: vec3;

        if (1 - Math.abs(hitResult.normal.normalize().dot(vec3.up())) < EPSILON) {
            lookDir = vec3.forward();
        } else {
            lookDir = hitResult.normal.cross(vec3.up());
        }

        const rotation = quat.lookAt(lookDir, hitResult.normal);
        transform.setWorldRotation(rotation);
    }
}
```

**Key Points:**
- Classification enabled in HitTestSessionOptions
- Surface type validation before allowing placement
- Visual feedback (green/hidden) for valid/invalid surfaces
- Configurable surface restrictions via @input parameter

### Example 4: Placement History with Undo

Track placed objects and support undo functionality:

```typescript
const WorldQueryModule = require("LensStudio:WorldQueryModule");
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class PlacementWithUndo extends BaseScriptComponent {
    @input
    previewObject: SceneObject;

    @input
    prefab: ObjectPrefab;

    @input
    undoButton: SceneObject;

    @input
    maxPlacedObjects: number = 20;

    private hitTestSession: HitTestSession;
    private placedObjects: SceneObject[] = [];
    private lastHitResult: WorldQueryHitTestResult | null = null;

    onAwake() {
        this.hitTestSession = WorldQueryModule.createHitTestSession();
        this.previewObject.enabled = false;

        // Set up placement
        const interactors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All);
        for (const interactor of interactors) {
            interactor.onTriggerEnd.add(() => {
                if (this.lastHitResult) {
                    this.placeObject();
                }
            });
        }

        // Set up undo button
        if (this.undoButton) {
            const interactable = this.undoButton.getComponent("Component.InteractableComponent");
            if (interactable) {
                interactable.onTriggerEnd.add(() => {
                    this.undo();
                });
            }
        }

        this.createEvent("UpdateEvent").bind(this.updatePreview.bind(this));
    }

    updatePreview() {
        const interactor = SIK.InteractionManager.getTargetingInteractors().shift();

        if (!interactor || !interactor.isActive() || !interactor.isTargeting()) {
            this.previewObject.enabled = false;
            this.lastHitResult = null;
            return;
        }

        const rayStart = new vec3(
            interactor.startPoint.x,
            interactor.startPoint.y,
            interactor.startPoint.z + 30
        );

        this.hitTestSession.hitTest(rayStart, interactor.endPoint, (result) => {
            if (result === null) {
                this.previewObject.enabled = false;
                this.lastHitResult = null;
                return;
            }

            this.lastHitResult = result;
            this.previewObject.enabled = true;

            const transform = this.previewObject.getTransform();
            transform.setWorldPosition(result.position);

            const lookDir = this.getLookDirection(result.normal);
            const rotation = quat.lookAt(lookDir, result.normal);
            transform.setWorldRotation(rotation);
        });
    }

    placeObject() {
        if (!this.lastHitResult) return;

        // Check limit
        if (this.placedObjects.length >= this.maxPlacedObjects) {
            // Remove oldest object
            const oldest = this.placedObjects.shift();
            if (oldest) {
                oldest.destroy();
            }
        }

        // Place new object
        const newObject = this.prefab.instantiate(null);
        const transform = newObject.getTransform();

        transform.setWorldPosition(this.lastHitResult.position);

        const lookDir = this.getLookDirection(this.lastHitResult.normal);
        const rotation = quat.lookAt(lookDir, this.lastHitResult.normal);
        transform.setWorldRotation(rotation);

        // Track object
        this.placedObjects.push(newObject);

        print(`Placed object ${this.placedObjects.length}/${this.maxPlacedObjects}`);
    }

    undo() {
        if (this.placedObjects.length === 0) {
            print("Nothing to undo");
            return;
        }

        // Remove most recent object
        const lastObject = this.placedObjects.pop();
        if (lastObject) {
            lastObject.destroy();
            print(`Undone. ${this.placedObjects.length} objects remaining`);
        }
    }

    clearAll() {
        for (const obj of this.placedObjects) {
            obj.destroy();
        }
        this.placedObjects = [];
        print("Cleared all placed objects");
    }

    getLookDirection(normal: vec3): vec3 {
        const EPSILON = 0.01;
        const normalizedNormal = normal.normalize();

        if (1 - Math.abs(normalizedNormal.dot(vec3.up())) < EPSILON) {
            return vec3.forward();
        }

        return normalizedNormal.cross(vec3.up());
    }
}
```

**Key Points:**
- Array tracks all placed objects
- FIFO queue with maximum capacity
- Undo removes most recent placement
- Cleanup method for destroying all objects

Built with 👻 by the Spectacles team


