![CropCameraTexture](AssetImage/CropCameraTexture.png)

# Crop Camera Texture

A comprehensive camera texture cropping utility for extracting regions of interest from camera feeds. This package provides precise crop rectangle control with normalized coordinates, CropTextureProvider integration, adaptive resolution management, and frame-by-frame processing capabilities for creating picture-in-picture effects, zoom views, focused AR overlays, and dynamic camera manipulation experiences.

## Features

- **Normalized Crop Coordinates**: Define crop rectangles with -1 to 1 coordinate system
- **CropTextureProvider Integration**: Connect to Lens Studio's crop texture pipeline
- **Real-Time Updates**: Modify crop regions dynamically during runtime
- **Image Component Display**: Direct integration with UI Image components
- **Camera Module Support**: Works with any CameraModule texture source
- **Aspect Ratio Preservation**: Maintain proper scaling within crop regions
- **Adaptive Resolution**: Automatic resolution adjustment for editor vs device
- **Original Texture Access**: Get both cropped and original camera textures
- **Frame Callback Support**: Process camera frames with onNewFrame events

## Quick Start

Crop a camera feed to a specific region:

```typescript
import {CameraTexture} from "CropCameraTexture.lspkg/Scripts/CameraTexture";

@component
export class CropCameraExample extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input screenTexture: Texture;
  @input uiImage: Image;

  onAwake() {
    const cameraTexture = this.sceneObject.createComponent("Component.ScriptComponent") as CameraTexture;
    cameraTexture.camModule = this.camModule;
    cameraTexture.screenTexture = this.screenTexture;
    cameraTexture.uiImage = this.uiImage;

    // Set crop rectangle (center square)
    cameraTexture.cropLeft = -0.3;
    cameraTexture.cropRight = 0.3;
    cameraTexture.cropBottom = -0.3;
    cameraTexture.cropTop = 0.3;

    // Get the cropped texture
    const croppedTexture = cameraTexture.getCameraTexture();
    print("Camera crop initialized");
  }
}
```

## Script Highlights

### CameraTexture.ts

Manages camera texture cropping with configurable crop rectangle boundaries using normalized coordinates in -1 to 1 range. Implements automatic camera setup through setupCamera() method that creates CameraRequest, sets resolution based on platform (352px in editor, 756px on device), and requests camera access through provided CameraModule. Interfaces with CropTextureProvider by getting the control property from screenTexture and configuring inputTexture with the raw camera feed. Provides getCameraTexture() method that returns processed (cropped) texture with automatic provider configuration and real-time crop rectangle updates. Handles crop rect properties including left, right, bottom, and top boundaries that define the visible region. Implements onNewFrame callback handler that updates UI Image component with cropped result on each camera frame. Includes getOriginalCameraTexture() method for accessing high-quality uncropped feed. Features comprehensive error handling with try-catch blocks and detailed print statements for debugging camera setup and crop configuration issues.

## Core API Methods

```typescript
// Configuration inputs
@input uiImage: Image                        // Display target for cropped camera
@input screenTexture: Texture                // Texture for crop processing
@input camModule: CameraModule               // Camera module reference
@input cropLeft: number                      // Left boundary (-1 to 1)
@input cropRight: number                     // Right boundary (-1 to 1)
@input cropBottom: number                    // Bottom boundary (-1 to 1)
@input cropTop: number                       // Top boundary (-1 to 1)

// Public methods
getCameraTexture(): Texture                  // Returns cropped texture
getOriginalCameraTexture(): Texture          // Returns uncropped texture

// CropTextureProvider API (internal)
cropProvider.inputTexture: Texture
cropProvider.cropRect.left: number
cropProvider.cropRect.right: number
cropProvider.cropRect.bottom: number
cropProvider.cropRect.top: number
```

## Advanced Usage

### Dynamic Zoom Effect

Create a smooth zoom animation by animating crop bounds:

```typescript
@component
export class DynamicZoomEffect extends BaseScriptComponent {
  @input cropTexture: Texture;
  @input camModule: CameraModule;
  @input zoomSpeed: number = 0.5;
  @input maxZoom: number = 3.0;

  private cropProvider: CropTextureProvider;
  private zoomLevel: number = 1.0;
  private isZooming: boolean = false;
  private targetZoom: number = 1.0;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = CameraModule.CameraId.Default_Color;
    const cameraTexture = this.camModule.requestCamera(camRequest);

    this.cropProvider = this.cropTexture.control as CropTextureProvider;
    this.cropProvider.inputTexture = cameraTexture;

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      this.updateZoom();
    });
  }

  updateZoom() {
    if (this.isZooming) {
      // Smoothly interpolate to target zoom
      const delta = getDeltaTime() * this.zoomSpeed;
      this.zoomLevel = this.zoomLevel + (this.targetZoom - this.zoomLevel) * delta;

      // Stop when close enough
      if (Math.abs(this.zoomLevel - this.targetZoom) < 0.01) {
        this.zoomLevel = this.targetZoom;
        this.isZooming = false;
      }
    }

    const cropSize = 1.0 / this.zoomLevel;

    this.cropProvider.cropRect.left = -cropSize;
    this.cropProvider.cropRect.right = cropSize;
    this.cropProvider.cropRect.bottom = -cropSize;
    this.cropProvider.cropRect.top = cropSize;
  }

  zoomIn() {
    this.targetZoom = Math.min(this.maxZoom, this.zoomLevel * 1.5);
    this.isZooming = true;
    print(`Zooming in to ${this.targetZoom.toFixed(2)}x`);
  }

  zoomOut() {
    this.targetZoom = Math.max(1.0, this.zoomLevel / 1.5);
    this.isZooming = true;
    print(`Zooming out to ${this.targetZoom.toFixed(2)}x`);
  }

  resetZoom() {
    this.targetZoom = 1.0;
    this.isZooming = true;
    print("Resetting zoom");
  }
}
```

### Pan and Scan Effect

Move the crop window across the camera feed:

```typescript
@component
export class PanScanEffect extends BaseScriptComponent {
  @input cropTexture: Texture;
  @input camModule: CameraModule;
  @input panSpeed: number = 0.3;

  private cropProvider: CropTextureProvider;
  private panX: number = 0;
  private panY: number = 0;
  private cropSize: number = 0.4;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    const cameraTexture = this.camModule.requestCamera(camRequest);

    this.cropProvider = this.cropTexture.control as CropTextureProvider;
    this.cropProvider.inputTexture = cameraTexture;

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      this.updatePan();
    });
  }

  updatePan() {
    // Update crop position
    const left = this.panX - this.cropSize;
    const right = this.panX + this.cropSize;
    const bottom = this.panY - this.cropSize;
    const top = this.panY + this.cropSize;

    // Clamp to valid range
    this.cropProvider.cropRect.left = Math.max(-1.0, Math.min(1.0 - this.cropSize * 2, left));
    this.cropProvider.cropRect.right = Math.min(1.0, Math.max(-1.0 + this.cropSize * 2, right));
    this.cropProvider.cropRect.bottom = Math.max(-1.0, Math.min(1.0 - this.cropSize * 2, bottom));
    this.cropProvider.cropRect.top = Math.min(1.0, Math.max(-1.0 + this.cropSize * 2, top));
  }

  panLeft() {
    this.panX -= this.panSpeed;
    this.panX = Math.max(-1.0 + this.cropSize, this.panX);
  }

  panRight() {
    this.panX += this.panSpeed;
    this.panX = Math.min(1.0 - this.cropSize, this.panX);
  }

  panUp() {
    this.panY += this.panSpeed;
    this.panY = Math.min(1.0 - this.cropSize, this.panY);
  }

  panDown() {
    this.panY -= this.panSpeed;
    this.panY = Math.max(-1.0 + this.cropSize, this.panY);
  }

  center() {
    this.panX = 0;
    this.panY = 0;
  }
}
```

### Aspect Ratio Lock

Maintain specific aspect ratios while cropping:

```typescript
@component
export class AspectRatioLock extends BaseScriptComponent {
  @input cropTexture: Texture;
  @input camModule: CameraModule;
  @input aspectRatio: number = 16.0 / 9.0; // 16:9 by default

  private cropProvider: CropTextureProvider;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    const cameraTexture = this.camModule.requestCamera(camRequest);

    this.cropProvider = this.cropTexture.control as CropTextureProvider;
    this.cropProvider.inputTexture = cameraTexture;

    this.applyCropWithAspectRatio(0.8); // 80% of available space
  }

  applyCropWithAspectRatio(scale: number) {
    // Calculate dimensions maintaining aspect ratio
    let width: number;
    let height: number;

    if (this.aspectRatio > 1.0) {
      // Landscape
      width = scale;
      height = scale / this.aspectRatio;
    } else {
      // Portrait
      height = scale;
      width = scale * this.aspectRatio;
    }

    // Center the crop
    this.cropProvider.cropRect.left = -width;
    this.cropProvider.cropRect.right = width;
    this.cropProvider.cropRect.bottom = -height;
    this.cropProvider.cropRect.top = height;

    print(`Applied ${this.aspectRatio.toFixed(2)}:1 aspect ratio`);
  }

  setAspectRatio(ratio: number) {
    this.aspectRatio = ratio;
    this.applyCropWithAspectRatio(0.8);
  }

  // Common aspect ratios
  set16x9() { this.setAspectRatio(16.0 / 9.0); }
  set4x3() { this.setAspectRatio(4.0 / 3.0); }
  set1x1() { this.setAspectRatio(1.0); }
  set9x16() { this.setAspectRatio(9.0 / 16.0); }
}
```

### Multi-Window Display

Show multiple crops from same camera feed:

```typescript
@component
export class MultiWindowDisplay extends BaseScriptComponent {
  @input camModule: CameraModule;
  @input cropTexture1: Texture;
  @input cropTexture2: Texture;
  @input cropTexture3: Texture;
  @input cropTexture4: Texture;

  private cameraTexture: Texture;

  onAwake() {
    // Get single camera feed
    const camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = CameraModule.CameraId.Default_Color;
    camRequest.imageSmallerDimension = 1024; // High res for multiple crops
    this.cameraTexture = this.camModule.requestCamera(camRequest);

    // Create 4 different crop regions (quadrants)
    this.setupQuadrant(this.cropTexture1, -1.0, 0.0, 0.0, 1.0); // Top-left
    this.setupQuadrant(this.cropTexture2, 0.0, 1.0, 0.0, 1.0);  // Top-right
    this.setupQuadrant(this.cropTexture3, -1.0, 0.0, -1.0, 0.0); // Bottom-left
    this.setupQuadrant(this.cropTexture4, 0.0, 1.0, -1.0, 0.0);  // Bottom-right

    print("Multi-window display initialized");
  }

  setupQuadrant(cropTexture: Texture, left: number, right: number, bottom: number, top: number) {
    const cropProvider = cropTexture.control as CropTextureProvider;
    cropProvider.inputTexture = this.cameraTexture;
    cropProvider.cropRect.left = left;
    cropProvider.cropRect.right = right;
    cropProvider.cropRect.bottom = bottom;
    cropProvider.cropRect.top = top;
  }
}
```

### Cinematic Letterbox

Create cinematic widescreen effect:

```typescript
@component
export class CinematicLetterbox extends BaseScriptComponent {
  @input cropTexture: Texture;
  @input camModule: CameraModule;
  @input cinematicRatio: number = 2.35; // Ultra-wide cinema aspect

  private cropProvider: CropTextureProvider;
  private isLetterboxed: boolean = false;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    const cameraTexture = this.camModule.requestCamera(camRequest);

    this.cropProvider = this.cropTexture.control as CropTextureProvider;
    this.cropProvider.inputTexture = cameraTexture;

    this.applyLetterbox();
  }

  applyLetterbox() {
    const height = 1.0 / this.cinematicRatio;

    this.cropProvider.cropRect.left = -1.0;
    this.cropProvider.cropRect.right = 1.0;
    this.cropProvider.cropRect.bottom = -height;
    this.cropProvider.cropRect.top = height;

    this.isLetterboxed = true;
    print(`Letterbox applied: ${this.cinematicRatio.toFixed(2)}:1`);
  }

  removeLetterbox() {
    this.cropProvider.cropRect.left = -1.0;
    this.cropProvider.cropRect.right = 1.0;
    this.cropProvider.cropRect.bottom = -1.0;
    this.cropProvider.cropRect.top = 1.0;

    this.isLetterboxed = false;
    print("Letterbox removed");
  }

  toggleLetterbox() {
    if (this.isLetterboxed) {
      this.removeLetterbox();
    } else {
      this.applyLetterbox();
    }
  }
}
```

### Focus Point Tracking

Crop around a moving point of interest:

```typescript
@component
export class FocusPointTracker extends BaseScriptComponent {
  @input cropTexture: Texture;
  @input camModule: CameraModule;
  @input focusPoint: SceneObject; // Object to track
  @input cropSize: number = 0.3;
  @input smoothSpeed: number = 5.0;

  private cropProvider: CropTextureProvider;
  private currentX: number = 0;
  private currentY: number = 0;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    const cameraTexture = this.camModule.requestCamera(camRequest);

    this.cropProvider = this.cropTexture.control as CropTextureProvider;
    this.cropProvider.inputTexture = cameraTexture;

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      this.updateCrop();
    });
  }

  updateCrop() {
    if (!this.focusPoint) return;

    // Get focus point position (normalized)
    const pos = this.focusPoint.getTransform().getWorldPosition();
    const targetX = pos.x;
    const targetY = pos.y;

    // Smooth movement
    const delta = getDeltaTime() * this.smoothSpeed;
    this.currentX += (targetX - this.currentX) * delta;
    this.currentY += (targetY - this.currentY) * delta;

    // Apply crop centered on focus point
    const left = this.currentX - this.cropSize;
    const right = this.currentX + this.cropSize;
    const bottom = this.currentY - this.cropSize;
    const top = this.currentY + this.cropSize;

    // Clamp to valid range
    this.cropProvider.cropRect.left = Math.max(-1.0, Math.min(1.0 - this.cropSize * 2, left));
    this.cropProvider.cropRect.right = Math.min(1.0, Math.max(-1.0 + this.cropSize * 2, right));
    this.cropProvider.cropRect.bottom = Math.max(-1.0, Math.min(1.0 - this.cropSize * 2, bottom));
    this.cropProvider.cropRect.top = Math.min(1.0, Math.max(-1.0 + this.cropSize * 2, top));
  }

  setFocusPoint(newPoint: SceneObject) {
    this.focusPoint = newPoint;
    print("Focus point updated");
  }
}
```

### Animated Crop Presets

Transition between predefined crop regions:

```typescript
@component
export class AnimatedCropPresets extends BaseScriptComponent {
  @input cropTexture: Texture;
  @input camModule: CameraModule;
  @input transitionSpeed: number = 2.0;

  private cropProvider: CropTextureProvider;
  private presets: CropPreset[] = [];
  private currentPresetIndex: number = 0;
  private isTransitioning: boolean = false;

  private currentLeft: number = -1.0;
  private currentRight: number = 1.0;
  private currentBottom: number = -1.0;
  private currentTop: number = 1.0;

  onAwake() {
    const camRequest = CameraModule.createCameraRequest();
    const cameraTexture = this.camModule.requestCamera(camRequest);

    this.cropProvider = this.cropTexture.control as CropTextureProvider;
    this.cropProvider.inputTexture = cameraTexture;

    // Define presets
    this.presets.push({ name: "Full", left: -1.0, right: 1.0, bottom: -1.0, top: 1.0 });
    this.presets.push({ name: "Center", left: -0.5, right: 0.5, bottom: -0.5, top: 0.5 });
    this.presets.push({ name: "Top", left: -1.0, right: 1.0, bottom: 0.0, top: 1.0 });
    this.presets.push({ name: "Bottom", left: -1.0, right: 1.0, bottom: -1.0, top: 0.0 });
    this.presets.push({ name: "Left", left: -1.0, right: 0.0, bottom: -1.0, top: 1.0 });
    this.presets.push({ name: "Right", left: 0.0, right: 1.0, bottom: -1.0, top: 1.0 });

    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      if (this.isTransitioning) {
        this.updateTransition();
      }
    });
  }

  updateTransition() {
    const preset = this.presets[this.currentPresetIndex];
    const delta = getDeltaTime() * this.transitionSpeed;

    // Lerp to target
    this.currentLeft += (preset.left - this.currentLeft) * delta;
    this.currentRight += (preset.right - this.currentRight) * delta;
    this.currentBottom += (preset.bottom - this.currentBottom) * delta;
    this.currentTop += (preset.top - this.currentTop) * delta;

    // Apply
    this.cropProvider.cropRect.left = this.currentLeft;
    this.cropProvider.cropRect.right = this.currentRight;
    this.cropProvider.cropRect.bottom = this.currentBottom;
    this.cropProvider.cropRect.top = this.currentTop;

    // Check if transition complete
    const threshold = 0.01;
    if (Math.abs(this.currentLeft - preset.left) < threshold &&
        Math.abs(this.currentRight - preset.right) < threshold &&
        Math.abs(this.currentBottom - preset.bottom) < threshold &&
        Math.abs(this.currentTop - preset.top) < threshold) {
      this.isTransitioning = false;
      print(`Transition to ${preset.name} complete`);
    }
  }

  transitionToPreset(index: number) {
    if (index >= 0 && index < this.presets.length) {
      this.currentPresetIndex = index;
      this.isTransitioning = true;
      print(`Transitioning to ${this.presets[index].name}`);
    }
  }

  nextPreset() {
    const next = (this.currentPresetIndex + 1) % this.presets.length;
    this.transitionToPreset(next);
  }
}

interface CropPreset {
  name: string;
  left: number;
  right: number;
  bottom: number;
  top: number;
}
```

## Configuration Tips

### Crop Coordinate System

Understanding the normalized coordinate system:

1. **X Axis (Left/Right)**: -1.0 (left edge) to 1.0 (right edge)
2. **Y Axis (Bottom/Top)**: -1.0 (bottom edge) to 1.0 (top edge)
3. **Center Point**: (0, 0) is the center of the camera feed
4. **Valid Range**: All coordinates must be between -1.0 and 1.0

### Crop Size Guidelines

Recommended crop sizes for different use cases:

1. **Full View (1.0)**: No cropping, entire camera feed visible
2. **Standard Crop (0.5-0.8)**: Balanced zoom with context
3. **Close Crop (0.3-0.5)**: Focused detail view
4. **Macro Crop (0.1-0.3)**: Extreme magnification

### Performance Optimization

Best practices for optimal crop performance:

1. **Resolution Matching**: Use appropriate camera resolution for crop size
2. **Update Frequency**: Limit crop rectangle updates to when needed
3. **Smooth Transitions**: Use lerp for animated crop changes
4. **Cache Calculations**: Store computed crop values when possible

## Built with 👻 by the Spectacles team

---

[See more packages](https://github.com/specs-devs/packages)

