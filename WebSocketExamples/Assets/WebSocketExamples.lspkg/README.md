<p align="center">
  <img src="Docs/media/WebSocketExamples.png" width="250px" alt="WebSocketExamples"/>
</p>

# WebSocket Examples

TextEcho tests a remote WebSocket server; IMUData parses sensor CSV and IMUCube applies world rotation. Arduino/ESP-IDF server references ship with the package. A reachable, explicitly configured server is required; this sample does not work out of the box. The original long tutorial is preserved in [Guide](Docs/guide.md).

## Usage

This section ships with the package and describes its exact source revision. Generic Lens scripting, scene construction and Specs spatial design live in CLAD skills; exact package APIs, protocol, wiring and limitations live here.

### Package identity

- [package.native](package.native) holds the package version; existing ReadMe preserved, SetupScript empty and no instantiable root.
- Consumer prefix `WebSocketExamples.lspkg/`; editable `Assets/WebSocketExamples.lspkg/`. Example `WebSocketExamples.lspkg/Scripts/TextEcho`.
- [Manifest](package_dependencies.json): SnapDecorators, Utilities, SpectaclesInteractionKit, SpectaclesUIKit, Motion, Icons.
- [WebSocketExamples__PLACE_IN_SCENE.prefab](WebSocketExamples__PLACE_IN_SCENE.prefab) wires InternetModule, status Text and cube. Set both server URLs: each script ships with `ws://YOUR-IP-ADDRESS/ws` and stays idle until it is replaced. The IMU cube sits 80 cm in front of the prefab origin with its status line below it.
- The prefab is self-contained: dropping it into an empty Specs scene (Camera + SIK/UIKit) gives the full demo — a Guide panel (dismissed with "Ok, I understood"), then an ExampleCarousel that steps through Text Echo and IMU Visualization. The demo scaffolding scripts ship in [Example/](Example/) (`ExampleCarousel`, `GuideDismissPanel`); see [Components](Docs/components.md).

### Version and API status

Read [API status](Docs/api-status.md). Reconnect is explicit/manual; rotation is immediate while optional camera-follow position is interpolated. The original tutorial's stronger reliability/validation claims are not implementation guarantees.

### Applicability

Use for WebSocket connectivity demonstrations and three-angle sensor visualization. It provides client components and reference server source, not server discovery, authentication, automatic reconnection, calibrated sensor axes or a built-in device simulator.

### Related CLAD skills

[specs-websocket](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-websocket/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): first-use rules and CSV axis behavior.
- [API status](Docs/api-status.md): current capabilities and source gaps.
- [Components](Docs/components.md): every input, public method and lifecycle hook.
- [Examples](Docs/examples.md): typed status/send and offline rotation consumers.
- [Troubleshooting](Docs/troubleshooting.md): placeholder, lifetime, parsing and hardware issues.
- [Hardware](Docs/hardware.md): shipped Arduino/ESP-IDF behavior and setup differences.
- [Guide](Docs/guide.md): preserved original setup/API tutorial.

### Verification

1. Compile is clean (no `as any`); `TextEcho`, `IMUData` and `IMUCube` resolve on the prefab instance, InternetModule is assigned to both network scripts.
2. With the placeholder URL, Preview logs `SETUP REQUIRED` for both scripts, `Cannot connect: 'IP Address' is still the placeholder`, no socket error; the IMU status line reads `Setup required - set IP Address (see README)` under the cube, 80 cm in front.
3. Against your own echo server, with TextEcho `enableLogging` on (the prefab ships it on): the Logger shows `Message 1` (text) and `Message 2` (binary, if the server echoes binary — the Arduino sketch does not); `sendMessage` only sends when connected.
4. Against an IMU server: the status reads `Connected!` and the cube follows the streamed `x,y,z` angles; check the axis order (the shipped ESP32 sketch sends X,Z,Y) and `reconnect()` after a disconnect.
5. Hardware/server behavior is not provable in the Preview — verify on Specs on the same network as the server.

## Built with 👽 by the SPECS team
