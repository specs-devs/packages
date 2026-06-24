/**
 * Specs Inc. 2026
 * Hand attachment system for attaching objects to hand joints in world space. Provides smooth
 * interpolation, customizable offsets, and support for all hand joints with configurable tracking.
 */
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";
import { MathUtils } from "Utilities.lspkg/Scripts/Utils/MathUtils";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * HandAttacher - Attach objects to hand joints in world space
 *
 * Attaches a target object to any hand joint with customizable offset and rotation.
 * The object is not parented - it follows the joint in world space with smooth interpolation.
 */

export enum HandSide {
    Left = "left",
    Right = "right",
    Dominant = "dominant",
    NonDominant = "nondominant"
}

export enum HandJoint {
    Wrist = "wrist",

    // Thumb joints
    ThumbBase = "thumbToWrist",
    ThumbKnuckle = "thumbKnuckle",
    ThumbMid = "thumbMidJoint",
    ThumbTip = "thumbTip",

    // Index finger joints
    IndexBase = "indexToWrist",
    IndexKnuckle = "indexKnuckle",
    IndexMid = "indexMidJoint",
    IndexUpper = "indexUpperJoint",
    IndexTip = "indexTip",

    // Middle finger joints
    MiddleBase = "middleToWrist",
    MiddleKnuckle = "middleKnuckle",
    MiddleMid = "middleMidJoint",
    MiddleUpper = "middleUpperJoint",
    MiddleTip = "middleTip",

    // Ring finger joints
    RingBase = "ringToWrist",
    RingKnuckle = "ringKnuckle",
    RingMid = "ringMidJoint",
    RingUpper = "ringUpperJoint",
    RingTip = "ringTip",

    // Pinky finger joints
    PinkyBase = "pinkyToWrist",
    PinkyKnuckle = "pinkyKnuckle",
    PinkyMid = "pinkyMidJoint",
    PinkyUpper = "pinkyUpperJoint",
    PinkyTip = "pinkyTip"
}

@component
export class HandAttacher extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the object to attach to the hand joint (leave empty to use this object)</span>')

    @input
    @hint("Object to attach to hand joint (leave empty to use this object)")
    @allowUndefined
    targetObject: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Hand Joint Selection</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose which hand and joint to attach to</span>')

    @input("string")
    @hint("Hand: left | right | dominant | nondominant")
    handSide: string = "right";

    @input("string")
    @hint("Joint: wrist | thumbToWrist | thumbKnuckle | thumbMidJoint | thumbTip | indexToWrist | indexKnuckle | indexMidJoint | indexUpperJoint | indexTip | middleToWrist | middleKnuckle | middleMidJoint | middleUpperJoint | middleTip | ringToWrist | ringKnuckle | ringMidJoint | ringUpperJoint | ringTip | pinkyToWrist | pinkyKnuckle | pinkyMidJoint | pinkyUpperJoint | pinkyTip")
    handJoint: string = "indexTip";

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Position & Rotation Offsets</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Adjust position and rotation offsets relative to the joint</span>')

    @input
    @hint("Position offset from joint (in joint's local space)")
    positionOffset: vec3 = vec3.zero();

    @input
    @hint("Rotation offset (in degrees)")
    rotationOffset: vec3 = vec3.zero();

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Smoothing Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure interpolation smoothing for position and rotation tracking</span>')

    @input
    @hint("Enable smooth position interpolation")
    usePositionSmoothing: boolean = true;

    @input
    @hint("Position smoothing speed (higher = faster response)")
    positionSmoothSpeed: number = 10.0;

    @input
    @hint("Enable smooth rotation interpolation")
    useRotationSmoothing: boolean = true;

    @input
    @hint("Rotation smoothing speed (higher = faster response)")
    rotationSmoothSpeed: number = 8.0;

    @input
    @hint("Only update position")
    updatePositionOnly: boolean = false;

    @input
    @hint("Only update rotation")
    updateRotationOnly: boolean = false;

    @input
    @hint("Hide object when hand is not tracked")
    hideWhenNotTracked: boolean = true;

    @input
    @hint("Debug: Show tracking status in console")
    debugMode: boolean = false;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Private properties
  private logger: Logger;
  private targetTransform: Transform;
  private currentHand: any; // TrackedHand type
  private wasTracked: boolean = false;

  /**
   * Called when component wakes up - initialize logger and setup hand tracking
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("HandAttacher", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
    }

    // Use this script's scene object if no target specified
    if (!this.targetObject) {
      this.targetObject = this.sceneObject;
      if (this.enableLogging) {
        this.logger.info("Using script's own scene object as target");
      }
    }

    this.targetTransform = this.targetObject.getTransform();

    // Set up hand tracking
    this.setupHandTracking();

    if (this.enableLogging) {
      this.logger.info(`Initialized - Hand: ${this.handSide}, Joint: ${this.handJoint}`);
    }
  }

  /**
   * Called every frame
   * Automatically bound to UpdateEvent via SnapDecorators
   */
  @bindUpdateEvent
  updateHandAttachment(): void {
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: updateHandAttachment() - Update event");
    }

    this.onUpdate();
  }

  /**
   * Sets up hand tracking with SIK HandInputData
   */
  private setupHandTracking(): void {
    const handInputData = SIK.HandInputData;

    // Get the appropriate hand
    switch (this.handSide) {
      case "left":
        this.currentHand = handInputData.getHand("left");
        break;
      case "right":
        this.currentHand = handInputData.getHand("right");
        break;
      case "dominant":
        this.currentHand = handInputData.getDominantHand();
        break;
      case "nondominant":
        this.currentHand = handInputData.getNonDominantHand();
        break;
    }

    if (!this.currentHand) {
      this.logger.error("Failed to get hand reference!");
      return;
    }

    // Set up hand tracking events
    this.currentHand.onHandFound.add(() => {
      if (this.enableLogging) {
        this.logger.info(`${this.handSide} hand found`);
      }
      if (this.hideWhenNotTracked) {
        this.targetObject.enabled = true;
      }
    });

    this.currentHand.onHandLost.add(() => {
      if (this.enableLogging) {
        this.logger.info(`${this.handSide} hand lost`);
      }
      if (this.hideWhenNotTracked) {
        this.targetObject.enabled = false;
      }
    });
  }

  /**
   * Updates the target object's position and rotation to follow the hand joint
   */
  private onUpdate(): void {
    if (!this.targetObject || !this.currentHand) {
      if (this.enableLogging) {
        this.logger.warn("Missing target object or current hand");
      }
      return;
    }

    const isTracked = this.currentHand.isTracked();

    // Handle tracking state changes
    if (isTracked !== this.wasTracked) {
      this.wasTracked = isTracked;
      if (this.hideWhenNotTracked) {
        this.targetObject.enabled = isTracked;
      }
      if (this.enableLogging) {
        this.logger.info(`Hand tracking ${isTracked ? "started" : "stopped"}`);
      }
    }

    if (!isTracked) return;

    // Get the selected joint
    const joint = this.getJoint(this.handJoint);
    if (!joint) {
      if (this.enableLogging) {
        this.logger.error(`Joint '${this.handJoint}' not found!`);
      }
      return;
    }

    // Verify joint has position
    if (!joint.position) {
      if (this.enableLogging) {
        this.logger.error(`Joint '${this.handJoint}' has no position!`);
      }
      return;
    }

    if (this.enableLogging) {
      const pos = joint.position;
      this.logger.debug(`Joint pos: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    }

        // Update position
        if (!this.updateRotationOnly) {
            this.updatePosition(joint);
        }

        // Update rotation
        if (!this.updatePositionOnly) {
            this.updateRotation(joint);
        }
    }

  /**
   * Gets the hand joint object by name
   * @param jointName - Name of the joint to retrieve
   * @returns The joint object or null if not found
   */
  private getJoint(jointName: string): any {
    // Map joint string to actual hand joint property
    switch (jointName) {
      case "wrist": return this.currentHand.wrist;

      case "thumbToWrist": return this.currentHand.thumbToWrist;
      case "thumbKnuckle": return this.currentHand.thumbKnuckle;
      case "thumbMidJoint": return this.currentHand.thumbMidJoint;
      case "thumbTip": return this.currentHand.thumbTip;

      case "indexToWrist": return this.currentHand.indexToWrist;
      case "indexKnuckle": return this.currentHand.indexKnuckle;
      case "indexMidJoint": return this.currentHand.indexMidJoint;
      case "indexUpperJoint": return this.currentHand.indexUpperJoint;
      case "indexTip": return this.currentHand.indexTip;

      case "middleToWrist": return this.currentHand.middleToWrist;
      case "middleKnuckle": return this.currentHand.middleKnuckle;
      case "middleMidJoint": return this.currentHand.middleMidJoint;
      case "middleUpperJoint": return this.currentHand.middleUpperJoint;
      case "middleTip": return this.currentHand.middleTip;

      case "ringToWrist": return this.currentHand.ringToWrist;
      case "ringKnuckle": return this.currentHand.ringKnuckle;
      case "ringMidJoint": return this.currentHand.ringMidJoint;
      case "ringUpperJoint": return this.currentHand.ringUpperJoint;
      case "ringTip": return this.currentHand.ringTip;

      case "pinkyToWrist": return this.currentHand.pinkyToWrist;
      case "pinkyKnuckle": return this.currentHand.pinkyKnuckle;
      case "pinkyMidJoint": return this.currentHand.pinkyMidJoint;
      case "pinkyUpperJoint": return this.currentHand.pinkyUpperJoint;
      case "pinkyTip": return this.currentHand.pinkyTip;

      default: return null;
    }
  }

  /**
   * Updates the target object's position to follow the joint with optional smoothing
   * @param joint - The hand joint to follow
   */
  private updatePosition(joint: any): void {
    // Get joint world position
    const jointPosition = joint.position;

    if (this.enableLogging) {
      this.logger.debug(`Setting position from joint: (${jointPosition.x.toFixed(2)}, ${jointPosition.y.toFixed(2)}, ${jointPosition.z.toFixed(2)})`);
    }

    // Apply offset in joint's local space
    const jointRotation = joint.rotation;
    const rotatedOffset = jointRotation.multiplyVec3(this.positionOffset);
    const targetPosition = jointPosition.add(rotatedOffset);

    // Get current position
    const currentPosition = this.targetTransform.getWorldPosition();

    // Apply smoothing if enabled
    let finalPosition: vec3;
    if (this.usePositionSmoothing) {
      const deltaTime = getDeltaTime();
      const t = Math.min(1.0, this.positionSmoothSpeed * deltaTime);
      finalPosition = vec3.lerp(currentPosition, targetPosition, t);
    } else {
      finalPosition = targetPosition;
    }

    if (this.enableLogging) {
      this.logger.debug(`Final position: (${finalPosition.x.toFixed(2)}, ${finalPosition.y.toFixed(2)}, ${finalPosition.z.toFixed(2)})`);
    }

    this.targetTransform.setWorldPosition(finalPosition);
  }

  /**
   * Updates the target object's rotation to match the joint with optional smoothing
   * @param joint - The hand joint to follow
   */
  private updateRotation(joint: any): void {
    // Get joint world rotation
    const jointRotation = joint.rotation;

    // Apply rotation offset
    const offsetQuat = quat.fromEulerAngles(
      this.rotationOffset.x * MathUtils.DegToRad,
      this.rotationOffset.y * MathUtils.DegToRad,
      this.rotationOffset.z * MathUtils.DegToRad
    );
    const targetRotation = jointRotation.multiply(offsetQuat);

    // Get current rotation
    const currentRotation = this.targetTransform.getWorldRotation();

    // Apply smoothing if enabled
    let finalRotation: quat;
    if (this.useRotationSmoothing) {
      const deltaTime = getDeltaTime();
      const t = Math.min(1.0, this.rotationSmoothSpeed * deltaTime);
      finalRotation = quat.slerp(currentRotation, targetRotation, t);
    } else {
      finalRotation = targetRotation;
    }

    this.targetTransform.setWorldRotation(finalRotation);
  }

  /**
   * Public API: Change the hand being tracked
   * @param side - Hand side ("left", "right", "dominant", "nondominant")
   */
  public setHand(side: string): void {
    this.handSide = side;
    this.setupHandTracking();

    if (this.enableLogging) {
      this.logger.info(`Hand changed to: ${side}`);
    }
  }

  /**
   * Public API: Change the joint being tracked
   * @param joint - Joint name (e.g., "wrist", "indexTip", "thumbTip")
   */
  public setJoint(joint: string): void {
    this.handJoint = joint;

    if (this.enableLogging) {
      this.logger.info(`Joint changed to: ${joint}`);
    }
  }

  /**
   * Public API: Set position offset from the joint
   * @param offset - Position offset vector
   */
  public setPositionOffset(offset: vec3): void {
    this.positionOffset = offset;

    if (this.enableLogging) {
      this.logger.info(`Position offset set to: (${offset.x}, ${offset.y}, ${offset.z})`);
    }
  }

  /**
   * Public API: Set rotation offset from the joint
   * @param offset - Rotation offset in degrees (euler angles)
   */
  public setRotationOffset(offset: vec3): void {
    this.rotationOffset = offset;

    if (this.enableLogging) {
      this.logger.info(`Rotation offset set to: (${offset.x}, ${offset.y}, ${offset.z})`);
    }
  }

  /**
   * Public API: Check if the hand is currently being tracked
   * @returns True if hand is tracked, false otherwise
   */
  public isHandTracked(): boolean {
    return this.currentHand ? this.currentHand.isTracked() : false;
  }
}
