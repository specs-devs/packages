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

const MIN_EXTENT = 10.0

/** Minimum local AABB extent to consider a mesh meaningful (filters out unit quads/circles). */
const MIN_MESH_EXTENT = 2.0

/**
 * Try to extract mesh AABB from a SceneObject's RenderMeshVisual.
 * Returns \{localMin, localMax, transform\} if the mesh has a meaningful AABB, or null.
 */
function getMeshBounds(obj: SceneObject): {localMin: vec3; localMax: vec3; transform: Transform} | null {
  const rmv = obj.getComponent("Component.RenderMeshVisual")
  if (!rmv || isNull(rmv)) return null
  const mesh = rmv.mesh
  if (!mesh || isNull(mesh)) return null

  try {
    const localMin = mesh.aabbMin
    const localMax = mesh.aabbMax
    if (!localMin || !localMax) return null

    // Check if the mesh AABB is meaningful (not a tiny procedural unit mesh)
    const extent = localMax.sub(localMin)
    if (
      Math.abs(extent.x) < MIN_MESH_EXTENT &&
      Math.abs(extent.y) < MIN_MESH_EXTENT &&
      Math.abs(extent.z) < MIN_MESH_EXTENT
    ) {
      return null
    }

    return {localMin, localMax, transform: obj.getTransform()}
  } catch {
    return null
  }
}

/**
 * Walk up the hierarchy from obj to find the closest ancestor with a meaningful
 * RenderMeshVisual AABB. Returns the mesh bounds or null if none found.
 */
function findClosestMeshBounds(obj: SceneObject): {localMin: vec3; localMax: vec3; transform: Transform} | null {
  let current: SceneObject | null = obj
  while (current && !isNull(current)) {
    const bounds = getMeshBounds(current)
    if (bounds) return bounds
    current = current.getParent()
  }
  return null
}

/**
 * Collect mesh world-space AABB corners from the closest ancestor with a meaningful mesh.
 * Returns true if mesh bounds were found and added.
 */
function collectMeshWorldBounds(obj: SceneObject, positions: vec3[]): boolean {
  const bounds = findClosestMeshBounds(obj)
  if (!bounds) return false

  const {localMin, localMax, transform} = bounds
  // Transform the 8 corners of the local AABB to world space
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

  // Apply minimum extent threshold for zero-volume bounding boxes
  if (extents.x < MIN_EXTENT && extents.y < MIN_EXTENT && extents.z < MIN_EXTENT) {
    extents = new vec3(MIN_EXTENT, MIN_EXTENT, MIN_EXTENT)
  }

  return {
    found: true,
    objectName,
    center: vec3ToPlain(center),
    extents: vec3ToPlain(extents),
    min: vec3ToPlain(aabb.min),
    max: vec3ToPlain(aabb.max)
  }
}
