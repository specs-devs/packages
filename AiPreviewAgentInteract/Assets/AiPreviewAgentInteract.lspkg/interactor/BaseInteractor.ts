import {setTimeout} from "Leaf.lspkg/Utils/common/Utils"
import BaseInteractor from "SpectaclesInteractionKit.lspkg/Core/Interactor/BaseInteractor"
import {InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

/**
 * Minimal wrapper around a SIK BaseInteractor.
 * Does NOT override any SIK properties — all targeting, triggers, hover,
 * drag, and manipulation are handled natively by SIK.
 * Subclasses control the hand position and gesture only.
 */
export abstract class AiBaseInteractor {
  constructor(protected sikInteractor: BaseInteractor) {
    // Ensure the interactor reports as active
    this.sikInteractor.isActive = () => true
  }

  destroy(): void {}

  protected async awaitEventOnce(
    event: PublicApi<InteractorEvent>,
    timeoutMs: number = 5000,
    eventName: string = "SIK event"
  ): Promise<void> {
    let unsubscribe = () => {}
    const promise = new Promise<void>((resolve, reject) => {
      let settled = false
      unsubscribe = event.add(() => {
        if (!settled) {
          settled = true
          resolve()
        }
      })
      setTimeout(() => {
        if (!settled) {
          settled = true
          reject(
            new Error(
              `Timed out waiting for ${eventName} after ${timeoutMs}ms. ` +
                `The interactable may not have received the interaction — ` +
                `check that the hand is positioned correctly and the target is reachable.`
            )
          )
        }
      }, timeoutMs)
    })
    // `try/finally` is load-bearing: on timeout or any throw, the event
    // subscription would otherwise leak and keep firing against a dead
    // handler, polluting subsequent interactions on the same interactable.
    try {
      await promise
    } finally {
      unsubscribe()
    }
  }

  set inputType(inputType: InteractorInputType) {
    this.sikInteractor["inputType"] = inputType
  }
}
