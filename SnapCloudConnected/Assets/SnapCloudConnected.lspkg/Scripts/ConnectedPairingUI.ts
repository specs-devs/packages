/**
 * SPECS Inc. 2027
 * Pairing panel for Snap Cloud Connected, built from UI Kit buttons. The host taps Host and reads out
 * the 4-digit code; a guest taps Join, enters the 4 digits on the keypad and submits. After each
 * player places their surface, Ready confirms; Place Again re-places; Leave exits the room.
 * The session also works without this panel: call host(), join(code), confirmReady(), leave().
 */
// Preload ThemeService before any UI Kit visual (avoids a circular-import init-order crash).
import "UIKit.lspkg/Scripts/Themes/ThemeService"
import {BaseButton} from "UIKit.lspkg/Scripts/Components/Button/BaseButton"
import {RectangleButton} from "UIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {ConnectedState, SnapCloudConnected} from "./SnapCloudConnected"

/** Seconds after a page swap during which button presses are ignored. */
const PAGE_INPUT_LOCK = 0.35

@component
export class ConnectedPairingUI extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("Session to drive. Empty: the first SnapCloudConnected in the scene")
  session: SnapCloudConnected

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Text</span>')
  @input
  @allowUndefined
  @hint("Status line")
  statusText: Text

  @input
  @allowUndefined
  @hint("Room code: the host's code, or the digits a guest has typed")
  codeText: Text

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Pages</span>')
  @input
  @allowUndefined
  @hint("Shown when offline: Host and Join buttons")
  startPage: SceneObject

  @input
  @allowUndefined
  @hint("Shown while a guest types the code: digit keys, Delete, Submit, Back")
  keypadPage: SceneObject

  @input
  @allowUndefined
  @hint("Shown in a room: Ready, Place Again, Leave")
  roomPage: SceneObject

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Buttons</span>')
  @input
  @allowUndefined
  hostButton: RectangleButton

  @input
  @allowUndefined
  joinButton: RectangleButton

  @input
  @hint("Ten keypad buttons in order 0, 1, 2 … 9 (any UI Kit button)")
  digitButtons: SceneObject[] = []

  @input
  @allowUndefined
  deleteButton: RectangleButton

  @input
  @allowUndefined
  submitButton: RectangleButton

  @input
  @allowUndefined
  backButton: RectangleButton

  @input
  @allowUndefined
  readyButton: RectangleButton

  @input
  @allowUndefined
  placeAgainButton: RectangleButton

  @input
  @allowUndefined
  leaveButton: RectangleButton

  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  private logger: Logger
  private connected: SnapCloudConnected | null = null
  private entering = false
  private pageShownAt = -1
  private digits = ""
  private unsubscribes: (() => void)[] = []

  onAwake(): void {
    this.logger = new Logger("ConnectedPairingUI", this.enableLogging, true)
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("OnDestroyEvent").bind(() => {
      this.unsubscribes.forEach((u) => u())
      this.unsubscribes = []
    })
  }

  private onStart(): void {
    const session = this.session || SnapCloudConnected.getInstance()
    if (!session) {
      this.logger.warn("No SnapCloudConnected found. Assign one to Session")
      return
    }
    this.connected = session
    this.unsubscribes.push(session.onStateChanged.add(() => this.refresh()))
    this.unsubscribes.push(session.onStatusChanged.add(() => this.refresh()))
    this.unsubscribes.push(session.onRoomChanged.add(() => this.refresh()))

    this.bind(this.hostButton, () => {
      this.entering = false
      session.host()
      this.refresh()
    })
    this.bind(this.joinButton, () => {
      this.entering = true
      this.digits = ""
      this.refresh()
    })
    this.digitButtons.forEach((object, digit) => this.bind(this.buttonOn(object), () => this.type(String(digit % 10))))
    this.bind(this.deleteButton, () => {
      this.digits = this.digits.slice(0, -1)
      this.refresh()
    })
    this.bind(this.submitButton, () => {
      if (this.digits.length !== 4) return
      this.entering = false
      session.join(this.digits)
      // The session may stay Offline with an unchanged status (e.g. no SupabaseProject): leave the keypad anyway.
      this.refresh()
    })
    this.bind(this.backButton, () => {
      this.entering = false
      this.digits = ""
      this.refresh()
    })
    this.bind(this.readyButton, () => session.confirmReady())
    this.bind(this.placeAgainButton, () => session.placeSurface())
    this.bind(this.leaveButton, () => session.leave())
    this.refresh()
  }

  private type(digit: string): void {
    if (this.digits.length >= 4) return
    this.digits += digit
    this.refresh()
  }

  private refresh(): void {
    const session = this.connected
    if (!session) return
    const state = session.state
    const offline = state === ConnectedState.Offline
    const inRoom = !offline && state !== ConnectedState.Connecting
    this.show(this.startPage, offline && !this.entering)
    this.show(this.keypadPage, offline && this.entering)
    this.show(this.roomPage, inRoom)
    this.show(this.readyButton?.getSceneObject(), state === ConnectedState.Confirm)
    this.show(this.placeAgainButton?.getSceneObject(), state === ConnectedState.Confirm || state === ConnectedState.Waiting || state === ConnectedState.Active)
    this.show(this.submitButton?.getSceneObject(), this.digits.length === 4)

    if (this.codeText) {
      if (inRoom) this.codeText.text = "Room " + session.roomCode + " · Player " + (session.seat + 1) + (session.isHost ? " (host)" : "")
      else if (this.entering) this.codeText.text = (this.digits + "____").slice(0, 4).split("").join(" ")
      else this.codeText.text = ""
    }
    if (this.statusText) {
      this.statusText.text = offline && this.entering ? "Enter the 4-digit code shown on the host's Lens." : session.status
    }
  }

  private bind(button: BaseButton | null | undefined, action: () => void): void {
    if (!button) return
    this.unsubscribes.push(
      button.onTriggerUp.add(() => {
        // Pages swap under the hand (Join → keypad keys at the same spot): ignore presses right after a swap.
        if (getTime() - this.pageShownAt < PAGE_INPUT_LOCK) return
        action()
      })
    )
  }

  private buttonOn(object: SceneObject): BaseButton | null {
    if (!object) return null
    const scripts = object.getComponents("Component.ScriptComponent") as ScriptComponent[]
    for (const script of scripts) if (script instanceof BaseButton) return script
    this.logger.warn("No UI Kit button on keypad object " + object.name)
    return null
  }

  private show(object: SceneObject | null | undefined, visible: boolean): void {
    if (object && !isNull(object) && object.enabled !== visible) {
      object.enabled = visible
      if (visible) this.pageShownAt = getTime()
    }
  }
}
