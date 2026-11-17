//@component
/**
 * SPECS Inc. 2027
 * World query hit test example (JS variant, feature parity with WorldQueryHitExampleTS).
 * Surface detection, semantic surface classification, and object placement: HitTestSession with
 * optional filtering, classification and refine options, real-time cursor positioning on detected
 * surfaces, a legible color-coded billboard label that names the detected surface (GROUND, WALL,
 * TABLE, ...) at the raycast hit point, and trigger end callback for object spawning.
 */
// import required modules
const Interactor = require("SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor");
const InteractorTriggerType = Interactor.InteractorTriggerType;
const InteractorInputType = Interactor.InteractorInputType;
const {SIK} = require("SpectaclesInteractionKit.lspkg/SIK");
const WorldCameraFinderProvider = require("SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider").default;

const WorldQueryModule = require("LensStudio:WorldQueryModule");
const EPSILON = 0.01;

//@input int indexToSpawn
//@input SceneObject targetObject
//@input SceneObject[] objectsToSpawn
//@input bool filterEnabled
//@ui {"widget":"separator"}
//@ui {"widget":"label", "label":"Cursor Smoothing — ease the preview object toward the hit point"}
//@input bool smoothingEnabled = true {"hint":"Smoothly interpolate (lerp) the preview object toward the hit point instead of snapping to it"}
//@input float smoothingSpeed = 10.0 {"hint":"Smoothing speed — higher is snappier. ~5 feels floaty, ~10 balanced, ~25 tight. Frame-rate independent"}
//@ui {"widget":"separator"}
//@ui {"widget":"label", "label":"Intro Hint — short instruction tethered in front of the user at the start"}
//@input bool showIntroHint = true {"hint":"Show a brief instruction tethered in front of the user when the Lens starts"}
//@input string introHintText = "Point to surfaces using your hand to see semantic classification and pinch to instantiate the object prefab" {"hint":"Instruction text shown at start (long lines wrap automatically)"}
//@input float introHintDuration = 2.0 {"hint":"How long the intro hint stays visible, in seconds"}
//@ui {"widget":"separator"}
//@input bool classificationEnabled = true {"hint":"Enable surface classification (options.classification) on the hit test session"}
//@input bool showSurfaceLabel = true {"hint":"Show a color-coded label at the hit point naming the detected surface (GROUND, WALL, TABLE, ...)"}
//@input bool refineEnabled {"hint":"Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported"}
//@input float labelScale = 1.0 {"hint":"Uniform scale multiplier for the semantic surface label"}
//@input int detectCategory = 0 {"widget":"combobox", "values":[{"label":"All", "value":0}, {"label":"Ground", "value":1}, {"label":"Wall", "value":2}, {"label":"Ceiling", "value":3}, {"label":"Table", "value":4}, {"label":"None / Unknown", "value":5}], "hint":"The full set of detectable surface categories. 'All' labels every detected surface; pick one category to only label hits of that type"}
//@ui {"widget":"separator"}
//@ui {"widget":"label", "label":"Surface Category Colors — Ground, Wall, Ceiling, Table, None/Unknown"}
//@input vec4 groundColor = {0.0, 1.0, 0.0, 1.0} {"widget":"color", "hint":"Label color when the detected surface is Ground"}
//@input vec4 wallColor = {0.0, 1.0, 0.9686, 1.0} {"widget":"color", "hint":"Label color when the detected surface is a Wall"}
//@input vec4 ceilingColor = {0.6667, 0.0, 1.0, 1.0} {"widget":"color", "hint":"Label color when the detected surface is a Ceiling"}
//@input vec4 tableColor = {1.0, 0.0, 0.0, 1.0} {"widget":"color", "hint":"Label color when the detected surface is a Table"}
//@input vec4 unknownColor = {0.0275, 0.0, 0.4392, 1.0} {"widget":"color", "hint":"Label color for None/Unknown surfaces — also the fallback for any category without its own color above"}

// Colors are keyed by classification NAME (string), never by enum literal: public Lens Studio
// builds may only declare None/Ground, while builds/devices with semantic detection report the
// full set. The value->name map is built dynamically from the RUNTIME SurfaceClassification
// enum, so every category above just works the moment the runtime starts reporting it.
// Dropdown index -> classification NAME (string). Filtering compares names, never enum
// members, so this stays compile-safe on public Lens Studio builds. Index 0 = "All".
var DETECT_CATEGORY_NAMES = ["All", "Ground", "Wall", "Ceiling", "Table", "None"];

var LABEL_BACKGROUND_COLOR = new vec4(0.0, 0.0, 0.0, 0.65);
var LABEL_OUTLINE_COLOR = new vec4(0.0, 0.0, 0.0, 1.0);
var LABEL_TEXT_SIZE = 96;
var LABEL_SURFACE_OFFSET_CM = 5;  // push the label off the surface along the hit normal
var LABEL_LIFT_CM = 10;           // lift the label so it clears the preview object

// Builds the classification value -> name map from the RUNTIME enum object. Never reference
// SurfaceClassification members other than None/Ground directly — availability depends on the
// Lens Studio / SnapOS version.
function buildClassificationNameMap() {
    var names = {};
    var keys = Object.keys(SurfaceClassification);
    for (var i = 0; i < keys.length; i++) {
        var value = SurfaceClassification[keys[i]];
        if (typeof value === "number" && names[value] === undefined) {
            names[value] = keys[i];
        }
    }
    return names;
}

function WorldQueryHitExample() {
    // Private variables
    var primaryInteractor;
    var hitTestSession;
    var transform;
    var lastHitResult; // Store last hit result for trigger end callback
    var camera;
    var classificationNames;
    var surfaceColors;
    var labelObject;
    var labelText;
    var lastLabelName = "";
    var smoothedPosition = null;
    var smoothedRotation = null;
    var introHintObject = null;

    function onAwake() {
        // Inputs added to this script after a component was serialized read as `undefined` at
        // runtime until the scene is re-saved — normalize them to their intended defaults so
        // package upgrades never silently disable a feature.
        script.smoothingEnabled = script.smoothingEnabled !== false;
        script.smoothingSpeed = script.smoothingSpeed === undefined ? 10.0 : script.smoothingSpeed;
        script.showIntroHint = script.showIntroHint !== false;
        script.introHintText = script.introHintText === undefined
            ? "Point to surfaces using your hand to see semantic classification and pinch to instantiate the object prefab"
            : script.introHintText;
        script.introHintDuration = script.introHintDuration === undefined ? 2.0 : script.introHintDuration;

        // Build the runtime classification value -> name map before creating the session
        classificationNames = buildClassificationNameMap();
        // Seed the name -> color map from the Inspector color inputs (one per known category)
        surfaceColors = {
            Ground: script.groundColor,
            Wall: script.wallColor,
            Ceiling: script.ceilingColor,
            Table: script.tableColor,
            None: script.unknownColor,
        };
        camera = WorldCameraFinderProvider.getInstance();

        // create new hit session
        hitTestSession = createHitTestSession(script.filterEnabled);
        if (!script.targetObject) {
            print("Please set Target Object input");
            return;
        }
        transform = script.targetObject.getTransform();
        // disable target object when surface is not detected
        script.targetObject.enabled = false;
        setObjectEnabled(script.indexToSpawn);

        // Create the semantic surface label that follows the raycast hit point
        if (script.showSurfaceLabel) {
            createSurfaceLabel();
        }

        // Brief instruction tethered in front of the user at the start of the experience
        if (script.showIntroHint) {
            createIntroHint();
        }

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
                    // Skip when the pinch was on a UI element (button, panel), not on a surface
                    if (lastHitResult && primaryInteractor === currentInteractor && !currentInteractor.currentInteractable) {
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

        // Place where the user sees the cursor: the smoothed pose when smoothing is enabled,
        // otherwise the exact last hit.
        var hitPosition = (script.smoothingEnabled && smoothedPosition !== null)
            ? smoothedPosition
            : lastHitResult.position;
        var toRotation = (script.smoothingEnabled && smoothedRotation !== null)
            ? smoothedRotation
            : calculateSurfaceRotation(lastHitResult.normal);

        newObject.getTransform().setWorldPosition(hitPosition);
        newObject.getTransform().setWorldRotation(toRotation);
    }

    function calculateSurfaceRotation(hitNormal) {
        var lookDirection;
        if (1 - Math.abs(hitNormal.normalize().dot(vec3.up())) < EPSILON) {
            lookDirection = vec3.forward();
        } else {
            lookDirection = hitNormal.cross(vec3.up());
        }
        return quat.lookAt(lookDirection, hitNormal);
    }

    function createHitTestSession(filterEnabled) {
        // create hit test session with options
        var options = HitTestSessionOptions.create();
        options.filter = filterEnabled;
        options.classification = script.classificationEnabled;

        if (script.refineEnabled) {
            // `refine` is not available on every Lens Studio/SnapOS version —
            // assign it defensively so this script runs everywhere.
            try {
                options.refine = true;
            } catch (e) {
                print("HitTestSessionOptions.refine is not supported on this Lens Studio/SnapOS version — ignoring");
            }
        }

        var session = WorldQueryModule.createHitTestSessionWithOptions(options);
        return session;
    }

    function onHitTestResult(results) {
        if (results === null) {
            script.targetObject.enabled = false;
            setSurfaceLabelVisible(false);
            lastHitResult = null;
        } else {
            var wasVisible = script.targetObject.enabled;
            script.targetObject.enabled = true;
            // Store hit result for potential trigger end callback
            lastHitResult = results;

            //identifying the direction the object should look at based on the normal of the hit location.
            var toRotation = calculateSurfaceRotation(results.normal);

            // Ease the cursor toward the hit pose (or snap when smoothing is off)
            applyCursorPose(results.position, toRotation, wasVisible);

            // Communicate the detected surface semantically at the hit point
            updateSurfaceLabel(results);
        }
    }

    // Moves the preview object toward the hit pose. With smoothing enabled the cursor eases in
    // with a frame-rate-independent exponential lerp (tune with Smoothing Speed); it snaps
    // directly on the first frame it appears so it never flies in from a stale position.
    function applyCursorPose(position, rotation, wasVisible) {
        if (!script.smoothingEnabled || !wasVisible ||
            smoothedPosition === null || smoothedRotation === null) {
            smoothedPosition = position;
            smoothedRotation = rotation;
        } else {
            var t = 1 - Math.exp(-Math.max(script.smoothingSpeed, 0.01) * getDeltaTime());
            smoothedPosition = vec3.lerp(smoothedPosition, position, t);
            smoothedRotation = quat.slerp(smoothedRotation, rotation, t);
        }

        var cursorTransform = script.targetObject.getTransform();
        cursorTransform.setWorldPosition(smoothedPosition);
        cursorTransform.setWorldRotation(smoothedRotation);
    }

    // --- Semantic surface label ---------------------------------------------------------------

    // Creates the billboard label that names the detected surface at the raycast hit point.
    // Built for legibility on Glasses: solid dark background, black outline, color-coded fill.
    function createSurfaceLabel() {
        labelObject = global.scene.createSceneObject("SurfaceClassificationLabel");
        labelObject.setParent(script.getSceneObject());
        // Runtime-created objects don't reliably land on a camera-rendered layer — inherit ours
        labelObject.layer = script.getSceneObject().layer;

        labelText = labelObject.createComponent("Component.Text");
        labelText.text = "";
        labelText.size = LABEL_TEXT_SIZE;
        labelText.textFill.color = script.unknownColor;
        labelText.backgroundSettings.enabled = true;
        labelText.backgroundSettings.fill.color = LABEL_BACKGROUND_COLOR;
        labelText.backgroundSettings.margins = Rect.create(0.3, 0.3, 0.15, 0.15);
        labelText.backgroundSettings.cornerRadius = 0.2;
        labelText.outlineSettings.enabled = true;
        labelText.outlineSettings.size = 0.35;
        labelText.outlineSettings.fill.color = LABEL_OUTLINE_COLOR;

        var labelScale = Math.max(script.labelScale, 0.01);
        labelObject.getTransform().setLocalScale(new vec3(labelScale, labelScale, labelScale));
        labelObject.enabled = false;
    }

    function setSurfaceLabelVisible(visible) {
        if (labelObject && labelObject.enabled !== visible) {
            labelObject.enabled = visible;
        }
    }

    // Resolves a classification enum value to its runtime enum key name.
    function getClassificationName(classification) {
        if (classification === undefined || classification === null) {
            return "None";
        }
        var name = classificationNames[classification];
        return name === undefined ? ("Surface" + classification) : name;
    }

    // Positions the color-coded semantic label at the hit point (offset along the surface normal
    // and lifted to clear the preview object) and billboards it toward the camera.
    function updateSurfaceLabel(results) {
        if (!script.showSurfaceLabel || !labelText) {
            return;
        }
        if (!script.classificationEnabled) {
            setSurfaceLabelVisible(false);
            return;
        }

        var name = getClassificationName(results.classification);

        // Category filter: "All" labels every hit; a specific category hides the label on
        // every other surface type. Compared by NAME string — compile-safe on public builds.
        var filterName = DETECT_CATEGORY_NAMES[script.detectCategory];
        if (filterName === undefined) filterName = "All";
        if (filterName !== "All" && name !== filterName) {
            setSurfaceLabelVisible(false);
            return;
        }

        if (name !== lastLabelName) {
            lastLabelName = name;
            labelText.text = name === "None" ? "UNKNOWN" : name.toUpperCase();
            var color = surfaceColors[name];
            labelText.textFill.color = color === undefined ? script.unknownColor : color;
        }

        // Anchor the label to the (smoothed) cursor position so the two move as one
        var hitNormal = results.normal.normalize();
        var anchor = smoothedPosition !== null ? smoothedPosition : results.position;
        var labelPosition = anchor
            .add(hitNormal.uniformScale(LABEL_SURFACE_OFFSET_CM))
            .add(vec3.up().uniformScale(LABEL_LIFT_CM));

        var labelTransform = labelObject.getTransform();
        labelTransform.setWorldPosition(labelPosition);

        // Billboard toward the camera so the label stays legible from any angle
        // (Text faces along the look direction, so aim it from the label back at the camera)
        var cameraPosition = camera.getWorldPosition();
        var toCamera = cameraPosition.sub(labelPosition);
        if (toCamera.lengthSquared > EPSILON) {
            labelTransform.setWorldRotation(quat.lookAt(toCamera, vec3.up()));
        }

        setSurfaceLabelVisible(true);
    }

    // --- Intro hint -----------------------------------------------------------------------------

    // Soft line-wrap for the hint text so it reads as a compact block.
    function wrapHintText(text, maxLineLength) {
        if (text.indexOf("\n") !== -1) {
            return text; // author already formatted it
        }
        var words = text.split(" ");
        var lines = [];
        var line = "";
        for (var i = 0; i < words.length; i++) {
            if (line.length > 0 && line.length + 1 + words[i].length > maxLineLength) {
                lines.push(line);
                line = words[i];
            } else {
                line = line.length > 0 ? line + " " + words[i] : words[i];
            }
        }
        if (line.length > 0) {
            lines.push(line);
        }
        return lines.join("\n");
    }

    // Shows a short instruction tethered in front of the user (parented to the camera, slightly
    // below eye line) and removes it after `introHintDuration` seconds.
    function createIntroHint() {
        var cameraObject = camera.getComponent().getSceneObject();

        introHintObject = global.scene.createSceneObject("IntroHint");
        introHintObject.setParent(cameraObject);
        // Runtime-created objects don't reliably land on a camera-rendered layer — inherit the camera's
        introHintObject.layer = cameraObject.layer;

        var hintText = introHintObject.createComponent("Component.Text");
        hintText.text = wrapHintText(script.introHintText, 34);
        hintText.size = 48;
        hintText.textFill.color = new vec4(1.0, 1.0, 1.0, 1.0);
        hintText.backgroundSettings.enabled = true;
        hintText.backgroundSettings.fill.color = LABEL_BACKGROUND_COLOR;
        hintText.backgroundSettings.margins = Rect.create(0.4, 0.4, 0.25, 0.25);
        hintText.backgroundSettings.cornerRadius = 0.2;
        hintText.outlineSettings.enabled = true;
        hintText.outlineSettings.size = 0.35;
        hintText.outlineSettings.fill.color = LABEL_OUTLINE_COLOR;

        // Head-tethered: parented to the camera, slightly below center at a comfortable distance
        var hintTransform = introHintObject.getTransform();
        hintTransform.setLocalPosition(new vec3(0, -14, -60));
        // Text renders single-sided facing its -Z; flip 180° on Y so the front faces the camera
        hintTransform.setLocalRotation(quat.fromEulerAngles(0, Math.PI, 0));

        var hideEvent = script.createEvent("DelayedCallbackEvent");
        hideEvent.bind(function() {
            if (introHintObject !== null) {
                introHintObject.destroy();
                introHintObject = null;
            }
        });
        hideEvent.reset(Math.max(script.introHintDuration, 0.1));
    }

    function onUpdate() {
        primaryInteractor = SIK.InteractionManager.getTargetingInteractors().shift();
        if (primaryInteractor &&
            primaryInteractor.isActive() &&
            primaryInteractor.isTargeting() &&
            !primaryInteractor.currentInteractable // pointing at UI, not at a surface
        ) {
            var rayStartOffset = new vec3(primaryInteractor.startPoint.x, primaryInteractor.startPoint.y, primaryInteractor.startPoint.z + 30);
            var rayStart = rayStartOffset;
            var rayEnd = primaryInteractor.endPoint;

            hitTestSession.hitTest(rayStart, rayEnd, onHitTestResult);

        } else {
            script.targetObject.enabled = false;
            setSurfaceLabelVisible(false);
            // Forget the last hit so a later pinch can't place an object at a stale position
            lastHitResult = null;
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
