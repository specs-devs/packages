//@component
/**
 * InstantiateOn2DGrids - JavaScript version of the C# utility
 * Instantiates objects in a 2D grid pattern on the XY plane
 */

//@input Asset.ObjectPrefab prefab {"hint":"The prefab to instantiate"}
//@input SceneObject gridCenter {"hint":"The center of the grid"}
//@input float gridWidth = 5 {"hint":"Number of elements along the X axis"}
//@input float gridHeight = 5 {"hint":"Number of elements along the Y axis"}
//@input float spacingX = 1.5 {"hint":"Spacing between elements in the X direction"}
//@input float spacingY = 1.5 {"hint":"Spacing between elements in the Y direction"}
//@input float zPosition = 0.0 {"hint":"Offset along Z for all elements on the XY plane"}

function InstantiateOn2DGrids() {
    // Initialize with the proper pattern
    script.createEvent("OnStartEvent").bind(onStart);
    
    function onStart() {
        instantiateGrid();
    }
    
    function instantiateGrid() {
        if (!script.prefab || !script.gridCenter) {
            print("Please assign both the prefab and the grid center Transform.");
            return;
        }
        
        // Calculate the starting position based on the center of the grid
        var centerPosition = script.gridCenter.getTransform().getWorldPosition();
        var startPosition = new vec3(
            centerPosition.x - (script.gridWidth - 1) * script.spacingX / 2,
            centerPosition.y - (script.gridHeight - 1) * script.spacingY / 2,
            centerPosition.z + script.zPosition
        );
        
        // Loop through the rows and columns to instantiate the prefabs
        for (var x = 0; x < script.gridWidth; x++) {
            for (var z = 0; z < script.gridHeight; z++) {
                // Calculate the position for each prefab (on the XY plane)
                var position = new vec3(
                    startPosition.x + x * script.spacingX,
                    startPosition.y + z * script.spacingY,
                    startPosition.z
                );
                
                // Create a prefab instance at the calculated position
                createPrefabInstance(position);
            }
        }
    }
    
    // Helper method to create a prefab instance at a specific position
    function createPrefabInstance(position) {
        if (script.prefab) {
            var instance = script.prefab.instantiate(script.sceneObject);
            // The offsets above are along world axes: turn them with the gridCenter so the layout follows its rotation.
            var centerTransform = script.gridCenter.getTransform();
            var origin = centerTransform.getWorldPosition();
            instance.getTransform().setWorldPosition(origin.add(centerTransform.getWorldRotation().multiplyVec3(position.sub(origin))));
            print("Created prefab instance at position: " + position.x + ", " + position.y + ", " + position.z);
        }
    }
}

// Register the script
script.InstantiateOn2DGrids = InstantiateOn2DGrids;
InstantiateOn2DGrids();
