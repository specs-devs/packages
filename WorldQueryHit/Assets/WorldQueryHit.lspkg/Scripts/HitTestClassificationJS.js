// import required modules
const Interactor = require("SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor");
const InteractorTriggerType = Interactor.InteractorTriggerType;
const InteractorInputType = Interactor.InteractorInputType;
const {SIK} = require("SpectaclesInteractionKit.lspkg/SIK");

const WorldQueryModule = require("LensStudio:WorldQueryModule");

function HitTestClassification() {
  // Private variables
  var hitTestSession;
  var primaryInteractor;

  function onAwake() {
    hitTestSession = createHitTestSession();

    script.createEvent("UpdateEvent").bind(onUpdate);
  }

  function createHitTestSession() {
    var options = HitTestSessionOptions.create();
    options.classification = true;

    var session = WorldQueryModule.createHitTestSessionWithOptions(options);
    return session;
  }

  function onHitTestResult(result) {
    if (result === null) {
      // Hit test failed
      return;
    }

    var hitPosition = result.position;
    var hitNormal = result.normal;
    var hitClassification = result.classification;

    switch (hitClassification) {
      case SurfaceClassification.Ground:
        print("Hit ground!");
        break;
      case SurfaceClassification.None:
        print("Hit unknown surface!");
        break;
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
