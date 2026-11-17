/**
 * SPECS Inc. 2027
 * World query hit test example with surface detection, semantic surface classification, and object
 * placement. Demonstrates HitTestSession creation with optional filtering, classification and refine
 * options, real-time cursor positioning on detected surfaces, a legible color-coded billboard label
 * that names the detected surface (GROUND, WALL, TABLE, ...) at the raycast hit point, trigger end
 * callback for object spawning, position and rotation alignment with hit normals, and
 * preview/placement workflow for AR surface interactions.
 */
import { bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import {
    InteractorTriggerType,
    InteractorInputType
  } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
  import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
  import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

  const WorldQueryModule = require("LensStudio:WorldQueryModule")
  const EPSILON = 0.01;

  // Order must match the "Detect Category" ComboBox values below (0 = All). Filtering compares
  // classification NAMEs (strings), never enum members — compile-safe on public Lens Studio builds.
  const DETECT_CATEGORY_NAMES = ["All", "Ground", "Wall", "Ceiling", "Table", "None"];

  const LABEL_BACKGROUND_COLOR = new vec4(0.0, 0.0, 0.0, 0.65);
  const LABEL_OUTLINE_COLOR = new vec4(0.0, 0.0, 0.0, 1.0);
  const LABEL_TEXT_SIZE = 96;
  const LABEL_SURFACE_OFFSET_CM = 5;  // push the label off the surface along the hit normal
  const LABEL_LIFT_CM = 10;           // lift the label so it clears the preview object

  /**
   * Builds the classification value -> name map from the RUNTIME enum object (the equivalent of
   * SharedUtils' listEnum, inlined here). Never reference SurfaceClassification members other than
   * None/Ground as compile-time literals — they are not declared in public Lens Studio typings.
   */
  function buildClassificationNameMap(): Map<number, string> {
      const names = new Map<number, string>();
      const enumObject = SurfaceClassification as any;
      for (const key of Object.keys(enumObject)) {
          const value = enumObject[key];
          if (typeof value === "number" && !names.has(value)) {
              names.set(value, key);
          }
      }
      return names;
  }

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
      @ui.label('<span style="color: #60A5FA;">Cursor Smoothing</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Ease the preview object toward the hit point instead of snapping</span>')

      @input
      @hint("Smoothly interpolate (lerp) the preview object toward the hit point instead of snapping to it")
      smoothingEnabled: boolean = true;

      @input
      @hint("Smoothing speed — higher is snappier. ~5 feels floaty, ~10 balanced, ~25 tight. Frame-rate independent")
      smoothingSpeed: number = 10.0;

      @ui.separator
      @ui.label('<span style="color: #60A5FA;">Intro Hint</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Short instruction tethered in front of the user at the start</span>')

      @input
      @hint("Show a brief instruction tethered in front of the user when the Lens starts")
      showIntroHint: boolean = true;

      @input
      @hint("Instruction text shown at start (long lines wrap automatically)")
      introHintText: string = "Point to surfaces using your hand to see semantic classification and pinch to instantiate the object prefab";

      @input
      @hint("How long the intro hint stays visible, in seconds")
      introHintDuration: number = 2.0;

      @ui.separator
      @ui.label('<span style="color: #60A5FA;">Semantic Surface Detection</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Classification options and hit-point label</span>')

      @input
      @hint("Enable surface classification (options.classification) on the hit test session")
      classificationEnabled: boolean = true;

      @input
      @hint("Show a color-coded label at the hit point naming the detected surface (GROUND, WALL, TABLE, ...)")
      showSurfaceLabel: boolean = true;

      @input
      @hint("Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported")
      refineEnabled: boolean = false;

      @input
      @hint("Uniform scale multiplier for the semantic surface label")
      labelScale: number = 1.0;

      @input
      @widget(new ComboBoxWidget([
          new ComboBoxItem("All", 0),
          new ComboBoxItem("Ground", 1),
          new ComboBoxItem("Wall", 2),
          new ComboBoxItem("Ceiling", 3),
          new ComboBoxItem("Table", 4),
          new ComboBoxItem("None / Unknown", 5),
      ]))
      @hint("The full set of detectable surface categories. 'All' labels every detected surface; pick one category to only label hits of that type")
      detectCategory: number = 0;

      @ui.separator
      @ui.label('<span style="color: #60A5FA;">Surface Category Colors</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">All supported categories: Ground, Wall, Ceiling, Table, None/Unknown</span>')
      @ui.label('<span style="color: #94A3B8; font-size: 11px;">Colors are matched to the detected surface NAME at runtime</span>')

      // Colors are keyed by classification NAME (string), never by enum literal: public Lens
      // Studio builds may only declare None/Ground in their typings, while builds/devices with
      // semantic detection report the full set. The value->name map is built dynamically from the
      // RUNTIME SurfaceClassification enum, so every category below just works the moment the
      // runtime starts reporting it — zero code changes needed.
      @input('vec4', '{0.0, 1.0, 0.0, 1.0}')
      @widget(new ColorWidget())
      @hint("Label color when the detected surface is Ground")
      groundColor: vec4;

      @input('vec4', '{0.0, 1.0, 0.9686, 1.0}')
      @widget(new ColorWidget())
      @hint("Label color when the detected surface is a Wall")
      wallColor: vec4;

      @input('vec4', '{0.6667, 0.0, 1.0, 1.0}')
      @widget(new ColorWidget())
      @hint("Label color when the detected surface is a Ceiling")
      ceilingColor: vec4;

      @input('vec4', '{1.0, 0.0, 0.0, 1.0}')
      @widget(new ColorWidget())
      @hint("Label color when the detected surface is a Table")
      tableColor: vec4;

      @input('vec4', '{0.0275, 0.0, 0.4392, 1.0}')
      @widget(new ColorWidget())
      @hint("Label color for None/Unknown surfaces — also the fallback for any category without its own color above")
      unknownColor: vec4;

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
      private camera: WorldCameraFinderProvider;
      private classificationNames: Map<number, string>;
      private surfaceColors: Record<string, vec4>;
      private labelObject: SceneObject;
      private labelText: Text;
      private lastLabelName: string = "";
      private smoothedPosition: vec3 | null = null;
      private smoothedRotation: quat | null = null;
      private introHintObject: SceneObject | null = null;

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

          // Inputs added to this script after a component was serialized read as `undefined` at
          // runtime until the scene is re-saved — normalize them to their intended defaults so
          // package upgrades never silently disable a feature.
          this.smoothingEnabled = this.smoothingEnabled !== false;
          this.smoothingSpeed = this.smoothingSpeed ?? 10.0;
          this.showIntroHint = this.showIntroHint !== false;
          this.introHintText = this.introHintText
              ?? "Point to surfaces using your hand to see semantic classification and pinch to instantiate the object prefab";
          this.introHintDuration = this.introHintDuration ?? 2.0;

          // Build the runtime classification value -> name map before creating the session
          this.classificationNames = buildClassificationNameMap();
          // Seed the name -> color map from the Inspector color inputs (one per known category)
          this.surfaceColors = {
              Ground: this.groundColor,
              Wall: this.wallColor,
              Ceiling: this.ceilingColor,
              Table: this.tableColor,
              None: this.unknownColor,
          };
          this.camera = WorldCameraFinderProvider.getInstance();

          // create new hit session
          this.hitTestSession = this.createHitTestSession(this.filterEnabled);
          if (!this.targetObject) {
              this.logger.error("Please set Target Object input");
              return;
          }
          this.transform = this.targetObject.getTransform();
          // disable target object when surface is not detected
          this.targetObject.enabled = false;
          this.setObjectEnabled(this.indexToSpawn)

          // Create the semantic surface label that follows the raycast hit point
          if (this.showSurfaceLabel) {
              this.createSurfaceLabel();
          }

          // Brief instruction tethered in front of the user at the start of the experience
          if (this.showIntroHint) {
              this.createIntroHint();
          }

          // Set up trigger end callback
          this.setupTriggerEndCallback();

          if (this.enableLogging) {
              this.logger.info("Hit test session created with filter: " + this.filterEnabled
                  + ", classification: " + this.classificationEnabled
                  + ", refine requested: " + this.refineEnabled);
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
                  // Skip when the pinch was on a UI element (button, panel), not on a surface
                  if (this.lastHitResult && this.primaryInteractor === interactor && !interactor.currentInteractable) {
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

          // Place where the user sees the cursor: the smoothed pose when smoothing is enabled,
          // otherwise the exact last hit.
          const hitPosition = this.smoothingEnabled && this.smoothedPosition !== null
              ? this.smoothedPosition
              : this.lastHitResult.position;
          const toRotation = this.smoothingEnabled && this.smoothedRotation !== null
              ? this.smoothedRotation
              : this.calculateSurfaceRotation(this.lastHitResult.normal);

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
          options.classification = this.classificationEnabled;

          if (this.refineEnabled) {
              // `refine` is not declared on every Lens Studio version's typings/runtime —
              // assign it defensively so this script compiles and runs everywhere.
              try {
                  (options as any).refine = true;
              } catch (e) {
                  if (this.enableLogging) {
                      this.logger.info("HitTestSessionOptions.refine is not supported on this Lens Studio/SnapOS version — ignoring");
                  }
              }
          }

          const session = WorldQueryModule.createHitTestSessionWithOptions(options);
          return session;
      }


      onHitTestResult(results) {
          if (results === null) {
              this.targetObject.enabled = false;
              this.setSurfaceLabelVisible(false);
              this.lastHitResult = null;
          } else {
              const wasVisible = this.targetObject.enabled;
              this.targetObject.enabled = true;
              // Store hit result for potential trigger end callback
              this.lastHitResult = results;

              //identifying the direction the object should look at based on the normal of the hit location.
              const toRotation = this.calculateSurfaceRotation(results.normal);

              // Ease the cursor toward the hit pose (or snap when smoothing is off)
              this.applyCursorPose(results.position, toRotation, wasVisible);

              // Communicate the detected surface semantically at the hit point
              this.updateSurfaceLabel(results);
          }
      }

      /**
       * Moves the preview object toward the hit pose. With smoothing enabled the cursor eases in
       * with a frame-rate-independent exponential lerp (tune with Smoothing Speed); it snaps
       * directly on the first frame it appears so it never flies in from a stale position.
       */
      private applyCursorPose(position: vec3, rotation: quat, wasVisible: boolean) {
          if (!this.smoothingEnabled || !wasVisible ||
              this.smoothedPosition === null || this.smoothedRotation === null) {
              this.smoothedPosition = position;
              this.smoothedRotation = rotation;
          } else {
              const t = 1 - Math.exp(-Math.max(this.smoothingSpeed, 0.01) * getDeltaTime());
              this.smoothedPosition = vec3.lerp(this.smoothedPosition, position, t);
              this.smoothedRotation = quat.slerp(this.smoothedRotation, rotation, t);
          }

          const transform = this.targetObject.getTransform();
          transform.setWorldPosition(this.smoothedPosition);
          transform.setWorldRotation(this.smoothedRotation);
      }

      // --- Semantic surface label -------------------------------------------------------------

      /**
       * Creates the billboard label that names the detected surface at the raycast hit point.
       * Built for legibility on Glasses: solid dark background, black outline, color-coded fill.
       */
      private createSurfaceLabel() {
          this.labelObject = global.scene.createSceneObject("SurfaceClassificationLabel");
          this.labelObject.setParent(this.sceneObject);
          // Runtime-created objects don't reliably land on a camera-rendered layer — inherit ours
          this.labelObject.layer = this.sceneObject.layer;

          this.labelText = this.labelObject.createComponent("Component.Text");
          this.labelText.text = "";
          this.labelText.size = LABEL_TEXT_SIZE;
          this.labelText.textFill.color = this.unknownColor;
          this.labelText.backgroundSettings.enabled = true;
          this.labelText.backgroundSettings.fill.color = LABEL_BACKGROUND_COLOR;
          this.labelText.backgroundSettings.margins = Rect.create(0.3, 0.3, 0.15, 0.15);
          this.labelText.backgroundSettings.cornerRadius = 0.2;
          this.labelText.outlineSettings.enabled = true;
          this.labelText.outlineSettings.size = 0.35;
          this.labelText.outlineSettings.fill.color = LABEL_OUTLINE_COLOR;

          const labelScale = Math.max(this.labelScale, 0.01);
          this.labelObject.getTransform().setLocalScale(new vec3(labelScale, labelScale, labelScale));
          this.labelObject.enabled = false;
      }

      private setSurfaceLabelVisible(visible: boolean) {
          if (this.labelObject && this.labelObject.enabled !== visible) {
              this.labelObject.enabled = visible;
          }
      }

      /** Resolves a classification enum value to its runtime enum key name. */
      private getClassificationName(classification: number | undefined | null): string {
          if (classification === undefined || classification === null) {
              return "None";
          }
          return this.classificationNames.get(classification) ?? ("Surface" + classification);
      }

      /**
       * Positions the color-coded semantic label at the hit point (offset along the surface
       * normal and lifted to clear the preview object) and billboards it toward the camera.
       */
      private updateSurfaceLabel(results) {
          if (!this.showSurfaceLabel || !this.labelText) {
              return;
          }
          if (!this.classificationEnabled) {
              this.setSurfaceLabelVisible(false);
              return;
          }

          const name = this.getClassificationName(results.classification);

          // Category filter: "All" labels every hit; a specific category hides the label on
          // every other surface type. Compared by NAME string — compile-safe on public builds.
          const filterName = DETECT_CATEGORY_NAMES[this.detectCategory] ?? "All";
          if (filterName !== "All" && name !== filterName) {
              this.setSurfaceLabelVisible(false);
              return;
          }

          if (name !== this.lastLabelName) {
              this.lastLabelName = name;
              this.labelText.text = name === "None" ? "UNKNOWN" : name.toUpperCase();
              this.labelText.textFill.color = this.surfaceColors[name] ?? this.unknownColor;
              if (this.enableLogging) {
                  this.logger.info("Detected surface: " + name);
              }
          }

          // Anchor the label to the (smoothed) cursor position so the two move as one
          const hitNormal: vec3 = results.normal.normalize();
          const anchor: vec3 = this.smoothedPosition ?? results.position;
          const labelPosition: vec3 = anchor
              .add(hitNormal.uniformScale(LABEL_SURFACE_OFFSET_CM))
              .add(vec3.up().uniformScale(LABEL_LIFT_CM));

          const labelTransform = this.labelObject.getTransform();
          labelTransform.setWorldPosition(labelPosition);

          // Billboard toward the camera so the label stays legible from any angle
          // (Text faces along the look direction, so aim it from the label back at the camera)
          const cameraPosition = this.camera.getWorldPosition();
          const toCamera = cameraPosition.sub(labelPosition);
          if (toCamera.lengthSquared > EPSILON) {
              labelTransform.setWorldRotation(quat.lookAt(toCamera, vec3.up()));
          }

          this.setSurfaceLabelVisible(true);
      }

      // --- Intro hint ---------------------------------------------------------------------------

      /** Soft line-wrap for the hint text so it reads as a compact block. */
      private wrapHintText(text: string, maxLineLength: number): string {
          if (text.indexOf("\n") !== -1) {
              return text; // author already formatted it
          }
          const words = text.split(" ");
          const lines: string[] = [];
          let line = "";
          for (const word of words) {
              if (line.length > 0 && line.length + 1 + word.length > maxLineLength) {
                  lines.push(line);
                  line = word;
              } else {
                  line = line.length > 0 ? line + " " + word : word;
              }
          }
          if (line.length > 0) {
              lines.push(line);
          }
          return lines.join("\n");
      }

      /**
       * Shows a short instruction tethered in front of the user (parented to the camera, slightly
       * below eye line) and removes it after `introHintDuration` seconds.
       */
      private createIntroHint() {
          const cameraObject = this.camera.getComponent().getSceneObject();

          this.introHintObject = global.scene.createSceneObject("IntroHint");
          this.introHintObject.setParent(cameraObject);
          // Runtime-created objects don't reliably land on a camera-rendered layer — inherit the camera's
          this.introHintObject.layer = cameraObject.layer;

          const hintText = this.introHintObject.createComponent("Component.Text");
          hintText.text = this.wrapHintText(this.introHintText, 34);
          hintText.size = 48;
          hintText.textFill.color = new vec4(1.0, 1.0, 1.0, 1.0);
          hintText.backgroundSettings.enabled = true;
          hintText.backgroundSettings.fill.color = LABEL_BACKGROUND_COLOR;
          hintText.backgroundSettings.margins = Rect.create(0.4, 0.4, 0.25, 0.25);
          hintText.backgroundSettings.cornerRadius = 0.2;
          hintText.outlineSettings.enabled = true;
          hintText.outlineSettings.size = 0.35;
          hintText.outlineSettings.fill.color = LABEL_OUTLINE_COLOR;

          // Head-tethered: parented to the camera, slightly below center, closer than typical
          // in-scene readme panels so the hint is never occluded by them
          const hintTransform = this.introHintObject.getTransform();
          hintTransform.setLocalPosition(new vec3(0, -14, -60));
          // Text renders single-sided facing its -Z; flip 180° on Y so the front faces the camera
          hintTransform.setLocalRotation(quat.fromEulerAngles(0, Math.PI, 0));

          if (this.enableLogging) {
              this.logger.info("Intro hint shown for " + this.introHintDuration + "s");
          }

          const hideEvent = this.createEvent("DelayedCallbackEvent");
          hideEvent.bind(() => {
              if (this.introHintObject !== null) {
                  this.introHintObject.destroy();
                  this.introHintObject = null;
                  if (this.enableLogging) {
                      this.logger.info("Intro hint hidden");
                  }
              }
          });
          hideEvent.reset(Math.max(this.introHintDuration, 0.1));
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
              this.primaryInteractor.isTargeting() &&
              !this.primaryInteractor.currentInteractable // pointing at UI, not at a surface
          ) {
              const rayStartOffset = new vec3(this.primaryInteractor.startPoint.x, this.primaryInteractor.startPoint.y, this.primaryInteractor.startPoint.z + 30);
              const rayStart = rayStartOffset;
              const rayEnd = this.primaryInteractor.endPoint;


              this.hitTestSession.hitTest(rayStart, rayEnd, this.onHitTestResult.bind(this));


          } else {
              this.targetObject.enabled = false;
              this.setSurfaceLabelVisible(false);
              // Forget the last hit so a later pinch can't place an object at a stale position
              this.lastHitResult = null;
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
