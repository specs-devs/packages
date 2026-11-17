//@component
/**
 * SPECS Inc. 2027
 * Semantic surface detection module (JS variant, feature parity with HitTestClassificationTS).
 * Creates a HitTestSession with classification enabled (plus an optional refine mode), derives the
 * classification value->name map dynamically from the runtime SurfaceClassification enum so it
 * works on every Lens Studio / SnapOS version, and exposes the currently detected surface (name,
 * display name, color) through script.getCurrentClassification() and the
 * script.onClassificationChanged event so other scripts can consume semantic surface information
 * (Ground, Wall, Ceiling, Table, ...) for context-aware AR experiences.
 */
// import required modules
const Interactor = require("SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor");
const InteractorTriggerType = Interactor.InteractorTriggerType;
const InteractorInputType = Interactor.InteractorInputType;
const {SIK} = require("SpectaclesInteractionKit.lspkg/SIK");
const Event = require("SpectaclesInteractionKit.lspkg/Utils/Event").default;

const WorldQueryModule = require("LensStudio:WorldQueryModule");

//@input bool refineEnabled {"hint":"Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported"}
//@input bool enableLogging {"hint":"Enable general logging (events, operations, etc.)"}

function hexToColor(hex, alpha) {
  var clean = hex.replace("#", "");
  var r = parseInt(clean.substring(0, 2), 16) / 255;
  var g = parseInt(clean.substring(2, 4), 16) / 255;
  var b = parseInt(clean.substring(4, 6), 16) / 255;
  return new vec4(r, g, b, alpha === undefined ? 1.0 : alpha);
}

// Label colors keyed by classification NAME (string), not by enum literal. Public Lens Studio
// builds may only declare None/Ground, while devices with semantic detection report the full set
// (Wall, Ceiling, Table, ...). Keying by name keeps this file working on every Lens Studio
// version and automatically supports new classifications as SnapOS adds them.
var SURFACE_COLORS = {
  Ground: hexToColor("#00ff00"),
  Wall: hexToColor("#00fff7"),
  Ceiling: hexToColor("#aa00ff"),
  Table: hexToColor("#ff0000"),
  None: hexToColor("#070070"),
};
// None doubles as the fallback for any category without an explicit color above
var FALLBACK_COLOR = SURFACE_COLORS["None"];

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

function HitTestClassification() {
  // Private variables
  var hitTestSession;
  var primaryInteractor;
  var classificationNames;
  var currentInfo = null;

  // Fires whenever the detected surface classification CHANGES (not every frame).
  // Payload: { classification, name, displayName, color }
  script.onClassificationChanged = new Event();

  // Returns the most recent semantic surface detection, or null before the first hit.
  script.getCurrentClassification = function() {
    return currentInfo;
  };

  function onAwake() {
    classificationNames = buildClassificationNameMap();
    hitTestSession = createHitTestSession();

    script.createEvent("UpdateEvent").bind(onUpdate);
  }

  function createHitTestSession() {
    var options = HitTestSessionOptions.create();
    options.classification = true;

    if (script.refineEnabled) {
      // `refine` is not available on every Lens Studio/SnapOS version —
      // assign it defensively so this script runs everywhere.
      try {
        options.refine = true;
      } catch (e) {
        if (script.enableLogging) {
          print("HitTestSessionOptions.refine is not supported on this Lens Studio/SnapOS version — ignoring");
        }
      }
    }

    var session = WorldQueryModule.createHitTestSessionWithOptions(options);
    return session;
  }

  function getClassificationName(classification) {
    if (classification === undefined || classification === null) {
      return "None";
    }
    var name = classificationNames[classification];
    return name === undefined ? ("Surface" + classification) : name;
  }

  function getClassificationColor(name) {
    var color = SURFACE_COLORS[name];
    return color === undefined ? FALLBACK_COLOR : color;
  }

  function onHitTestResult(result) {
    if (result === null) {
      // Hit test failed — keep the last known classification.
      return;
    }

    var name = getClassificationName(result.classification);
    if (currentInfo !== null && currentInfo.name === name) {
      return; // No change — don't spam consumers every frame.
    }

    currentInfo = {
      classification: result.classification,
      name: name,
      displayName: name === "None" ? "UNKNOWN" : name.toUpperCase(),
      color: getClassificationColor(name),
    };
    script.onClassificationChanged.invoke(currentInfo);

    if (script.enableLogging) {
      print("Detected surface: " + currentInfo.displayName + " (classification=" + currentInfo.classification + ")");
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
    }
  }

  // Initialize
  onAwake();
}

// Register and initialize the script
script.HitTestClassification = HitTestClassification;
HitTestClassification();
