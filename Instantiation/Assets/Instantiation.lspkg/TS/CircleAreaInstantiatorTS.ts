/**
 * Specs Inc. 2026
 * Circular area instantiation utility that spawns prefabs within a circular area with random
 * placement. Useful for creating scattered object patterns, particles, or decorative elements.
 */
@component
export class CircleAreaInstantiatorTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Circle Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the center point and prefab to instantiate within the circular area</span>')

    // References to scene objects
    @input
    @hint("Center of the circle area")
    center!: SceneObject;

    @input
    @hint("Prefab to instantiate")
    prefab!: ObjectPrefab;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distribution Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure how many objects to spawn and the radius of the circular area</span>')

    @input
    @hint("Number of prefabs to instantiate")
    numberOfPrefabs: number = 10;

    @input
    @hint("Radius of the circle")
    radius: number = 5.0;
    
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
    
    // Method to instantiate prefabs within the circle area
    instantiatePrefabs(): void {
        if (!this.center || !this.prefab) {
            print("Error: Center or prefab not assigned!");
            return;
        }
        
        const centerPosition = this.center.getTransform().getWorldPosition();
        
        for (let i = 0; i < this.numberOfPrefabs; i++) {
            // Random angle and distance to place the prefab
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.radius;
            
            // Calculate position based on angle and distance
            const randomPosition = new vec3(
                centerPosition.x + Math.cos(angle) * distance,
                centerPosition.y + Math.sin(angle) * distance,
                centerPosition.z 
            );
            
            // Create a prefab instance at the random position
            this.createPrefabInstance(randomPosition);
        }
    }
    
    // Helper method to create a prefab instance at a specific position
    private createPrefabInstance(position: vec3): void {
        if (this.prefab) {

       
            // In a real implementation, we would use StudioLib's actual instantiation API
            // For this example, we'll just log what would happen
            print(`Created prefab instance at position: ${position.x}, ${position.y}, ${position.z}`);
            
            // The actual instantiation code would be something like:
            const instance = this.prefab.instantiate(this.sceneObject);
            instance.getTransform().setWorldPosition(position);
        }
    }
}
