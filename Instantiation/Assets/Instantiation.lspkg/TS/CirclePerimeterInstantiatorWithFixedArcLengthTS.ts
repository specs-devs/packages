/**
 * Specs Inc. 2026
 * Circle perimeter instantiation with fixed arc length spacing. Spawns prefabs along a circle
 * with consistent arc distance between instances, useful for precise circular layouts.
 */
@component
export class CirclePerimeterInstantiatorWithFixedArcLengthTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Circle Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the center point, prefab, and radius for the circular layout</span>')

    @input
    @hint("Center of the circle")
    center!: SceneObject;

    @input
    @hint("Prefab to instantiate")
    prefab!: ObjectPrefab;

    @input
    @hint("Radius of the circle")
    radius: number = 5.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure the number of objects or arc length between them</span>')

    @input
    @hint("Number of prefabs to instantiate around the circle")
    numberOfPrefabs: number = 10;

    @input
    @hint("Fixed arc length between instantiated prefabs (used only when numberOfPrefabs is 0)")
    arcLength: number = 2.0;

    @input
    @hint("Start angle of the arc in degrees (0-360)")
    startAngle: number = 0;
    
    @input
    @hint("Angular span of the arc in degrees (0-360, where 360 is a full circle)")
    arcAngleSpan: number = 360;

    // Initialize with the proper pattern
    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => {
            this.onStart();
            print("Onstart event triggered");
        });
    }

    onStart(): void {
        this.instantiatePrefabs();
    }

    // Method to instantiate prefabs along the circle perimeter
    instantiatePrefabs(): void {
        if (!this.center || !this.prefab || this.radius <= 0 || this.numberOfPrefabs <= 0) {
            print("Error: Invalid parameters! Ensure radius and number of prefabs are greater than zero, and center/prefab are assigned.");
            return;
        }

        // Convert angles to radians
        const startAngleRad = (this.startAngle * Math.PI) / 180;
        const arcSpanRad = (this.arcAngleSpan * Math.PI) / 180;
        
        // Get the number of prefabs to instantiate
        let prefabCount = this.numberOfPrefabs;
        
        // Calculate angle step based on the number of prefabs
        const angleStep = (prefabCount > 1) ? arcSpanRad / (prefabCount - 1) : 0;
        
        // If we're working with a very small arc or just one prefab
        if (prefabCount <= 1 || this.arcAngleSpan <= 0) {
            prefabCount = 1;
        }

        const centerPosition = this.center.getTransform().getWorldPosition();

        for (let i = 0; i < prefabCount; i++) {
            // Calculate angle for each prefab
            const angle = startAngleRad + (i * angleStep);

            // Calculate the position on the perimeter of the circle
            const positionOnCircle = new vec3(
                centerPosition.x + Math.cos(angle) * this.radius,
                centerPosition.y + Math.sin(angle) * this.radius,
                centerPosition.z
            );

            // Create a prefab instance at the calculated position
            this.createPrefabInstance(positionOnCircle);
        }
    }

    // Helper method to create a prefab instance at a specific position
    private createPrefabInstance(position: vec3): void {
        if (this.prefab) {

            if (this.prefab) {
                const instance = this.prefab.instantiate(this.sceneObject);
                instance.getTransform().setWorldPosition(position);
                print(`Created prefab instance at position: ${position.x}, ${position.y}, ${position.z}`);
            }
        }
    }

}
