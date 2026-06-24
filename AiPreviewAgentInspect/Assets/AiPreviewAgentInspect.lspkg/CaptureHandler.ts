import {computeAABB} from "./AABBComputer"
import {AgentCommand, AgentResponse, CaptureViewCommand} from "./AgentMessages"
import {MessagePublisher} from "./messaging/MessagePublisher"
import {CaptureDetail, captureOrthoView} from "./OrthoCapture"
import {findSceneObjectByUniqueId} from "./SceneHelpers"

const DEFAULT_DISTANCE = 100

export class CaptureHandler {
  constructor(private publisher: MessagePublisher<AgentCommand, AgentResponse>) {
    this.publisher.subscribe("CaptureView", (cmd: CaptureViewCommand) => this.handleCaptureView(cmd))
  }

  /**
   * Render an orthographic snapshot of a region.
   *
   * Region resolution:
   *   - If `uniqueIds` is non-empty, the region is the AABB over those scene
   *     objects. Extra `distance / 2` is added to each half-extent so the
   *     framing has some context around the object. When `distance` is
   *     omitted no extra padding is added (the captureOrthoView call still
   *     applies its built-in PADDING_FACTOR). `isolate` hides everything else.
   *   - Otherwise the region is a cube centered at `center` (default origin)
   *     with half-size `distance / 2` (default 50). `isolate` is a no-op
   *     because there's no object set to isolate against.
   *
   * Both modes feed the same `captureOrthoView` once a center and extents
   * are computed.
   */
  private async handleCaptureView(cmd: CaptureViewCommand): Promise<void> {
    try {
      const viewAngle = cmd.viewAngle ?? "isometric"
      const detail = (cmd.detail ?? "medium") as CaptureDetail

      const hasUniqueIds = cmd.uniqueIds && cmd.uniqueIds.length > 0

      let center: {x: number; y: number; z: number}
      let extents: {x: number; y: number; z: number}
      let objectRotation: quat | undefined
      let isolateObjects: SceneObject[] | undefined
      let isMultiObject = false

      if (hasUniqueIds) {
        // Object mode — frame around the AABB of the given uniqueIds.
        let minX = Infinity,
          minY = Infinity,
          minZ = Infinity
        let maxX = -Infinity,
          maxY = -Infinity,
          maxZ = -Infinity
        let anyFound = false

        for (const id of cmd.uniqueIds!) {
          const aabb = computeAABB(id)
          if (!aabb.found) continue
          anyFound = true
          if (aabb.min.x < minX) minX = aabb.min.x
          if (aabb.min.y < minY) minY = aabb.min.y
          if (aabb.min.z < minZ) minZ = aabb.min.z
          if (aabb.max.x > maxX) maxX = aabb.max.x
          if (aabb.max.y > maxY) maxY = aabb.max.y
          if (aabb.max.z > maxZ) maxZ = aabb.max.z
        }

        if (!anyFound) {
          this.publisher.notify({
            type: "CommandError",
            commandId: cmd.commandId,
            message: `No scene objects found for uniqueIds: ${JSON.stringify(cmd.uniqueIds)}`,
            reason: "not_found"
          })
          return
        }

        const halfPadding = cmd.distance !== undefined ? cmd.distance / 2 : 0
        center = {x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2}
        extents = {
          x: (maxX - minX) / 2 + halfPadding,
          y: (maxY - minY) / 2 + halfPadding,
          z: (maxZ - minZ) / 2 + halfPadding
        }

        // Single-object captures use the object's own rotation so the
        // viewAngle ("front", "back", etc.) is relative to the object rather
        // than world axes. For multi-object framing there's no canonical
        // orientation, so we leave it world-aligned.
        isMultiObject = cmd.uniqueIds!.length > 1
        if (!isMultiObject) {
          const obj = findSceneObjectByUniqueId(cmd.uniqueIds![0])
          if (obj && !isNull(obj)) {
            objectRotation = obj.getTransform().getWorldRotation()
          }
        }

        if (cmd.isolate) {
          isolateObjects = cmd
            .uniqueIds!.map((id) => findSceneObjectByUniqueId(id))
            .filter((obj): obj is SceneObject => obj !== undefined && !isNull(obj))
        }
      } else {
        // Scene mode — cube around `center` (defaults to origin).
        center = cmd.center ?? {x: 0, y: 0, z: 0}
        const halfSize = (cmd.distance ?? DEFAULT_DISTANCE) / 2
        extents = {x: halfSize, y: halfSize, z: halfSize}
      }

      const result = await captureOrthoView(
        viewAngle,
        center,
        extents,
        objectRotation,
        isMultiObject,
        isolateObjects,
        detail
      )

      this.publisher.notify({
        type: "CaptureViewResponse",
        commandId: cmd.commandId,
        imageBase64: result.imageBase64,
        viewAngle,
        width: result.width,
        height: result.height
      })
    } catch (e) {
      this.publisher.notify({
        type: "CommandError",
        commandId: cmd.commandId,
        message: String(e),
        reason: "internal_error"
      })
    }
  }
}
