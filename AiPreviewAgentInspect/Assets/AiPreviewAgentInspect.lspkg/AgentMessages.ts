import {BaseMessage} from "./messaging/Messaging"

// ─── Commands (Editor → Lens) ─────────────────────────────────────────────────

/** Lightweight heartbeat — used by the MCP tool to confirm the handler is alive. */
export interface PingCommand extends BaseMessage {
  type: "Ping"
  commandId: string
}

/**
 * Capture an orthographic render of a region of interest.
 *
 * The region is determined by `uniqueIds` (when non-empty) — the lens computes
 * the combined AABB of those scene objects — or by `center` otherwise. In both
 * cases `distance` controls how much extra space is included around the region:
 *
 *   - With `uniqueIds`: extra padding added to the AABB half-extents.
 *   - With `center` only: half-size of the cube around `center` (ortho zoom).
 *
 * `isolate` hides every scene object that isn't in `uniqueIds`. Has no effect
 * when `uniqueIds` is empty.
 */
export interface CaptureViewCommand extends BaseMessage {
  type: "CaptureView"
  commandId: string
  /** Camera angle preset. */
  viewAngle: "isometric" | "top" | "front" | "back" | "left" | "right"
  /** Scene objects to frame. When empty, falls back to `center`. */
  uniqueIds?: string[]
  /** World-space point to look at when `uniqueIds` is empty. */
  center?: {x: number; y: number; z: number}
  /** Extra space around the region. Padding for object mode, ortho extent for center mode. */
  distance?: number
  /** Hide every scene object not in `uniqueIds`. Ignored when `uniqueIds` is empty. */
  isolate?: boolean
  /** Image quality: "low" (256x192), "medium" (512x384, default), "high" (1024x768). */
  detail?: "low" | "medium" | "high"
}

// ─── RuntimeQuery — unified scene query/inspection ───────────────────────────

/** Property comparison operators for filtering by component property values. */
export type PropertyOperator = "EQUALS" | "CONTAINS" | "GT" | "LT" | "EXISTS"

/** Sort strategy for filter result lists. */
export type SortBy = "NONE" | "NAME" | "DISTANCE"

export interface Vec3Plain {
  x: number
  y: number
  z: number
}

/**
 * AND-combined filter predicates. Every present field narrows the result set;
 * absent fields don't filter. Sent unchanged from the editor — schema-level
 * validation happens before this lens-side handler is invoked.
 */
export interface FilterPredicate {
  /** Object must carry ALL listed component types (short or fully-qualified). */
  hasComponents?: string[]
  /** Single component-property predicate; requires a registered reader for that type. */
  property?: {
    componentType: string
    propertyName: string
    operator: PropertyOperator
    value?: unknown
  }
  /** Spatial: object's world position within `radius` of `point`. */
  nearPoint?: {
    point: Vec3Plain
    radius: number
  }
  /** Confine the walk to descendants of this object (uniqueId). */
  descendantOf?: string
  /** Case-insensitive substring on `obj.name`. */
  nameContains?: string
  /** When true, skip objects where `isEnabledInHierarchy` is false. */
  enabledOnly?: boolean
}

/**
 * Recursive projection spec. Cheap fields (name, uniqueId, enabled, parentName,
 * parentUniqueId, childCount, componentTypes) are always populated. The flags
 * here are the lazy fields — populated only if the editor's selection set
 * asked for them, since each one has a meaningful per-node cost.
 */
export interface ProjectionSpec {
  transform?: boolean
  components?: {filter?: string[]}
  bounds?: boolean
  /** Walk one level up; recursive spec governs the parent's projection. */
  parent?: ProjectionSpec
  /** Walk descendants up to `maxDepth`. Server caps maxDepth at MAX_PROJECTION_DEPTH. */
  children?: {
    maxDepth: number
    nameFilter?: string
    projection: ProjectionSpec
  }
}

export type RuntimeQueryScope =
  | {kind: "capabilities"}
  | {kind: "single"; uniqueId: string}
  | {kind: "roots"}
  | {
      kind: "filter"
      predicate: FilterPredicate
      limit?: number
      sortBy?: SortBy
    }

/**
 * Single command type that replaces FindByComponent / FindByProperty /
 * GetObjectsNearPoint / GetSceneOverview / InspectObject. Editor resolvers
 * compose this from the GraphQL query AST.
 */
export interface RuntimeQueryCommand extends BaseMessage {
  type: "RuntimeQuery"
  commandId: string
  scope: RuntimeQueryScope
  /** Ignored when scope.kind === "capabilities". */
  projection: ProjectionSpec
}

/**
 * Commands handled directly by the Inspect package. The Interact package
 * extends this set via its own command types subscribed against the same
 * publisher (see AiPreviewAgentInteract.lspkg/AgentMessages.ts).
 */
export type AgentCommand = PingCommand | CaptureViewCommand | RuntimeQueryCommand

// ─── Responses (Lens → Editor) ────────────────────────────────────────────────

export interface PingResponse extends BaseMessage {
  type: "PingResponse"
  commandId: string
}

/**
 * Per-hand interaction state, surfaced on success and error responses. Defined
 * here so universal CommandErrorResponse can carry it — the editor's MCP tools
 * branch on `handState` regardless of which package emitted the error.
 */
export interface HandStateEntry {
  status: "free" | "holding"
  objectId?: string
  objectName?: string
}

export interface HandState {
  left: HandStateEntry
  right: HandStateEntry
}

export interface CommandErrorResponse extends BaseMessage {
  type: "CommandError"
  commandId: string
  message: string
  /**
   * Classification of the failure. The MCP side branches on this for recovery:
   *   - not_found: target doesn't exist (retry lookup or pick another target)
   *   - disabled: target exists but is disabled (skip, or wait for it to be enabled)
   *   - clipped: target is outside a scroll view's visible bounds (scroll first)
   *   - obstructed: another object physically blocks the target
   *   - unreachable: target can't be reached (scene geometry)
   *   - interactor_busy: hand is already holding — Release or use the other hand
   *   - unknown_command: lens couldn't dispatch the command type
   *   - invalid_params: required params were missing or malformed
   *   - unknown_component: property filter targets an unregistered component reader
   *   - unknown_property: reader exists but no such property name was readable
   *   - internal_error: unexpected exception in the handler — not retryable
   *   - unsupported: the requested capability (e.g. component reader) is not registered
   */
  reason?:
    | "not_found"
    | "disabled"
    | "clipped"
    | "obstructed"
    | "unreachable"
    | "interactor_busy"
    | "unknown_command"
    | "invalid_params"
    | "unknown_component"
    | "unknown_property"
    | "internal_error"
    | "unsupported"
  handState?: HandState
  /** Diagnostic context. For unknown_component: list of registered names. For unknown_property: list of properties on the reader. */
  context?: Record<string, unknown>
}

export interface CaptureViewResponse extends BaseMessage {
  type: "CaptureViewResponse"
  commandId: string
  imageBase64: string
  viewAngle: string
  width: number
  height: number
}

// ─── RuntimeQuery payload types ──────────────────────────────────────────────

export interface TransformPayload {
  worldPosition: Vec3Plain
  localPosition: Vec3Plain
  worldRotation: {x: number; y: number; z: number; w: number}
  localRotation: {x: number; y: number; z: number; w: number}
  worldScale: Vec3Plain
  localScale: Vec3Plain
}

export interface BoundsPayload {
  center: Vec3Plain
  extents: Vec3Plain
  min: Vec3Plain
  max: Vec3Plain
}

export interface ComponentPayload {
  type: string
  properties: Record<string, unknown>
}

export interface MatchedPropertyPayload {
  name: string
  value: unknown
}

/**
 * Per-object payload returned for sceneObject / sceneObjects.matches /
 * sceneRoots. Cheap fields are always populated; lazy fields appear only
 * when the editor's projection spec asked for them.
 */
export interface SceneObjectPayload {
  // Cheap, always-on
  name: string
  uniqueId: string
  enabled: boolean
  childCount: number
  componentTypes: string[]
  parentName?: string
  parentUniqueId?: string

  // Lazy
  transform?: TransformPayload
  components?: ComponentPayload[]
  bounds?: BoundsPayload
  /** Populated when projection.parent was set. */
  parentProjection?: SceneObjectPayload
  /** Populated when projection.children was set. */
  children?: SceneObjectPayload[]

  // Filter-context fields (populated by sceneObjects matches only)
  /** Set when nearPoint filter was active. */
  distance?: number
  /** Set when property filter matched this object. */
  matchedProperty?: MatchedPropertyPayload
}

/**
 * Diagnostic counters explaining why the result set has its size. Each field
 * is the count of objects surviving up to that filter stage in the
 * cheap-first evaluation order. `null` for filters that weren't applied.
 */
export interface FilterBreakdown {
  afterDescendantOf: number | null
  afterEnabledOnly: number | null
  afterNameContains: number | null
  afterComponent: number | null
  afterNearPoint: number | null
  afterProperty: number | null
}

export interface CapabilitiesPayload {
  registeredReaders: Array<{
    name: string
    properties: string[]
  }>
  /** All distinct component type short-names currently present in the scene. Live snapshot. */
  presentComponents: string[]
  totalSceneObjects: number
  operators: PropertyOperator[]
  sortByOptions: SortBy[]
  schemaVersion: string
}

export type RuntimeQueryResult =
  | {kind: "single"; object: SceneObjectPayload | null}
  | {kind: "roots"; objects: SceneObjectPayload[]}
  | {
      kind: "filter"
      matches: SceneObjectPayload[]
      totalScanned: number
      filterBreakdown: FilterBreakdown
      truncated: boolean
    }
  | {kind: "capabilities"; capabilities: CapabilitiesPayload}

export interface RuntimeQueryResponse extends BaseMessage {
  type: "RuntimeQueryResponse"
  commandId: string
  result: RuntimeQueryResult
}

/**
 * Responses emitted by the Inspect package. The Interact package emits
 * additional response types (CommandSuccessResponse, etc.) through the same
 * publisher.
 */
export type AgentResponse = PingResponse | CommandErrorResponse | CaptureViewResponse | RuntimeQueryResponse
