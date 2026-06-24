import {HandState, HandStateEntry} from "AiPreviewAgentInspect.lspkg/AgentMessages"
import {MessagePublisher} from "AiPreviewAgentInspect.lspkg/messaging/MessagePublisher"
import {getInteractables, isEnabled} from "Leaf.lspkg/Interactors/InteractableUtils"
import {nextFrame, setTimeout as scheduleAfter} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {
  DragCommand,
  GestureCommand,
  HoverCommand,
  InteractionCommand,
  InteractionResponse,
  PinchCommand,
  PokeCommand,
  ReleaseCommand,
  RotateCommand,
  WaitCommand
} from "./AgentMessages"
import {AiHandInteractor} from "./interactor/HandInteractor"
import {validateInteractable} from "./interactor/InteractableValidator"

/**
 * Find an Interactable by its SceneObject's uniqueIdentifier. Local helper —
 * Leaf.lspkg/Interactors/InteractableUtils doesn't ship this lookup.
 */
function findInteractableByUniqueId(uniqueId: string): Interactable | undefined {
  return getInteractables().find((i) => i.getSceneObject().uniqueIdentifier === uniqueId)
}

// Delay applied after any action that ends a SIK trigger cycle (Pinch no-hold,
// Drag no-hold, Release). Without this, a follow-up interaction on the same
// interactable arrives before SIK has finished dispatching onTriggerEnd and
// re-armed, and the next onTriggerStart never fires. 250ms is conservative —
// empirically 300ms explicit Waits worked; tune down later if safe.
const POST_TRIGGER_SETTLE_MS = 250

// Sanity cap on lens-side Wait duration. The editor already enforces a
// tighter (~10s) cap; this protects the runtime against a rogue or
// mistranscribed command parking the pipeline arbitrarily long.
const MAX_WAIT_MS = 60_000

const ALLOWED_GESTURES = new Set<string>(["pinch", "fist", "palm", "backhand", "relaxed", "neutral"])

function isFiniteVec3(v: unknown): v is {x: number; y: number; z: number} {
  if (!v || typeof v !== "object") return false
  const p = v as {x?: unknown; y?: unknown; z?: unknown}
  return (
    typeof p.x === "number" &&
    Number.isFinite(p.x) &&
    typeof p.y === "number" &&
    Number.isFinite(p.y) &&
    typeof p.z === "number" &&
    Number.isFinite(p.z)
  )
}

export class InteractionHandler {
  // Lazily-created interactors — only instantiated when first interaction is needed
  private rightHandInteractor: AiHandInteractor | null = null
  private leftHandInteractor: AiHandInteractor | null = null

  // Track which object each hand is holding (null = free)
  private heldObjects = new Map<"left" | "right", {uniqueId: string | null; name: string | null}>()

  constructor(private publisher: MessagePublisher<InteractionCommand, InteractionResponse>) {
    this.publisher.subscribe("Pinch", (cmd: PinchCommand) => this.handlePinch(cmd))
    this.publisher.subscribe("Hover", (cmd: HoverCommand) => this.handleHover(cmd))
    this.publisher.subscribe("Poke", (cmd: PokeCommand) => this.handlePoke(cmd))
    this.publisher.subscribe("Drag", (cmd: DragCommand) => this.handleDrag(cmd))
    this.publisher.subscribe("Gesture", (cmd: GestureCommand) => this.handleGesture(cmd))
    this.publisher.subscribe("Release", (cmd: ReleaseCommand) => this.handleRelease(cmd))
    this.publisher.subscribe("Rotate", (cmd: RotateCommand) => this.handleRotate(cmd))
    this.publisher.subscribe("Wait", (cmd: WaitCommand) => this.handleWait(cmd))
  }

  // ─── Interactor management ────────────────────────────────────────────────

  private async getInteractor(handType: "left" | "right" = "right"): Promise<AiHandInteractor> {
    const cached = handType === "right" ? this.rightHandInteractor : this.leftHandInteractor
    if (cached) return cached

    // First-construction retry loop: the SIK InteractionManager registers
    // hand interactors during ScriptComponent boot, and the very first
    // interaction request after a lens reset can fire before that registration
    // completes. AiHandInteractor's constructor throws a clear error in that
    // window; we wait a frame and try again. ~10 frames is generous (~167ms
    // at 60fps); if SIK hasn't booted by then something else is wrong.
    const MAX_FRAMES = 10
    let lastError: unknown
    for (let i = 0; i < MAX_FRAMES; i++) {
      try {
        const interactor = new AiHandInteractor(handType)
        if (handType === "right") this.rightHandInteractor = interactor
        else this.leftHandInteractor = interactor
        return interactor
      } catch (e) {
        lastError = e
        await nextFrame()
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to create AiHandInteractor("${handType}") after ${MAX_FRAMES} frames`)
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  /**
   * Resolves an interactable by uniqueId, checks enabled state, and runs
   * pre-flight validation (clipping, obstruction). Returns the interactable
   * on success, or sends a CommandError and returns null on failure.
   */
  private async resolveAndValidate(
    commandId: string,
    uniqueId?: string,
    name?: string,
    parentName?: string
  ): Promise<Interactable | null> {
    let interactable: Interactable | undefined

    if (uniqueId) {
      interactable = findInteractableByUniqueId(uniqueId)
    }

    if (!interactable && name) {
      const all = getInteractables()
      interactable = all.find((i) => {
        const so = i.getSceneObject()
        if (so.name !== name) return false
        if (parentName && so.getParent()?.name !== parentName) return false
        return true
      })
    }

    if (!interactable) {
      const identifier = name ? `name: "${name}"` : `uniqueId: "${uniqueId}"`
      this.respond({
        type: "CommandError",
        commandId,
        message: `No interactable found with ${identifier}`,
        reason: "not_found"
      })
      return null
    }
    if (!isEnabled(interactable)) {
      this.respond({
        type: "CommandError",
        commandId,
        message: `Interactable "${interactable.getSceneObject().name}" is disabled.`,
        reason: "disabled"
      })
      return null
    }
    const validation = await validateInteractable(interactable)
    if (!validation.valid) {
      this.respond({
        type: "CommandError",
        commandId,
        message: validation.message!,
        reason: validation.reason
      })
      return null
    }
    return interactable
  }

  // ─── Hand state helpers ────────────────────────────────────────────────────

  private getHandState(): HandState {
    const stateFor = (handType: "left" | "right"): HandStateEntry => {
      const held = this.heldObjects.get(handType)
      if (held) {
        return {
          status: "holding",
          objectId: held.uniqueId ?? undefined,
          objectName: held.name ?? undefined
        }
      }
      return {status: "free"}
    }
    return {left: stateFor("left"), right: stateFor("right")}
  }

  private checkCompatibility(
    action: string,
    handType: "left" | "right",
    targetUniqueId?: string | null
  ): string | null {
    const held = this.heldObjects.get(handType)
    const otherHand = handType === "right" ? "left" : "right"

    switch (action) {
      case "Pinch":
      case "Hover":
      case "Poke":
      case "Gesture":
        if (held) {
          const heldDesc = held.name ? `${held.name} (uniqueId: ${held.uniqueId})` : "in free space"
          return `Cannot ${action}: ${handType} hand is currently holding ${heldDesc}. Release first or use the ${otherHand} hand.`
        }
        return null
      case "Drag":
        if (held) {
          if (held.uniqueId === null && targetUniqueId === null) return null
          if (held.uniqueId !== null && held.uniqueId === targetUniqueId) return null
          const heldDesc = held.name ? `${held.name} (uniqueId: ${held.uniqueId})` : "in free space"
          return `Cannot Drag: ${handType} hand is currently holding ${heldDesc}. Release first or use the ${otherHand} hand.`
        }
        return null
      case "Release":
      case "Rotate":
        if (!held) {
          return `Cannot ${action}: ${handType} hand is not holding anything. Use Pinch or Drag with hold:true first.`
        }
        return null
      default:
        return null
    }
  }

  // ─── Settling ─────────────────────────────────────────────────────────────

  private settle(): Promise<void> {
    return new Promise<void>((resolve) => {
      scheduleAfter(resolve, POST_TRIGGER_SETTLE_MS)
    })
  }

  // ─── Command handlers ─────────────────────────────────────────────────────

  private async handlePinch(cmd: PinchCommand): Promise<void> {
    try {
      const handType = cmd.handType ?? "right"
      const compatError = this.checkCompatibility("Pinch", handType)
      if (compatError) {
        this.respond({type: "CommandError", commandId: cmd.commandId, message: compatError, reason: "interactor_busy"})
        return
      }
      const interactor = await this.getInteractor(handType)

      if (cmd.uniqueId || cmd.name) {
        const interactable = await this.resolveAndValidate(cmd.commandId, cmd.uniqueId, cmd.name, cmd.parentName)
        if (!interactable) return
        const resolvedUniqueId = interactable.getSceneObject().uniqueIdentifier
        await interactor.pinchInteractable(interactable, cmd.hold ?? false, cmd.durationMs)
        if (cmd.hold) {
          this.heldObjects.set(handType, {uniqueId: resolvedUniqueId, name: interactable.getSceneObject().name})
        } else {
          await this.settle()
        }
        this.respond({type: "CommandSuccess", commandId: cmd.commandId, resolvedUniqueId})
      } else if (cmd.worldPosition) {
        if (!isFiniteVec3(cmd.worldPosition)) {
          this.respond({
            type: "CommandError",
            commandId: cmd.commandId,
            message: "Pinch worldPosition must have finite x/y/z.",
            reason: "invalid_params"
          })
          return
        }
        const worldPos = new vec3(cmd.worldPosition.x, cmd.worldPosition.y, cmd.worldPosition.z)
        await interactor.pinch(worldPos, cmd.hold ?? false, cmd.durationMs)
        if (cmd.hold) {
          this.heldObjects.set(handType, {uniqueId: null, name: null})
        } else {
          await this.settle()
        }
        this.respond({type: "CommandSuccess", commandId: cmd.commandId})
      } else {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: "Pinch requires either uniqueId or worldPosition.",
          reason: "invalid_params"
        })
      }
    } catch (e) {
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private async handleHover(cmd: HoverCommand): Promise<void> {
    try {
      const handType = cmd.handType ?? "right"
      const compatError = this.checkCompatibility("Hover", handType)
      if (compatError) {
        this.respond({type: "CommandError", commandId: cmd.commandId, message: compatError, reason: "interactor_busy"})
        return
      }
      const interactor = await this.getInteractor(handType)

      if (cmd.uniqueId || cmd.name) {
        const interactable = await this.resolveAndValidate(cmd.commandId, cmd.uniqueId, cmd.name, cmd.parentName)
        if (!interactable) return
        const resolvedUniqueId = interactable.getSceneObject().uniqueIdentifier
        await interactor.hoverInteractable(interactable, cmd.durationMs ?? 200)
        this.respond({type: "CommandSuccess", commandId: cmd.commandId, resolvedUniqueId})
      } else if (cmd.worldPosition) {
        if (!isFiniteVec3(cmd.worldPosition)) {
          this.respond({
            type: "CommandError",
            commandId: cmd.commandId,
            message: "Hover worldPosition must have finite x/y/z.",
            reason: "invalid_params"
          })
          return
        }
        const worldPos = new vec3(cmd.worldPosition.x, cmd.worldPosition.y, cmd.worldPosition.z)
        await interactor.hoverAt(worldPos, cmd.durationMs ?? 200)
        this.respond({type: "CommandSuccess", commandId: cmd.commandId})
      } else {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: "Hover requires either uniqueId or worldPosition.",
          reason: "invalid_params"
        })
      }
    } catch (e) {
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private async handlePoke(cmd: PokeCommand): Promise<void> {
    try {
      const handType = cmd.handType ?? "right"
      const compatError = this.checkCompatibility("Poke", handType)
      if (compatError) {
        this.respond({type: "CommandError", commandId: cmd.commandId, message: compatError, reason: "interactor_busy"})
        return
      }
      const interactor = await this.getInteractor(handType)

      if (cmd.uniqueId || cmd.name) {
        const interactable = await this.resolveAndValidate(cmd.commandId, cmd.uniqueId, cmd.name, cmd.parentName)
        if (!interactable) return
        const resolvedUniqueId = interactable.getSceneObject().uniqueIdentifier
        await interactor.pokeInteractable(interactable, cmd.durationMs ?? 200)
        await this.settle()
        this.respond({type: "CommandSuccess", commandId: cmd.commandId, resolvedUniqueId})
      } else if (cmd.worldPosition) {
        if (!isFiniteVec3(cmd.worldPosition)) {
          this.respond({
            type: "CommandError",
            commandId: cmd.commandId,
            message: "Poke worldPosition must have finite x/y/z.",
            reason: "invalid_params"
          })
          return
        }
        const worldPos = new vec3(cmd.worldPosition.x, cmd.worldPosition.y, cmd.worldPosition.z)
        await interactor.pokeAt(worldPos, cmd.durationMs ?? 200)
        this.respond({type: "CommandSuccess", commandId: cmd.commandId})
      } else {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: "Poke requires either uniqueId or worldPosition.",
          reason: "invalid_params"
        })
      }
    } catch (e) {
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private async handleDrag(cmd: DragCommand): Promise<void> {
    const handType = cmd.handType ?? "right"
    if (!isFiniteVec3(cmd.worldPosition)) {
      this.respond({
        type: "CommandError",
        commandId: cmd.commandId,
        message: "Drag requires a worldPosition with finite x/y/z.",
        reason: "invalid_params"
      })
      return
    }
    const targetPos = new vec3(cmd.worldPosition.x, cmd.worldPosition.y, cmd.worldPosition.z)
    const interactor = await this.getInteractor(handType)
    const held = this.heldObjects.get(handType)
    const releaseMidDrag = cmd.releaseMidDrag ?? false
    // releaseMidDrag always releases partway through; a "hold" request
    // is semantically incompatible, so the mid-drag release wins.
    const hold = releaseMidDrag ? false : (cmd.hold ?? false)

    // Track whether the pre-drag pinch succeeded in this invocation so we
    // can roll back state if the subsequent drag throws. Without this, a
    // flaky drag permanently marks the hand busy on a SIK interactor
    // that's actually in an indeterminate state.
    let pinchedInThisCall = false

    try {
      if (cmd.uniqueId || cmd.name) {
        const interactable = await this.resolveAndValidate(cmd.commandId, cmd.uniqueId, cmd.name, cmd.parentName)
        if (!interactable) return
        const resolvedUniqueId = interactable.getSceneObject().uniqueIdentifier
        const compatError = this.checkCompatibility("Drag", handType, resolvedUniqueId)
        if (compatError) {
          this.respond({
            type: "CommandError",
            commandId: cmd.commandId,
            message: compatError,
            reason: "interactor_busy"
          })
          return
        }
        // If not already holding this object, pinch first
        if (!held || held.uniqueId !== resolvedUniqueId) {
          await interactor.pinchInteractable(interactable, true)
          this.heldObjects.set(handType, {uniqueId: resolvedUniqueId, name: interactable.getSceneObject().name})
          pinchedInThisCall = true
        }
        await interactor.drag(targetPos, cmd.durationMs ?? 1000, hold, releaseMidDrag)
        if (!hold) {
          this.heldObjects.delete(handType)
          await this.settle()
        }
        this.respond({type: "CommandSuccess", commandId: cmd.commandId, resolvedUniqueId})
      } else {
        const compatError = this.checkCompatibility("Drag", handType, null)
        if (compatError) {
          this.respond({
            type: "CommandError",
            commandId: cmd.commandId,
            message: compatError,
            reason: "interactor_busy"
          })
          return
        }
        // If not already holding in free space, pinch first
        if (!held || held.uniqueId !== null) {
          await interactor.pinch(targetPos, true)
          this.heldObjects.set(handType, {uniqueId: null, name: null})
          pinchedInThisCall = true
        }
        await interactor.drag(targetPos, cmd.durationMs ?? 1000, hold, releaseMidDrag)
        if (!hold) {
          this.heldObjects.delete(handType)
          await this.settle()
        }
        this.respond({type: "CommandSuccess", commandId: cmd.commandId})
      }
    } catch (e) {
      if (pinchedInThisCall) {
        this.heldObjects.delete(handType)
        try {
          await interactor.release()
        } catch {
          // Best-effort cleanup; we're already surfacing a failure.
        }
      }
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private async handleGesture(cmd: GestureCommand): Promise<void> {
    try {
      if (!ALLOWED_GESTURES.has(cmd.gesture)) {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: `Unsupported gesture "${cmd.gesture}". Allowed: ${[...ALLOWED_GESTURES].join(", ")}.`,
          reason: "invalid_params"
        })
        return
      }
      if (cmd.worldPosition !== undefined && !isFiniteVec3(cmd.worldPosition)) {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: "Gesture worldPosition must have finite x/y/z.",
          reason: "invalid_params"
        })
        return
      }
      const compatError = this.checkCompatibility("Gesture", cmd.handType)
      if (compatError) {
        this.respond({type: "CommandError", commandId: cmd.commandId, message: compatError, reason: "interactor_busy"})
        return
      }
      const interactor = await this.getInteractor(cmd.handType)
      const duration = cmd.durationMs ?? 500

      if (cmd.worldPosition) {
        const worldPos = new vec3(cmd.worldPosition.x, cmd.worldPosition.y, cmd.worldPosition.z)
        await interactor.hand.setPosition(worldPos, duration)
      }

      await interactor.hand.makeGesture(cmd.gesture, undefined, duration)
      this.respond({type: "CommandSuccess", commandId: cmd.commandId})
    } catch (e) {
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private async handleRelease(cmd: ReleaseCommand): Promise<void> {
    try {
      const handType = cmd.handType
      const compatError = this.checkCompatibility("Release", handType)
      if (compatError) {
        this.respond({type: "CommandError", commandId: cmd.commandId, message: compatError, reason: "interactor_busy"})
        return
      }
      const held = this.heldObjects.get(handType)
      if (!held) {
        // Defensive: checkCompatibility should have caught this. If that
        // contract is ever loosened, we'd rather surface a clear error
        // than trip a TypeError on the non-null assertion below.
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: `No object held by ${handType} hand.`,
          reason: "interactor_busy"
        })
        return
      }
      const interactor = await this.getInteractor(handType)
      await interactor.release()
      const resolvedUniqueId = held.uniqueId ?? undefined
      this.heldObjects.delete(handType)
      await this.settle()
      this.respond({type: "CommandSuccess", commandId: cmd.commandId, resolvedUniqueId})
    } catch (e) {
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private async handleRotate(cmd: RotateCommand): Promise<void> {
    try {
      const handType = cmd.handType
      if (!isFiniteVec3(cmd.rotation)) {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: "Rotate requires rotation with finite x/y/z euler degrees.",
          reason: "invalid_params"
        })
        return
      }
      const compatError = this.checkCompatibility("Rotate", handType)
      if (compatError) {
        this.respond({type: "CommandError", commandId: cmd.commandId, message: compatError, reason: "interactor_busy"})
        return
      }
      const held = this.heldObjects.get(handType)
      if (!held) {
        this.respond({
          type: "CommandError",
          commandId: cmd.commandId,
          message: `No object held by ${handType} hand.`,
          reason: "interactor_busy"
        })
        return
      }
      const interactor = await this.getInteractor(handType)
      const rotation = new vec3(cmd.rotation.x, cmd.rotation.y, cmd.rotation.z)
      await interactor.rotate(rotation, cmd.durationMs ?? 500)
      this.respond({type: "CommandSuccess", commandId: cmd.commandId, resolvedUniqueId: held.uniqueId ?? undefined})
    } catch (e) {
      this.respond({type: "CommandError", commandId: cmd.commandId, message: String(e), reason: "internal_error"})
    }
  }

  private handleWait(cmd: WaitCommand): void {
    if (typeof cmd.durationMs !== "number" || !Number.isFinite(cmd.durationMs)) {
      this.respond({
        type: "CommandError",
        commandId: cmd.commandId,
        message: "Wait requires a finite numeric durationMs.",
        reason: "invalid_params"
      })
      return
    }
    if (cmd.durationMs > MAX_WAIT_MS) {
      this.respond({
        type: "CommandError",
        commandId: cmd.commandId,
        message: `Wait durationMs (${cmd.durationMs}) exceeds the lens-side cap of ${MAX_WAIT_MS}ms.`,
        reason: "invalid_params"
      })
      return
    }
    // Zero (or negative) durations reply on the next frame — createDelayedEvent
    // requires a positive delay. Positive durations use the frame-scheduled
    // setTimeout wrapper from Leaf.lspkg/Utils/common/Utils.
    if (cmd.durationMs <= 0) {
      this.respond({type: "CommandSuccess", commandId: cmd.commandId})
      return
    }
    scheduleAfter(() => {
      this.respond({type: "CommandSuccess", commandId: cmd.commandId})
    }, cmd.durationMs)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private respond(response: InteractionResponse): void {
    if (response.type === "CommandSuccess" || response.type === "CommandError") {
      ;(response as any).handState = this.getHandState()
    }
    this.publisher.notify(response)
  }
}
