import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

/**
 * SPECS Inc. 2027
 * Camera service for managing composite camera textures. Handles camera requests and texture
 * composition for both editor and device environments with different camera configurations.
 */
@component
export class CameraService extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Camera Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure camera and texture resources for composite camera output</span>')

    @input editorCamera: Camera;
    @input screenCropTexture: Texture;
    @input
    private camModule: CameraModule;

    @input
    @allowUndefined
    @hint("Material that shows the Lens content in the composite (Materials/ImageVC). Its baseTex is set at start.")
    lensContentMaterial: Material;

    @input
    @allowUndefined
    @hint("Texture with the Lens content. Leave empty to use the render target of Editor Camera (the Lens camera).")
    lensRenderTarget: Texture;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;

    private isEditor = global.deviceInfoSystem.isEditor();

    /**
     * Called when component is initialized
     */
    onAwake(): void {
        this.logger = new Logger("CameraService", this.enableLogging || this.enableLoggingLifecycle, true);
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
        }
    }

    @bindStartEvent
    start(): void {
        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: start() - Initializing camera service");
        }

        const camID = this.isEditor
            ? CameraModule.CameraId.Default_Color
            : CameraModule.CameraId.Right_Color;
        const camRequest = CameraModule.createCameraRequest();
        camRequest.cameraId = camID;
        //camRequest.imageSmallerDimension = this.isEditor ? 352 : 756;

        const camTexture = this.camModule.requestCamera(camRequest);

        if (this.enableLogging) {
            this.logger.debug(`Camera texture requested: ${camTexture}`);
        }

        const camTexControl = camTexture.control as CameraTextureProvider;
        const cropTexControl = this.screenCropTexture.control as CropTextureProvider;
        cropTexControl.inputTexture = camTexture;
        camTexControl.onNewFrame.add(() => { });

        this.assignLensContent();

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: start() - Camera service initialized");
        }
    }

    /**
     * Points the Lens content material at the Lens camera's render target, so the composite
     * works in any project without editing the material by hand.
     */
    private assignLensContent(): void {
        if (!this.lensContentMaterial) {
            return;
        }
        const lensTexture = this.lensRenderTarget ?? this.editorCamera?.renderTarget;
        if (!lensTexture) {
            this.logger.warn("No Lens render target found; set Lens Render Target or Editor Camera.");
            return;
        }
        this.lensContentMaterial.mainPass.baseTex = lensTexture;

        if (this.enableLogging) {
            this.logger.debug(`Lens content texture assigned: ${lensTexture}`);
        }
    }
}
