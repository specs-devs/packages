@component
export class CameraService extends BaseScriptComponent {
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
