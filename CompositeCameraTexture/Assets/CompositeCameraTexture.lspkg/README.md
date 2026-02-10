![CompositeCameraTexture](AssetImage/CompositeCameraTexture.png)

# Composite Camera Texture

A comprehensive camera feed management system for compositing multiple camera inputs on Spectacles. This package provides CameraModule integration, texture provider control, frame event handling, and CropTextureProvider connectivity for creating multi-camera AR experiences, picture-in-picture effects, and advanced camera processing pipelines.

## Features

- **Camera Module Integration**: Access device cameras (left, right, default)
- **Texture Provider Control**: Manage camera texture providers with frame callbacks
- **Crop Texture Support**: Apply CropTextureProvider for region-of-interest extraction
- **Editor/Device Switching**: Automatic camera selection based on platform
- **Frame Event Handling**: React to new camera frames for processing
- **Resolution Control**: Configure camera resolution and quality settings
- **Multi-Camera Support**: Combine multiple camera feeds in single experience
- **Adaptive Resolution**: Dynamic resolution adjustment for editor vs device

## Quick Start

Set up a basic camera texture feed:

```typescript
import {CameraService} from "CompositeCameraTexture.lspkg/Scripts/CameraService";

@component
export class CameraFeedSetup extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input targetMaterial: Material;

  onAwake() {
    const isEditor = global.deviceInfoSystem.isEditor();
    const cameraId = isEditor
      ? CameraModule.CameraId.Default_Color
      : CameraModule.CameraId.Right_Color;

    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = cameraId;

    const camTexture = this.camModule.requestCamera(camRequest);
    this.targetMaterial.mainPass.baseTex = camTexture;

    const texControl = camTexture.control as CameraTextureProvider;
    texControl.onNewFrame.add(() => {
      // Process frame here
      print("New camera frame received");
    });
  }
}
```

## Script Highlights

### CameraService.ts

Manages camera texture acquisition from the CameraModule with platform-specific camera selection. Implements automatic camera ID switching based on deviceInfoSystem.isEditor() check - uses Default_Color camera in Lens Studio editor and Right_Color camera on Spectacles device. Creates CameraRequest object using CameraModule.createCameraRequest() and configures cameraId property before requesting camera access. Connects camera texture to CropTextureProvider by setting inputTexture property, enabling cropping and region-of-interest extraction. Registers onNewFrame callback on CameraTextureProvider for continuous frame processing and event-driven updates. Handles the complete camera setup flow including request creation, texture acquisition, crop provider configuration, and frame callback registration.

## Core API Methods

```typescript
// Create camera request
CameraModule.createCameraRequest(): CameraModule.CameraRequest

// Configure camera request
camRequest.cameraId: CameraModule.CameraId
camRequest.imageSmallerDimension: number

// Request camera access
camModule.requestCamera(request: CameraModule.CameraRequest): Texture

// Access texture provider
texture.control as CameraTextureProvider

// Frame callback
cameraTextureProvider.onNewFrame.add(callback: (frame) => void)

// Crop texture setup
cropProvider.inputTexture: Texture
```

## Advanced Usage

### Dual Camera Composite

Combine left and right camera feeds for stereo vision:

```typescript
@component
export class DualCameraComposite extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input leftImage: Image;
  @input rightImage: Image;

  private leftTexture: Texture;
  private rightTexture: Texture;
  private frameCount: number = 0;

  onAwake() {
    this.setupLeftCamera();
    this.setupRightCamera();
  }

  setupLeftCamera() {
    const leftRequest = CameraModule.createCameraRequest();
    leftRequest.cameraId = CameraModule.CameraId.Left_Color;
    leftRequest.imageSmallerDimension = 756;

    this.leftTexture = this.camModule.requestCamera(leftRequest);
    this.leftImage.mainPass.baseTex = this.leftTexture;

    const leftControl = this.leftTexture.control as CameraTextureProvider;
    leftControl.onNewFrame.add(() => {
      this.onLeftFrameReceived();
    });

    print("Left camera initialized");
  }

  setupRightCamera() {
    const rightRequest = CameraModule.createCameraRequest();
    rightRequest.cameraId = CameraModule.CameraId.Right_Color;
    rightRequest.imageSmallerDimension = 756;

    this.rightTexture = this.camModule.requestCamera(rightRequest);
    this.rightImage.mainPass.baseTex = this.rightTexture;

    const rightControl = this.rightTexture.control as CameraTextureProvider;
    rightControl.onNewFrame.add(() => {
      this.onRightFrameReceived();
    });

    print("Right camera initialized");
  }

  onLeftFrameReceived() {
    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      print(`Left camera: ${this.frameCount} frames`);
    }
  }

  onRightFrameReceived() {
    // Process right camera frame
    // Could do stereo depth analysis here
  }
}
```

### Picture-in-Picture Effect

Create a small preview window with different camera:

```typescript
@component
export class PictureInPicture extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input mainImage: Image;
  @input pipImage: Image;
  @input pipScale: number = 0.25;

  onAwake() {
    // Main view: Right camera (full screen)
    const mainRequest = CameraModule.createCameraRequest();
    mainRequest.cameraId = CameraModule.CameraId.Right_Color;
    mainRequest.imageSmallerDimension = 756;
    const mainTexture = this.camModule.requestCamera(mainRequest);
    this.mainImage.mainPass.baseTex = mainTexture;

    // PiP view: Left camera (small corner)
    const pipRequest = CameraModule.createCameraRequest();
    pipRequest.cameraId = CameraModule.CameraId.Left_Color;
    pipRequest.imageSmallerDimension = 352; // Lower resolution for PiP
    const pipTexture = this.camModule.requestCamera(pipRequest);
    this.pipImage.mainPass.baseTex = pipTexture;

    // Scale PiP window
    const pipTransform = this.pipImage.getSceneObject().getTransform();
    const currentScale = pipTransform.getLocalScale();
    pipTransform.setLocalScale(currentScale.uniformScale(this.pipScale));

    print("Picture-in-Picture initialized");
  }
}
```

### Frame Rate Monitor

Track camera frame rate and performance:

```typescript
@component
export class CameraFrameRateMonitor extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input displayText: Text;

  private frameCount: number = 0;
  private lastTime: number = 0;
  private currentFPS: number = 0;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = CameraModule.CameraId.Default_Color;

    const camTexture = this.camModule.requestCamera(camRequest);
    const camControl = camTexture.control as CameraTextureProvider;

    camControl.onNewFrame.add(() => {
      this.onFrame();
    });

    this.lastTime = getTime();

    // Update display every second
    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      const currentTime = getTime();
      const elapsed = currentTime - this.lastTime;

      if (elapsed >= 1.0) {
        this.currentFPS = this.frameCount / elapsed;
        this.frameCount = 0;
        this.lastTime = currentTime;

        this.displayText.text = `Camera FPS: ${this.currentFPS.toFixed(1)}`;
      }
    });
  }

  onFrame() {
    this.frameCount++;
  }
}
```

### Multi-Resolution Camera System

Request multiple resolution levels from same camera:

```typescript
@component
export class MultiResolutionCamera extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input highResImage: Image;
  @input mediumResImage: Image;
  @input lowResImage: Image;

  private resolutions = {
    high: 1024,
    medium: 512,
    low: 256
  };

  onAwake() {
    this.setupCamera(
      CameraModule.CameraId.Default_Color,
      this.resolutions.high,
      this.highResImage,
      "High"
    );

    this.setupCamera(
      CameraModule.CameraId.Default_Color,
      this.resolutions.medium,
      this.mediumResImage,
      "Medium"
    );

    this.setupCamera(
      CameraModule.CameraId.Default_Color,
      this.resolutions.low,
      this.lowResImage,
      "Low"
    );
  }

  setupCamera(cameraId: CameraModule.CameraId, resolution: number, image: Image, label: string) {
    const request = CameraModule.createCameraRequest();
    request.cameraId = cameraId;
    request.imageSmallerDimension = resolution;

    const texture = this.camModule.requestCamera(request);
    image.mainPass.baseTex = texture;

    const control = texture.control as CameraTextureProvider;
    control.onNewFrame.add(() => {
      // Process frame for this resolution
    });

    print(`${label} resolution camera initialized: ${resolution}px`);
  }
}
```

### Camera Feed Recorder

Record camera frames for processing:

```typescript
@component
export class CameraFrameRecorder extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input maxFrames: number = 100;

  private frames: Texture[] = [];
  private isRecording: boolean = false;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = CameraModule.CameraId.Default_Color;
    camRequest.imageSmallerDimension = 512;

    const camTexture = this.camModule.requestCamera(camRequest);
    const camControl = camTexture.control as CameraTextureProvider;

    camControl.onNewFrame.add((frame) => {
      if (this.isRecording) {
        this.recordFrame(camTexture);
      }
    });
  }

  startRecording() {
    this.isRecording = true;
    this.frames = [];
    print("Recording started");
  }

  stopRecording() {
    this.isRecording = false;
    print(`Recording stopped. Captured ${this.frames.length} frames`);
  }

  recordFrame(texture: Texture) {
    if (this.frames.length < this.maxFrames) {
      // In real implementation, would copy texture data
      this.frames.push(texture);

      if (this.frames.length === this.maxFrames) {
        print(`Maximum frames reached: ${this.maxFrames}`);
        this.stopRecording();
      }
    }
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  clearFrames() {
    this.frames = [];
    print("Frame buffer cleared");
  }
}
```

### Adaptive Resolution System

Dynamically adjust camera resolution based on performance:

```typescript
@component
export class AdaptiveResolutionCamera extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input targetImage: Image;

  private resolutionLevels = [256, 352, 512, 756, 1024];
  private currentResolutionIndex = 2; // Start at 512
  private currentTexture: Texture;
  private frameTimeHistory: number[] = [];

  onAwake() {
    this.requestCameraAtCurrentResolution();

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      this.monitorPerformance();
    });
  }

  requestCameraAtCurrentResolution() {
    const resolution = this.resolutionLevels[this.currentResolutionIndex];

    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = CameraModule.CameraId.Default_Color;
    camRequest.imageSmallerDimension = resolution;

    this.currentTexture = this.camModule.requestCamera(camRequest);
    this.targetImage.mainPass.baseTex = this.currentTexture;

    print(`Camera resolution set to: ${resolution}px`);
  }

  monitorPerformance() {
    const frameTime = getDeltaTime();
    this.frameTimeHistory.push(frameTime);

    // Keep last 60 frames
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    // Check every 2 seconds
    if (this.frameTimeHistory.length === 60) {
      const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / 60;
      const fps = 1.0 / avgFrameTime;

      // Adjust resolution based on FPS
      if (fps < 45 && this.currentResolutionIndex > 0) {
        // Performance struggling, reduce resolution
        this.currentResolutionIndex--;
        this.requestCameraAtCurrentResolution();
        print(`Reduced resolution due to performance: ${fps.toFixed(1)} fps`);
      } else if (fps > 55 && this.currentResolutionIndex < this.resolutionLevels.length - 1) {
        // Performance good, increase resolution
        this.currentResolutionIndex++;
        this.requestCameraAtCurrentResolution();
        print(`Increased resolution: ${fps.toFixed(1)} fps`);
      }

      this.frameTimeHistory = [];
    }
  }
}
```

### Camera Switcher

Switch between different cameras at runtime:

```typescript
@component
export class CameraSwitcher extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input displayImage: Image;

  private cameras = [
    CameraModule.CameraId.Default_Color,
    CameraModule.CameraId.Left_Color,
    CameraModule.CameraId.Right_Color
  ];

  private currentCameraIndex = 0;
  private currentTexture: Texture;

  onAwake() {
    this.switchToCamera(this.currentCameraIndex);
  }

  switchToCamera(index: number) {
    if (index < 0 || index >= this.cameras.length) {
      print(`Invalid camera index: ${index}`);
      return;
    }

    this.currentCameraIndex = index;
    const cameraId = this.cameras[index];

    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = cameraId;
    camRequest.imageSmallerDimension = 756;

    this.currentTexture = this.camModule.requestCamera(camRequest);
    this.displayImage.mainPass.baseTex = this.currentTexture;

    const cameraNames = ["Default", "Left", "Right"];
    print(`Switched to ${cameraNames[index]} camera`);
  }

  nextCamera() {
    const nextIndex = (this.currentCameraIndex + 1) % this.cameras.length;
    this.switchToCamera(nextIndex);
  }

  previousCamera() {
    const prevIndex = (this.currentCameraIndex - 1 + this.cameras.length) % this.cameras.length;
    this.switchToCamera(prevIndex);
  }
}
```

## Configuration Tips

### Camera Selection Guidelines

Choose appropriate cameras for different use cases:

1. **Default_Color**: Primary camera, best for editor testing
2. **Right_Color**: Right eye camera on Spectacles, use for device builds
3. **Left_Color**: Left eye camera, use for stereo or multi-camera effects

### Resolution Best Practices

Optimize resolution based on use case:

1. **High Detail (756-1024px)**: Main view, photo capture, text recognition
2. **Standard (512px)**: Normal AR experiences, balanced performance
3. **Performance (256-352px)**: Background processing, editor testing
4. **Picture-in-Picture (256px)**: Secondary views, thumbnails

### Frame Callback Performance

Efficient frame processing:

1. **Minimize Processing**: Keep onNewFrame callbacks lightweight
2. **Batch Operations**: Process multiple frames together when possible
3. **Conditional Processing**: Skip frames if falling behind
4. **Async Operations**: Offload heavy processing to separate systems

## Built with 👻 by the Spectacles team

---

[See more packages](https://github.com/specs-devs/packages)

