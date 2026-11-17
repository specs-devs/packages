/**
 * SPECS Inc. 2027
 * Shared by the Ground and Wall modes: aims the hit test along the gaze, holds the indicator in
 * front of the camera while nothing is hit, and eases it toward the pose found.
 */
const SPEED = 8; // Interpolation speed

// How far the horizontal hit test aims below the gaze. Exported so a mode
// predicting where that ray lands cannot drift out of sync with it.
export const HORIZONTAL_RAY_DOWN_TILT = 0.1;

@component
export class SingleSurface extends BaseScriptComponent {
  desiredPosition = vec3.zero();
  desiredRotation = quat.quatIdentity();

  useDefaultHeight = true;
  lastGroundHeight = 0;

  private trans!: Transform;
  private cameraTransform!: Transform;
  private screenDistance: number = 0;

  init(camTrans: Transform, transform: Transform, screenDist: number) {
    this.cameraTransform = camTrans;
    this.trans = transform;
    this.screenDistance = screenDist;
    this.setDefaultPose();
  }

  startCalibration() {
    this.useDefaultHeight = true;
    this.lastGroundHeight = 0;
    this.desiredPosition = vec3.zero();
    this.desiredRotation = quat.quatIdentity();
  }

  setDefaultPose() {
    this.desiredPosition = this.cameraTransform
      .getWorldPosition()
      .add(this.cameraTransform.forward.uniformScale(-this.screenDistance));
    this.desiredRotation = this.cameraTransform.getWorldRotation();
    this.trans.setWorldPosition(this.desiredPosition);
    this.trans.setWorldRotation(this.desiredRotation);
  }

  runHitTest(
    hitTestSession: HitTestSession,
    min: number,
    max: number,
    isHorizontal: boolean,
    onHitTestResult: (hitTestResult: any) => void,
  ) {
    const rayDirection = this.cameraTransform.forward;
    if (isHorizontal) rayDirection.y += HORIZONTAL_RAY_DOWN_TILT; // slight downward angle
    const camPos = this.cameraTransform.getWorldPosition();
    const rayStart = camPos.add(rayDirection.uniformScale(-min));
    const rayEnd = camPos.add(rayDirection.uniformScale(-max));

    if (hitTestSession != null) {
      hitTestSession.hitTest(rayStart, rayEnd, (hitTestResult) => {
        onHitTestResult(hitTestResult);
      });
    }
  }

  interpolatePositionVisuals() {
    this.trans.setWorldPosition(
      vec3.lerp(
        this.trans.getWorldPosition(),
        this.desiredPosition,
        getDeltaTime() * SPEED,
      ),
    );
    this.trans.setWorldRotation(
      quat.slerp(
        this.trans.getWorldRotation(),
        this.desiredRotation,
        getDeltaTime() * SPEED,
      ),
    );
  }
}
