# WebSocketExamples examples

[← Agent usage index](../README.md)

## Use when

Use typed readiness checks and offline rotation before claiming network success.

## Prefab path

Place [WebSocketExamples__PLACE_IN_SCENE.prefab](../WebSocketExamples__PLACE_IN_SCENE.prefab). Configure URLs and assigned InternetModule/Text/cube references. Set IMUCube.camObj only if camera following is desired. Required server/board steps live in [Hardware](hardware.md).

## Send when open

Assign an existing TextEcho; its Awake/Start owns the socket. This observer checks readiness every frame and sends once per consumer instance. It does not guess that two seconds guarantees connection or retry automatically.

```typescript
import {TextEcho} from "WebSocketExamples.lspkg/Scripts/TextEcho"
@component
export class EchoWhenOpen extends BaseScriptComponent {
  @input echo!: TextEcho
  private sent = false
  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.sent && this.echo.getConnectionStatus().isConnected) {
        this.echo.sendMessage("Hello from Specs")
        this.sent = true
      }
    })
  }
}
```

sendMessage has no delivery acknowledgement. Call `echo.reconnect()` only on a deliberate retry action; neither sample retries automatically.

## Offline finite rotation and reset

Assign an existing initialized IMUCube, with network receiver disabled for this isolated check so sensor messages do not immediately overwrite the test pose. Follow optional camera assignment only if intended.

```typescript
import {IMUCube} from "WebSocketExamples.lspkg/Scripts/IMUCube"
@component
export class LocalCubeCheck extends BaseScriptComponent {
  @input cube!: IMUCube
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      const angles = [20, 35, -10]
      if (angles.length === 3 && angles.every(Number.isFinite)) {
        this.cube.setRotationAngle(angles)
        print("Euler degrees: " + this.cube.getCurrentRotation().join(","))
      }
      const reset = this.createEvent("DelayedCallbackEvent")
      reset.bind(() => this.cube.resetRotation())
      reset.reset(2)
    })
  }
}
```

This tests public transform API, not sensor parsing or a physical server. Query returns Euler derived from desired quaternion, not the original input representation or current externally edited transform.

## Observe IMU readiness

```typescript
import {IMUData} from "WebSocketExamples.lspkg/Scripts/IMUData"
@component
export class ImuReadyLabel extends BaseScriptComponent {
  @input imu!: IMUData
  @input statusText!: Text
  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      const status = this.imu.getConnectionStatus()
      this.statusText.text = status.isConnected ? "IMU socket open" : "IMU setup/connection pending"
    })
  }
}
```

Use a separate statusText rather than overwriting IMUData.screenText's diagnostics. Socket open does not confirm valid angle packets. No public IMU message callback is provided; extending parsing requires a separately authorized source change.
