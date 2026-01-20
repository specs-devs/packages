# Crop Camera Texture

This component provides an intuitive way to crop camera textures directly from the Lens Studio Inspector using the Screen Crop Texture component.

## Overview

The CropCameraTexture functionality enables you to:
- Capture camera frames from the device
- Crop the camera texture to specific dimensions
- Display both the original and cropped textures in your Lens

## Features

- **Simple Inspector-Based Configuration**: Adjust crop settings visually in the Lens Studio Inspector
- **Real-Time Cropping**: Automatically applies cropping on every camera frame
- **Flexible Implementation**: Works with any texture that uses a CropTextureProvider

## How To Use

1. Add the CameraTexture script component to an object in your scene
2. Set the following required inputs in the Inspector:
   - `uiImage`: The Image component to display the original camera texture
   - `croppedImage`: The Image component to display the cropped result
   - `screenTexture`: A texture with the CropTextureProvider control (RectCropTexture)

3. Use the Lens Studio Inspector to visually adjust the crop area with the Screen Crop Texture component

## Implementation Details

This solution is provided in both TypeScript and JavaScript formats:

- **TypeScript**: For projects using the TypeScript workflow
- **JavaScript**: For traditional Lens Studio development

## Example

```typescript
// Example usage of the component
const cameraTextureComponent = script.getComponent("CameraTexture") as CameraTexture;
const croppedTexture = cameraTextureComponent.getCameraTexture();
```

## Technical Details

The component uses the CropTextureProvider from Lens Studio's API to handle the texture cropping. The cropping is applied on every new camera frame, ensuring that your UI always displays the most current cropped view.

The cropping is handled transparently, with no need for manual texture manipulation code - making this an ideal solution for rapid prototyping and production lenses alike.
 
