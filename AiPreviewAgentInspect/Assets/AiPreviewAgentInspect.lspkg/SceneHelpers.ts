/**
 * Scene-traversal helpers used by RuntimeQueryHandler + AABBComputer.
 *
 * These are tied to our query semantics — `findSceneObjectByUniqueId` is the
 * uniqueId resolver used across runtime tools, and `getColliderSize` is the
 * AABB shape extractor.
 */

/**
 * Depth-first walk to find a SceneObject by uniqueId. When `root` is omitted,
 * walks every root in `global.scene`.
 */
export function findSceneObjectByUniqueId(uniqueId: string, root?: SceneObject): SceneObject | undefined {
  const visit = (obj: SceneObject): SceneObject | undefined => {
    if (obj.uniqueIdentifier === uniqueId) return obj
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const found = visit(obj.getChild(i))
      if (found) return found
    }
    return undefined
  }
  if (root) return visit(root)
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    const found = visit(global.scene.getRootObject(i))
    if (found) return found
  }
  return undefined
}

/**
 * Returns a collider's world-aligned axis size as a vec3. Supports Box,
 * Sphere, Capsule/Cylinder/Cone (axis-aware), and Mesh shapes.
 */
export function getColliderSize(collider: ColliderComponent): vec3 {
  if (collider.shape.isOfType("BoxShape")) {
    return (collider.shape as BoxShape).size
  } else if (collider.shape.isOfType("SphereShape")) {
    const diameter = (collider.shape as SphereShape).radius * 2
    return new vec3(diameter, diameter, diameter)
  } else if (
    collider.shape.isOfType("CapsuleShape") ||
    collider.shape.isOfType("CylinderShape") ||
    collider.shape.isOfType("ConeShape")
  ) {
    const shape = collider.shape as CapsuleShape | CylinderShape | ConeShape
    const length = shape.length
    const diameter = shape.radius * 2
    switch (shape.axis) {
      case Axis.X:
        return new vec3(length, diameter, diameter)
      case Axis.Y:
        return new vec3(diameter, length, diameter)
      case Axis.Z:
        return new vec3(diameter, diameter, length)
    }
  } else if (collider.shape.isOfType("MeshShape")) {
    const meshShape = collider.shape as MeshShape
    return meshShape.mesh.aabbMax.sub(meshShape.mesh.aabbMin)
  }
  throw new Error(`Unsupported collider shape: ${collider.shape.getTypeName()}`)
}
