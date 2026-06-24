// Serialization helpers

export function vec3ToPlain(v: vec3): {x: number; y: number; z: number} {
  return {x: v.x, y: v.y, z: v.z}
}

export function vec4ToPlain(v: vec4): {x: number; y: number; z: number; w: number} {
  return {x: v.x, y: v.y, z: v.z, w: v.w}
}

export function quatToPlain(q: quat): {x: number; y: number; z: number; w: number} {
  return {x: q.x, y: q.y, z: q.z, w: q.w}
}

export function colorToPlain(c: vec4): {r: number; g: number; b: number; a: number} {
  return {r: c.r, g: c.g, b: c.b, a: c.a}
}

/** e.g. "Component.Text" → "Text" */
export function toShortName(fullKey: string): string {
  const dot = fullKey.lastIndexOf(".")
  return dot >= 0 ? fullKey.slice(dot + 1) : fullKey
}

/** e.g. "Text" → "Component.Text" */
export function toFullKey(shortName: string): string {
  return shortName.startsWith("Component.") ? shortName : `Component.${shortName}`
}

// Registry

type ComponentReader = (component: Component) => Record<string, unknown>

export class ComponentReaderRegistry {
  private readers = new Map<string, ComponentReader>()
  // Manually-declared property names per reader. Powers capabilities
  // introspection and the property-filter unknown-property check; we can't
  // discover these by introspection without invoking a reader against a real
  // component instance, which isn't available at registration time.
  private propertyNames = new Map<string, string[]>()

  register(componentType: string, reader: ComponentReader, propertyNames: string[] = []): void {
    this.readers.set(componentType, reader)
    this.propertyNames.set(componentType, propertyNames)
  }

  read(component: Component, componentType: string): {type: string; properties: Record<string, unknown>} | null {
    const reader = this.readers.get(componentType)
    if (!reader) return null
    try {
      const properties = reader(component)
      return {type: componentType, properties}
    } catch {
      return null
    }
  }

  hasReader(componentType: string): boolean {
    return this.readers.has(componentType)
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.readers.keys())
  }

  getPropertyNames(componentType: string): string[] {
    return this.propertyNames.get(componentType) ?? []
  }

  /** Short-name → declared property names, for capabilities introspection. */
  getRegisteredReadersDigest(): Array<{name: string; properties: string[]}> {
    const out: Array<{name: string; properties: string[]}> = []
    for (const fullKey of this.readers.keys()) {
      out.push({name: toShortName(fullKey), properties: this.propertyNames.get(fullKey) ?? []})
    }
    return out
  }

  readAllComponents(
    sceneObject: SceneObject,
    componentFilter?: string[]
  ): Array<{type: string; properties: Record<string, unknown>}> {
    const types = componentFilter ?? this.getRegisteredTypes()
    const results: Array<{type: string; properties: Record<string, unknown>}> = []
    for (const componentType of types) {
      // getComponents (plural) returns ALL matches — covers the SIK pattern
      // where one SceneObject has multiple ScriptComponents (e.g. Interactable
      // + InteractableManipulation). Single-component types just yield a
      // 1-element list.
      const components = sceneObject.getComponents(componentType as keyof ComponentNameMap)
      if (!components || components.length === 0) continue
      for (const component of components) {
        const result = this.read(component, componentType)
        if (result !== null) {
          results.push(result)
        }
      }
    }
    return results
  }

  getComponentTypesOnObject(sceneObject: SceneObject): string[] {
    const present = new Set<string>()
    for (const componentType of this.getRegisteredTypes()) {
      const components = sceneObject.getComponents(componentType as keyof ComponentNameMap)
      if (!components || components.length === 0) continue
      present.add(toShortName(componentType))
      // For ScriptComponents, also surface each script asset's name as a
      // synthetic "type". The SIK pattern attaches behavior via script-asset
      // names (Interactable, InteractableManipulation, ButtonFeedback, etc.)
      // rather than literal component types — surfacing them here makes them
      // visible in componentTypes / presentComponents and filterable via
      // hasComponents without the agent having to know the SIK convention.
      if (componentType === "Component.ScriptComponent") {
        for (const sc of components) {
          // constructor name covers runtime-created (UIKit) scripts with no script asset
          const scriptName: string | undefined =
            (sc as {script?: {name?: string}; scriptAsset?: {name?: string}}).script?.name ??
            (sc as {scriptAsset?: {name?: string}}).scriptAsset?.name ??
            (sc as {constructor?: {name?: string}})?.constructor?.name
          if (scriptName) present.add(scriptName)
        }
      }
    }
    return Array.from(present)
  }
}

// Built-in readers

function readText(comp: Component): Record<string, unknown> {
  const t = comp as Text
  const props: Record<string, unknown> = {}
  props.text = t.text
  props.size = t.size
  if (t.font != null) props.font = t.font.name
  if (t.textFill?.color != null) props.color = colorToPlain(t.textFill.color)
  props.horizontalOverflow = String(t.horizontalOverflow)
  props.verticalOverflow = String(t.verticalOverflow)
  props.sizeToFit = t.sizeToFit
  props.horizontalAlignment = String(t.horizontalAlignment)
  props.verticalAlignment = String(t.verticalAlignment)
  return props
}

function readImage(comp: Component): Record<string, unknown> {
  const img = comp as Image
  const props: Record<string, unknown> = {}
  if (img.mainMaterial != null) props.mainMaterial = img.mainMaterial.name
  props.stretchMode = String(img.stretchMode)
  props.flipX = img.flipX
  props.flipY = img.flipY
  props.pivot = {x: img.pivot.x, y: img.pivot.y}
  props.renderOrder = img.renderOrder
  props.horizontalAlignment = String(img.horizontalAlignment)
  props.verticalAlignment = String(img.verticalAlignment)
  return props
}

function readRenderMeshVisual(comp: Component): Record<string, unknown> {
  const rmv = comp as RenderMeshVisual
  const props: Record<string, unknown> = {}
  if (rmv.mesh != null) props.mesh = rmv.mesh.name
  if (rmv.mainMaterial != null) props.mainMaterial = rmv.mainMaterial.name
  props.meshShadowMode = String(rmv.meshShadowMode)
  props.renderOrder = rmv.renderOrder
  props.blendShapesEnabled = rmv.blendShapesEnabled
  return props
}

function readText3D(comp: Component): Record<string, unknown> {
  const t = comp as Text3D
  const props: Record<string, unknown> = {}
  props.text = t.text
  props.size = t.size
  if (t.font != null) props.font = t.font.name
  props.extrusionDepth = t.extrusionDepth
  if (t.mainMaterial != null) props.mainMaterial = t.mainMaterial.name
  props.horizontalOverflow = String(t.horizontalOverflow)
  props.verticalOverflow = String(t.verticalOverflow)
  return props
}

function readAnimationPlayer(comp: Component): Record<string, unknown> {
  const ap = comp as AnimationPlayer
  const props: Record<string, unknown> = {}
  const activeClips = ap.getActiveClips()
  props.isPlaying = activeClips.length > 0
  props.activeClips = activeClips
  return props
}

function readCamera(comp: Component): Record<string, unknown> {
  const cam = comp as Camera
  const props: Record<string, unknown> = {}
  props.cameraType = String(cam.type)
  props.fov = cam.fov
  props.near = cam.near
  props.far = cam.far
  props.renderOrder = cam.renderOrder
  props.size = cam.size
  return props
}

function readScreenTransform(comp: Component): Record<string, unknown> {
  const st = comp as ScreenTransform
  const props: Record<string, unknown> = {}
  props.anchor = {
    left: st.anchors.left,
    right: st.anchors.right,
    top: st.anchors.top,
    bottom: st.anchors.bottom
  }
  props.offset = {
    left: st.offsets.left,
    right: st.offsets.right,
    top: st.offsets.top,
    bottom: st.offsets.bottom
  }
  props.pivot = {x: st.pivot.x, y: st.pivot.y}
  return props
}

function readScriptComponent(comp: Component): Record<string, unknown> {
  const sc = comp as ScriptComponent
  const props: Record<string, unknown> = {}
  // constructor name covers runtime-created (UIKit) scripts with no script asset
  const scriptName: string | undefined =
    sc["script"]?.name ?? sc["scriptAsset"]?.name ?? (sc as {constructor?: {name?: string}})?.constructor?.name
  if (scriptName !== undefined) props.scriptAsset = scriptName
  return props
}

function readAudioComponent(comp: Component): Record<string, unknown> {
  const ac = comp as AudioComponent
  const props: Record<string, unknown> = {}
  if (ac.audioTrack != null) props.audioTrack = ac.audioTrack.name
  props.volume = ac.volume
  props.playbackMode = String(ac.playbackMode)
  return props
}

export function createDefaultRegistry(): ComponentReaderRegistry {
  const registry = new ComponentReaderRegistry()

  registry.register("Component.Text", readText, [
    "text",
    "size",
    "font",
    "color",
    "horizontalOverflow",
    "verticalOverflow",
    "sizeToFit",
    "horizontalAlignment",
    "verticalAlignment"
  ])
  registry.register("Component.Image", readImage, [
    "mainMaterial",
    "stretchMode",
    "flipX",
    "flipY",
    "pivot",
    "renderOrder",
    "horizontalAlignment",
    "verticalAlignment"
  ])
  registry.register("Component.RenderMeshVisual", readRenderMeshVisual, [
    "mesh",
    "mainMaterial",
    "meshShadowMode",
    "renderOrder",
    "blendShapesEnabled"
  ])
  registry.register("Component.Text3D", readText3D, [
    "text",
    "size",
    "font",
    "extrusionDepth",
    "mainMaterial",
    "horizontalOverflow",
    "verticalOverflow"
  ])
  registry.register("Component.AnimationPlayer", readAnimationPlayer, ["isPlaying", "activeClips"])
  registry.register("Component.Camera", readCamera, ["cameraType", "fov", "near", "far", "renderOrder", "size"])
  registry.register("Component.ScreenTransform", readScreenTransform, ["anchor", "offset", "pivot"])
  registry.register("Component.ScriptComponent", readScriptComponent, ["scriptAsset"])
  registry.register("Component.AudioComponent", readAudioComponent, ["audioTrack", "volume", "playbackMode"])

  return registry
}
