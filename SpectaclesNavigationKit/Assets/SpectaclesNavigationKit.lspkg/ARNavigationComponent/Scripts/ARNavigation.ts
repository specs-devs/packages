/**
 * Specs Inc. 2026
 * AR navigation display controller for directional arrow and distance text. Shows real-time direction
 * to selected places from NavigationDataComponent, distance measurements in metric or US units, smooth
 * arrow rotation with slerp interpolation, arrival detection with check sign indicator, and dynamic
 * visibility management based on navigation state and user proximity thresholds.
 */
import {unsubscribe} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {NavigationDataComponent} from "../../NavigationDataComponent/NavigationDataComponent"
import {Place} from "../../NavigationDataComponent/Place"
import {UserPosition} from "../../NavigationDataComponent/UserPosition"

enum MeasurementSystem {
  Metric = 0,
  US = 1,
}

const log = new NativeLogger("ARNavigation")

/**
 * Controls an arrow and distance text that displays the direction to go to the selected {@link NavigationDataComponent}
 * target.
 *
 * @version 1.0.0
 */
@component
export class ARNavigation extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Navigation Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Navigation data source and target settings</span>')

  @input
  private navigationDataComponent: NavigationDataComponent

  @input
  private targetPivot: SceneObject

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Visual Elements</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Arrow, check sign, and distance text components</span>')

  @input
  @hint("The arrow showing the direction to the selected place.")
  private arrowRenderMeshVisual: RenderMeshVisual
  @input
  @hint("The check sign indicating the user reached the destination.")
  private checkSignMeshVisual: RenderMeshVisual

  @input
  @hint("The text showing the distance to the selected place.")
  private distanceTexts: Text[]

  @input
  @allowUndefined
  @hint("The text showing the name of the selected place.")
  private placeNameText: Text

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Display Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Measurement system, visibility, and arrival detection</span>')

  @input("int")
  @widget(new ComboBoxWidget([new ComboBoxItem("Metric", 0), new ComboBoxItem("US", 1)]))
  measurementSystem: MeasurementSystem = MeasurementSystem.Metric

  @input
  private showByDefault: boolean = false

  @input
  @hint("When within this radius, the arrow will no longer show a direction.")
  public hereRadius: number = 3

  private targetPivotTransform: Transform
  private selectedPlace: Place | null = null
  private userPosition: UserPosition | null = null

  private switchUpdateEvent: UpdateEvent | null = null
  private switchDuration = 2
  private switchTimer = 0

  private smoothArrowRotationUpdate: UpdateEvent | null = null

  private initialArrowScale: vec3
  private initialArrowRotation: quat
  private initialCheckSignScale: vec3
  private initialCheckSignRotation: quat
  private initialCheckSignPosition: vec3

  private arrowTransform: Transform
  private checkSignTransform: Transform

  private delayedResetEvent: DelayedCallbackEvent | null = null

  private userUpdateUnsubscribe: unsubscribe

  public blockActivation: boolean = false

  private onAwake(): void {
    if (this.arrowRenderMeshVisual === null) {
      log.e("Arrow RenderMeshVisual not set")
      return
    }

    if (this.navigationDataComponent === null) {
      log.e("NavigationDataComponent not set")
      return
    }

    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))

    // Prepare event for switching smoothly to the destinationReached object
    this.switchUpdateEvent = this.createEvent("UpdateEvent")
    this.switchUpdateEvent.bind(this.onSwitchToDestinationReachedUpdate.bind(this))
    this.switchUpdateEvent.enabled = false

    // Prepare reset after a delay
    this.delayedResetEvent = this.createEvent("DelayedCallbackEvent")
    this.delayedResetEvent.bind(this.reset.bind(this))

    // Prepare event for updating the arrow rotation
    this.smoothArrowRotationUpdate = this.createEvent("UpdateEvent")
    this.smoothArrowRotationUpdate.bind(() => {
      this.onUserPositionUpdated()
      this.smoothArrowRotationUpdateCallback()
    })
    this.smoothArrowRotationUpdate.enabled = false

    // Disable navigation objects at start
    this.arrowRenderMeshVisual.sceneObject.enabled = false
    this.checkSignMeshVisual.sceneObject.enabled = false

    // Clone materials to avoid issues with shared materials
    if (!isNull(this.arrowRenderMeshVisual.mainMaterial)) {
      this.arrowRenderMeshVisual.mainMaterial = this.arrowRenderMeshVisual.mainMaterial.clone()
    }
    if (!isNull(this.checkSignMeshVisual.mainMaterial)) {
      this.checkSignMeshVisual.mainMaterial = this.checkSignMeshVisual.mainMaterial.clone()
    }

    this.checkSignTransform = this.checkSignMeshVisual.getTransform()
    this.arrowTransform = this.arrowRenderMeshVisual.getTransform()

    this.initialArrowRotation = this.arrowTransform.getLocalRotation()
    this.initialCheckSignRotation = this.checkSignTransform.getLocalRotation()

    // Store initial values
    this.initialArrowScale = this.arrowTransform.getLocalScale()
    this.initialCheckSignScale = this.checkSignTransform.getLocalScale()
    this.initialCheckSignPosition = this.checkSignTransform.getLocalPosition()

    this.targetPivotTransform = this.targetPivot.getTransform()
  }

  private onStart(): void {
    this.userPosition = this.navigationDataComponent.getUserPosition()

    this.navigationDataComponent.onNavigationStarted.add(this.onPlaceSelected.bind(this))
    this.navigationDataComponent.onArrivedAtPlace.add(this.onDestinationReached.bind(this))

    if (this.showByDefault) {
      this.setVisible(true)
    }
  }

  public setVisible(visible: boolean): void {
    if (this.blockActivation) {
      return
    }

    this.showByDefault = visible
    this.arrowRenderMeshVisual.sceneObject.enabled = visible
    this.smoothArrowRotationUpdate.enabled = visible

    this.setTextVisible(visible)
  }

  private onPlaceSelected(place: Place): void {
    this.reset()
    this.selectedPlace = place
    if (!isNull(this.placeNameText)) {
      this.placeNameText.text = place?.name ?? ""
    }

    this.setVisible(this.selectedPlace !== null)
  }

  private targetRotation: quat = quat.quatIdentity()

  private onUserPositionUpdated(): void {
    if (this.selectedPlace === null || this.userPosition === null) {
      return
    }

    const angle = this.userPosition.getBearingTo(this.selectedPlace, true)
    const distance = this.userPosition.getDistanceTo(this.selectedPlace)
    const placePosition = this.selectedPlace.getRelativePosition()

    if (isNull(placePosition)) {
      return
    }

    const vertical = placePosition.y - this.userPosition.getRelativeTransform().getWorldPosition().y

    const absVertical = Math.abs(vertical)
    let verticalText = ""
    if (absVertical > 180) {
      const upText = absVertical > 0 ? " up)" : " down)"
      verticalText = "\n(" + this.getFormattedDistance(vertical / 100) + upText
    }

    const text = this.getFormattedDistance(distance) + verticalText

    for (const distanceText of this.distanceTexts) {
      distanceText.text = text
    }

    this.targetRotation = quat.angleAxis(-angle, vec3.up())
  }

  private smoothArrowRotationUpdateCallback(): void {
    let animatedTarget = this.targetRotation
    const distanceCheck = this.userPosition.getDistanceTo(this.selectedPlace) < this.hereRadius
    if (distanceCheck) {
      const down = quat.angleAxis(1.571, vec3.left())
      const spin = quat.angleAxis(getTime(), vec3.forward())
      animatedTarget = down.multiply(spin)
    }
    this.setTextVisible(!distanceCheck)

    const smoothedRotation = quat.slerp(
      this.targetPivotTransform.getWorldRotation(),
      animatedTarget,
      getDeltaTime() * 10,
    )
    this.targetPivotTransform.setWorldRotation(smoothedRotation)
  }

  /**
   * Called when the user has reached the destination.
   * Prepare the elements that will be updated during the switch.
   */
  private onDestinationReached(): void {
    // The arrow will fade out during the switch
    this.arrowRenderMeshVisual.mainPass.alpha = 1

    // The checkSign object will scale up during the switch.
    this.checkSignMeshVisual.mainPass.alpha = 0
    this.checkSignMeshVisual.sceneObject.enabled = true
    this.checkSignTransform.setLocalScale(vec3.zero())

    this.smoothArrowRotationUpdate.enabled = false

    this.distanceTexts.forEach((m) => {
      m.sceneObject.enabled = false
    })

    // Remove user update callback
    if (!isNull(this.userUpdateUnsubscribe)) {
      this.userUpdateUnsubscribe()
    }

    this.switchUpdateEvent.enabled = true
  }

  /**
   * Smoothly switch to the destination reached object. The arrow fades out and the destination reached object scales up.
   * This function is called every frame until the switch is complete.
   */
  private onSwitchToDestinationReachedUpdate(): void {
    this.switchTimer += getDeltaTime()

    if (this.switchTimer >= this.switchDuration) {
      this.switchTimer = 0
      this.switchUpdateEvent.enabled = false

      // Hide everything after a delay
      this.delayedResetEvent.reset(3)
    } else {
      const t = this.easeInOutCubic(this.switchTimer / this.switchDuration)

      // Opacity
      this.arrowRenderMeshVisual.mainPass.alpha = 1 - t
      this.checkSignMeshVisual.mainPass.alpha = t

      // Rotation
      const arrowRotation = quat.angleAxis(4 * Math.PI * t, vec3.up()).multiply(this.initialArrowRotation)
      this.arrowTransform.setLocalRotation(arrowRotation)

      const checkSignRotation = quat
        .angleAxis(4 * Math.PI * (1 - t), vec3.forward())
        .multiply(this.initialCheckSignRotation)
      this.checkSignTransform.setLocalRotation(checkSignRotation)

      // Scale
      this.checkSignTransform.setLocalScale(this.initialCheckSignScale.uniformScale(t))
      this.arrowTransform.setLocalScale(this.initialArrowScale.uniformScale(1 - t))

      // Position
      this.checkSignTransform.setLocalPosition(
        vec3.lerp(this.initialCheckSignPosition, this.initialCheckSignPosition.add(vec3.up().uniformScale(1)), t),
      )
    }
  }

  private reset(): void {
    // Reset the arrow and checkSign objects
    this.arrowRenderMeshVisual.sceneObject.enabled = false
    this.checkSignMeshVisual.sceneObject.enabled = false
    this.arrowRenderMeshVisual.mainPass.alpha = 1
    this.checkSignMeshVisual.mainPass.alpha = 0

    this.arrowTransform.setLocalScale(this.initialArrowScale)
    this.arrowTransform.setLocalRotation(this.initialArrowRotation)
    this.checkSignTransform.setLocalScale(this.initialCheckSignScale)
    this.checkSignTransform.setLocalPosition(this.initialCheckSignPosition)
    this.checkSignTransform.setLocalRotation(this.initialCheckSignRotation)

    this.switchUpdateEvent.enabled = false
    this.switchTimer = 0

    this.smoothArrowRotationUpdate.enabled = false

    // Avoid several delayed resets to be chained
    this.delayedResetEvent.cancel()
  }

  private easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  }

  private getFormattedDistance(distance: number | null): string {
    let result = ""

    if (isNull(distance)) {
      return result
    }

    if (this.measurementSystem === MeasurementSystem.Metric) {
      if (distance < 1000) {
        result = distance.toFixed(0) + "m"
      } else {
        result = (distance / 1000).toFixed(1) + "km"
      }
    } else {
      const feetDistance = distance * 3.28084
      if (feetDistance < 1609.34) {
        result = feetDistance.toFixed(0) + "ft"
      } else {
        result = (feetDistance / 1609.34).toFixed(1) + "mi"
      }
    }

    return result
  }

  private setTextVisible(visible: boolean): void {
    this.distanceTexts.forEach((m) => {
      m.sceneObject.enabled = visible
    })
    if (!isNull(this.placeNameText)) {
      this.placeNameText.sceneObject.enabled = visible
    }
  }
}
