import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

export enum CameraType {
  Main = 0,
  GlassesLeft = 1,
  GlassesRight = 2
}

export class CameraService {
  private static instance: CameraService

  // Just keep the main camera
  private _mainCamera: Camera = WorldCameraFinderProvider.getInstance().getComponent()

  // These can be created on-demand if needed later
  private _glassesLeftCamera: Camera
  private _glassesRightCamera: Camera

  public static getInstance(): CameraService {
    if (!CameraService.instance) {
      CameraService.instance = new CameraService()
    }
    return CameraService.instance
  }

  // Simplified constructor with no initialization that uses CameraModule
  private constructor() {
    // No complex initialization needed
  }

  get mainCameraTransform(): Transform {
    return this._mainCamera.getTransform()
  }

  getCamera(cameraType: CameraType): Camera {
    if (cameraType === CameraType.Main) {
      return this._mainCamera
    }
    if (cameraType === CameraType.GlassesLeft) {
      if (!this._glassesLeftCamera) {
        print("Warning: GlassesLeft camera requested but not initialized")
      }
      return this._glassesLeftCamera
    }
    if (cameraType === CameraType.GlassesRight) {
      if (!this._glassesRightCamera) {
        print("Warning: GlassesRight camera requested but not initialized")
      }
      return this._glassesRightCamera
    }
    throw new Error("Invalid camera type")
  }
}
