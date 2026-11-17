/**
 * SPECS Inc. 2027
 * Demo only (not part of the package): moves the demo objects so phones watching the room
 * see something change. Spins, bobs or orbits this SceneObject around its start pose.
 */
@component
export class SpectatorDemoMotion extends BaseScriptComponent {
  @input
  @hint("Motion applied to this object")
  @widget(new ComboBoxWidget([new ComboBoxItem("Spin", "spin"), new ComboBoxItem("Bob", "bob"), new ComboBoxItem("Orbit", "orbit")]))
  motion: string = "spin"

  @input("float")
  @hint("Cycles per second")
  speed: number = 0.25

  @input("float")
  @hint("Bob height or orbit radius in cm")
  amplitude: number = 10

  private start = vec3.zero()
  private startRotation = quat.quatIdentity()
  private time = 0

  onAwake(): void {
    const t = this.getTransform()
    this.start = t.getLocalPosition()
    this.startRotation = t.getLocalRotation()
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private tick(): void {
    this.time += getDeltaTime()
    const angle = this.time * this.speed * Math.PI * 2
    const t = this.getTransform()
    if (this.motion === "spin") {
      t.setLocalRotation(quat.angleAxis(angle, vec3.up()).multiply(this.startRotation))
    } else if (this.motion === "bob") {
      t.setLocalPosition(this.start.add(new vec3(0, (Math.sin(angle) * 0.5 + 0.5) * this.amplitude, 0)))
    } else {
      t.setLocalPosition(this.start.add(new vec3(Math.cos(angle) * this.amplitude, 0, Math.sin(angle) * this.amplitude)))
      t.setLocalRotation(quat.angleAxis(-angle, vec3.up()).multiply(this.startRotation))
    }
  }
}
