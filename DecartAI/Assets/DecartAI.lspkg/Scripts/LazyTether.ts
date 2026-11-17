/**
 * LazyTether — soft follow behavior for world-space content.
 *
 * Keeps this SceneObject at `distanceCm` in front of the camera, but only
 * re-positions when the user has looked away more than `deadzoneDegrees`
 * (or walked more than `distanceToleranceCm`), then eases into place and
 * settles. Yaw-only: the content stays at eye height and never tilts.
 *
 * This is the classic "lazy tether" — content feels anchored in the room,
 * not glued to your face, which reads much better on camera captures.
 */
@component
export class LazyTether extends BaseScriptComponent {
  @input
  @hint('Camera (or any object) to follow')
  cameraObject: SceneObject

  @input('number', '80')
  @hint('Resting distance in front of the camera, cm')
  distanceCm: number = 80

  @input('number', '0')
  @hint('Vertical offset from eye height, cm')
  heightOffsetCm: number = 0

  @input('number', '12')
  @hint('Start following once the view direction is more than this many degrees off the content')
  deadzoneDegrees: number = 12

  @input('number', '30')
  @hint('Also start following when the distance drifts by more than this, cm (walking)')
  distanceToleranceCm: number = 30

  @input('number', '4')
  @hint('Follow smoothing — higher is snappier, lower is floatier')
  smoothing: number = 4

  private t: Transform
  private camT: Transform
  private following = false

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      if (isNull(this.cameraObject)) {
        print('[LazyTether] cameraObject @input is not wired')
        return
      }
      this.t = this.sceneObject.getTransform()
      this.camT = this.cameraObject.getTransform()
      this.snapToTarget()
    })
    this.createEvent('UpdateEvent').bind(() => this.update())
  }

  /** Camera view direction projected onto the ground plane. */
  private viewDirFlat(): vec3 {
    const dir = this.camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const flat = new vec3(dir.x, 0, dir.z)
    return flat.length < 0.001 ? new vec3(0, 0, -1) : flat.normalize()
  }

  private targetPos(): vec3 {
    const camPos = this.camT.getWorldPosition()
    const p = camPos.add(this.viewDirFlat().uniformScale(this.distanceCm))
    return new vec3(p.x, camPos.y + this.heightOffsetCm, p.z)
  }

  /** Yaw-only rotation so the content's +Z face points back at the camera. */
  private faceCameraRotation(pos: vec3): quat {
    const d = this.camT.getWorldPosition().sub(pos)
    const yaw = Math.atan2(d.x, d.z) // radians; 0 = +Z at camera
    return quat.angleAxis(yaw, vec3.up())
  }

  private snapToTarget(): void {
    const pos = this.targetPos()
    this.t.setWorldPosition(pos)
    this.t.setWorldRotation(this.faceCameraRotation(pos))
  }

  private update(): void {
    if (!this.t || !this.camT) {
      return
    }
    const dt = getDeltaTime()
    const pos = this.t.getWorldPosition()
    const camPos = this.camT.getWorldPosition()
    const target = this.targetPos()

    const offset = new vec3(pos.x - camPos.x, 0, pos.z - camPos.z)
    const offsetDir = offset.length < 0.001 ? new vec3(0, 0, -1) : offset.normalize()
    const cosAngle = Math.max(-1, Math.min(1, offsetDir.dot(this.viewDirFlat())))
    const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI
    const drift = Math.abs(offset.length - this.distanceCm) + Math.abs(pos.y - target.y)

    if (!this.following && (angleDeg > this.deadzoneDegrees || drift > this.distanceToleranceCm)) {
      this.following = true
    }
    if (!this.following) {
      return
    }

    const k = 1 - Math.exp(-this.smoothing * dt)
    const next = vec3.lerp(pos, target, k)
    this.t.setWorldPosition(next)
    this.t.setWorldRotation(quat.slerp(this.t.getWorldRotation(), this.faceCameraRotation(next), k))

    if (next.distance(target) < 2 && angleDeg < 2) {
      this.following = false // settled — stop chasing until the next deadzone breach
    }
  }
}
