import {computeAABB} from "./AABBComputer"
import {
  AgentCommand,
  AgentResponse,
  BoundsPayload,
  CapabilitiesPayload,
  CommandErrorResponse,
  ComponentPayload,
  FilterBreakdown,
  FilterPredicate,
  MatchedPropertyPayload,
  ProjectionSpec,
  PropertyOperator,
  RuntimeQueryCommand,
  RuntimeQueryResponse,
  RuntimeQueryResult,
  SceneObjectPayload,
  SortBy,
  TransformPayload
} from "./AgentMessages"
import {ComponentReaderRegistry, quatToPlain, toFullKey, toShortName, vec3ToPlain} from "./ComponentReaderRegistry"
import {MessagePublisher} from "./messaging/MessagePublisher"
import {findSceneObjectByUniqueId} from "./SceneHelpers"

const MAX_TRAVERSAL_DEPTH = 256
// Hard ceiling on projection depth — protects against runaway recursive
// children/parent selection sets the editor might compose. Beyond this depth
// the projector returns bare cheap-only payloads instead of throwing.
const MAX_PROJECTION_DEPTH = 5
const SCHEMA_VERSION = "1.0"

const VALID_OPERATORS = new Set<PropertyOperator>(["EQUALS", "CONTAINS", "GT", "LT", "EXISTS"])
const VALID_SORT_BY = new Set<SortBy>(["NONE", "NAME", "DISTANCE"])

// ─── Helpers ────────────────────────────────────────────────────────────────

function readTransform(obj: SceneObject): TransformPayload {
  const t = obj.getTransform()
  return {
    worldPosition: vec3ToPlain(t.getWorldPosition()),
    localPosition: vec3ToPlain(t.getLocalPosition()),
    worldRotation: quatToPlain(t.getWorldRotation()),
    localRotation: quatToPlain(t.getLocalRotation()),
    worldScale: vec3ToPlain(t.getWorldScale()),
    localScale: vec3ToPlain(t.getLocalScale())
  }
}

function readBounds(uniqueId: string): BoundsPayload | undefined {
  const aabb = computeAABB(uniqueId)
  if (!aabb.found) return undefined
  return {center: aabb.center, extents: aabb.extents, min: aabb.min, max: aabb.max}
}

function matchesOperator(propValue: unknown, operator: PropertyOperator, compareValue: unknown): boolean {
  switch (operator) {
    case "EXISTS":
      return propValue !== null && propValue !== undefined
    case "EQUALS":
      if (typeof propValue === "object" && propValue !== null) {
        return JSON.stringify(propValue) === JSON.stringify(compareValue)
      }
      return propValue === compareValue
    case "CONTAINS":
      if (typeof propValue !== "string") return false
      return propValue.toLowerCase().includes(String(compareValue).toLowerCase())
    case "GT":
      if (typeof propValue !== "number") return false
      return propValue > (compareValue as number)
    case "LT":
      if (typeof propValue !== "number") return false
      return propValue < (compareValue as number)
    default:
      return false
  }
}

/**
 * Component-presence check with two resolution paths:
 *   1. Literal lookup — `obj.getComponent(fullKey)`. Covers built-in types.
 *   2. Script-asset-name fallback — match the requested name against any
 *      ScriptComponent's `script.name` / `scriptAsset.name`. Covers the
 *      SIK pattern where behavior is attached via script-asset name
 *      (Interactable, InteractableManipulation, custom user scripts, etc.)
 *      and the literal type-name lookup wouldn't find it.
 */
function hasComponent(obj: SceneObject, shortOrFullKey: string): boolean {
  const fullKey = toFullKey(shortOrFullKey)
  const literal = obj.getComponent(fullKey as keyof ComponentNameMap)
  if (literal) return true
  const shortName = toShortName(fullKey)
  const scripts = obj.getComponents("Component.ScriptComponent" as keyof ComponentNameMap)
  if (scripts && scripts.length > 0) {
    for (const sc of scripts) {
      // constructor name covers runtime-created (UIKit) scripts with no script asset
      const scriptName: string | undefined =
        (sc as {script?: {name?: string}; scriptAsset?: {name?: string}}).script?.name ??
        (sc as {scriptAsset?: {name?: string}}).scriptAsset?.name ??
        (sc as {constructor?: {name?: string}})?.constructor?.name
      if (scriptName === shortName) return true
    }
  }
  return false
}

// ─── Errors ─────────────────────────────────────────────────────────────────

class UnknownComponentError extends Error {
  constructor(
    public readonly requested: string,
    public readonly registered: string[]
  ) {
    super(`Unknown component "${requested}". Registered readers: [${registered.join(", ")}]`)
  }
}

class UnknownPropertyError extends Error {
  constructor(
    public readonly componentType: string,
    public readonly propertyName: string,
    public readonly available: string[]
  ) {
    super(
      `Property "${propertyName}" not exposed by reader for "${componentType}". ` +
        `Available: [${available.join(", ")}]`
    )
  }
}

class NotFoundError extends Error {
  constructor(
    public readonly resource: string,
    public readonly id: string
  ) {
    super(`${resource} not found: "${id}"`)
  }
}

class InvalidParamsError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export class RuntimeQueryHandler {
  constructor(
    private publisher: MessagePublisher<AgentCommand, AgentResponse>,
    private registry: ComponentReaderRegistry
  ) {
    this.publisher.subscribe("RuntimeQuery", (cmd: RuntimeQueryCommand) => this.handle(cmd))
  }

  private handle(cmd: RuntimeQueryCommand): void {
    try {
      const result = this.execute(cmd)
      const response: RuntimeQueryResponse = {
        type: "RuntimeQueryResponse",
        commandId: cmd.commandId,
        result
      }
      this.publisher.notify(response)
    } catch (e) {
      this.publisher.notify(this.errorFor(cmd.commandId, e))
    }
  }

  private execute(cmd: RuntimeQueryCommand): RuntimeQueryResult {
    const {scope, projection} = cmd
    switch (scope.kind) {
      case "capabilities":
        return {kind: "capabilities", capabilities: this.computeCapabilities()}
      case "single": {
        const obj = findSceneObjectByUniqueId(scope.uniqueId)
        if (!obj || isNull(obj)) {
          // Returning null beats a hard error here — the editor maps "missing"
          // to a graphql `null` which the AI can branch on directly. Hard
          // errors are reserved for malformed input.
          return {kind: "single", object: null}
        }
        return {kind: "single", object: this.project(obj, projection, 0)}
      }
      case "roots": {
        const objects: SceneObjectPayload[] = []
        for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
          objects.push(this.project(global.scene.getRootObject(i), projection, 0))
        }
        return {kind: "roots", objects}
      }
      case "filter":
        return this.executeFilter(scope.predicate, scope.limit, scope.sortBy ?? "NONE", projection)
    }
  }

  // ─── Filter ──────────────────────────────────────────────────────────────

  private executeFilter(
    predicate: FilterPredicate,
    limit: number | undefined,
    sortBy: SortBy,
    projection: ProjectionSpec
  ): RuntimeQueryResult {
    if (!VALID_SORT_BY.has(sortBy)) {
      throw new InvalidParamsError(`Invalid sortBy: "${sortBy}"`, {
        validSortByOptions: Array.from(VALID_SORT_BY)
      })
    }
    if (sortBy === "DISTANCE" && !predicate.nearPoint) {
      throw new InvalidParamsError(
        `sortBy: "DISTANCE" requires filter.nearPoint to be set. ` +
          `Either provide a nearPoint filter, or use sortBy: NAME / NONE.`,
        {validSortByOptions: ["NONE", "NAME"], missingFilter: "nearPoint"}
      )
    }
    if (predicate.property && !VALID_OPERATORS.has(predicate.property.operator)) {
      throw new InvalidParamsError(`Invalid operator "${predicate.property.operator}".`, {
        validOperators: Array.from(VALID_OPERATORS)
      })
    }

    // Validate the property filter against the registry up-front so the AI
    // gets a precise error rather than a silent empty-result.
    if (predicate.property) {
      const fullKey = toFullKey(predicate.property.componentType)
      if (!this.registry.hasReader(fullKey)) {
        throw new UnknownComponentError(
          predicate.property.componentType,
          this.registry.getRegisteredTypes().map(toShortName)
        )
      }
      // EXISTS legitimately probes for unknown property names (returns false).
      // For other operators, the property must be declared on the reader, or
      // the filter would silently never match.
      if (predicate.property.operator !== "EXISTS") {
        const declared = this.registry.getPropertyNames(fullKey)
        if (declared.length > 0 && !declared.includes(predicate.property.propertyName)) {
          throw new UnknownPropertyError(predicate.property.componentType, predicate.property.propertyName, declared)
        }
      }
    }

    // Resolve descendantOf scope (changes the walk start; not a per-node check).
    let scopeRoot: SceneObject | undefined
    if (predicate.descendantOf) {
      const found = findSceneObjectByUniqueId(predicate.descendantOf)
      if (!found || isNull(found)) {
        throw new NotFoundError("SceneObject (descendantOf)", predicate.descendantOf)
      }
      scopeRoot = found
    }

    const breakdown: FilterBreakdown = {
      afterDescendantOf: scopeRoot ? 0 : null,
      afterEnabledOnly: predicate.enabledOnly ? 0 : null,
      afterNameContains: predicate.nameContains ? 0 : null,
      afterComponent: predicate.hasComponents?.length ? 0 : null,
      afterNearPoint: predicate.nearPoint ? 0 : null,
      afterProperty: predicate.property ? 0 : null
    }

    // Sorted queries can't early-exit (we'd cut off objects that should rank
    // ahead). Unsorted queries early-exit at limit for cheap large scenes.
    const collectAll = sortBy === "NAME" || sortBy === "DISTANCE"
    const effectiveLimit = limit ?? Infinity

    const matches: Array<{payload: SceneObjectPayload; sortKey: string; distance?: number}> = []
    let totalScanned = 0
    let stoppedEarly = false

    const visit = (obj: SceneObject, depth: number): void => {
      if (stoppedEarly) return
      if (depth > MAX_TRAVERSAL_DEPTH) return
      if (isNull(obj)) return
      totalScanned++

      const matchInfo = this.evaluatePredicate(obj, predicate, breakdown)
      if (matchInfo.matched) {
        const payload = this.project(obj, projection, 0)
        if (matchInfo.distance !== undefined) {
          payload.distance = Math.round(matchInfo.distance * 100) / 100
        }
        if (matchInfo.matchedProperty) {
          payload.matchedProperty = matchInfo.matchedProperty
        }
        matches.push({payload, sortKey: obj.name, distance: matchInfo.distance})

        if (!collectAll && matches.length >= effectiveLimit) {
          stoppedEarly = true
          return
        }
      }

      for (let i = 0; i < obj.getChildrenCount(); i++) {
        visit(obj.getChild(i), depth + 1)
      }
    }

    if (scopeRoot) {
      visit(scopeRoot, 0)
    } else {
      for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
        visit(global.scene.getRootObject(i), 0)
      }
    }

    if (sortBy === "NAME") {
      matches.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    } else if (sortBy === "DISTANCE") {
      matches.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    }

    const truncated = stoppedEarly || (limit !== undefined && matches.length > effectiveLimit)
    const finalMatches = matches.slice(0, effectiveLimit).map((m) => m.payload)

    return {
      kind: "filter",
      matches: finalMatches,
      totalScanned,
      filterBreakdown: breakdown,
      truncated
    }
  }

  /**
   * Evaluate predicates cheap-first and short-circuit on the first failure.
   * Increments breakdown counters at each surviving stage. When nearPoint is
   * active, returns the computed distance regardless of pass/fail so the
   * sort step doesn't need to recompute.
   */
  private evaluatePredicate(
    obj: SceneObject,
    predicate: FilterPredicate,
    breakdown: FilterBreakdown
  ): {matched: boolean; distance?: number; matchedProperty?: MatchedPropertyPayload} {
    if (breakdown.afterDescendantOf !== null) breakdown.afterDescendantOf++

    if (predicate.enabledOnly && !obj.isEnabledInHierarchy) return {matched: false}
    if (breakdown.afterEnabledOnly !== null) breakdown.afterEnabledOnly++

    if (predicate.nameContains) {
      if (!obj.name.toLowerCase().includes(predicate.nameContains.toLowerCase())) {
        return {matched: false}
      }
    }
    if (breakdown.afterNameContains !== null) breakdown.afterNameContains++

    if (predicate.hasComponents?.length) {
      for (const ct of predicate.hasComponents) {
        if (!hasComponent(obj, ct)) return {matched: false}
      }
    }
    if (breakdown.afterComponent !== null) breakdown.afterComponent++

    let distance: number | undefined
    if (predicate.nearPoint) {
      const point = new vec3(predicate.nearPoint.point.x, predicate.nearPoint.point.y, predicate.nearPoint.point.z)
      distance = obj.getTransform().getWorldPosition().distance(point)
      if (distance > predicate.nearPoint.radius) return {matched: false, distance}
    }
    if (breakdown.afterNearPoint !== null) breakdown.afterNearPoint++

    let matchedProperty: MatchedPropertyPayload | undefined
    if (predicate.property) {
      const fullKey = toFullKey(predicate.property.componentType)
      // Iterate ALL components of the type — multi-script SceneObjects (the
      // SIK pattern) commonly have N>1 ScriptComponents. Without this, the
      // predicate only ever inspects the FIRST one and silently misses
      // matches on secondary components.
      const components = obj.getComponents(fullKey as keyof ComponentNameMap)
      if (!components || components.length === 0) return {matched: false, distance}
      let foundMatch: MatchedPropertyPayload | undefined
      for (const component of components) {
        const read = this.registry.read(component, fullKey)
        if (!read) continue
        const propValue = read.properties[predicate.property.propertyName]
        if (matchesOperator(propValue, predicate.property.operator, predicate.property.value)) {
          foundMatch = {name: predicate.property.propertyName, value: propValue}
          break
        }
      }
      if (!foundMatch) return {matched: false, distance}
      matchedProperty = foundMatch
    }
    if (breakdown.afterProperty !== null) breakdown.afterProperty++

    return {matched: true, distance, matchedProperty}
  }

  // ─── Projection ──────────────────────────────────────────────────────────

  private project(obj: SceneObject, spec: ProjectionSpec, depth: number): SceneObjectPayload {
    if (depth > MAX_PROJECTION_DEPTH) {
      // Return a bare payload — better than throwing mid-walk. Callers
      // detect the cap by the absence of expected nested fields.
      return {
        name: obj.name,
        uniqueId: obj.uniqueIdentifier,
        enabled: obj.isEnabledInHierarchy,
        childCount: obj.getChildrenCount(),
        componentTypes: this.registry.getComponentTypesOnObject(obj)
      }
    }

    const parent = obj.getParent()
    const payload: SceneObjectPayload = {
      name: obj.name,
      uniqueId: obj.uniqueIdentifier,
      enabled: obj.isEnabledInHierarchy,
      childCount: obj.getChildrenCount(),
      componentTypes: this.registry.getComponentTypesOnObject(obj),
      parentName: parent && !isNull(parent) ? parent.name : undefined,
      parentUniqueId: parent && !isNull(parent) ? parent.uniqueIdentifier : undefined
    }
    if (spec.transform) {
      payload.transform = readTransform(obj)
    }
    if (spec.components) {
      const filterFullKeys = spec.components.filter?.map(toFullKey)
      payload.components = this.registry.readAllComponents(obj, filterFullKeys) as ComponentPayload[]
    }
    if (spec.bounds) {
      payload.bounds = readBounds(obj.uniqueIdentifier)
    }
    if (spec.parent && parent && !isNull(parent)) {
      payload.parentProjection = this.project(parent, spec.parent, depth + 1)
    }
    if (spec.children) {
      payload.children = this.collectChildren(
        obj,
        spec.children.maxDepth,
        spec.children.nameFilter,
        spec.children.projection,
        depth
      )
    }
    return payload
  }

  private collectChildren(
    obj: SceneObject,
    maxDepth: number,
    nameFilter: string | undefined,
    childProjection: ProjectionSpec,
    callerDepth: number
  ): SceneObjectPayload[] {
    const cap = Math.min(maxDepth, MAX_PROJECTION_DEPTH)
    const filterLower = nameFilter?.toLowerCase()

    const recurse = (parent: SceneObject, remainingDepth: number, depthFromTop: number): SceneObjectPayload[] => {
      const out: SceneObjectPayload[] = []
      if (remainingDepth <= 0) return out
      for (let i = 0; i < parent.getChildrenCount(); i++) {
        const child = parent.getChild(i)
        if (isNull(child)) continue
        const nameMatches = !filterLower || child.name.toLowerCase().includes(filterLower)
        const projected = this.project(child, childProjection, callerDepth + 1 + depthFromTop)
        const grandchildren = recurse(child, remainingDepth - 1, depthFromTop + 1)
        if (grandchildren.length > 0) {
          projected.children = grandchildren
        }
        // When filtering by name, prune branches that neither match nor
        // contain matching descendants — preserves tree structure for
        // matched leaves without flooding the response with empty parents.
        if (filterLower) {
          if (nameMatches || grandchildren.length > 0) out.push(projected)
        } else {
          out.push(projected)
        }
      }
      return out
    }

    return recurse(obj, cap, 0)
  }

  // ─── Capabilities ────────────────────────────────────────────────────────

  private computeCapabilities(): CapabilitiesPayload {
    const presentSet = new Set<string>()
    let totalSceneObjects = 0
    const visit = (obj: SceneObject, depth: number): void => {
      if (depth > MAX_TRAVERSAL_DEPTH) return
      if (isNull(obj)) return
      totalSceneObjects++
      for (const t of this.registry.getComponentTypesOnObject(obj)) {
        presentSet.add(t)
      }
      for (let i = 0; i < obj.getChildrenCount(); i++) {
        visit(obj.getChild(i), depth + 1)
      }
    }
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      visit(global.scene.getRootObject(i), 0)
    }
    return {
      registeredReaders: this.registry.getRegisteredReadersDigest(),
      presentComponents: Array.from(presentSet).sort(),
      totalSceneObjects,
      operators: ["EQUALS", "CONTAINS", "GT", "LT", "EXISTS"],
      sortByOptions: ["NONE", "NAME", "DISTANCE"],
      schemaVersion: SCHEMA_VERSION
    }
  }

  // ─── Errors ──────────────────────────────────────────────────────────────

  private errorFor(commandId: string, e: unknown): CommandErrorResponse {
    if (e instanceof UnknownComponentError) {
      return {
        type: "CommandError",
        commandId,
        message: e.message,
        reason: "unknown_component",
        context: {requested: e.requested, registered: e.registered}
      }
    }
    if (e instanceof UnknownPropertyError) {
      return {
        type: "CommandError",
        commandId,
        message: e.message,
        reason: "unknown_property",
        context: {
          componentType: e.componentType,
          propertyName: e.propertyName,
          availableProperties: e.available
        }
      }
    }
    if (e instanceof NotFoundError) {
      return {
        type: "CommandError",
        commandId,
        message: e.message,
        reason: "not_found",
        context: {resource: e.resource, id: e.id}
      }
    }
    if (e instanceof InvalidParamsError) {
      return {
        type: "CommandError",
        commandId,
        message: e.message,
        reason: "invalid_params",
        context: e.context
      }
    }
    return {
      type: "CommandError",
      commandId,
      message: e instanceof Error ? e.message : String(e),
      reason: "internal_error"
    }
  }
}
