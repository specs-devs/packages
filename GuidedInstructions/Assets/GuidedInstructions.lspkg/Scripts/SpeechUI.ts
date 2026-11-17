/**
 * SPECS Inc. 2027
 * Speech UI component for the Depth Cache Glasses lens.
 */
// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining the Visual class +
// COLORS, and the theme chain reads them at module-load). Loading ThemeService first lets
// Visual.ts finish before any UIKit component (incl. scene-authored buttons) loads.
import "UIKit.lspkg/Scripts/Themes/ThemeService";
import animate, {CancelSet} from "InteractionKit.lspkg/Utils/animate"
import Event from "InteractionKit.lspkg/Utils/Event"
import {ASRController} from "./ASRController"
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {bindStartEvent, bindUpdateEvent} from "SnapDecorators.lspkg/decorators"

const UI_CAM_DISTANCE = 110 // cm in front of camera (Specs far-field guideline)
const UI_CAM_HEIGHT = -19.8 // cm, same angle as the authored -9 cm at 50 cm
const AUTHORED_DISTANCE = 50 // cm the UI was sized for; scaled up so it keeps its angular size

@component
export class SpeechUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SpeechUI – speech bubble with microphone button</span><br/><span style="color: #94A3B8; font-size: 11px;">Follows the main camera and shows ASR transcription text.</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @input
  @hint("Main camera scene object used to position the speech UI")
  mainCamObj: SceneObject

  @input
  @hint("Anchor for the speech bubble popup")
  speecBocAnchor: SceneObject

  @input
  @hint("Render mesh for the microphone icon with animated shader")
  micRend: RenderMeshVisual

  @input
  @hint("Text component displaying the transcribed speech")
  speechText: Text

  @input
  @hint("ASR voice controller for starting and stopping transcription")
  asrVoiceController: ASRController

  @input
  @hint("Collider for enabling and disabling the speech button tap area")
  speechButtonCollider: ColliderComponent

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging</span>')
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy)")
  enableLoggingLifecycle: boolean = false

  onSpeechReady = new Event<string>()

  private logger: Logger
  private speechBubbleTrans: Transform
  private trans: Transform
  private mainCamTrans: Transform

  onAwake() {
    this.logger = new Logger("SpeechUI", this.enableLogging || this.enableLoggingLifecycle, true)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")
    this.speechBubbleTrans = this.speecBocAnchor.getTransform()
    this.speechBubbleTrans.setLocalScale(vec3.zero())
    this.trans = this.getSceneObject().getTransform()
    this.trans.setLocalScale(this.trans.getLocalScale().uniformScale(UI_CAM_DISTANCE / AUTHORED_DISTANCE))
    this.mainCamTrans = this.mainCamObj.getTransform()
    this.animateSpeechIcon(false)
    this.speechText.text = ""
  }

  @bindStartEvent
  private onStart() {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()")
    this.asrVoiceController.onPartialVoiceEvent.add((text) => {
      this.speechText.text = text
    })
    this.asrVoiceController.onFinalVoiceEvent.add((text) => {
      this.speechText.text = text
      this.stopListening()
      this.onSpeechReady.invoke(text)
    })
  }

  activateSpeechButton(activate: boolean) {
    this.speechButtonCollider.enabled = activate
  }

  onSpeechButtonDown() {
    this.logger.info("Speech button Down!")
    this.speechText.text = ""
    this.animateSpeechBubble(true)
    this.animateSpeechIcon(true)
    this.asrVoiceController.startListening()
  }

  // Pinch-up hook wired by the demo prefab's TouchDownButton. Intentionally does not stop
  // listening: the button is tap-to-talk and ASR ends itself on the final transcription.
  onSpeechButtonUp() {
    this.logger.debug("Speech button Up")
  }

  stopListening() {
    this.logger.info("Disabling speech UI")
    this.animateSpeechIcon(false)
    this.asrVoiceController.stopListening()
  }

  @bindUpdateEvent
  private onUpdate() {
    const camPos = this.mainCamTrans.getWorldPosition()
    let desiredPosition = camPos.add(this.mainCamTrans.forward.uniformScale(-UI_CAM_DISTANCE))
    desiredPosition = desiredPosition.add(this.mainCamTrans.up.uniformScale(UI_CAM_HEIGHT))
    // Clamp so a long frame (low Preview frame rate) can't overshoot and oscillate away
    const followT = Math.min(1, getDeltaTime() * 10)
    this.trans.setWorldPosition(vec3.lerp(this.trans.getWorldPosition(), desiredPosition, followT))
    const desiredRotation = quat.lookAt(this.mainCamTrans.forward, vec3.up())
    this.trans.setWorldRotation(quat.slerp(this.trans.getWorldRotation(), desiredRotation, followT))
  }

  private animateSpeechIcon(active: boolean) {
    this.micRend.mainPass.Tweak_N23 = active ? 3 : 0
    this.micRend.mainPass.Tweak_N33 = active ? 3 : 0
    this.micRend.mainPass.Tweak_N37 = active ? 0.2 : 0
  }

  private animateSpeechBubble(open: boolean) {
    const currScale = this.speechBubbleTrans.getLocalScale()
    const desiredScale = open ? vec3.one() : vec3.zero()
    animate({
      easing: "ease-out-elastic",
      duration: 1,
      update: (t) => {
        this.speechBubbleTrans.setLocalScale(vec3.lerp(currScale, desiredScale, t))
      },
      ended: null,
      cancelSet: new CancelSet()
    })
  }
}
