/**
 * Specs Inc. 2026
 * World query hit test example with surface detection and object placement. Demonstrates HitTestSession
 * creation with optional filtering, real-time cursor positioning on detected surfaces, trigger end
 * callback for object spawning, position and rotation alignment with hit normals, and preview/placement
 * workflow for AR surface interactions.
 */
import { bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import {
    InteractorTriggerType,
    InteractorInputType
  } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
  import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"

  const WorldQueryModule = require("LensStudio:WorldQueryModule")
  const EPSILON = 0.01;


  @component
  export class NewScript extends BaseScriptComponent {

      @ui.separator
      @ui.label('<span style="color: #60A5FA;">Spawn Configuration</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Object selection and spawn index</span>')

      private primaryInteractor;
      private hitTestSession: HitTestSession;
      private transform: Transform;
      private lastHitResult: any; // Store last hit result for trigger end callback
      @input
      indexToSpawn: number;

      @input
      targetObject: SceneObject;

      @input
      objectsToSpawn: SceneObject[];

      @ui.separator
      @ui.label('<span style="color: #60A5FA;">Hit Test Settings</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Surface detection filter configuration</span>')

      @input
      filterEnabled: boolean;

      @ui.separator
      @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

      @input
      @hint("Enable general logging (hit tests, object placement, etc.)")
      enableLogging: boolean = false;

      @input
      @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
      enableLoggingLifecycle: boolean = false;

      private logger: Logger;

      /**
       * Called when component wakes up - initialize logger and hit test session
       */
      onAwake() {
          const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
          this.logger = new Logger("WorldQueryHitExample", shouldLog, true);

          if (this.enableLoggingLifecycle) {
              this.logger.header("WorldQueryHitExample Initialization");
              this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
          }

          // create new hit session
          this.hitTestSession = this.createHitTestSession(this.filterEnabled);
          if (!this.sceneObject) {
              this.logger.error("Please set Target Object input");
              return;
          }
          this.transform = this.targetObject.getTransform();
          // disable target object when surface is not detected
          this.targetObject.enabled = false;
          this.setObjectEnabled(this.indexToSpawn)

          // Set up trigger end callback
          this.setupTriggerEndCallback();

          if (this.enableLogging) {
              this.logger.info("Hit test session created with filter: " + this.filterEnabled);
          }
      }
  
  
      setupTriggerEndCallback() {
          // Get all interactors and set up trigger end callbacks
          const allInteractors = SIK.InteractionManager.getInteractorsByType(
              InteractorInputType.All
          );
          
          for (const interactor of allInteractors) {
              interactor.onTriggerEnd.add(() => {
                  // Only place object if we have a valid hit result and this is the primary interactor
                  if (this.lastHitResult && this.primaryInteractor === interactor) {
                      this.placeObject();
                  }
              });
          }
      }
  
      placeObject() {
          if (!this.lastHitResult) return;

          if (this.enableLogging) {
              this.logger.info("Placing object at hit position");
          }

          // Copy the plane/axis object
          const parent = this.objectsToSpawn[this.indexToSpawn].getParent();
          const newObject = parent.copyWholeHierarchy(this.objectsToSpawn[this.indexToSpawn]);
          newObject.setParentPreserveWorldTransform(null);

          // Set position and rotation from last hit
          const hitPosition = this.lastHitResult.position;
          const hitNormal = this.lastHitResult.normal;

          const toRotation = this.calculateSurfaceRotation(hitNormal);
          newObject.getTransform().setWorldPosition(hitPosition);
          newObject.getTransform().setWorldRotation(toRotation);

          if (this.enableLogging) {
              this.logger.success("Object placed successfully");
          }
      }

      private calculateSurfaceRotation(hitNormal: vec3): quat {
          let lookDirection;
          if (1 - Math.abs(hitNormal.normalize().dot(vec3.up())) < EPSILON) {
              lookDirection = vec3.forward();
          } else {
              lookDirection = hitNormal.cross(vec3.up());
          }
          return quat.lookAt(lookDirection, hitNormal);
      }
  
      createHitTestSession(filterEnabled) {
          // create hit test session with options
          const options = HitTestSessionOptions.create();
          options.filter = filterEnabled;
  
  
          const session = WorldQueryModule.createHitTestSessionWithOptions(options);
          return session;
      }
  
  
      onHitTestResult(results) {
          if (results === null) {
              this.targetObject.enabled = false;
              this.lastHitResult = null;
          } else {
              this.targetObject.enabled = true;
              // Store hit result for potential trigger end callback
              this.lastHitResult = results;
              
              // get hit information
              const hitPosition = results.position;
              const hitNormal = results.normal;

              //identifying the direction the object should look at based on the normal of the hit location.
              const toRotation = this.calculateSurfaceRotation(hitNormal);

              //set position and rotation
              this.targetObject.getTransform().setWorldPosition(hitPosition);
              this.targetObject.getTransform().setWorldRotation(toRotation);
          }
      }

      /**
       * Called every frame
       * Automatically bound to UpdateEvent via SnapDecorators
       */
      @bindUpdateEvent
      onUpdate() {
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
  
  
              this.hitTestSession.hitTest(rayStart, rayEnd, this.onHitTestResult.bind(this));
  
  
          } else {
              this.targetObject.enabled = false;
          }
      }
  
      setObjectIndex(i) {
          this.indexToSpawn = i;
      }
  
      setObjectEnabled(i) {
          for (let i = 0; i < this.objectsToSpawn.length; i++)
              this.objectsToSpawn[i].enabled = i == this.indexToSpawn;
      }
  }
  