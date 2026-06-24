import {CommandErrorResponse, HandState} from "AiPreviewAgentInspect.lspkg/AgentMessages"
import {BaseMessage} from "Leaf.lspkg/Utils/common/MessagingSystem/MessageTypes/BaseMessage"

// ─── Commands (Editor → Lens) ─────────────────────────────────────────────────

/**
 * Pinch at a target interactable or world position.
 * If uniqueId is provided, resolves and validates the interactable.
 * If worldPosition is provided (no uniqueId), pinches in free space.
 */
export interface PinchCommand extends BaseMessage {
  type: "Pinch"
  commandId: string
  uniqueId?: string
  name?: string
  parentName?: string
  /** World-space position for coordinate-based targeting. Alternative to uniqueId. */
  worldPosition?: {x: number; y: number; z: number}
  handType?: "left" | "right"
  durationMs?: number
  hold?: boolean
}

export interface HoverCommand extends BaseMessage {
  type: "Hover"
  commandId: string
  uniqueId?: string
  name?: string
  parentName?: string
  /** World-space position for coordinate-based targeting. Alternative to uniqueId. */
  worldPosition?: {x: number; y: number; z: number}
  durationMs?: number
  handType?: "left" | "right"
}

/**
 * Poke an interactable or world position with the index fingertip — extended
 * finger pushes into the collider without pinching. SIK fires onTriggerStart
 * in poke trigger mode (distinct from the pinch trigger). Targets that gate on
 * `targetingMode = Poke` only become reachable through this action.
 *
 * If uniqueId is provided, targets an interactable. If worldPosition is
 * provided instead, pokes in free space.
 */
export interface PokeCommand extends BaseMessage {
  type: "Poke"
  commandId: string
  uniqueId?: string
  name?: string
  parentName?: string
  /** World-space position for coordinate-based targeting. Alternative to uniqueId. */
  worldPosition?: {x: number; y: number; z: number}
  durationMs?: number
  handType?: "left" | "right"
}

/**
 * Grab and move to a world-space position.
 * If uniqueId is provided, targets an interactable and drives InteractableManipulation.
 * If only worldPosition is provided (no uniqueId), moves the hand in free space.
 */
export interface DragCommand extends BaseMessage {
  type: "Drag"
  commandId: string
  uniqueId?: string
  name?: string
  parentName?: string
  /** Target world-space position. */
  worldPosition: {x: number; y: number; z: number}
  durationMs?: number
  handType?: "left" | "right"
  hold?: boolean
  /**
   * If true, release the pinch partway through the drag so the remaining
   * hand motion carries past the target without driving the object — a
   * "throw" motion. Implies hold=false.
   */
  releaseMidDrag?: boolean
}

export interface GestureCommand extends BaseMessage {
  type: "Gesture"
  commandId: string
  handType: "left" | "right"
  gesture: "pinch" | "fist" | "palm" | "backhand" | "relaxed" | "neutral"
  /** World-space position to move the hand to before the gesture. */
  worldPosition?: {x: number; y: number; z: number}
  durationMs?: number
}

/** Release the pinch on the specified hand. Only valid when hand is holding. */
export interface ReleaseCommand extends BaseMessage {
  type: "Release"
  commandId: string
  handType: "left" | "right"
}

/** Rotate the hand by euler angle deltas while holding. Only valid when hand is holding. */
export interface RotateCommand extends BaseMessage {
  type: "Rotate"
  commandId: string
  handType: "left" | "right"
  /** Euler angle deltas in degrees. */
  rotation: {x: number; y: number; z: number}
  /** Duration of the rotation animation in milliseconds. Defaults to 500. */
  durationMs?: number
}

/** Pause for `durationMs` on the lens, then reply with CommandSuccess. Used by the MCP Batch action's Wait sub-action. */
export interface WaitCommand extends BaseMessage {
  type: "Wait"
  commandId: string
  durationMs: number
}

export type InteractionCommand =
  | PinchCommand
  | HoverCommand
  | PokeCommand
  | DragCommand
  | GestureCommand
  | ReleaseCommand
  | RotateCommand
  | WaitCommand

// ─── Responses (Lens → Editor) ────────────────────────────────────────────────

export interface CommandSuccessResponse extends BaseMessage {
  type: "CommandSuccess"
  commandId: string
  resolvedUniqueId?: string
  handState?: HandState
}

export type InteractionResponse = CommandSuccessResponse | CommandErrorResponse
