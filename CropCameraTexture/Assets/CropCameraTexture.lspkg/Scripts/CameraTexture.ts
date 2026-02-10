/**
 * Specs Inc. 2026
 * Camera texture cropping utility that allows you to crop camera frames to specific regions.
 * Provides both cropped and original texture access with configurable crop boundaries.
 */
@component
export class CameraTexture extends BaseScriptComponent {
  private cameraRequest: CameraModule.CameraRequest;
  private cameraTexture: Texture;
  private cropProvider: any;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">UI Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the UI image component and texture resources</span>')

  @input
  @hint("The image component that will display the cropped camera frame.")
  uiImage: Image;

  @input
  @hint("Texture used for processing camera frames")
  screenTexture: Texture;

  @input
  @hint("Camera module reference from the scene.")
  camModule: CameraModule;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Crop Rectangle Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the crop region using normalized coordinates (-1 to 1) for left, right, bottom, and top boundaries</span>')

  @input
  @hint("Crop rectangle left boundary (-1 to 1).")
  cropLeft: number = -0.2;

  @input
  @hint("Crop rectangle right boundary (-1 to 1).")
  cropRight: number = 0.2;

  @input
  @hint("Crop rectangle bottom boundary (-1 to 1).")
  cropBottom: number = -0.2;

  @input
  @hint("Crop rectangle top boundary (-1 to 1).")
  cropTop: number = 0.2;

  /**
   * Returns the processed camera texture (always cropped if crop texture is available)
   * @returns The processed texture
   */
  public getCameraTexture(): Texture {
    try {
      if (this.screenTexture && this.cameraTexture) {
        // Get the control as crop provider
        const cropProvider = this.screenTexture.control as any;
        
        if (!cropProvider) {
          print("Crop texture has no control provider");
          return this.cameraTexture;
        }
        
        // Set the input texture
        if (cropProvider.inputTexture !== undefined) {
          cropProvider.inputTexture = this.cameraTexture;
        }

        // Update crop rectangle properties directly
        if (cropProvider.cropRect) {
          cropProvider.cropRect.left = this.cropLeft;
          cropProvider.cropRect.right = this.cropRight;
          cropProvider.cropRect.bottom = this.cropBottom;
          cropProvider.cropRect.top = this.cropTop;
        }
        
        return this.screenTexture;
      }
      
      // Return original camera texture if no crop texture is available
      return this.cameraTexture;
    } catch (error) {
      print("Error in getCameraTexture: " + error);
      return this.cameraTexture;
    }
  }

  /**
   * Returns the original high-quality camera texture without cropping
   * @returns The original camera texture
   */
  public getOriginalCameraTexture(): Texture {
    return this.cameraTexture;
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.setupCamera();
    });
  }

  private setupCamera(): void {
    try {
      print("Starting camera setup...");
      
      // Check if camera module is provided via inspector
      if (!this.camModule) {
        print("Camera module not provided via inspector - please assign it in the component settings");
        return;
      }
      
      this.cameraRequest = CameraModule.createCameraRequest();
      print("Camera request created");
      
      if (!this.cameraRequest) {
        print("Failed to create camera request");
        return;
      }
      
      this.cameraRequest.cameraId = CameraModule.CameraId.Default_Color;
      
      // Use adaptive resolution like GeminiExample: lower for editor, higher for device
      const isEditor = global.deviceInfoSystem.isEditor();
      this.cameraRequest.imageSmallerDimension = isEditor ? 352 : 756;
      print("Camera request configured - Resolution: " + this.cameraRequest.imageSmallerDimension + " (Editor: " + isEditor + ")");

      const camera = global.deviceInfoSystem.getTrackingCameraForId(
        CameraModule.CameraId.Default_Color
      );
      const resolution = camera.resolution;
      print(resolution); // x 682 y 1024

      // Request camera access using the provided camera module
      this.cameraTexture = this.camModule.requestCamera(this.cameraRequest);
      print("Camera texture requested: " + this.cameraTexture);
      
      if (!this.cameraTexture) {
        print("Failed to get camera texture");
        return;
      }
      
      // Get the crop provider from the screen texture
      this.cropProvider = this.screenTexture.control as any;
      print("Crop provider: " + this.cropProvider);
      
      // Set initial input texture
      if (this.cropProvider && this.cropProvider.inputTexture !== undefined) {
        this.cropProvider.inputTexture = this.cameraTexture;
      }

      // Set up frame update handler
      const cameraControl = this.cameraTexture.control as any;
      if (cameraControl && cameraControl.onNewFrame) {
        cameraControl.onNewFrame.add((cameraFrame) => {
          // Update the UI image with the cropped result
          if (this.uiImage) {
            this.uiImage.mainPass.baseTex = this.getCameraTexture();
          }
        });
      }

      // Initial setup for the UI image
      if (this.uiImage) {
        this.uiImage.mainPass.baseTex = this.getCameraTexture();
      }
      
      print("Camera setup successful");
    } catch (error) {
      print("Camera setup failed: " + error);
      print("Error stack: " + error.stack);
    }
  }
}
