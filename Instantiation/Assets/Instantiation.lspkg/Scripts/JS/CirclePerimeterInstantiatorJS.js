//@component
/**
 * CirclePerimeterInstantiator - JavaScript version of the C# utility
 * Instantiates prefabs evenly spaced along the perimeter of a circle, one at a time with a pop-in,
 * so the order around the circle is visible.
 */

//@input SceneObject center {"hint":"Center of the circle"}
//@input Asset.ObjectPrefab prefab {"hint":"Prefab to instantiate"}
//@input float numberOfPrefabs = 10 {"hint":"Number of prefabs to instantiate"}
//@input float radius = 5.0 {"hint":"Radius of the circle"}
//@input float spawnInterval = 0.12 {"hint":"Seconds between two spawns (0 = all at once)"}
//@input float popDuration = 0.3 {"hint":"Seconds each prefab takes to pop in from zero scale"}
//@input bool loop = true {"hint":"When the ring is complete, wait, clear it and spawn it again"}
//@input float holdTime = 1.5 {"hint":"Seconds the complete ring stays before it is cleared (when looping)"}

function CirclePerimeterInstantiator() {
    // Spawned instances with their pop-in start time and target scale.
    var spawned = [];
    var nextIndex = 0;
    var nextSpawnTime = 0;
    var ringDoneTime = -1;

    script.createEvent("OnStartEvent").bind(function() {
        nextSpawnTime = getTime();
        script.createEvent("UpdateEvent").bind(onUpdate);
    });

    function prefabCount() {
        return Math.max(1, Math.floor(script.numberOfPrefabs));
    }

    function onUpdate() {
        if (!script.center || !script.prefab) {
            return;
        }
        var now = getTime();
        var count = prefabCount();
        // Spawn every prefab that is due (all at once when spawnInterval is 0).
        while (nextIndex < count && now >= nextSpawnTime) {
            spawnAt(nextIndex, count, now);
            nextIndex++;
            nextSpawnTime += Math.max(0, script.spawnInterval);
            if (nextIndex === count) {
                ringDoneTime = now;
            }
        }
        // Pop-in: scale from zero to the prefab's own scale with a small overshoot.
        for (var i = 0; i < spawned.length; i++) {
            var item = spawned[i];
            var k = script.popDuration > 0 ? Math.min(1, (now - item.start) / script.popDuration) : 1;
            item.obj.getTransform().setLocalScale(item.scale.uniformScale(easeOutBack(k)));
        }
        // Loop: hold the full ring, clear it, start again.
        if (script.loop && ringDoneTime >= 0 && now - ringDoneTime > script.holdTime + script.popDuration) {
            clear();
            nextIndex = 0;
            nextSpawnTime = now;
            ringDoneTime = -1;
        }
    }

    // Instantiates all prefabs along the circle perimeter at once
    function instantiatePrefabs() {
        var count = prefabCount();
        var now = getTime();
        for (var i = 0; i < count; i++) {
            spawnAt(i, count, now);
        }
    }

    function spawnAt(i, count, now) {
        if (!script.center || !script.prefab) {
            print("Error: Center or prefab not assigned!");
            return;
        }
        // Angle for this prefab (evenly spaced), offset in the center's local XY plane.
        var angle = i * Math.PI * 2 / count;
        var offset = new vec3(Math.cos(angle) * script.radius, Math.sin(angle) * script.radius, 0);
        var centerTransform = script.center.getTransform();
        var instance = script.prefab.instantiate(script.sceneObject);
        var transform = instance.getTransform();
        transform.setWorldPosition(centerTransform.getWorldPosition().add(centerTransform.getWorldRotation().multiplyVec3(offset)));
        var scale = transform.getLocalScale();
        transform.setLocalScale(vec3.zero());
        spawned.push({obj: instance, start: now, scale: scale});
    }

    function clear() {
        for (var i = 0; i < spawned.length; i++) {
            spawned[i].obj.destroy();
        }
        spawned = [];
    }

    // 0 -> 1 with a small overshoot at the end, so each prefab "pops" into place.
    function easeOutBack(x) {
        var c1 = 1.70158;
        var c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }

    script.instantiatePrefabs = instantiatePrefabs;
}

// Register the script
script.CirclePerimeterInstantiator = CirclePerimeterInstantiator;
CirclePerimeterInstantiator();
