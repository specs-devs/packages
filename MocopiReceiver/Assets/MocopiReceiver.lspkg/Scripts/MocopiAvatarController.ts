/**
 * Specs Inc. 2026
 * Avatar controller for mapping mocopi motion capture data to 3D character rigs. Handles automatic
 * bone mapping, coordinate system conversion, smooth interpolation, and support for custom avatar
 * hierarchies with configurable tracking and T-pose reset.
 */

import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import { SkeletonDefinition, FrameData, MocopiBone, MOCOPI_BONE_NAMES } from "./MocopiDataTypes"
import { PrefabPlacement } from "./PrefabPlacement"

const log = new NativeLogger("MocopiAvatarController")

interface BoneMapping {
  mocopiBoneId: number
  mocopiBoneName: string
  avatarObject: SceneObject
}

@component
export class MocopiAvatarController extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Avatar Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Avatar is automatically initialized from prefab placement</span>')

  @input
  @hint("PrefabPlacement component to get avatar from instantiated prefab")
  @allowUndefined
  prefabPlacement: PrefabPlacement

  private currentAvatarRoot: SceneObject = null

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Transform Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure how motion data is applied to the avatar</span>')
  @input
  @hint("Enable position updates (not just rotation)")
  updatePositions: boolean = false

  @input
  @hint("Apply coordinate system conversion (Unity to Lens Studio)")
  applyCoordinateConversion: boolean = true

  @input
  @hint("Smooth factor for interpolation (0-1, 0=none, 1=max)")
  smoothFactor: number = 0.3

  @input
  @hint("Avatar scale multiplier")
  avatarScale: number = 1.0

  private skeleton: SkeletonDefinition = null
  private boneMappings: Map<number, BoneMapping> = new Map()
  private initialized: boolean = false

  // Smoothing
  private targetRotations: Map<number, quat> = new Map()
  private targetPositions: Map<number, vec3> = new Map()

  onAwake() {
    if (!this.prefabPlacement) {
      print("[MocopiAvatarController] ERROR: PrefabPlacement must be assigned!")
      log.e("PrefabPlacement not assigned")
      return
    }

    print("[MocopiAvatarController] Initialized")
    print(`[MocopiAvatarController] PrefabPlacement: ASSIGNED`)
    log.i("Avatar controller initialized")
  }

  // Reset avatar controller (clear references for re-initialization)
  public resetAvatar() {
    print("[MocopiAvatarController] Resetting avatar controller...")
    this.boneMappings.clear()
    this.targetRotations.clear()
    this.targetPositions.clear()
    this.initialized = false
    this.currentAvatarRoot = null
    print("[MocopiAvatarController] Cleared prefab avatar root reference")
    log.i("Avatar controller reset")
  }

  // Initialize avatar with skeleton
  public initializeAvatar(skeleton: SkeletonDefinition) {
    if (!skeleton || !skeleton.bones) {
      print("[MocopiAvatarController] ERROR: Invalid skeleton data")
      log.e("Invalid skeleton data")
      return
    }

    // Use avatar from prefab placement
    if (!this.prefabPlacement) {
      print("[MocopiAvatarController] ERROR: PrefabPlacement not assigned!")
      log.e("PrefabPlacement not assigned")
      return
    }

    this.currentAvatarRoot = this.getAvatarRootFromPrefab()
    if (!this.currentAvatarRoot) {
      print("[MocopiAvatarController] ERROR: Could not find avatar root in instantiated prefab")
      log.e("Avatar root not found in prefab")
      return
    }
    print(`[MocopiAvatarController] Using PREFAB avatar: ${this.currentAvatarRoot.name}`)

    this.skeleton = skeleton
    print("=" .repeat(60))
    print("[MocopiAvatarController] INITIALIZING AVATAR")
    print(`[MocopiAvatarController] Skeleton bones: ${skeleton.num_bones}`)
    print("=" .repeat(60))
    log.i(`Initializing avatar with ${skeleton.num_bones} bones`)

    // Create bone mappings
    this.createBoneMappings()

    this.initialized = true
    print(`[MocopiAvatarController] Avatar initialized with ${this.boneMappings.size} bone mappings`)
    log.i(`Avatar initialized with ${this.boneMappings.size} bone mappings`)
  }

  // Get avatar root from prefab placement (instantiated prefab -> human_low:_root)
  private getAvatarRootFromPrefab(): SceneObject {
    if (!this.prefabPlacement) return null

    // Access the private instantiatedPrefab field via any cast
    const placement = this.prefabPlacement as any
    const instantiatedPrefab = placement.instantiatedPrefab as SceneObject

    if (!instantiatedPrefab) {
      print("[MocopiAvatarController] No instantiated prefab found yet")
      return null
    }

    print(`[MocopiAvatarController] Searching for avatar root in prefab: ${instantiatedPrefab.name}`)

    // Recursively search for "human_low:_root" or ":_root" pattern
    const root = this.findRootInHierarchy(instantiatedPrefab)

    if (root) {
      print(`[MocopiAvatarController] Found avatar root: ${root.name}`)
      return root
    }

    print("[MocopiAvatarController] Could not find human_low:_root, returning instantiated prefab")
    return instantiatedPrefab
  }

  // Recursively search for root bone in hierarchy
  private findRootInHierarchy(obj: SceneObject): SceneObject {
    const nameLower = obj.name.toLowerCase()

    // Check if this object is the root bone we're looking for
    // Match patterns like "human_low:_root", ":_root", or just "root"
    if (nameLower.includes("human_low") && nameLower.includes("root")) {
      return obj
    }
    if (nameLower.endsWith(":_root") || nameLower.endsWith(":root")) {
      return obj
    }

    // Search children recursively
    const childCount = obj.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const child = obj.getChild(i)
      print(`[MocopiAvatarController] Checking hierarchy: ${child.name}`)
      const result = this.findRootInHierarchy(child)
      if (result) return result
    }

    return null
  }

  // Create bone mappings between mocopi bones and avatar objects
  private createBoneMappings() {
    this.boneMappings.clear()

    if (!this.skeleton) return

    // Try to find matching scene objects for each mocopi bone
    for (let i = 0; i < this.skeleton.bones.length; i++) {
      const bone = this.skeleton.bones[i]

      // Try to find scene object by bone name
      const avatarObject = this.findBoneObject(bone.name)

      if (avatarObject) {
        const mapping: BoneMapping = {
          mocopiBoneId: bone.id,
          mocopiBoneName: bone.name,
          avatarObject: avatarObject
        }
        this.boneMappings.set(bone.id, mapping)
        print(`[MocopiAvatarController] Mapped: ${bone.name} -> ${avatarObject.name}`)
        log.d(`Mapped bone ${bone.name} to scene object ${avatarObject.name}`)
      } else {
        print(`[MocopiAvatarController] WARN: No avatar object for bone: ${bone.name}`)
        log.w(`Could not find avatar object for bone: ${bone.name}`)
      }
    }
  }

  // Find bone object in avatar hierarchy
  private findBoneObject(boneName: string): SceneObject {
    // Search recursively in avatar hierarchy
    return this.searchHierarchy(this.currentAvatarRoot, boneName)
  }

  // Recursive hierarchy search
  private searchHierarchy(obj: SceneObject, name: string): SceneObject {
    const objNameLower = obj.name.toLowerCase()
    const nameLower = name.toLowerCase()
    
    // Direct match
    if (objNameLower === nameLower) {
      return obj
    }

    // Check variations (common naming patterns)
    const variations = [
      name,
      name.replace(/_/g, ""),
      name.replace(/_/g, " "),
      `mixamorig:${name}`,
      `${name}_jnt`,
      `${name}_bone`,
      // Lens Studio avatar prefixes
      `human_low:_${name}`,
      `human_high:_${name}`,
      `human:_${name}`,
      // Check if object name ends with the bone name
      `_${name}`,
      `:_${name}`,
      `:${name}`
    ]

    for (const variant of variations) {
      if (objNameLower === variant.toLowerCase()) {
        return obj
      }
      // Also check if object name ends with variant
      if (objNameLower.endsWith(variant.toLowerCase())) {
        return obj
      }
    }

    // Search children
    const childCount = obj.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const child = obj.getChild(i)
      const result = this.searchHierarchy(child, name)
      if (result) return result
    }

    return null
  }

  // Update avatar with frame data
  public updateFrame(frame: FrameData) {
    if (!this.initialized || !this.skeleton || !frame.bones) {
      return
    }

    // Update each mapped bone
    for (let i = 0; i < frame.bones.length; i++) {
      const bone = frame.bones[i]
      this.updateBone(bone)
    }
  }

  // Update single bone
  private updateBone(bone: MocopiBone) {
    const mapping = this.boneMappings.get(bone.id)
    if (!mapping) return

    const transform = mapping.avatarObject.getTransform()

    // Convert rotation quaternion
    let rotation = new quat(
      bone.rotation.w,
      bone.rotation.x,
      bone.rotation.y,
      bone.rotation.z
    )

    // Apply coordinate system conversion if enabled
    if (this.applyCoordinateConversion) {
      rotation = this.convertRotation(rotation)
    }

    // Apply smoothing
    if (this.smoothFactor > 0) {
      const current = transform.getLocalRotation()
      const factor = 1.0 - this.smoothFactor
      rotation = quat.slerp(current, rotation, factor)
    }

    // Apply rotation
    transform.setLocalRotation(rotation)

    // Update position if enabled
    if (this.updatePositions) {
      let position = new vec3(
        bone.position.x * this.avatarScale,
        bone.position.y * this.avatarScale,
        bone.position.z * this.avatarScale
      )

      if (this.applyCoordinateConversion) {
        position = this.convertPosition(position)
      }

      if (this.smoothFactor > 0) {
        const current = transform.getLocalPosition()
        const factor = 1.0 - this.smoothFactor
        position = vec3.lerp(current, position, factor)
      }

      transform.setLocalPosition(position)
    }
  }

  // Convert rotation from Unity/mocopi to Lens Studio coordinates
  private convertRotation(rot: quat): quat {
    // Unity to Lens Studio coordinate conversion
    // Unity: Y-up, left-handed
    // Lens Studio: Y-up, right-handed
    // Negate X and W for quaternion conversion
    return new quat(-rot.w, -rot.x, rot.y, rot.z)
  }

  // Convert position from Unity/mocopi to Lens Studio coordinates
  private convertPosition(pos: vec3): vec3 {
    // Negate X axis for coordinate system conversion
    return new vec3(-pos.x, pos.y, pos.z)
  }

  // Manual bone mapping
  public mapBone(mocopiBoneId: number, avatarObject: SceneObject) {
    if (mocopiBoneId < 0 || !avatarObject) {
      log.e("Invalid bone mapping parameters")
      return
    }

    const boneName = mocopiBoneId < MOCOPI_BONE_NAMES.length
      ? MOCOPI_BONE_NAMES[mocopiBoneId]
      : `bone_${mocopiBoneId}`

    const mapping: BoneMapping = {
      mocopiBoneId: mocopiBoneId,
      mocopiBoneName: boneName,
      avatarObject: avatarObject
    }

    this.boneMappings.set(mocopiBoneId, mapping)
    log.i(`Manually mapped bone ${boneName} to ${avatarObject.name}`)
  }

  // Remove bone mapping
  public unmapBone(mocopiBoneId: number) {
    this.boneMappings.delete(mocopiBoneId)
  }

  // Get bone mappings
  public getBoneMappings(): Map<number, BoneMapping> {
    return this.boneMappings
  }

  // Clear all mappings
  public clearMappings() {
    this.boneMappings.clear()
    this.initialized = false
    log.i("Bone mappings cleared")
  }

  // Reset avatar to T-pose
  public resetPose() {
    this.boneMappings.forEach(mapping => {
      const transform = mapping.avatarObject.getTransform()
      transform.setLocalRotation(quat.quatIdentity())
      if (this.updatePositions) {
        transform.setLocalPosition(vec3.zero())
      }
    })
    log.i("Avatar reset to T-pose")
  }

  // Get statistics
  public getStats() {
    return {
      initialized: this.initialized,
      totalBones: this.skeleton ? this.skeleton.num_bones : 0,
      mappedBones: this.boneMappings.size,
      unmappedBones: this.skeleton ? this.skeleton.num_bones - this.boneMappings.size : 0
    }
  }
}
