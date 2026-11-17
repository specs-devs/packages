/**
 * SPECS Inc. 2027
 * Syncs the position, rotation and scale of a list of SceneObjects between the players of a
 * Snap Cloud Connected room. Poses are relative to each player's placed origin. Choose who may move
 * them: anyone (the last player to move an object owns it until someone else moves it) or one seat.
 * Use the same Sync Id and the same object order on every device.
 */
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {OWNER_ANYONE, SnapCloudConnected} from "./SnapCloudConnected"

@component
export class SyncedTransforms extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("Session to sync through. Empty: the first SnapCloudConnected in the scene")
  session: SnapCloudConnected

  @input
  @hint("Objects whose transforms are synced. Keep the same order on every device")
  objects: SceneObject[] = []

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Anyone (last to move)", -1),
      new ComboBoxItem("Player 1 (host)", 0),
      new ComboBoxItem("Player 2", 1),
      new ComboBoxItem("Player 3", 2),
      new ComboBoxItem("Player 4", 3)
    ])
  )
  @hint("Who publishes these transforms. Everyone else follows them")
  owner: number = OWNER_ANYONE

  @input
  @hint("Unique id for this group, the same on every device. Empty: this SceneObject's name")
  syncId: string = ""

  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  private logger: Logger
  private registered: SnapCloudConnected | null = null
  private ids: string[] = []

  onAwake(): void {
    this.logger = new Logger("SyncedTransforms", this.enableLogging, true)
    this.createEvent("OnStartEvent").bind(() => this.register())
    this.createEvent("OnDestroyEvent").bind(() => this.unregister())
  }

  /** Id of objects[index] on the wire: "<syncId>/<index>". */
  idOf(index: number): string {
    return (this.syncId || this.getSceneObject().name) + "/" + index
  }

  /** True when this player currently publishes objects[index]. */
  isOwnedLocally(index: number): boolean {
    return !!this.registered && this.registered.ownsObject(this.idOf(index))
  }

  private register(): void {
    const session = this.session || SnapCloudConnected.getInstance()
    if (!session) {
      this.logger.warn("No SnapCloudConnected found. Assign one to Session")
      return
    }
    this.registered = session
    this.objects.forEach((object, index) => {
      if (!object) return
      const id = this.idOf(index)
      session.registerObject(id, object, this.owner)
      this.ids.push(id)
    })
    this.logger.info("Registered " + this.ids.length + " object(s) as '" + (this.syncId || this.getSceneObject().name) + "'")
  }

  private unregister(): void {
    if (!this.registered) return
    for (const id of this.ids) this.registered.unregisterObject(id)
    this.ids = []
    this.registered = null
  }
}
