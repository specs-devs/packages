/**
 * Specs Inc. 2026
 * GuidancePanel – step-by-step maintenance guidance display.
 *
 * MANUAL mode – user navigates with the prev/next RectangleButtons assigned below.
 * AUTO mode   – SceneController calls setAutoStep(stepId) after each Gemini response.
 *
 * The script's own SceneObject is used as both the camera-follow anchor AND the
 * show/hide scale target – no extra "root" object needed.
 * All step content comes from NespressoKnowledge.ts.
 */

import {RectangleButton} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DESCALING_STEPS, MaintenanceStep} from "./NespressoKnowledge"
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {bindStartEvent, bindUpdateEvent} from "SnapDecorators.lspkg/decorators"

const PANEL_DISTANCE = 50   // cm in front of camera
const PANEL_HEIGHT = 8      // cm above camera center
const PANEL_LERP = 5        // camera-follow smoothness

@component
export class GuidancePanel extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">GuidancePanel – step-by-step maintenance guide</span><br/><span style="color: #94A3B8; font-size: 11px;">Content from NespressoKnowledge.ts. Assign buttons below – events wired in code.</span>')
  @ui.separator

  // ── Camera ───────────────────────────────────────────────────────────────
  @ui.label('<span style="color: #60A5FA;">Camera</span>')
  @input
  @hint("Main camera scene object – panel follows this in world space")
  mainCamObj: SceneObject

  // ── Texts ─────────────────────────────────────────────────────────────────
  @ui.label('<span style="color: #60A5FA;">Display Texts</span>')
  @input
  @hint("Step counter + phase, e.g. '3 / 15  [DESCALING]'")
  stepCounterText: Text

  @input
  @hint("Current step title")
  stepTitleText: Text

  @input
  @hint("Current step description, warnings, and time notes")
  stepDescText: Text

  @input
  @hint("Current mode indicator: MANUAL or AUTO")
  modeText: Text

  // ── Buttons ───────────────────────────────────────────────────────────────
  @ui.label('<span style="color: #60A5FA;">Buttons</span>')
  @input
  @hint("RectangleButton for going to the previous step")
  prevButton: RectangleButton

  @input
  @hint("RectangleButton for going to the next step")
  nextButton: RectangleButton

  @input
  @hint("RectangleButton to toggle between MANUAL and AUTO mode")
  modeToggleButton: RectangleButton

  // ── Logging ───────────────────────────────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging</span>')
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging")
  enableLoggingLifecycle: boolean = false

  // ── Public events ─────────────────────────────────────────────────────────

  /** Fired whenever the displayed step changes (0-based index). */
  public onStepChanged = new Event<number>()

  // ── Privates ──────────────────────────────────────────────────────────────

  private logger: Logger
  private trans: Transform
  private mainCamTrans: Transform
  private currentStepIndex: number = 0
  private isAutoMode: boolean = false
  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake() {
    this.logger = new Logger("GuidancePanel", this.enableLogging || this.enableLoggingLifecycle, true)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")

    this.trans = this.getSceneObject().getTransform()
    this.mainCamTrans = this.mainCamObj.getTransform()
    this.refreshDisplay()
  }

  @bindStartEvent
  private onStart() {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()")

    this.prevButton.onTriggerUp.add(() => this.goToPrevStep())
    this.nextButton.onTriggerUp.add(() => this.goToNextStep())
    this.modeToggleButton.onTriggerUp.add(() => this.toggleMode())
  }

  @bindUpdateEvent
  private onUpdate() {
    const camPos = this.mainCamTrans.getWorldPosition()
    const desired = camPos
      .add(this.mainCamTrans.forward.uniformScale(-PANEL_DISTANCE))
      .add(this.mainCamTrans.up.uniformScale(PANEL_HEIGHT))

    this.trans.setWorldPosition(
      vec3.lerp(this.trans.getWorldPosition(), desired, getDeltaTime() * PANEL_LERP)
    )
    const desiredRot = quat.lookAt(this.mainCamTrans.forward, vec3.up())
    this.trans.setWorldRotation(
      quat.slerp(this.trans.getWorldRotation(), desiredRot, getDeltaTime() * PANEL_LERP)
    )
  }

  // ── Public API ────────────────────────────────────────────────────────────

  goToPrevStep() {
    if (this.isAutoMode) return
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--
      this.refreshDisplay()
      this.onStepChanged.invoke(this.currentStepIndex)
      this.logger.info("Step -> " + (this.currentStepIndex + 1))
    }
  }

  goToNextStep() {
    if (this.isAutoMode) return
    if (this.currentStepIndex < DESCALING_STEPS.length - 1) {
      this.currentStepIndex++
      this.refreshDisplay()
      this.onStepChanged.invoke(this.currentStepIndex)
      this.logger.info("Step -> " + (this.currentStepIndex + 1))
    }
  }

  toggleMode() {
    this.isAutoMode = !this.isAutoMode
    this.refreshDisplay()
    this.logger.info("Mode -> " + (this.isAutoMode ? "AUTO" : "MANUAL"))
  }

  /**
   * Called by SceneController when Gemini detects which step the user is at.
   * Ignored when in MANUAL mode.
   * @param stepId 1-based step number (1–15); 0 = not detected
   */
  setAutoStep(stepId: number) {
    if (!this.isAutoMode || stepId <= 0) return
    const idx = DESCALING_STEPS.findIndex((s) => s.id === stepId)
    if (idx === -1 || idx === this.currentStepIndex) return
    this.currentStepIndex = idx
    this.refreshDisplay()
    this.onStepChanged.invoke(this.currentStepIndex)
    this.logger.info("Auto step -> " + DESCALING_STEPS[idx].id + ": " + DESCALING_STEPS[idx].title)
  }

  get currentStep(): MaintenanceStep {
    return DESCALING_STEPS[this.currentStepIndex]
  }

  get autoMode(): boolean {
    return this.isAutoMode
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private refreshDisplay() {
    const step = DESCALING_STEPS[this.currentStepIndex]

    this.stepCounterText.text = step.id + " / " + DESCALING_STEPS.length + "  [" + step.phase.toUpperCase() + "]"
    this.stepTitleText.text = step.title

    let desc = step.description
    if (step.warning) desc += "\n\u26A0 " + step.warning
    if (step.timeNote) desc += "\n\u23F1 " + step.timeNote
    this.stepDescText.text = desc

    this.modeText.text = this.isAutoMode ? "AUTO" : "MANUAL"
  }

}
