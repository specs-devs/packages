/**
 * Specs Inc. 2026
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

    private isEditor = global.deviceInfoSystem.isEditor();

    onAwake() {
        this.createEvent("OnStartEvent").bind(this.start.bind(this));
    }

    start() {
        const camID = this.isEditor
            ? CameraModule.CameraId.Default_Color
            : CameraModule.CameraId.Right_Color;
        const camRequest = CameraModule.createCameraRequest();
        camRequest.cameraId = camID;
        //camRequest.imageSmallerDimension = this.isEditor ? 352 : 756;

        const camTexture = this.camModule.requestCamera(camRequest);
        print(camTexture);
        const camTexControl = camTexture.control as CameraTextureProvider;
        const cropTexControl = this.screenCropTexture.control as CropTextureProvider;
        cropTexControl.inputTexture = camTexture;
        camTexControl.onNewFrame.add(() => { });
    }
}
