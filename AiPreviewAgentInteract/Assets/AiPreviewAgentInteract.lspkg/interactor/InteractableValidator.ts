import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

// Reasons the validator itself can produce. Caller-initiated failures
// (not_found, disabled, interactor_busy) are constructed separately by the
// interaction-handler dispatch and are not part of this union.
export type ValidationReason = "clipped" | "obstructed"

export interface ValidationResult {
  valid: boolean
  reason?: ValidationReason
  message?: string
}

const VALID: ValidationResult = {valid: true}

/**
 * Checks if the interactable is inside a scrollable ancestor whose
 * ScreenTransform clips it outside its visible bounds.
 */
function checkClipping(interactable: Interactable): ValidationResult {
  const targetPos = interactable.getTransform().getWorldPosition()
  let current = interactable.getSceneObject().getParent()

  while (current && !isNull(current)) {
    const screenTransform = current.getComponent("Component.ScreenTransform") as ScreenTransform | null
    if (screenTransform && !isNull(screenTransform)) {
      // Check if this ancestor has an Interactable with isScrollable
      const parentInteractables = current.getComponents(Interactable.getTypeName()) as Interactable[]
      const isScrollableParent = parentInteractables.some((i) => i.isScrollable)

      if (isScrollableParent && !screenTransform.containsWorldPoint(targetPos)) {
        return {
          valid: false,
          reason: "clipped",
          message: `Outside visible bounds of "${current.name}". Scroll to reveal it first.`
        }
      }
    }
    current = current.getParent()
  }

  return VALID
}

/**
 * Returns true if `a` is the same object as `b` or an ancestor of `b`.
 */
function isAncestorOrSelf(a: SceneObject, b: SceneObject): boolean {
  let current: SceneObject | null = b
  while (current && !isNull(current)) {
    if (current.isSame(a)) return true
    current = current.getParent()
  }
  return false
}

/**
 * Casts a ray from the camera to the interactable and checks if the first
 * collider hit belongs to the target's interaction hierarchy.
 * Returns a Promise because raycasts resolve asynchronously (after simulation update).
 */
function checkObstruction(interactable: Interactable): Promise<ValidationResult> {
  const camera = WorldCameraFinderProvider.getInstance().getComponent()
  const targetObj = interactable.getSceneObject()
  const targetPos = targetObj.getTransform().getWorldPosition()
  const cameraPos = camera.getTransform().getWorldPosition()

  return new Promise<ValidationResult>((resolve) => {
    Physics.createGlobalProbe().rayCast(cameraPos, targetPos, (hit) => {
      if (!hit || isNull(hit)) {
        resolve(VALID)
        return
      }

      const hitObj = hit.collider.getSceneObject()

      // Allow if the hit object is the target or an ancestor of the target
      if (isAncestorOrSelf(hitObj, targetObj)) {
        resolve(VALID)
        return
      }

      // Allow if the hit object and target share a common interactable
      // ancestor (e.g., SIK's InteractionPlaneColliderRoot is a sibling
      // within the same UI container).
      let ancestor: SceneObject | null = targetObj.getParent()
      while (ancestor && !isNull(ancestor)) {
        if (ancestor.getComponents(Interactable.getTypeName()).length > 0 && isAncestorOrSelf(ancestor, hitObj)) {
          resolve(VALID)
          return
        }
        ancestor = ancestor.getParent()
      }

      resolve({
        valid: false,
        reason: "obstructed",
        message: `Blocked by "${hitObj.name}" between camera and target.`
      })
    })
  })
}

/**
 * Validates that an interactable can be reached by the hand interactor.
 * Performs synchronous checks first (clipping), then an async physics probe.
 */
export async function validateInteractable(interactable: Interactable): Promise<ValidationResult> {
  // Check 1: Clipping by scroll view or masked container
  const clipResult = checkClipping(interactable)
  if (!clipResult.valid) {
    return clipResult
  }

  // Check 2: Physical obstruction via raycast
  const obstructionResult = await checkObstruction(interactable)
  if (!obstructionResult.valid) {
    return obstructionResult
  }

  return VALID
}
