/**
 * Meshes for the button, generated in code (no mesh assets): a bevelled slab (round or rounded-rect
 * footprint), a holed base (bezel + well) the cap sinks into, a flat ring for the glow, and the debug
 * wireframe of the press volume.
 * All geometry is in local units with the top face at y = 0 unless an offset is given.
 */
import {ButtonShape, VolumeSpec} from "./ButtonVolume"

const RING_SEGMENTS = 48
// Thickness of the well's floor: the bottom face sits this far below it, never coplanar (no z-fighting).
const WELL_FLOOR_THICKNESS = 0.1
const CORNER_SEGMENTS = 10

/** Footprint outline (XZ), counter-clockwise seen from +Y, shrunk by `inset`. */
export function footprint(shape: ButtonShape, size: vec2, inset: number, corner: number): vec2[] {
  const pts: vec2[] = []
  if (shape === ButtonShape.Cylinder) {
    const r = Math.max(size.x / 2 - inset, 0.001)
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2
      pts.push(new vec2(Math.cos(a) * r, Math.sin(a) * r))
    }
    return pts
  }
  const hx = Math.max(size.x / 2 - inset, 0.001)
  const hz = Math.max(size.y / 2 - inset, 0.001)
  const cr = Math.max(Math.min(corner - inset, hx, hz), 0)
  const centres = [new vec2(hx - cr, hz - cr), new vec2(-hx + cr, hz - cr), new vec2(-hx + cr, -hz + cr), new vec2(hx - cr, -hz + cr)]
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < CORNER_SEGMENTS; i++) {
      const a = ((c + i / (CORNER_SEGMENTS - 1)) * Math.PI) / 2
      pts.push(new vec2(centres[c].x + Math.cos(a) * cr, centres[c].y + Math.sin(a) * cr))
    }
  }
  return pts
}

function newBuilder(topology: MeshTopology): MeshBuilder {
  const builder = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  builder.topology = topology
  builder.indexType = MeshIndexType.UInt16
  return builder
}

function finish(builder: MeshBuilder, verts: number[], indices: number[]): RenderMesh {
  builder.appendVerticesInterleaved(verts)
  builder.appendIndices(indices)
  builder.updateMesh()
  return builder.getMesh()
}

/**
 * A slab from y = -height to y = 0 with a rounded top edge of radius `bevel`.
 * `corner` is the footprint corner radius for box shapes. With `planarUV` the texture coordinates are
 * the footprint position (u along x, v along z, 0..1 across `size`), so a texture lies flat on the top face.
 */
export function buildSlab(shape: ButtonShape, size: vec2, height: number, bevel: number, corner: number, planarUV: boolean = false): RenderMesh {
  const builder = newBuilder(MeshTopology.Triangles)
  const verts: number[] = []
  const indices: number[] = []
  const b = Math.max(Math.min(bevel, height * 0.9, Math.min(size.x, size.y) * 0.45), 0)
  const steps = 6
  const rings: {inset: number; y: number; nUp: number; nOut: number}[] = [{inset: 0, y: -height, nUp: 0, nOut: 1}]
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * (Math.PI / 2)
    rings.push({inset: b * (1 - Math.cos(t)), y: -b + b * Math.sin(t), nUp: Math.sin(t), nOut: Math.cos(t)})
  }
  const base = footprint(shape, size, 0, corner)
  const n = base.length
  for (const ring of rings) {
    const outline = footprint(shape, size, ring.inset, corner)
    for (let i = 0; i < n; i++) {
      const p = outline[i]
      const o = base[i].normalize()
      const u = planarUV ? p.x / size.x + 0.5 : i / n
      const v = planarUV ? 0.5 - p.y / size.y : ring.nUp
      verts.push(p.x, ring.y, p.y, o.x * ring.nOut, ring.nUp, o.y * ring.nOut, u, v)
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = r * n + i
      const bb = r * n + ((i + 1) % n)
      indices.push(a, a + n, bb, bb, a + n, bb + n)
    }
  }
  // Top and bottom caps (fans).
  const top = verts.length / 8
  verts.push(0, 0, 0, 0, 1, 0, 0.5, 0.5)
  const lastRing = (rings.length - 1) * n
  for (let i = 0; i < n; i++) indices.push(top, lastRing + ((i + 1) % n), lastRing + i)
  const bottom = verts.length / 8
  verts.push(0, -height, 0, 0, -1, 0, 0.5, 0.5)
  for (let i = 0; i < n; i++) indices.push(bottom, i, (i + 1) % n)
  return finish(builder, verts, indices)
}

/**
 * A holed base ("well") for a cap of footprint `size`: a bezel (frame) at y = 0 with an opening that
 * matches the cap plus `clearance`, `bezelWidth` wide; inner walls down to y = -depth; a floor at the
 * bottom of the well; an outer skirt and a bottom face just below the floor, so it is a closed solid.
 * `corner` is the cap's footprint corner radius (box shapes); the opening and the outline follow it.
 */
export function buildWell(shape: ButtonShape, size: vec2, clearance: number, bezelWidth: number, depth: number, corner: number): RenderMesh {
  const builder = newBuilder(MeshTopology.Triangles)
  const verts: number[] = []
  const indices: number[] = []
  // footprint() grows the corner radius by the (negative) inset itself, so the outlines stay concentric.
  const opening = footprint(shape, size, -clearance, corner)
  const outer = footprint(shape, size, -(clearance + bezelWidth), corner)
  const n = opening.length
  const fullX = size.x + 2 * (clearance + bezelWidth)
  const fullZ = size.y + 2 * (clearance + bezelWidth)
  const uv = (p: vec2): [number, number] => [p.x / fullX + 0.5, 0.5 - p.y / fullZ]
  const ring = (pts: vec2[], y: number, normal: (i: number) => vec3): number => {
    const start = verts.length / 8
    for (let i = 0; i < n; i++) {
      const nm = normal(i)
      const [u, v] = uv(pts[i])
      verts.push(pts[i].x, y, pts[i].y, nm.x, nm.y, nm.z, u, v)
    }
    return start
  }
  const up = () => new vec3(0, 1, 0)
  const down = () => new vec3(0, -1, 0)
  const outward = (pts: vec2[]) => (i: number) => {
    const o = pts[i].length > 0 ? pts[i].normalize() : new vec2(1, 0)
    return new vec3(o.x, 0, o.y)
  }
  const inward = (pts: vec2[]) => (i: number) => {
    const o = outward(pts)(i)
    return new vec3(-o.x, 0, -o.z)
  }
  // Quads between two rings of n points (a -> b), wound so the face looks along `flip`.
  const strip = (a: number, b: number, flip: boolean) => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      if (flip) indices.push(a + i, b + i, a + j, a + j, b + i, b + j)
      else indices.push(a + i, a + j, b + i, a + j, b + j, b + i)
    }
  }
  // Bezel top: opening -> outline, facing +Y.
  strip(ring(opening, 0, up), ring(outer, 0, up), true)
  const bottomY = -depth - WELL_FLOOR_THICKNESS
  // Outer skirt: top -> bottom, facing outward.
  strip(ring(outer, 0, outward(outer)), ring(outer, bottomY, outward(outer)), true)
  // Inner walls of the well: top -> bottom, facing inward (toward the cap).
  strip(ring(opening, 0, inward(opening)), ring(opening, -depth, inward(opening)), false)
  // Floor of the well (fan, facing +Y) and the bottom face (fan, facing -Y).
  const floorRing = ring(opening, -depth, up)
  const floorCentre = verts.length / 8
  verts.push(0, -depth, 0, 0, 1, 0, 0.5, 0.5)
  for (let i = 0; i < n; i++) indices.push(floorCentre, floorRing + ((i + 1) % n), floorRing + i)
  const bottomRing = ring(outer, bottomY, down)
  const bottomCentre = verts.length / 8
  verts.push(0, bottomY, 0, 0, -1, 0, 0.5, 0.5)
  for (let i = 0; i < n; i++) indices.push(bottomCentre, bottomRing + i, bottomRing + ((i + 1) % n))
  return finish(builder, verts, indices)
}

/** A flat ring (annulus) at height `y`, facing +Y: from the footprint shrunk by `inner` to `outer` larger. */
export function buildRing(shape: ButtonShape, size: vec2, y: number, inner: number, outer: number, corner: number): RenderMesh {
  const builder = newBuilder(MeshTopology.Triangles)
  const verts: number[] = []
  const indices: number[] = []
  const a = footprint(shape, size, inner, corner)
  const b = footprint(shape, size, -outer, corner + outer)
  const n = a.length
  for (let i = 0; i < n; i++) verts.push(a[i].x, y, a[i].y, 0, 1, 0, i / n, 0)
  for (let i = 0; i < n; i++) verts.push(b[i].x, y, b[i].y, 0, 1, 0, i / n, 1)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(i, j, n + i, j, n + j, n + i)
  }
  return finish(builder, verts, indices)
}

/** Debug: the press volume (top, bottom, hover top) as lines on a child of `parent`. */
export function buildVolumeWireframe(parent: SceneObject, spec: VolumeSpec, material: Material | null): SceneObject {
  const builder = newBuilder(MeshTopology.Lines)
  const verts: number[] = []
  const indices: number[] = []
  const outline = footprint(spec.shape, spec.size, 0, Math.min(spec.size.x, spec.size.y) * 0.2)
  const n = outline.length
  const levels = [spec.hoverHeight, 0, -spec.travel]
  for (const y of levels) {
    const start = verts.length / 8
    for (let i = 0; i < n; i++) verts.push(outline[i].x, y, outline[i].y, 0, 1, 0, 0, 0)
    for (let i = 0; i < n; i++) indices.push(start + i, start + ((i + 1) % n))
  }
  const step = Math.max(1, Math.floor(n / 8))
  for (let i = 0; i < n; i += step) indices.push(i, 2 * n + i)
  const child = global.scene.createSceneObject("Agnostic3DButton Debug Volume")
  child.setParent(parent)
  const visual = child.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  visual.mesh = finish(builder, verts, indices)
  if (material) visual.mainMaterial = material
  return child
}
