# NDK Capture — setup

## 1. Unpack the Studio

Unzip `NDKCapture.lspkg/ExtractAtProjectRoot/NDKCaptureStudio.zip` **at the project root**, next to
`Assets/`, so that `<project>/NDKCaptureStudio/index.html` exists. The plugin serves this folder.
(Cloned projects already have it.) To change the native code, also unzip `NDKCaptureModule.zip`
there.

## 2. Lens Studio (Preview)

1. **Project Settings → Experimental APIs** on. Lens Studio only lets a Lens open the plugin's
   `ws://127.0.0.1:47793` socket with it on.
2. Drag `NDKCapture__PLACE_IN_SCENE` into the scene.
3. On the `NDKCapture` component, assign **AR Texture** = the main camera's render target. For the
   optional ui layer, render your UI with a second camera into its own render target, assign it to
   **UI Texture** and tick **Ui Layer**.
4. Press Play. **Window → NDKCapture → Open Studio** (or open `http://127.0.0.1:47792`).
5. In the Studio's Live view, change a layer and watch the Lens follow; press **Record**, then
   **Stop & Save**. The recording is in `<project>/NDKCaptureRecordings/<id>/` and in the Studio's
   Edit library.

## 3. Spectacles

1. In **Window → NDKCapture** press **Accept Specs on my network**. The Lens socket now listens on
   every interface (port 47793); your firewall may ask once.
2. Set **Studio Url** to `ws://<your computer's LAN address>:47793` (both on the same Wi-Fi).
3. Push the Lens. The native module loads on device: the camera, AR and mic layers are encoded by
   SpecsRecorder and streamed; the camera proxy feeds the Studio preview.
4. Optional: set **Device Folder** to a writable folder on the device to also write the native
   tracks there, and tick **Record Composite** for a `SpecsCapture` MP4.

Turn LAN mode off again (**Local only**) when you're done.

## 4. SpecsNDK 1.1.0 (only to rebuild the module)

Download the SpecsNDK 1.1.0 SDK for your OS from https://github.com/specs-devs/ndk
(`specsndk-armv8-1.1.0-<darwin21|mingw32|linux>-x86_64.tar.xz`), extract it (for example to
`~/Dev/SpecsNDK-1.1.0`), then:

```bash
NDKCaptureModule/build.sh ~/Dev/SpecsNDK-1.1.0
```

The script builds `libNDKCaptureModule.so` and copies it into `Assets/NDKCapture.lspkg/Modules/`.
See [native module](native-module.md).
