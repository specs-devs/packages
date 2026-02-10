// import required modules
const Interactor = require("SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor");
const InteractorTriggerType = Interactor.InteractorTriggerType;
const InteractorInputType = Interactor.InteractorInputType;
const {SIK} = require("SpectaclesInteractionKit.lspkg/SIK");

const WorldQueryModule = require("LensStudio:WorldQueryModule");
const EPSILON = 0.01;

//@input int indexToSpawn
//@input SceneObject targetObject
//@input SceneObject[] objectsToSpawn
//@input bool filterEnabled

function WorldQueryHitExample() {
    // Private variables
    var primaryInteractor;
    var hitTestSession;
    var transform;
    var lastHitResult; // Store last hit result for trigger end callback

    function onAwake() {
        // create new hit session
        hitTestSession = createHitTestSession(script.filterEnabled);
        if (!script.sceneObject) {
            print("Please set Target Object input");
            return;
        }
        transform = script.targetObject.getTransform();
        // disable target object when surface is not detected
        script.targetObject.enabled = false;
        setObjectEnabled(script.indexToSpawn);

        // Set up trigger end callback
        setupTriggerEndCallback();

        // create update event
        script.createEvent("UpdateEvent").bind(onUpdate);
    }

    function setupTriggerEndCallback() {
        // Get all interactors and set up trigger end callbacks
        var allInteractors = SIK.InteractionManager.getInteractorsByType(
            InteractorInputType.All
        );

        for (var i = 0; i < allInteractors.length; i++) {
            var interactor = allInteractors[i];
            interactor.onTriggerEnd.add(function(currentInteractor) {
                return function() {
                    // Only place object if we have a valid hit result and this is the primary interactor
                    if (lastHitResult && primaryInteractor === currentInteractor) {
                        placeObject();
                    }
                };
            }(interactor));
        }
    }

    function placeObject() {
        if (!lastHitResult) return;

        // Copy the plane/axis object
        var parent = script.objectsToSpawn[script.indexToSpawn].getParent();
        var newObject = parent.copyWholeHierarchy(script.objectsToSpawn[script.indexToSpawn]);
        newObject.setParentPreserveWorldTransform(null);

        // Set position and rotation from last hit
        var hitPosition = lastHitResult.position;
        var hitNormal = lastHitResult.normal;

        var lookDirection;
        if (1 - Math.abs(hitNormal.normalize().dot(vec3.up())) < EPSILON) {
            lookDirection = vec3.forward();
        } else {
            lookDirection = hitNormal.cross(vec3.up());
        }

        var toRotation = quat.lookAt(lookDirection, hitNormal);
        newObject.getTransform().setWorldPosition(hitPosition);
        newObject.getTransform().setWorldRotation(toRotation);
    }

    function createHitTestSession(filterEnabled) {
        // create hit test session with options
        var options = HitTestSessionOptions.create();
        options.filter = filterEnabled;

        var session = WorldQueryModule.createHitTestSessionWithOptions(options);
        return session;
    }

    function onHitTestResult(results) {
        if (results === null) {
            script.targetObject.enabled = false;
            lastHitResult = null;
        } else {
            script.targetObject.enabled = true;
            // Store hit result for potential trigger end callback
            lastHitResult = results;

            // get hit information
            var hitPosition = results.position;
            var hitNormal = results.normal;

            //identifying the direction the object should look at based on the normal of the hit location.

            var lookDirection;
            if (1 - Math.abs(hitNormal.normalize().dot(vec3.up())) < EPSILON) {
                lookDirection = vec3.forward();
            } else {
                lookDirection = hitNormal.cross(vec3.up());
            }

            var toRotation = quat.lookAt(lookDirection, hitNormal);
            //set position and rotation
            script.targetObject.getTransform().setWorldPosition(hitPosition);
            script.targetObject.getTransform().setWorldRotation(toRotation);
        }
    }

    function onUpdate() {
        primaryInteractor = SIK.InteractionManager.getTargetingInteractors().shift();
        if (primaryInteractor &&
            primaryInteractor.isActive() &&
            primaryInteractor.isTargeting()
        ) {
            var rayStartOffset = new vec3(primaryInteractor.startPoint.x, primaryInteractor.startPoint.y, primaryInteractor.startPoint.z + 30);
            var rayStart = rayStartOffset;
            var rayEnd = primaryInteractor.endPoint;

            hitTestSession.hitTest(rayStart, rayEnd, onHitTestResult);

        } else {
            script.targetObject.enabled = false;
        }
    }

    function setObjectIndex(i) {
        script.indexToSpawn = i;
    }

    function setObjectEnabled(indexToEnable) {
        for (var i = 0; i < script.objectsToSpawn.length; i++) {
            script.objectsToSpawn[i].enabled = i == indexToEnable;
        }
    }

    // Initialize
    onAwake();

    // Expose public methods
    script.setObjectIndex = setObjectIndex;
    script.setObjectEnabled = setObjectEnabled;
}

// Register and initialize the script
script.WorldQueryHitExample = WorldQueryHitExample;
WorldQueryHitExample();
