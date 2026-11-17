# WebSocket Examples

## What it is
A package of example WebSocket clients for Specs, plus reference server sources for microcontrollers. `TextEcho`
tests a WebSocket server by sending and logging echoed messages; `IMUData` and `IMUCube` stream sensor angles from
a board and rotate a cube with them. It is for developers connecting a Lens to their own server or hardware (for
example an ESP32) over a WebSocket. It needs a reachable server you configure yourself; it does not work out of
the box.

## What it does
- `WebSocketExamples__PLACE_IN_SCENE.prefab` shows a guide ("Ok, I understood") and an example carousel with two
  steps: Text Echo and IMU Visualization.
- Text Echo: on start, `TextEcho` opens a WebSocket to `ipAddress` through the `InternetModule`, sends
  `"Message 1"` (text) and `"Message 2"` (binary) on open, and logs every message it receives. It is log-only.
- IMU Visualization: `IMUData` connects, shows the connection status in a Text under the cube, sends
  `HI FROM Glasses` on open, parses each `x,y,z` CSV message into three angles and passes them to
  `IMUCube`, which sets the cube's world rotation. The cube can optionally follow a camera.
- While `ipAddress` is still the placeholder `ws://YOUR-IP-ADDRESS/ws`, both scripts stay idle and report
  "Setup required" instead of connecting.
- Reference servers ship in the package: an Arduino ESP32 echo sketch, an Arduino ESP32 + MPU6050 IMU streamer,
  and an ESP-IDF echo server with a desktop test client.

## Highlights
- Minimal, readable WebSocket clients built on `InternetModule`, with `reconnect()`, `getConnectionStatus()` and
  (in `TextEcho`) `sendMessage()`.
- Text and binary message handling, including Blob payloads.
- Simple CSV angle protocol from hardware to a 3D object, with `setRotationAngle`, `getCurrentRotation` and
  `resetRotation` on `IMUCube`.
- Hardware sources for both the Arduino and ESP-IDF toolchains.
- Clear setup messages in the Logger and on screen when the server URL is not set.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/TextEcho.ts` | Connects, sends test text and binary messages, logs echoes. |
| `Scripts/IMUData.ts` | Connects, shows status, parses `x,y,z` CSV angles and forwards them to the cube. |
| `Scripts/IMUCube.ts` | Applies received angles as world rotation, with optional camera follow. |
| `INO/ESP32/ESP32.ino` | Arduino ESP32 + MPU6050 sketch that streams angle CSV. |
| `INO/WebsocketExample.ino` | Arduino ESP32 text echo server. |
| `ESP-IDF/main/main.cpp` | ESP-IDF WebSocket echo server on `/ws`. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that steps between the two examples. |

## Extra info
- **Requires:** SnapDecorators, Utilities, InteractionKit, UIKit, Motion, Icons. A WebSocket server reachable from
  Specs (the sample baseline is the same network) and its full URL set on both `TextEcho` and `IMUData`. Real
  connections and hardware behaviour can only be verified on Specs; the Lens Studio Preview shows the setup
  messages. Reconnect is manual (`reconnect()`). The shipped IMU sketch sends angles in X,Z,Y order while the Lens
  applies them as X,Y,Z, so check the axis mapping for your board. Use your own Wi-Fi values in the sketches.
- **Get started:** drag `WebSocketExamples__PLACE_IN_SCENE.prefab` into an empty Specs scene with a Camera and the
  Interaction Kit (SIK) prefab, run a server from `INO/` or `ESP-IDF/`, and set `ipAddress` on both scripts.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): first-use rules and CSV axis behaviour.
  - [components.md](components.md): every input, public method and lifecycle hook.
  - [examples.md](examples.md): typed status / send and offline rotation consumers.
  - [hardware.md](hardware.md): the shipped Arduino and ESP-IDF sources and their setup.
  - [guide.md](guide.md): the original setup and API tutorial.
  - [troubleshooting.md](troubleshooting.md): placeholder, lifetime, parsing and hardware issues.
  - [api-status.md](api-status.md): current capabilities and known gaps.
