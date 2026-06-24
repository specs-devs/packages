type ViewAngle = "isometric" | "top" | "front" | "back" | "left" | "right"

// Local next-frame helper. Lazily owns a hidden ScriptComponent and resolves
// once time has advanced past the creation frame (i.e. on the next frame).
let frameWaiterScript: ScriptComponent | undefined

function getFrameWaiter(): ScriptComponent {
  if (!frameWaiterScript || isNull(frameWaiterScript)) {
    const obj = global.scene.createSceneObject("AiPreviewAgentFrameWaiter")
    frameWaiterScript = obj.createComponent("ScriptComponent")
  }
  return frameWaiterScript
}

function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    const creationTime = getTime()
    const updateEvent = getFrameWaiter().createEvent("UpdateEvent")
    updateEvent.bind(() => {
      // Only fire once time has advanced past creation time (i.e., next frame)
      if (getTime() > creationTime) {
        getFrameWaiter().removeEvent(updateEvent)
        resolve()
      }
    })
  })
}

// A single render target reused across every capture, resized per call.
// Dynamically created render target textures are not reliably reclaimed when
// they go out of scope, and `Texture.destroy()` is deprecated — so rather than
// allocate-and-release one per capture we keep one instance for the lifetime of
// the lens. Captures are driven serially by the agent, so a shared target is
// safe; if captures are ever parallelised this would need one target per call.
let cachedRenderTarget: Texture | undefined

function getRenderTarget(width: number, height: number): Texture {
  if (!cachedRenderTarget || isNull(cachedRenderTarget)) {
    cachedRenderTarget = global.scene.createRenderTargetTexture()
  }
  const rtControl = cachedRenderTarget.control as RenderTargetProvider
  rtControl.useScreenResolution = false
  rtControl.resolution = new vec2(width, height)
  return cachedRenderTarget
}

interface Vec3 {
  x: number
  y: number
  z: number
}

const PADDING_FACTOR_SINGLE = 1.5
const PADDING_FACTOR_MULTI = 1.1
const INV_SQRT3 = 1 / Math.sqrt(3)

export type CaptureDetail = "low" | "medium" | "high"

const RESOLUTION_PRESETS: Record<CaptureDetail, {width: number; height: number}> = {
  low: {width: 256, height: 192},
  medium: {width: 512, height: 384},
  high: {width: 1024, height: 768}
}

// Default export for backwards compatibility
export const RENDER_TARGET_WIDTH = 1024
export const RENDER_TARGET_HEIGHT = 768

interface OrthoViewParams {
  position: vec3
  rotation: quat
  orthoSize: number
  near: number
  far: number
}

function computeOrthoViewParams(
  viewAngle: ViewAngle,
  center: Vec3,
  extents: Vec3,
  objectRotation?: quat,
  paddingFactor: number = PADDING_FACTOR_SINGLE,
  renderWidth: number = RENDER_TARGET_WIDTH,
  renderHeight: number = RENDER_TARGET_HEIGHT
): OrthoViewParams {
  const maxExtent = Math.max(extents.x, extents.y, extents.z, 0.5)
  const camDistance = maxExtent * 4
  const aspectRatio = renderWidth / renderHeight
  const c = new vec3(center.x, center.y, center.z)
  const rot = objectRotation ?? quat.quatIdentity()

  // Each view angle defines a world-axis camera rotation (Euler angles).
  // For single-object captures, the object's rotation is prepended so the
  // camera directions are relative to the object's orientation.
  let cameraOffset: vec3
  let baseRotation: quat
  let viewWidth: number
  let viewHeight: number

  switch (viewAngle) {
    case "top":
      cameraOffset = rot.multiplyVec3(new vec3(0, camDistance, 0))
      baseRotation = rot.multiply(quat.fromEulerAngles(-Math.PI / 2, 0, 0))
      viewWidth = extents.x * 2
      viewHeight = extents.z * 2
      break
    case "front":
      cameraOffset = rot.multiplyVec3(new vec3(0, 0, camDistance))
      baseRotation = rot.multiply(quat.fromEulerAngles(0, 0, 0))
      viewWidth = extents.x * 2
      viewHeight = extents.y * 2
      break
    case "back":
      cameraOffset = rot.multiplyVec3(new vec3(0, 0, -camDistance))
      baseRotation = rot.multiply(quat.fromEulerAngles(0, Math.PI, 0))
      viewWidth = extents.x * 2
      viewHeight = extents.y * 2
      break
    case "left":
      cameraOffset = rot.multiplyVec3(new vec3(-camDistance, 0, 0))
      baseRotation = rot.multiply(quat.fromEulerAngles(0, -Math.PI / 2, 0))
      viewWidth = extents.z * 2
      viewHeight = extents.y * 2
      break
    case "right":
      cameraOffset = rot.multiplyVec3(new vec3(camDistance, 0, 0))
      baseRotation = rot.multiply(quat.fromEulerAngles(0, Math.PI / 2, 0))
      viewWidth = extents.z * 2
      viewHeight = extents.y * 2
      break
    case "isometric":
    default:
      cameraOffset = rot.multiplyVec3(
        new vec3(camDistance * INV_SQRT3, camDistance * INV_SQRT3, camDistance * INV_SQRT3)
      )
      baseRotation = rot.multiply(quat.fromEulerAngles(-Math.asin(INV_SQRT3), Math.PI / 4, 0))
      viewWidth = maxExtent * 2
      viewHeight = maxExtent * 2
      break
  }

  const orthoSize = Math.max(viewHeight, viewWidth / aspectRatio) * paddingFactor

  return {
    position: c.add(cameraOffset),
    rotation: baseRotation,
    orthoSize,
    near: 0.01,
    far: camDistance * 2
  }
}

/**
 * Captures an orthographic screenshot from the specified angle.
 * Creates a temporary camera + render target, renders one frame, encodes to base64, and cleans up.
 */
// Matches RuntimeQueryHandler's traversal cap so a deep/cyclic scene can't
// stack-overflow mid-capture and leave isolation layers unrestored.
const MAX_TRAVERSAL_DEPTH = 256

/**
 * Collects a SceneObject and all its descendants into an array.
 */
function collectDescendants(root: SceneObject): SceneObject[] {
  const result: SceneObject[] = []
  const walk = (obj: SceneObject, depth: number): void => {
    if (depth > MAX_TRAVERSAL_DEPTH) return
    result.push(obj)
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      walk(obj.getChild(i), depth + 1)
    }
  }
  walk(root, 0)
  return result
}

export async function captureOrthoView(
  viewAngle: ViewAngle,
  center: Vec3,
  extents: Vec3,
  objectRotation?: quat,
  isMultiObject: boolean = false,
  isolateObjects?: SceneObject[],
  detail: CaptureDetail = "medium"
): Promise<{imageBase64: string; width: number; height: number}> {
  const padding = isMultiObject ? PADDING_FACTOR_MULTI : PADDING_FACTOR_SINGLE
  const resolution = RESOLUTION_PRESETS[detail]
  const params = computeOrthoViewParams(
    viewAngle,
    center,
    extents,
    objectRotation,
    padding,
    resolution.width,
    resolution.height
  )

  // `camObj` is created inside the try so the finally block is guaranteed to
  // destroy it — any throw during setup (RT creation, camera property
  // assignment, layer isolation) would otherwise leak the temp SceneObject
  // and leave isolation layers stuck on the target hierarchy.
  let camObj: SceneObject | undefined
  const savedLayers: Array<{obj: SceneObject; layer: LayerSet}> = []
  try {
    camObj = global.scene.createSceneObject("__ortho_capture_tmp")
    const camera = camObj.createComponent("Component.Camera") as Camera

    // Reuse the shared render target (resized for this capture's resolution)
    // instead of allocating a fresh one per call — see getRenderTarget().
    const renderTarget = getRenderTarget(resolution.width, resolution.height)

    // Configure camera
    camera.type = Camera.Type.Orthographic
    camera.size = params.orthoSize
    camera.near = params.near
    camera.far = params.far
    camera.renderTarget = renderTarget
    const colorRenderTarget = camera.colorRenderTargets[0]
    colorRenderTarget.clearColorOption = ClearColorOption.CustomColor
    colorRenderTarget.clearColor = new vec4(0.1, 0.1, 0.1, 1)
    camera.renderOrder = 999

    // Position and orient
    const transform = camObj.getTransform()
    transform.setWorldPosition(params.position)
    transform.setWorldRotation(params.rotation)

    // Isolation: move target objects to a dedicated layer, camera renders only that layer
    if (isolateObjects && isolateObjects.length > 0) {
      // Use layer 31 as the isolation layer
      const isolationLayer = LayerSet.fromNumber(31)

      // Collect all objects to isolate (including descendants)
      for (const obj of isolateObjects) {
        for (const descendant of collectDescendants(obj)) {
          savedLayers.push({obj: descendant, layer: descendant.layer})
          descendant.layer = isolationLayer
        }
      }

      // Also move the camera to the isolation layer
      camObj.layer = isolationLayer
      camera.renderLayer = isolationLayer
    }

    // Wait for the camera to render
    await nextFrame()
    await nextFrame() // extra frame for safety

    // Encode render target to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      Base64.encodeTextureAsync(
        renderTarget,
        (encoded: string) => resolve(encoded),
        () => reject(new Error("Failed to encode render target to base64")),
        CompressionQuality.HighQuality,
        EncodingType.Jpg
      )
    })

    return {imageBase64: base64, width: resolution.width, height: resolution.height}
  } finally {
    // Restore original layers
    for (const {obj, layer} of savedLayers) {
      if (!isNull(obj)) {
        obj.layer = layer
      }
    }
    // Cleanup. The render target is intentionally NOT destroyed — it's the
    // shared, reused instance from getRenderTarget().
    if (camObj && !isNull(camObj)) {
      camObj.destroy()
    }
  }
}
