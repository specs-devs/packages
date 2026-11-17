<p align="center">
  <img src="Docs/media/MocopiReceiver.png" width="250px" alt="MocopiReceiver"/>
</p>

# Mocopi Receiver

MocopiReceiver receives Sony mocopi skeleton/frame JSON over WebSocket and drives a placed avatar with bone mapping, coordinate conversion and interpolation. The example instantiates a basic avatar after SurfacePlacement. The original sensor/relay setup tutorial is preserved in [Guide](Docs/guide.md).

> This independent community project is not officially affiliated with, sponsored by, or endorsed by Sony or Snap Inc. The original tutorial targets the standard six-sensor kit; twelve-sensor Pro behavior was not validated.

## Usage

This section ships with the package and describes the exact installed source revision. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; package-specific wiring, protocol and limitations live here.

### Package identity

- Descriptor [package.native](package.native) (the package version lives there); existing ReadMe preserved, empty SetupScript, no instantiable root.
- Editable source and consumer prefix: `Assets/MocopiReceiver.lspkg/` and `MocopiReceiver.lspkg/`, e.g. `MocopiReceiver.lspkg/Scripts/MocopiWebSocketClient`.
- [Dependency manifest](package_dependencies.json): SnapDecorators, InteractionKit, UIKit, SurfacePlacement, Utilities, Motion, Icons (see `package_dependencies.json`). The receiver scripts import SnapDecorators, InteractionKit (`Utils/NativeLogger`), SurfacePlacement and Utilities; the `Example/` scaffolding imports UIKit and InteractionKit.
- Demo [MocopiReceiver__PLACE_IN_SCENE.prefab](MocopiReceiver__PLACE_IN_SCENE.prefab); nested [basic avatar prefab](Prefabs/BasicAvatar/MocopiBasicAvatar/MocopiBasicAvatar.prefab).
- The demo prefab is self-contained: it includes the onboarding guide (`Guide`), the `ExampleCarousel` panel and the `MocopiReceiverExample` group (surface placement + Reset). Drop it into a Specs scene that already has a Camera with DeviceTracking and InteractionKit.
- Demo scaffolding: `MocopiReceiver.lspkg/Example/` holds `ExampleCarousel` and `GuideDismissPanel`. They only present the demo; the receiver scripts don't import them.
- Relay resources: [LocalServerExample](LocalServerExample/) (`server.py` + `start_server.sh` local WebSocket relay, `server_forwarder.py` + `start_forwarder.sh` UDP-to-cloud forwarder, `requirements.txt`) and [HostedServerExample](HostedServerExample/) (`server.py`, `Procfile`, `railway.json`, `runtime.txt`, `requirements.txt` for a hosted relay). Neither relay is started or deployed by the package; run your own. See [Guide](Docs/guide.md#network-setup).
- Assets: materials `Materials/MocopiBone.mat`, `Materials/MocopiJoint.mat` and the basic avatar's `Prefabs/BasicAvatar/MocopiBasicAvatar/Materials/MatXRay_1.mat`; shaders `Shaders/image_unlit.graphShader`, `Shaders/uber_pbr.graphShader`.

### Version and API status

Read [API status](Docs/api-status.md) for current methods and known source gaps. Single callback fields are not subscription events. The tutorial's placeholder URLs and setup fragments are not proof of a functioning connection.

### Applicability

Use for a mocopi relay that emits `skeleton_definition` before `frame_data` and for an avatar with compatible bone naming. SurfacePlacement positions the avatar root; frame updates use bone-local transforms. This package does not make a missing relay or hardware stream work offline.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for prefab/callback/skeleton order.
- [API status](Docs/api-status.md): compatibility, callback ownership and source gaps.
- [Components](Docs/components.md): every input, public method, callback and data shape.
- [Examples](Docs/examples.md): typed status observer and callback wrapper.
- [Troubleshooting](Docs/troubleshooting.md): connection, placement, mapping and smoothing symptoms.
- [Guide](Docs/guide.md): original long setup tutorial and relay architecture.

### Verification

1. TypeScript compiles clean with the installed companion builds, without `as any` in consumer code.
2. Set a valid relay URL on the avatar prefab; its current serialized value contains `something like -` and is not a valid URL.
3. On device, verify surface placement, avatar instantiation and Reset without duplicated/stale avatar instances. The Lens Studio Preview returns no WorldQuery hits, so placement never completes there; in Preview, drop `MocopiBasicAvatar.prefab` in front of the camera with `autoConnect` off to check rendering and init logs.
4. With a real relay, observe skeleton receipt, mapping stats and at least two motion frames, plus status and reconnect behavior.
5. Verify coordinate conversion and finite smoothing below 1 on the actual rig/device. Keep offline missing-server/hardware limitations explicit.

## Built with 👽 by the SPECS team 

---

[See more packages](https://github.com/specs-devs/packages)

