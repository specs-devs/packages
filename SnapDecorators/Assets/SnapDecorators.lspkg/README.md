# SnapDecorators

A powerful TypeScript decorator library for Spectacles development that simplifies component lifecycle management, dependency injection, and memoization. SnapDecorators leverages modern JavaScript decorator syntax to eliminate boilerplate code, automatically wire up event handlers, inject component dependencies, and optimize getter performance. This package transforms verbose Lens Studio component patterns into clean, declarative code using the Stage 3 TC39 decorator proposal, making your scripts more readable, maintainable, and less error-prone.

## Features

- **Event Binding Decorators** - Automatically bind methods to scene events without manual createEvent() calls
- **Lifecycle Event Support** - Decorators for OnStartEvent, UpdateEvent, LateUpdateEvent, OnEnableEvent, OnDisableEvent, and OnDestroyEvent
- **Memoization Decorator** - Cache getter results to avoid repeated expensive calculations
- **Dependency Injection** - Auto-inject components from the same SceneObject or parent hierarchy
- **Type-Safe Assertions** - Runtime validation utilities with TypeScript type guards
- **Error Reporting** - Enhanced error messages with source-mapped stack traces and scene hierarchy paths
- **Zero Runtime Overhead** - Decorators compile to efficient initialization code
- **Promise-Aware Event Handlers** - Automatic error catching for async methods

## Quick Start

```typescript
import { bindStartEvent, bindUpdateEvent, memo, depends, provider } from "./SnapDecorators.lspkg/decorators";
import { assert, verify } from "./SnapDecorators.lspkg/assert";

@component
export class DecoratorExample extends BaseScriptComponent {
    // Automatically inject Transform component from this SceneObject
    @depends("Component.Transform")
    transform!: Transform;

    // Automatically inject Camera component from parent hierarchy
    @provider("Component.Camera")
    camera!: Camera;

    // Memoized getter - computed once, then cached
    @memo
    get expensiveCalculation(): number {
        print("Computing expensive value...");
        return Math.sqrt(Math.random() * 1000);
    }

    // Automatically bound to OnStartEvent
    @bindStartEvent
    onStart() {
        assert(this.transform !== null, "Transform should be injected");
        print("Started with transform: " + this.transform);

        // Access memoized value multiple times - only computes once
        print(this.expensiveCalculation);
        print(this.expensiveCalculation); // Uses cached value
    }

    // Automatically bound to UpdateEvent
    @bindUpdateEvent
    onUpdate() {
        const pos = this.transform.getWorldPosition();
        print(`Position: ${pos.x}, ${pos.y}, ${pos.z}`);
    }

    // Supports async methods with automatic error handling
    @bindStartEvent
    async loadData() {
        await this.fetchRemoteData();
        print("Data loaded successfully");
    }

    async fetchRemoteData(): Promise<void> {
        // Errors are automatically caught and reported
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
```

## Script Highlights

### Event Binding Decorators

The event binding decorators automatically register your methods as event handlers during component initialization, eliminating the need for manual createEvent() calls in onAwake(). These decorators inject initialization code that runs before your onAwake method, setting up event bindings and wrapping your target method to preserve the correct `this` context. For async methods, the decorator automatically wraps the return promise with a catch handler that reports errors using the enhanced error reporting system. This means you can write clean, declarative event handlers without worrying about event registration boilerplate or promise rejection handling. The decorator supports all major Lens Studio lifecycle events including OnStartEvent, UpdateEvent, LateUpdateEvent, OnEnableEvent, OnDisableEvent, and OnDestroyEvent.

### Memoization Decorator

The memo decorator transforms getters into lazily-computed, cached properties that only calculate their value once. When you first access a memoized getter, it executes the getter function and replaces itself with a simple data property containing the result. Subsequent accesses read directly from this cached property without re-executing the getter logic. This is particularly useful for expensive computations like finding components in the scene hierarchy, calculating complex transformations, or building lookup tables. The decorator validates that it's only applied to getters (not setters or regular methods) and uses Object.defineProperty to replace the getter with the cached value while maintaining configurability and enumerability.

### Dependency Injection Decorators

The depends and provider decorators implement automatic dependency injection for components, eliminating manual getComponent() calls and null checking. The depends decorator injects a component from the same SceneObject, while provider searches up the parent hierarchy to find the nearest matching component. Both decorators execute during field initialization (before onAwake) and use assertion utilities to fail fast with helpful error messages if dependencies aren't found. The error messages include the full scene hierarchy path of the component, making it easy to identify which object is missing its dependency. This pattern encourages composition, reduces coupling, and makes component requirements explicit through field declarations.

### Assertion Utilities

The assert function provides runtime validation with TypeScript's asserts keyword, narrowing types after successful checks. Unlike simple if statements, assert throws an Error with a custom message, making it ideal for precondition checks and invariant validation. The verify function is a specialized assertion for null/undefined checks that both validates and returns a non-null type, allowing you to assert and assign in a single expression. These utilities integrate with the error reporting system to provide source-mapped stack traces and should be used liberally to catch bugs early in development.

### Debug Utilities

The debug module provides enhanced error reporting and scene hierarchy path generation. The reportError function detects Error objects, applies source maps to their stack traces, and formats them for printing, while also handling non-Error values gracefully. The spath function generates unique identifiers for scene objects and components based on their position in the hierarchy, creating paths like "/ParentObject/ChildObject:ScriptComponent" that make debugging messages much more informative. These utilities are used internally by the decorator system but are also exported for use in your own code.

## Core API Methods

### Event Binding Decorators

```typescript
@bindStartEvent       // Binds to OnStartEvent
@bindUpdateEvent      // Binds to UpdateEvent
@bindLateUpdateEvent  // Binds to LateUpdateEvent
@bindEnableEvent      // Binds to OnEnableEvent
@bindDisableEvent     // Binds to OnDisableEvent
@bindDestroyEvent     // Binds to OnDestroyEvent

// Usage pattern
@component
export class MyScript extends BaseScriptComponent {
    @bindStartEvent
    initialize() {
        // Automatically called on start
    }

    @bindUpdateEvent
    tick() {
        // Automatically called every frame
    }

    @bindStartEvent
    async loadAssets() {
        // Async methods supported - errors auto-caught
        await this.fetchData();
    }
}
```

### Memoization Decorator

```typescript
@memo

// Usage pattern
@component
export class MyScript extends BaseScriptComponent {
    @memo
    get cachedValue(): number {
        print("Computing value...");
        return Math.random() * 100;
    }

    @bindStartEvent
    useValue() {
        print(this.cachedValue); // Prints "Computing value..." then number
        print(this.cachedValue); // Just prints number (cached)
    }
}
```

### Dependency Injection Decorators

```typescript
@depends(componentType: keyof ComponentNameMap)
@provider(componentType: keyof ComponentNameMap)

// Usage pattern
@component
export class MyScript extends BaseScriptComponent {
    @depends("Component.Transform")
    transform!: Transform;

    @depends("Component.Camera")
    camera!: Camera;

    @provider("Component.RenderMeshVisual")
    mesh!: RenderMeshVisual; // Searches up parent hierarchy
}
```

### Assertion Utilities

```typescript
// Assert condition is true, throw Error if false
assert(condition: unknown, message?: string): asserts condition;

// Verify value is not null/undefined, return non-null value
verify<T>(value: T, message?: string): NonNullable<T>;

// Usage pattern
const component = verify(
    sceneObject.getComponent("Component.Transform"),
    "Transform component required"
);

assert(distance < maxDistance, "Distance exceeded maximum");
```

### Debug Utilities

```typescript
// Report error with source-mapped stack trace
reportError(reason: unknown): void;

// Generate scene hierarchy path for object or component
spath(node: SceneObject | Component): string;

// Usage pattern
try {
    await fetchData();
} catch (error) {
    reportError(error); // Prints formatted error with source map
}

print(`Component path: ${spath(this)}`); // "/Parent/Child:ScriptComponent"
```

## Advanced Usage

### Example 1: Complete Component with All Decorators

Combine all decorator types to create a clean, fully-featured component:

```typescript
import { bindStartEvent, bindUpdateEvent, bindDestroyEvent, memo, depends, provider } from "./SnapDecorators.lspkg/decorators";
import { assert, verify } from "./SnapDecorators.lspkg/assert";
import { reportError, spath } from "./SnapDecorators.lspkg/debug";

@component
export class FullyDecoratedComponent extends BaseScriptComponent {
    @input
    targetObject: SceneObject;

    // Dependency injection
    @depends("Component.Transform")
    private transform!: Transform;

    @provider("Component.Camera")
    private camera!: Camera;

    // Memoized expensive calculations
    @memo
    get lookupTable(): Map<string, number> {
        print("Building lookup table...");
        const table = new Map<string, number>();
        for (let i = 0; i < 1000; i++) {
            table.set(`key${i}`, i * 2);
        }
        return table;
    }

    @memo
    get initialPosition(): vec3 {
        print("Caching initial position...");
        return this.transform.getWorldPosition();
    }

    // Event handlers
    @bindStartEvent
    async initialize() {
        try {
            print(`Initialized at: ${spath(this)}`);

            // Dependencies are guaranteed to be injected
            assert(this.transform !== null, "Transform injected");
            assert(this.camera !== null, "Camera found in hierarchy");

            // Memoized getters computed once
            print(`Initial pos: ${this.initialPosition}`);
            print(`Table size: ${this.lookupTable.size}`);

            // Async initialization
            await this.loadRemoteConfig();

        } catch (error) {
            reportError(error);
        }
    }

    @bindUpdateEvent
    updatePosition() {
        // Access memoized values without recomputation
        const offset = this.lookupTable.get("key42") || 0;
        const currentPos = this.transform.getWorldPosition();

        // Calculate distance from initial position
        const dx = currentPos.x - this.initialPosition.x;
        const dy = currentPos.y - this.initialPosition.y;
        const dz = currentPos.z - this.initialPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance > 5.0) {
            print("Moved more than 5 meters from start");
        }
    }

    @bindDestroyEvent
    cleanup() {
        print(`Cleaning up: ${spath(this)}`);
        // Cleanup code here
    }

    private async loadRemoteConfig(): Promise<void> {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        print("Config loaded");
    }
}
```

**Key Points:**
- All dependencies injected before onAwake
- Memoized getters computed once on first access
- Event handlers automatically registered
- Async methods have automatic error handling
- Clean, declarative code with minimal boilerplate

### Example 2: Async Event Handlers with Error Handling

Use async event handlers with automatic promise rejection handling:

```typescript
import { bindStartEvent, bindUpdateEvent } from "./SnapDecorators.lspkg/decorators";
import { reportError } from "./SnapDecorators.lspkg/debug";

@component
export class AsyncEventExample extends BaseScriptComponent {
    private dataLoaded: boolean = false;
    private userData: any = null;

    // Async start event - errors automatically caught
    @bindStartEvent
    async loadInitialData() {
        print("Loading user data...");

        try {
            this.userData = await this.fetchUserData();
            this.dataLoaded = true;
            print("User data loaded successfully");
        } catch (error) {
            // This catch is optional - decorator handles uncaught errors
            print("Failed to load user data");
            reportError(error);
        }
    }

    // Multiple async handlers for the same event
    @bindStartEvent
    async initializeServices() {
        await this.connectToServer();
        await this.authenticateUser();
        print("Services initialized");
    }

    @bindUpdateEvent
    checkDataStatus() {
        if (!this.dataLoaded) {
            // Still loading
            return;
        }

        // Use loaded data
        print(`User ID: ${this.userData.id}`);
    }

    private async fetchUserData(): Promise<any> {
        // Simulate network request
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.1) {
                    resolve({ id: 123, name: "User" });
                } else {
                    reject(new Error("Network timeout"));
                }
            }, 500);
        });
    }

    private async connectToServer(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    private async authenticateUser(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}
```

**Key Points:**
- Multiple handlers can bind to the same event
- Async methods return promises that are automatically caught
- Manual try/catch is optional but allows custom error handling
- Decorator ensures uncaught promise rejections are reported

### Example 3: Memoization for Scene Hierarchy Lookups

Use memoization to cache expensive scene hierarchy searches:

```typescript
import { bindStartEvent, bindUpdateEvent, memo } from "./SnapDecorators.lspkg/decorators";
import { verify } from "./SnapDecorators.lspkg/assert";

@component
export class HierarchyLookupExample extends BaseScriptComponent {
    @input
    rootObject: SceneObject;

    // Cache all child transforms - computed once
    @memo
    get allChildTransforms(): Transform[] {
        print("Searching for all child transforms...");
        const transforms: Transform[] = [];
        this.collectTransforms(this.rootObject, transforms);
        print(`Found ${transforms.length} transforms`);
        return transforms;
    }

    // Cache specific named objects
    @memo
    get playerObject(): SceneObject {
        print("Finding player object...");
        return verify(
            this.findObjectByName(this.rootObject, "Player"),
            "Player object not found in hierarchy"
        );
    }

    @memo
    get enemyObjects(): SceneObject[] {
        print("Finding all enemy objects...");
        const enemies: SceneObject[] = [];
        this.collectObjectsByPrefix(this.rootObject, "Enemy_", enemies);
        return enemies;
    }

    @bindStartEvent
    initialize() {
        // These lookups only happen once, results are cached
        print(`Total transforms: ${this.allChildTransforms.length}`);
        print(`Player: ${this.playerObject.name}`);
        print(`Enemies: ${this.enemyObjects.length}`);
    }

    @bindUpdateEvent
    updateEntities() {
        // Access cached results with zero overhead
        for (const enemy of this.enemyObjects) {
            this.updateEnemy(enemy);
        }

        this.updatePlayer(this.playerObject);
    }

    private collectTransforms(obj: SceneObject, output: Transform[]): void {
        const transform = obj.getComponent("Component.Transform");
        if (transform) output.push(transform);

        for (let i = 0; i < obj.getChildrenCount(); i++) {
            this.collectTransforms(obj.getChild(i), output);
        }
    }

    private findObjectByName(obj: SceneObject, name: string): SceneObject | null {
        if (obj.name === name) return obj;

        for (let i = 0; i < obj.getChildrenCount(); i++) {
            const result = this.findObjectByName(obj.getChild(i), name);
            if (result) return result;
        }

        return null;
    }

    private collectObjectsByPrefix(obj: SceneObject, prefix: string, output: SceneObject[]): void {
        if (obj.name.startsWith(prefix)) {
            output.push(obj);
        }

        for (let i = 0; i < obj.getChildrenCount(); i++) {
            this.collectObjectsByPrefix(obj.getChild(i), prefix, output);
        }
    }

    private updateEnemy(enemy: SceneObject): void {
        // Enemy update logic
    }

    private updatePlayer(player: SceneObject): void {
        // Player update logic
    }
}
```

**Key Points:**
- Scene hierarchy searches are expensive - memoize them
- First access computes and caches the result
- Subsequent accesses are instant property reads
- Perfect for initialization-time lookups

### Example 4: Dependency Injection Patterns

Advanced dependency injection with both depends and provider:

```typescript
import { depends, provider, bindStartEvent } from "./SnapDecorators.lspkg/decorators";
import { assert } from "./SnapDecorators.lspkg/assert";

@component
export class DependencyExample extends BaseScriptComponent {
    // Inject from same SceneObject
    @depends("Component.Transform")
    private transform!: Transform;

    @depends("Component.RenderMeshVisual")
    private mesh!: RenderMeshVisual;

    // Inject from parent hierarchy
    @provider("Component.Camera")
    private camera!: Camera;

    @provider("Component.AudioListenerComponent")
    private audioListener!: AudioListenerComponent;

    // Manual injection for optional dependencies
    private optionalLight?: Component.Light;

    @bindStartEvent
    initialize() {
        // Required dependencies guaranteed to exist
        assert(this.transform !== null, "Transform injected");
        assert(this.mesh !== null, "Mesh injected");
        assert(this.camera !== null, "Camera found in hierarchy");
        assert(this.audioListener !== null, "AudioListener found");

        // Handle optional dependency manually
        this.optionalLight = this.sceneObject.getComponent("Component.Light");
        if (this.optionalLight) {
            print("Light component available");
        } else {
            print("No light component - using defaults");
        }

        // Use injected dependencies
        this.setupMesh();
        this.calculateDistanceToCamera();
    }

    @bindStartEvent
    setupMesh() {
        // Mesh is guaranteed to be available
        const material = this.mesh.getMaterial(0);
        material.mainPass.baseColor = new vec4(1, 0, 0, 1);
    }

    @bindStartEvent
    calculateDistanceToCamera() {
        const myPos = this.transform.getWorldPosition();
        const camPos = this.camera.getSceneObject().getTransform().getWorldPosition();

        const dx = camPos.x - myPos.x;
        const dy = camPos.y - myPos.y;
        const dz = camPos.z - myPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        print(`Distance to camera: ${distance}m`);
    }
}
```

**Key Points:**
- @depends searches only on the same SceneObject
- @provider searches up the parent hierarchy
- Dependencies injected before any event handlers run
- Assertion failures provide helpful error messages with scene paths

### Example 5: Custom Validation with Assertions

Use assertions for runtime validation and type narrowing:

```typescript
import { bindStartEvent, depends } from "./SnapDecorators.lspkg/decorators";
import { assert, verify } from "./SnapDecorators.lspkg/assert";

@component
export class ValidationExample extends BaseScriptComponent {
    @input
    minValue: number = 0;

    @input
    maxValue: number = 100;

    @input
    targetObject: SceneObject;

    @depends("Component.Transform")
    private transform!: Transform;

    @bindStartEvent
    validateInputs() {
        // Validate numeric ranges
        assert(this.minValue >= 0, "minValue must be non-negative");
        assert(this.maxValue > this.minValue, "maxValue must be greater than minValue");
        assert(this.maxValue <= 1000, "maxValue must not exceed 1000");

        // Validate object references
        assert(this.targetObject !== null, "targetObject must be assigned");
        assert(this.targetObject !== undefined, "targetObject must be assigned");

        // Verify returns non-null value
        const targetTransform = verify(
            this.targetObject.getComponent("Component.Transform"),
            "Target must have Transform component"
        );

        // targetTransform is typed as Transform (not Transform | null)
        const pos = targetTransform.getWorldPosition();
        print(`Target at: ${pos.x}, ${pos.y}, ${pos.z}`);

        // Validate positions
        this.validatePosition(pos);
    }

    private validatePosition(pos: vec3): void {
        // Runtime validation with helpful messages
        assert(!isNaN(pos.x), "Position X is NaN");
        assert(!isNaN(pos.y), "Position Y is NaN");
        assert(!isNaN(pos.z), "Position Z is NaN");
        assert(isFinite(pos.x), "Position X is infinite");
        assert(isFinite(pos.y), "Position Y is infinite");
        assert(isFinite(pos.z), "Position Z is infinite");

        const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        assert(magnitude < 1000, `Position magnitude ${magnitude} exceeds maximum`);
    }

    @bindStartEvent
    processValue(value: number | null) {
        // Verify handles null/undefined gracefully
        const safeValue = verify(value, "Value must not be null");

        // safeValue is typed as number (not number | null)
        const doubled = safeValue * 2;
        print(`Doubled value: ${doubled}`);
    }
}
```

**Key Points:**
- assert() throws Error with custom message if condition is false
- verify() validates and returns non-null value
- TypeScript type narrowing works with both utilities
- Use liberally for preconditions and invariants

### Example 6: Error Reporting and Debugging

Enhanced error reporting with scene hierarchy paths:

```typescript
import { bindStartEvent, bindUpdateEvent } from "./SnapDecorators.lspkg/decorators";
import { reportError, spath } from "./SnapDecorators.lspkg/debug";

@component
export class ErrorReportingExample extends BaseScriptComponent {
    @input
    targetObject: SceneObject;

    private errorCount: number = 0;
    private maxErrors: number = 5;

    @bindStartEvent
    initialize() {
        print(`Component initialized at: ${spath(this)}`);
        print(`Target object path: ${spath(this.targetObject)}`);

        try {
            this.riskyOperation();
        } catch (error) {
            // reportError applies source maps and formats nicely
            print("Caught error during initialization:");
            reportError(error);
        }
    }

    @bindUpdateEvent
    async updateWithErrorHandling() {
        try {
            await this.performAsyncOperation();
        } catch (error) {
            this.errorCount++;

            if (this.errorCount <= this.maxErrors) {
                print(`Error #${this.errorCount} at ${spath(this)}:`);
                reportError(error);
            }

            if (this.errorCount === this.maxErrors) {
                print("Maximum errors reached, suppressing further reports");
            }
        }
    }

    private riskyOperation(): void {
        // Simulate operation that might fail
        if (Math.random() > 0.7) {
            throw new Error("Random failure in riskyOperation");
        }
    }

    private async performAsyncOperation(): Promise<void> {
        if (Math.random() > 0.95) {
            throw new Error("Async operation failed");
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    @bindStartEvent
    demonstrateErrorTypes() {
        // reportError handles different error types

        try {
            throw new Error("Standard error");
        } catch (e) {
            reportError(e); // Formats with source map and stack trace
        }

        try {
            throw "String error";
        } catch (e) {
            reportError(e); // Handles string errors
        }

        try {
            throw { custom: "object" };
        } catch (e) {
            reportError(e); // Handles arbitrary objects
        }

        try {
            throw 42;
        } catch (e) {
            reportError(e); // Handles primitive values
        }
    }
}
```

**Key Points:**
- spath() generates readable hierarchy paths for debugging
- reportError() formats all error types consistently
- Source maps applied automatically for Error objects
- Useful for tracking down issues in complex hierarchies

### Example 7: Combining Multiple Patterns

Real-world example combining all decorator patterns:

```typescript
import { bindStartEvent, bindUpdateEvent, bindDestroyEvent, memo, depends, provider } from "./SnapDecorators.lspkg/decorators";
import { assert, verify } from "./SnapDecorators.lspkg/assert";
import { reportError, spath } from "./SnapDecorators.lspkg/debug";

@component
export class GameManager extends BaseScriptComponent {
    @input
    playerPrefab: ObjectPrefab;

    @input
    enemySpawnPoints: SceneObject[];

    @depends("Component.Transform")
    private transform!: Transform;

    @provider("Component.Camera")
    private camera!: Camera;

    private player: SceneObject | null = null;
    private enemies: SceneObject[] = [];
    private gameStarted: boolean = false;

    // Memoize expensive calculations
    @memo
    get spawnPositions(): vec3[] {
        print("Calculating spawn positions...");
        return this.enemySpawnPoints.map(sp =>
            sp.getTransform().getWorldPosition()
        );
    }

    @memo
    get gameConfig(): GameConfig {
        print("Loading game configuration...");
        return {
            maxEnemies: 10,
            spawnInterval: 2.0,
            playerSpeed: 5.0,
            enemySpeed: 3.0
        };
    }

    // Async initialization
    @bindStartEvent
    async initializeGame() {
        try {
            print(`Game manager initialized at: ${spath(this)}`);

            // Validate configuration
            assert(this.playerPrefab !== null, "Player prefab must be assigned");
            assert(this.enemySpawnPoints.length > 0, "Must have at least one spawn point");
            assert(this.camera !== null, "Camera must exist in hierarchy");

            // Access memoized config
            print(`Max enemies: ${this.gameConfig.maxEnemies}`);
            print(`Spawn points: ${this.spawnPositions.length}`);

            // Spawn player
            await this.spawnPlayer();

            // Start game
            this.gameStarted = true;
            print("Game started successfully");

        } catch (error) {
            print("Failed to initialize game:");
            reportError(error);
            this.gameStarted = false;
        }
    }

    @bindUpdateEvent
    updateGame() {
        if (!this.gameStarted) return;

        try {
            this.updatePlayer();
            this.updateEnemies();
            this.checkCollisions();
        } catch (error) {
            print("Error during game update:");
            reportError(error);
        }
    }

    @bindDestroyEvent
    cleanup() {
        print(`Cleaning up game manager at: ${spath(this)}`);

        // Destroy all spawned objects
        if (this.player) {
            this.player.destroy();
        }

        for (const enemy of this.enemies) {
            enemy.destroy();
        }

        this.enemies = [];
        this.gameStarted = false;
    }

    private async spawnPlayer(): Promise<void> {
        const spawnPos = this.transform.getWorldPosition();
        this.player = this.playerPrefab.instantiate(this.sceneObject.getParent());

        const playerTransform = verify(
            this.player.getComponent("Component.Transform"),
            "Player prefab must have Transform"
        );

        playerTransform.setWorldPosition(spawnPos);
        print(`Player spawned at: ${spath(this.player)}`);
    }

    private updatePlayer(): void {
        if (!this.player) return;

        // Player update logic using memoized config
        const speed = this.gameConfig.playerSpeed;
        // ... movement logic
    }

    private updateEnemies(): void {
        // Enemy update logic using memoized positions and config
        const maxEnemies = this.gameConfig.maxEnemies;

        if (this.enemies.length < maxEnemies) {
            // Spawn new enemies at memoized positions
            const spawnIndex = Math.floor(Math.random() * this.spawnPositions.length);
            // ... spawn logic
        }
    }

    private checkCollisions(): void {
        if (!this.player) return;

        const playerPos = this.player.getTransform().getWorldPosition();

        for (const enemy of this.enemies) {
            const enemyPos = enemy.getTransform().getWorldPosition();
            const distance = playerPos.distance(enemyPos);

            if (distance < 1.0) {
                print("Collision detected!");
                this.handleCollision(enemy);
            }
        }
    }

    private handleCollision(enemy: SceneObject): void {
        print(`Collision at: ${spath(enemy)}`);
        enemy.destroy();
        this.enemies = this.enemies.filter(e => e !== enemy);
    }
}

interface GameConfig {
    maxEnemies: number;
    spawnInterval: number;
    playerSpeed: number;
    enemySpeed: number;
}
```

**Key Points:**
- Combines all decorator types in a real game manager
- Async initialization with proper error handling
- Memoized config and spawn positions
- Dependency injection for core components
- Comprehensive error reporting with scene paths
- Clean, maintainable code with minimal boilerplate

### Example 8: Type-Safe Guards with Runtime Validation

Use type guards for safe component access:

```typescript
import { bindStartEvent } from "./SnapDecorators.lspkg/decorators";
import { isScriptObject, isComponent } from "./SnapDecorators.lspkg/guards";

@component
export class TypeGuardExample extends BaseScriptComponent {
    @input
    unknownObject: any;

    @bindStartEvent
    validateObjects() {
        // Type-safe runtime checks
        if (isScriptObject(this.unknownObject)) {
            print("Object is a ScriptObject");

            // TypeScript knows this.unknownObject is ScriptObject here
            const typeName = this.unknownObject.getTypeName();
            print(`Type: ${typeName}`);

            if (isComponent(this.unknownObject)) {
                print("Object is also a Component");

                // TypeScript knows it's a Component here
                const sceneObject = this.unknownObject.getSceneObject();
                print(`Parent scene object: ${sceneObject.name}`);
            }
        } else {
            print("Object is not a ScriptObject");
        }

        // Safe component access
        this.safeGetComponent(this.sceneObject, "Component.Transform");
    }

    private safeGetComponent<T extends keyof ComponentNameMap>(
        obj: SceneObject,
        typeName: T
    ): ComponentNameMap[T] | null {
        const component = obj.getComponent(typeName);

        if (component && isComponent(component)) {
            return component as ComponentNameMap[T];
        }

        return null;
    }
}
```

**Key Points:**
- Type guards provide runtime validation with type narrowing
- isScriptObject checks for ScriptObject methods safely
- isComponent validates Component-specific functionality
- TypeScript understands type narrowing after guard checks

Built with 👻 by the Spectacles team
