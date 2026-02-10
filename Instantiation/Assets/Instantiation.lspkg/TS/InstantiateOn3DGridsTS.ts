/**
 * Specs Inc. 2026
 * 3D grid instantiation utility that creates volumetric grid patterns in three-dimensional space.
 * Ideal for creating voxel-based structures, particle volumes, or 3D data visualizations.
 */
@component
export class InstantiateOn3DGridsTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Grid Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the prefab and center point for the 3D grid layout</span>')

    @input
    @hint("The prefab to instantiate")
    prefab!: ObjectPrefab;

    @input
    @hint("The center of the grid")
    gridCenter!: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Grid Dimensions</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the grid size along X, Y, and Z axes</span>')

    @input
    @hint("Number of elements along the X axis")
    gridWidth: number = 5;

    @input
    @hint("Number of elements along the Y axis")
    gridHeight: number = 5;

    @input
    @hint("Number of elements along the Z axis")
    gridDepth: number = 5;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Spacing Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure spacing between elements in all three dimensions</span>')

    @input
    @hint("Spacing between elements in the X direction")
    spacingX: number = 1.5;

    @input
    @hint("Spacing between elements in the Y direction")
    spacingY: number = 1.5;

    @input
    @hint("Spacing between elements in the Z direction")
    spacingZ: number = 1.5;
    
    // Initialize with the proper pattern
    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => {
            this.onStart();
            print("Onstart event triggered");
        });
    }
    
    onStart(): void {
        this.instantiateGrid();
    }
    
    instantiateGrid(): void {
        if (!this.prefab || !this.gridCenter) {
            print("Please assign both the prefab and the grid center Transform.");
            return;
        }
        
        // Calculate the total width, height, and depth of the grid
        const totalWidth = (this.gridWidth - 1) * this.spacingX;
        const totalHeight = (this.gridHeight - 1) * this.spacingY;
        const totalDepth = (this.gridDepth - 1) * this.spacingZ;
        
        // Calculate the starting position so that the grid is centered at gridCenter
        const centerPosition = this.gridCenter.getTransform().getWorldPosition();
        const startPosition = new vec3(
            centerPosition.x - totalWidth / 2,
            centerPosition.y - totalHeight / 2,
            centerPosition.z - totalDepth / 2
        );
        
        // Loop through the width, height, and depth to instantiate the prefabs
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                for (let z = 0; z < this.gridDepth; z++) {
                    // Calculate the position for each prefab
                    const position = new vec3(
                        startPosition.x + x * this.spacingX,
                        startPosition.y + y * this.spacingY,
                        startPosition.z + z * this.spacingZ
                    );
                    
                    // Create a prefab instance at the calculated position
                    this.createPrefabInstance(position);
                }
            }
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
