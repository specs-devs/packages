/**
 * Example only: a lava lamp. Six blobs heat up at the bottom (they swell), rise, cool at the top (they
 * shrink) and sink again, merging and splitting on the way — all one MetaballField with the Lava preset.
 * The glass column and the caps are built at runtime with MeshBuilder; assign `glassMaterial` /
 * `capMaterial` to show them (both optional).
 */
import {MetaballField} from "../../Scripts/MetaballField"
import {MetaballSource} from "../../Scripts/MetaballSource"

const SEGMENTS = 32

@component
export class LavaLamp extends BaseScriptComponent {
  @input
  @hint("Field the blobs belong to (Lava preset)")
  field: MetaballField

  @input
  @allowUndefined
  @hint("Transparent material for the glass column (optional)")
  glassMaterial: Material

  @input
  @allowUndefined
  @hint("Material for the base and the top cap (optional)")
  capMaterial: Material

  @input
  @hint("Number of blobs (max 8 per field)")
  @widget(new SliderWidget(1, 8, 1))
  count: number = 6

  @input
  @hint("Inner height of the column (cm)")
  height: number = 30

  @input
  @hint("Inner radius of the column (cm)")
  columnRadius: number = 6.5

  @input
  @hint("Base blob radius (cm)")
  blobRadius: number = 2.6

  @input
  @hint("Speed multiplier")
  speed: number = 1

  private blobs: {source: MetaballSource; speed: number; phase: number; wander: number; size: number}[] = []

  onAwake(): void {
    const n = Math.max(1, Math.min(8, Math.round(this.count)))
    for (let i = 0; i < n; i++) {
      const o = global.scene.createSceneObject("Blob" + i)
      o.setParent(this.sceneObject)
      const source = o.createComponent(MetaballSource.getTypeName()) as MetaballSource
      source.field = this.field
      source.radius = this.blobRadius
      this.blobs.push({source, speed: 0.05 + 0.035 * ((i * 7) % 5), phase: i / n, wander: 1.3 + (i % 3) * 0.6, size: 0.8 + 0.45 * ((i * 3) % 4) / 3})
    }
    if (this.glassMaterial) {
      this.addMesh("Glass", this.tube(this.columnRadius + 0.6, -this.height / 2, this.height / 2, false), this.glassMaterial)
    }
    if (this.capMaterial) {
      this.addMesh("Base", this.tube(this.columnRadius + 1.6, -this.height / 2 - 5, -this.height / 2, true), this.capMaterial)
      this.addMesh("Cap", this.tube(this.columnRadius + 1.0, this.height / 2, this.height / 2 + 3, true), this.capMaterial)
    }
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private update(): void {
    const t = getTime() * this.speed
    const halfH = this.height / 2
    for (const b of this.blobs) {
      // 0 = bottom, 1 = top, eased so blobs linger at both ends like real wax.
      const cycle = 0.5 - 0.5 * Math.cos(Math.PI * 2 * (t * b.speed + b.phase))
      const r = this.blobRadius * b.size * (1.25 - 0.5 * cycle)
      const y = -halfH + r + (this.height - 2 * r) * cycle
      const room = Math.max(0, this.columnRadius - r - 0.3)
      const x = Math.sin(t * 0.37 * b.wander + b.phase * 9) * room * 0.75
      const z = Math.cos(t * 0.29 * b.wander + b.phase * 5) * room * 0.6
      b.source.getTransform().setLocalPosition(new vec3(x, y, z))
      b.source.radius = r
    }
  }

  private addMesh(name: string, mesh: RenderMesh, material: Material): void {
    const o = global.scene.createSceneObject(name)
    o.setParent(this.sceneObject)
    const visual = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    visual.mainMaterial = material
  }

  /** An upright cylinder from y0 to y1; `closed` adds the end discs. */
  private tube(radius: number, y0: number, y1: number, closed: boolean): RenderMesh {
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
      {name: "texture0", components: 2}
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    const verts: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2
      const cx = Math.cos(a)
      const cz = Math.sin(a)
      verts.push(cx * radius, y0, cz * radius, cx, 0, cz, i / SEGMENTS, 0)
      verts.push(cx * radius, y1, cz * radius, cx, 0, cz, i / SEGMENTS, 1)
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const k = i * 2
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
    if (closed) {
      for (const [y, ny] of [
        [y0, -1],
        [y1, 1]
      ]) {
        const centre = verts.length / 8
        verts.push(0, y, 0, 0, ny, 0, 0.5, 0.5)
        for (let i = 0; i <= SEGMENTS; i++) {
          const a = (i / SEGMENTS) * Math.PI * 2
          verts.push(Math.cos(a) * radius, y, Math.sin(a) * radius, 0, ny, 0, 0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a))
        }
        for (let i = 0; i < SEGMENTS; i++) {
          if (ny > 0) {
            indices.push(centre, centre + 2 + i, centre + 1 + i)
          } else {
            indices.push(centre, centre + 1 + i, centre + 2 + i)
          }
        }
      }
    }
    builder.appendVerticesInterleaved(verts)
    builder.appendIndices(indices)
    builder.updateMesh()
    return builder.getMesh()
  }
}
