import {vec3ToPlain} from "./ComponentReaderRegistry"
import {findSceneObjectByUniqueId, getColliderSize} from "./SceneHelpers"

interface Vec3Plain {
  x: number
  y: number
  z: number
}

export interface AABBResult {
  found: boolean
  objectName?: string
  center: Vec3Plain
  extents: Vec3Plain
  min: Vec3Plain
  max: Vec3Plain
}

/** Framing box (half-extent, cm) substituted for a genuinely zero-volume result so a camera has something to frame. */
const MIN_EXTENT = 10.0

/**
 * Half-extent (cm) below which a box is treated as degenerate (a point/empty object) on ALL axes.
 * Only a genuine zero-volume result trips the framing floor; a real small object (a mark, an icon)
 * keeps its true measured extents. A larger threshold here would floor real small objects up to a
 * MIN_EXTENT cube and corrupt the bounds measurement that QueryRuntimeScene reports.
 */
const DEGENERATE_EPS = 0.01

/** Minimum world-space AABB extent (cm) to consider a mesh meaningful (filters out unit quads/circles). */
const MIN_MESH_EXTENT = 2.0

/**
 * Try to extract mesh AABB from a SceneObject's RenderMeshVisual.
 * Returns \{localMin, localMax, transform\} if the mesh has a meaningful AABB, or null.
 */
function getMeshBounds(obj: SceneObject): {localMin: vec3; localMax: vec3; transform: Transform; rmv: RenderMeshVisual} | null {
  const rmv = obj.getComponent("Component.RenderMeshVisual")
  if (!rmv || isNull(rmv)) return null
  const mesh = rmv.mesh
  if (!mesh || isNull(mesh)) return null

  try {
    const localMin = mesh.aabbMin
    const localMax = mesh.aabbMax
    if (!localMin || !localMax) return null

    const transform = obj.getTransform()
    const localExtent = localMax.sub(localMin)
    const worldScale = transform.getWorldScale()
    // Threshold in world space, not mesh-local: a GLB's 100x import scale lives in the
    // transform, so its local extent is sub-unit even when the object is tens of cm.
    const worldExtent = new vec3(
      Math.abs(localExtent.x * worldScale.x),
      Math.abs(localExtent.y * worldScale.y),
      Math.abs(localExtent.z * worldScale.z)
    )
    if (worldExtent.x < MIN_MESH_EXTENT && worldExtent.y < MIN_MESH_EXTENT && worldExtent.z < MIN_MESH_EXTENT) {
      return null
    }

    return {localMin, localMax, transform, rmv}
  } catch {
    return null
  }
}

/**
 * Collect world-space AABB corners from THIS object's own RenderMeshVisual (if any).
 * Returns true if mesh bounds were found and added.
 *
 * Does NOT climb to ancestors: `collectWorldPositions` already recurses into every
 * descendant, so each mesh node contributes its own box and the aggregate is complete.
 * The previous climb made an empty queried object (or empty child) borrow a large
 * ANCESTOR's bounds — the giant-cube false reading for anchors/groups/empties.
 */
function collectMeshWorldBounds(obj: SceneObject, positions: vec3[]): boolean {
  const bounds = getMeshBounds(obj)
  if (!bounds) return false

  const {localMin, localMax, transform, rmv} = bounds

  // Prefer the engine's authoritative world AABB. worldAabbMin()/worldAabbMax() compose
  // the FULL world matrix (rotation + scale + parent hierarchy + internal transform)
  // over the mesh's local AABB, so they capture a rotation baked into the node/mesh that
  // the decomposed `pos + rot*(scale*p)` reconstruction below approximates (it drops
  // shear under non-uniform scale + rotation). Gated with a runtime feature-check — these
  // were introduced in a newer LensCore, so older runtimes fall through to the manual path.
  const rmvAny = rmv as any
  if (typeof rmvAny.worldAabbMin === "function" && typeof rmvAny.worldAabbMax === "function") {
    try {
      const wMin: vec3 = rmvAny.worldAabbMin()
      const wMax: vec3 = rmvAny.worldAabbMax()
      // Only accept a NON-DEGENERATE engine box. A null result, or an all-zero/zero-volume
      // box, means the visual's world AABB isn't populated yet (mesh never rendered, culled,
      // or on a disabled subtree — which collectWorldPositions still walks). In that case the
      // engine value would collapse to the origin; fall through to the manual reconstruction
      // below, which is valid pre-render (it reads the local mesh AABB + world transform).
      const worldVol = wMin && wMax
        ? Math.abs(wMax.x - wMin.x) + Math.abs(wMax.y - wMin.y) + Math.abs(wMax.z - wMin.z)
        : 0
      if (wMin && wMax && worldVol > 1e-4) {
        for (let x = 0; x <= 1; x++) {
          for (let y = 0; y <= 1; y++) {
            for (let z = 0; z <= 1; z++) {
              positions.push(new vec3(
                x === 0 ? wMin.x : wMax.x,
                y === 0 ? wMin.y : wMax.y,
                z === 0 ? wMin.z : wMax.z
              ))
            }
          }
        }
        return true
      }
    } catch {
      // fall through to the manual reconstruction below
    }
  }

  // Fallback: transform the 8 corners of the local AABB to world space by hand.
  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      for (let z = 0; z <= 1; z++) {
        const localPoint = new vec3(
          x === 0 ? localMin.x : localMax.x,
          y === 0 ? localMin.y : localMax.y,
          z === 0 ? localMin.z : localMax.z
        )
        positions.push(
          transform
            .getWorldPosition()
            .add(transform.getWorldRotation().multiplyVec3(localPoint.mult(transform.getWorldScale())))
        )
      }
    }
  }
  return true
}

/**
 * Try to get ScreenTransform world-space corners.
 * Uses localPointToWorldPoint to convert the 4 corners of the local rect to world space.
 * Returns true if ScreenTransform bounds were found and added.
 */
function collectScreenTransformBounds(obj: SceneObject, positions: vec3[]): boolean {
  const st = obj.getComponent("Component.ScreenTransform")
  if (!st || isNull(st)) return false

  try {
    // ScreenTransform local coords: (-1,-1) = bottom-left, (1,1) = top-right
    const bl = st.localPointToWorldPoint(new vec2(-1, -1))
    const tr = st.localPointToWorldPoint(new vec2(1, 1))
    if (!bl || !tr) return false

    // Add all 4 corners (bl, br, tl, tr) for a proper 3D bounding box
    const br = st.localPointToWorldPoint(new vec2(1, -1))
    const tl = st.localPointToWorldPoint(new vec2(-1, 1))
    positions.push(bl, br, tl, tr)
    return true
  } catch {
    return false
  }
}

/**
 * Try to get physics collider bounds in world space.
 * Uses getColliderSize to get the local-space size, then transforms corners to world space.
 * Returns true if collider bounds were found and added.
 */
function collectColliderBounds(obj: SceneObject, positions: vec3[]): boolean {
  const collider = obj.getComponent("Physics.ColliderComponent")
  if (!collider || isNull(collider)) return false

  try {
    const size = getColliderSize(collider)
    if (!size) return false

    const halfSize = size.uniformScale(0.5)
    const localMin = halfSize.uniformScale(-1)
    const localMax = halfSize

    // Transform the 8 corners of the local collider box to world space
    const transform = obj.getTransform()
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          const localPoint = new vec3(
            x === 0 ? localMin.x : localMax.x,
            y === 0 ? localMin.y : localMax.y,
            z === 0 ? localMin.z : localMax.z
          )
          positions.push(
            transform
              .getWorldPosition()
              .add(transform.getWorldRotation().multiplyVec3(localPoint.mult(transform.getWorldScale())))
          )
        }
      }
    }
    return true
  } catch {
    return false
  }
}

/**
 * Recursively collect world-space bounds from a SceneObject and all descendants.
 * Priority: ScreenTransform \> collider \> mesh AABB \> transform position.
 */
function collectWorldPositions(obj: SceneObject, positions: vec3[]): void {
  if (isNull(obj)) return
  if (
    !collectScreenTransformBounds(obj, positions) &&
    !collectColliderBounds(obj, positions) &&
    !collectMeshWorldBounds(obj, positions)
  ) {
    positions.push(obj.getTransform().getWorldPosition())
  }
  for (let i = 0; i < obj.getChildrenCount(); i++) {
    collectWorldPositions(obj.getChild(i), positions)
  }
}

/**
 * Compute AABB from a list of world positions.
 * Returns null if the list is empty.
 */
function computeAABBFromPositions(positions: vec3[]): {min: vec3; max: vec3} | null {
  if (positions.length === 0) return null

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

  for (const p of positions) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }

  return {min: new vec3(minX, minY, minZ), max: new vec3(maxX, maxY, maxZ)}
}

/**
 * Compute the AABB for a specific object (+ descendants) or the full scene.
 * @param uniqueId - if provided, target that object. If omitted, compute for the full scene.
 */
export function computeAABB(uniqueId?: string): AABBResult {
  const positions: vec3[] = []
  let objectName: string | undefined

  if (uniqueId) {
    const obj = findSceneObjectByUniqueId(uniqueId)
    if (!obj || isNull(obj)) {
      return {
        found: false,
        center: {x: 0, y: 0, z: 0},
        extents: {x: 0, y: 0, z: 0},
        min: {x: 0, y: 0, z: 0},
        max: {x: 0, y: 0, z: 0}
      }
    }
    objectName = obj.name
    collectWorldPositions(obj, positions)
  } else {
    // Full scene
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      collectWorldPositions(global.scene.getRootObject(i), positions)
    }
  }

  const aabb = computeAABBFromPositions(positions)
  if (!aabb) {
    return {
      found: false,
      objectName,
      center: {x: 0, y: 0, z: 0},
      extents: {x: 0, y: 0, z: 0},
      min: {x: 0, y: 0, z: 0},
      max: {x: 0, y: 0, z: 0}
    }
  }

  // Compute center and half-extents
  const center = aabb.min.add(aabb.max).uniformScale(0.5)
  let extents = aabb.max.sub(aabb.min).uniformScale(0.5)
  let min = aabb.min
  let max = aabb.max

  // Substitute a framable box ONLY for a genuinely zero-volume result (a point/empty object),
  // detected by a near-zero half-extent on every axis. A real small object — a mark, an icon —
  // has a non-zero extent on at least one axis and keeps its true measurement; the earlier
  // MIN_EXTENT threshold here floored anything under 10 cm on all axes up to a 20 cm cube, which
  // corrupted the bounds QueryRuntimeScene reports for small objects. Re-derive min/max from
  // center +/- the substituted half-extents so the clamped result stays internally consistent.
  if (extents.x < DEGENERATE_EPS && extents.y < DEGENERATE_EPS && extents.z < DEGENERATE_EPS) {
    extents = new vec3(MIN_EXTENT, MIN_EXTENT, MIN_EXTENT)
    min = center.sub(extents)
    max = center.add(extents)
  }

  return {
    found: true,
    objectName,
    center: vec3ToPlain(center),
    extents: vec3ToPlain(extents),
    min: vec3ToPlain(min),
    max: vec3ToPlain(max)
  }
}
