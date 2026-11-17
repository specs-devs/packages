/**
 * Glasses Inc. 2026
 * PersistentAnchorExample — the whole native anchor lifecycle in one small component.
 *
 * Add it to any SceneObject and assign `content`. On start it:
 * 1. opens an `AnchorSession` for `area` (empty = all of this Lens's anchors);
 * 2. restores the anchor saved last time: by its stored id (`resolveAnchor`) or, failing that, when
 *    the session discovers it (`onAnchorNearby`) — so content reappears where the user left it;
 * 3. otherwise creates a world anchor `placeDistance` cm in front of the wearer and saves it, storing
 *    `Anchor.id` in persistent storage for the next launch.
 *
 * Content is parented under an anchored SceneObject whose `AnchorComponent` drives the pose. It is
 * shown only while the anchor is `Tracking` and its positional uncertainty is below
 * `maxUncertaintyCm`, and hidden while it is `Lost`, still `Initializing`, or in `Error`.
 *
 * Call `placeHere()` to move the anchor in front of the wearer (create + save the new one, then
 * delete the old one: anchors are immutable), `forget()` to delete it, `clearArea()` to delete every
 * anchor this Lens saved in the area. Custom Location anchors discovered nearby also log their
 * latitude / longitude (needs the user's location permission).
 *
 * Lens Studio Preview has no anchor service: the content is simply shown in front of the camera.
 */
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {Anchor, AnchorController, TrackingStateChange, UncertaintyChange} from "../../Scripts/AnchorController"
import {Logger} from "../../Scripts/Logger"

const STORE_KEY_PREFIX = "AnchorExamples.persistentAnchor."

@component
export class PersistentAnchorExample extends BaseScriptComponent {
  @input
  @hint("Content to keep at the anchored spot. It is reparented under the anchored SceneObject.")
  content: SceneObject

  @input
  @hint("Area name that scopes the session (keep one area under ~250 m²). Empty = every anchor of this Lens.")
  area: string = "example-area"

  @input
  @hint("Distance in front of the wearer, in cm, for a new anchor.")
  placeDistance: number = 80

  @input
  @hint("Hide the content while the reported positional uncertainty is above this value (cm).")
  maxUncertaintyCm: number = 10

  @input
  @hint("Optional: the AnchorModule asset. Without it the controller uses require().")
  @allowUndefined
  anchorModule: AnchorModule

  private readonly logger = new Logger("PersistentAnchorExample", true)
  private readonly controller = AnchorController.getInstance()
  private anchoredRoot: SceneObject
  private anchor: Anchor | null = null
  private tracking = false
  private uncertaintyCm = Number.POSITIVE_INFINITY
  private placing = false

  onAwake(): void {
    this.controller.setModule(this.anchorModule)
    this.anchoredRoot = global.scene.createSceneObject("PersistentAnchor")
    this.content.setParent(this.anchoredRoot)
    this.content.getTransform().setLocalPosition(vec3.zero())
    this.content.enabled = false

    this.controller.onTrackingStateChanged.add((change: TrackingStateChange) => this.onState(change))
    this.controller.onUncertaintyChanged.add((change: UncertaintyChange) => this.onUncertainty(change))
    this.controller.onAnchorNearby.add((anchor: Anchor) => this.onNearby(anchor))
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("OnDestroyEvent").bind(() => this.controller.closeSession())
  }

  private async start(): Promise<void> {
    if (!this.controller.isSupported) {
      this.logger.info("No anchor service (Lens Studio Preview): showing the content in front of the camera")
      this.anchoredRoot.getTransform().setWorldTransform(this.poseInFront())
      this.content.enabled = true
      return
    }
    const session = await this.controller.openSession(this.area.length > 0 ? this.area : null)
    if (!session) return
    const storedId = this.storedId()
    if (storedId) {
      const restored = await this.controller.resolveAnchor(storedId)
      if (restored) {
        this.follow(restored)
        return
      }
      this.logger.warn(`Stored anchor ${storedId} is gone; creating a new one`)
      this.storeId(null)
    }
    await this.placeHere()
  }

  /** Create + save a world anchor in front of the wearer and follow it; the previous one is deleted. */
  async placeHere(): Promise<void> {
    // Ignore repeated requests while the previous anchor is still being created and saved:
    // overlapping creates can leave the session stuck.
    if (this.placing) return
    this.placing = true
    try {
      const previous = this.anchor
      const anchor = await this.controller.createWorldAnchor(this.poseInFront())
      if (!anchor) return
      this.follow(anchor)
      // Save resolves once the device has mapped enough of the surroundings: keep looking around.
      if (!(await this.controller.saveAnchor(anchor))) {
        this.logger.warn(`Anchor ${anchor.id} could not be saved; it lasts for this session only`)
        return
      }
      this.storeId(anchor.id)
      if (previous && previous.id !== anchor.id) await this.controller.deleteAnchor(previous)
    } finally {
      this.placing = false
    }
  }

  /** Delete the saved anchor and hide the content. */
  async forget(): Promise<void> {
    if (this.anchor) await this.controller.deleteAnchor(this.anchor)
    this.anchor = null
    this.storeId(null)
    this.updateVisibility()
  }

  /** Delete every anchor this Lens saved in the session's area. */
  async clearArea(): Promise<void> {
    await this.controller.clearArea()
    this.anchor = null
    this.storeId(null)
    this.updateVisibility()
  }

  private follow(anchor: Anchor): void {
    this.anchor = anchor
    this.tracking = false
    this.uncertaintyCm = Number.POSITIVE_INFINITY
    this.controller.track(this.anchoredRoot, anchor)
    this.logger.info(`Following ${AnchorController.typeName(anchor)} anchor ${anchor.id}`)
    this.updateVisibility()
  }

  private async onNearby(anchor: Anchor): Promise<void> {
    if (AnchorController.isCustom(anchor)) {
      const geo = await this.controller.getGeoPosition(anchor)
      if (geo) this.logger.info(`Custom Location ${anchor.id} at ${geo.latitude}, ${geo.longitude}`)
    }
    // Discovery is the fallback when the stored id could not be resolved yet.
    if (!this.anchor && anchor.id === this.storedId()) this.follow(anchor)
  }

  private onState(change: TrackingStateChange): void {
    if (change.target !== this.anchoredRoot) return
    this.tracking = change.state === AnchorModule.AnchorTrackingState.Tracking
    this.logger.info(`Anchor ${change.anchor.id}: ${AnchorController.stateName(change.state)}`)
    this.updateVisibility()
  }

  private onUncertainty(change: UncertaintyChange): void {
    if (change.target !== this.anchoredRoot) return
    this.uncertaintyCm = change.uncertaintyCm
    this.updateVisibility()
  }

  private updateVisibility(): void {
    this.content.enabled = this.anchor !== null && this.tracking && this.uncertaintyCm <= this.maxUncertaintyCm
  }

  private poseInFront(): mat4 {
    const camera = WorldCameraFinderProvider.getInstance()
    const position = camera.getForwardPositionParallelToGround(this.placeDistance)
    let toWearer = camera.getWorldPosition().sub(position)
    toWearer = new vec3(toWearer.x, 0, toWearer.z)
    toWearer = toWearer.length < 1e-4 ? vec3.forward() : toWearer.normalize()
    // Gravity aligned, content's forward pointing back at the wearer.
    return mat4.compose(position, quat.lookAt(toWearer, vec3.up()), vec3.one())
  }

  private storeKey(): string {
    return STORE_KEY_PREFIX + (this.area.length > 0 ? this.area : "default")
  }

  private storedId(): string | null {
    const id = global.persistentStorageSystem.store.getString(this.storeKey())
    return id && id.length > 0 ? id : null
  }

  private storeId(id: string | null): void {
    global.persistentStorageSystem.store.putString(this.storeKey(), id ?? "")
  }
}
