/**
 * Specs Inc. 2026
 * Random sphere volume instantiation utility that spawns prefabs at random points inside a
 * spherical volume. Perfect for particle systems, debris fields, or organic distributions.
 */
@component
export class RandomPointsInsideSphereTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Sphere Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the sphere center and prefab to instantiate inside the volume</span>')

    @input
    @hint("Reference to the sphere (center point)")
    sphere!: SceneObject;

    @input
    @hint("Prefab to instantiate")
    prefab!: ObjectPrefab;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure the number of random points and sphere radius</span>')

    @input
    @hint("Number of random points to generate")
    numberOfPoints: number = 10;

    @input
    @hint("Radius of the sphere")
    radius: number = 1.0;
    
    // Initialize with the proper pattern
    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => {
            this.onStart();
            print("Onstart event triggered");
        });
    }
    
    onStart(): void {
        this.generateRandomPointsInside();
    }
    
    generateRandomPointsInside(): void {
        if (!this.sphere || !this.prefab) {
            print("Error: Sphere or prefab not assigned!");
            return;
        }
        
        const spherePosition = this.sphere.getTransform().getWorldPosition();
        
        for (let i = 0; i < this.numberOfPoints; i++) {
            // Generate a random point inside a unit sphere
            const randomPoint = this.randomPointInsideUnitSphere();
            
            // Scale by the radius and offset by the sphere position
            const randomPointInsideSphere = new vec3(
                spherePosition.x + randomPoint.x * this.radius,
                spherePosition.y + randomPoint.y * this.radius,
                spherePosition.z + randomPoint.z * this.radius
            );
            
            // Create a prefab instance at the calculated position
            this.createPrefabInstance(randomPointInsideSphere);
        }
    }
    
    // Helper method to create a random point inside a unit sphere
    private randomPointInsideUnitSphere(): vec3 {
        // Implementation of the rejection sampling method
        while (true) {
            // Generate a random point in a cube
            const x = Math.random() * 2 - 1; // Range: -1 to 1
            const y = Math.random() * 2 - 1; // Range: -1 to 1
            const z = Math.random() * 2 - 1; // Range: -1 to 1
            
            // Check if the point is inside the unit sphere
            const lengthSquared = x * x + y * y + z * z;
            
            if (lengthSquared <= 1) {
                return new vec3(x, y, z);
            }
            
            // If not inside, try again
        }
    }
    
    // Helper method to create a prefab instance at a specific position
    private createPrefabInstance(position: vec3): void {
        if (this.prefab) {
            const instance = this.prefab.instantiate(this.sceneObject);
            instance.getTransform().setWorldPosition(position);
            print(`Created prefab instance at position: ${position.x}, ${position.y}, ${position.z}`);
        }
    }
}
