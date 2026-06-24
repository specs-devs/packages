/**
 * Specs Inc. 2026
 * Hit test classification example for surface type detection. Creates HitTestSession with classification
 * enabled, processes WorldQueryHitTestResult to identify surface types (Ground, None), integrates with
 * SIK InteractionManager for primary interactor tracking, and demonstrates real-time surface recognition
 * for context-aware AR experiences.
 */
import {
  InteractorTriggerType,
  InteractorInputType
} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindUpdateEvent } from "SnapDecorators.lspkg/decorators";

const WorldQueryModule =
  require('LensStudio:WorldQueryModule') as WorldQueryModule;

@component
export class HitTestClassification extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (events, operations, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  private logger: Logger;
  private hitTestSession: HitTestSession;
  private primaryInteractor;

  onAwake() {
    const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
    this.logger = new Logger("HitTestClassification", shouldLog, true);

    if (this.enableLoggingLifecycle) {
      this.logger.header("HitTestClassification Initialization");
      this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
    }

    this.hitTestSession = this.createHitTestSession();
  }

  createHitTestSession() {
    const options = HitTestSessionOptions.create();
    options.classification = true;

    const session = WorldQueryModule.createHitTestSessionWithOptions(options);
    return session;
  }

  onHitTestResult = (result: WorldQueryHitTestResult) => {
    if (result === null) {
      // Hit test failed
      return;
    }

    const hitPosition = result.position;
    const hitNormal = result.normal;
    const hitClassification = result.classification;

    switch (hitClassification) {
      case SurfaceClassification.Ground:
        if (this.enableLogging) {
          this.logger.info('Hit ground!');
        }
        break;
      case SurfaceClassification.None:
        if (this.enableLogging) {
          this.logger.info('Hit unknown surface!');
        }
        break;
    }
  };

  /**
   * Called every frame
   * Automatically bound to UpdateEvent via SnapDecorators
   */
  @bindUpdateEvent
  onUpdate(): void {
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onUpdate() - Update event");
    }
    this.primaryInteractor = SIK.InteractionManager.getTargetingInteractors().shift();
    if (this.primaryInteractor &&
        this.primaryInteractor.isActive() &&
        this.primaryInteractor.isTargeting()
    ) {
        const rayStartOffset = new vec3(this.primaryInteractor.startPoint.x, this.primaryInteractor.startPoint.y, this.primaryInteractor.startPoint.z + 30);
        const rayStart = rayStartOffset;
        const rayEnd = this.primaryInteractor.endPoint;

        this.hitTestSession.hitTest(rayStart, rayEnd, this.onHitTestResult);
    }
  }
}