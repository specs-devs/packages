import {Hand as LeafHand} from "Leaf.lspkg/Interactors/interactor/handInput/Hand"

/**
 * LEAF's Hand class extended with instant (non-animated) world-space setters
 * plus a worldRotation getter. AiHandInteractor needs these for the
 * measureRelaxedOffset → setPosition → measurePinchOffset sampling sequence,
 * where each step must be synchronous so the wrist→indexTip offset isn't
 * read mid-animation.
 *
 * Everything else (gesture animations, keypoint accessors, setPosition with
 * animation, hide, getPinchStrength, isPinching, lastGesture, etc.) is
 * inherited from LEAF unchanged — see Leaf.lspkg/Interactors/interactor/
 * handInput/Hand for the API surface.
 */
export class Hand extends LeafHand {
  /** Set hand position instantly without animation. */
  setWorldPosition(position: vec3): void {
    this.animationPromises.position?.cancel()
    this.handRoot.getTransform().setWorldPosition(position)
  }

  /** Set hand rotation instantly without animation. */
  setWorldRotation(rotation: quat): void {
    this.animationPromises.rotation?.cancel()
    this.handRoot.getTransform().setWorldRotation(rotation)
  }

  getWorldRotation(): quat {
    return this.handRoot.getTransform().getWorldRotation()
  }

  /**
   * `setPosition` translates `handRoot`, not the wrist keypoint. To land
   * the indexTip on a specific world position, the caller needs to know
   * the rig-local offset between handRoot and indexTip. This getter
   * exposes that single fact without leaking the rest of `handRoot`.
   */
  getHandRootWorldPosition(): vec3 {
    return this.handRoot.getTransform().getWorldPosition()
  }
}
