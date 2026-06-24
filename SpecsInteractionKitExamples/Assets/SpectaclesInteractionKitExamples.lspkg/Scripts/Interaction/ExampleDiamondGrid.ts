/**
 * ExampleDiamondGrid – spawns a cols×rows isometric diamond-tile grid.
 *
 * Tile centres are placed using the isometric projection formula:
 *
 *   localX = halfX · (i − j)
 *   localY = halfY · (i + j)
 *
 * where (i, j) are centred lattice coordinates. halfX and halfY are derived
 * from the AABB of the rotated cube so the formula is correct for any rotation:
 *
 *   stepX  = extentX · cubeSize + gap          (projected tile width)
 *   stepY  = extentY/2 · cubeSize + gap/2      (interleaved row pitch)
 *   halfX  = stepX / 2,   halfY = stepY / 2
 *
 * At canonical isometric (rotX=35.264°, rotY=45°) extentX=√3 and extentY=2,
 * so halfX = √3/2 · s and halfY = ½ · s — the exact closed-form formula values.
 *
 * The overall grid is rhombus-shaped in screen space:
 *   (0, 0)           → bottom corner
 *   (cols−1, 0)      → right corner
 *   (0, rows−1)      → left corner
 *   (cols−1, rows−1) → top corner
 */
import { bindStartEvent } from "SnapDecorators.lspkg/decorators"

const DEG = Math.PI / 180

@component
export class ExampleDiamondGrid extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">ExampleDiamondGrid – isometric diamond tile grid</span><br/><span style="color: #94A3B8; font-size: 11px;">Tile centres follow X=halfX·(i−j), Y=halfY·(i+j). Step scalars are derived from the rotated cube AABB so tiles are flush at gap=0 for any rotation.</span>')
  @ui.separator

  // ── Prefab ────────────────────────────────────────────────────────────────
  @input("Asset.ObjectPrefab")
  @hint("Cube prefab to instantiate for each tile")
  cubePrefab: ObjectPrefab

  // ── Grid dimensions ───────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Grid")
  @input
  @hint("Tile count along the i-axis (right-upward diagonal in screen space)")
  cols: number = 5

  @input
  @hint("Tile count along the j-axis (left-upward diagonal in screen space)")
  rows: number = 5
  @ui.group_end

  // ── Tile appearance ───────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Tile")
  @input
  @hint("Uniform scale applied to each tile; also sets the isometric unit step s in the formula")
  cubeSize: number = 1

  @input
  @hint("X rotation in degrees — 35.264° with Y=45° is canonical isometric")
  rotX: number = 35.264

  @input
  @hint("Y rotation in degrees")
  rotY: number = 45

  @input
  @hint("Z rotation in degrees")
  rotZ: number = 0

  @input
  @hint("Extra spacing added to cubeSize when computing the step (s = cubeSize + gap). Negative values overlap tiles.")
  gap: number = 0

  @input
  @hint("World-Z depth offset per j-row for depth layering (0 = flat grid)")
  depthStep: number = 0
  @ui.group_end

  // ── Private ───────────────────────────────────────────────────────────────
  private instances: SceneObject[] = []

  @bindStartEvent
  onStart(): void {
    this.spawnGrid()
  }

  /** Destroy all tiles and rebuild the grid. Safe to call at runtime. */
  rebuild(): void {
    this.clearGrid()
    this.spawnGrid()
  }

  private clearGrid(): void {
    for (const inst of this.instances) {
      inst.destroy()
    }
    this.instances = []
  }

  private spawnGrid(): void {
    if (!this.cubePrefab) return

    const rot = quat.fromEulerAngles(
      this.rotX * DEG,
      this.rotY * DEG,
      this.rotZ * DEG
    )

    // Project all 8 corners of a unit cube to find screen-space extents for
    // this rotation. Identical to the classic AABB approach but feeds the formula.
    const signs = [-1, 1]
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    for (const sx of signs) {
      for (const sy of signs) {
        for (const sz of signs) {
          const p = rot.multiplyVec3(new vec3(sx * 0.5, sy * 0.5, sz * 0.5))
          if (p.x < minX) minX = p.x
          if (p.x > maxX) maxX = p.x
          if (p.y < minY) minY = p.y
          if (p.y > maxY) maxY = p.y
        }
      }
    }

    // stepX = full projected tile width; stepY = interleaved row pitch (half height).
    // halfX/halfY are the basis vector scalars for the formula:
    //   X = halfX · (fi − fj),   Y = halfY · (fi + fj)
    // At canonical iso (extentX=√3, extentY=2) this equals (√3/2·s, ½·s) exactly.
    const extentX = (maxX - minX) * this.cubeSize
    const extentY = (maxY - minY) * this.cubeSize

    // halfX/halfY are the per-step scalars for the formula X=halfX·(fi−fj), Y=halfY·(fi+fj).
    // At gap=0 the bottom vertex of each tile exactly touches the top vertex of its
    // diagonal neighbour — no gap, no overlap.
    const halfX = (extentX + this.gap) * 0.5
    const halfY = (extentY + this.gap) * 0.5

    const ci = (this.cols - 1) * 0.5
    const cj = (this.rows - 1) * 0.5

    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const inst = this.cubePrefab.instantiate(this.sceneObject)
        const tx = inst.getTransform()

        const fi = i - ci
        const fj = j - cj

        tx.setLocalPosition(new vec3(
          halfX * (fi - fj),
          halfY * (fi + fj),
          j * this.depthStep
        ))
        tx.setLocalRotation(rot)
        tx.setLocalScale(new vec3(this.cubeSize, this.cubeSize, this.cubeSize))

        this.instances.push(inst)
      }
    }
  }
}
