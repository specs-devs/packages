# WebSocket Examples

Real-time WebSocket connectivity examples for connecting Specs to remote devices including ESP32, Arduino, Raspberry Pi, and any standards-compliant WebSocket server. This package provides three production-ready TypeScript scripts demonstrating simple text echo and advanced IMU sensor data visualization with full Logger support, SnapDecorators lifecycle management, comprehensive error handling, and dual logging controls for debugging connectivity, data parsing, and real-time communication workflows.

## Features

- **Text Echo Client** - Simple WebSocket connectivity test with bidirectional text and binary messaging
- **IMU Data Receiver** - Real-time motion tracking with CSV angle parsing and validation
- **3D Rotation Handler** - Smooth camera-following cube with quaternion rotation and position interpolation
- **Logger Integration** - Dual logging controls (general and lifecycle) from Utilities package
- **SnapDecorators** - Modern lifecycle binding with @bindStartEvent, @bindUpdateEvent, @bindDestroyEvent
- **Connection Management** - Automatic event handling with reconnection and status query APIs
- **Type Safety** - Full TypeScript typing with proper WebSocket interfaces
- **Public APIs** - External control methods for reconnection, message sending, and state queries
- **ESP32 Reference Implementations** - Complete Arduino (.ino) and ESP-IDF (C++) server examples included

## Quick Start

### Example 1: Text Echo (Testing Connectivity)

```typescript
import {TextEcho} from "WebSocketExamples.lspkg/Scripts/TextEcho";

@component
export class EchoTest extends BaseScriptComponent {
  @input textEcho: TextEcho;

  onAwake() {
    // Send custom message
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => {
      this.textEcho.sendMessage("Hello from Specs!");

      // Check status
      const status = this.textEcho.getConnectionStatus();
      print("Connected: " + status.isConnected);
    });
    delayed.reset(2); // Wait for connection
  }
}
```

### Example 2: IMU Visualization (Real-Time Sensor Data)

```typescript
import {IMUData} from "WebSocketExamples.lspkg/Scripts/IMUData";
import {IMUCube} from "WebSocketExamples.lspkg/Scripts/IMUCube";

@component
export class IMUController extends BaseScriptComponent {
  @input imuData: IMUData;
  @input imuCube: IMUCube;

  onAwake() {
    // Query connection
    const status = this.imuData.getConnectionStatus();
    print("IMU Server: " + status.url);

    // Get current rotation
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => {
      const rotation = this.imuCube.getCurrentRotation();
      print("Rotation: " + rotation);
    });
    delayed.reset(1);
  }
}
```

## Scene Setup Guidelines

### Example 1: Text Echo Setup

**Scene Structure:**
```
Scene
└── EchoController [SceneObject]
    └── TextEcho.ts [Script]
```

**Configuration Steps:**
1. Create new SceneObject named "EchoController"
2. Add `TextEcho.ts` script component
3. In Inspector, configure:
   - **Internet Module**: Create (Assets panel → Right-click → Create New → Internet Module), then assign
   - **IP Address**: Set to your server (e.g., `ws://192.168.1.100/ws`)
   - **Enable Logging**: Check to see connection events in console
4. Run lens and check Logger output for connection status

**What It Does:**
- Connects to WebSocket server on scene start
- Sends text message "Message 1"
- Sends binary message "Message 2"
- Logs all received echo responses
- Provides public API for sending custom messages

**Console Output Example:**
```
[TextEcho] Attempting to connect to ws://192.168.1.100/ws
[TextEcho] WebSocket Connected!
[TextEcho] Sending text: Message 1
[TextEcho] Received text: Message 1
```

### Example 2: IMU Visualization Setup

**Scene Structure:**
```
Scene
├── VisualizationCube [3D Object]
│   └── IMUCube.ts [Script]
└── IMUController [SceneObject]
    └── IMUData.ts [Script]
```

**Configuration Steps:**

1. **Create the Cube:**
   - Add 3D object (cube/sphere/any mesh) to scene
   - Add `IMUCube.ts` script to the object
   - **(Optional)** Assign **Cam Obj** to main camera for smooth following behavior

2. **Create the Controller:**
   - Create new SceneObject named "IMUController"
   - Add `IMUData.ts` script
   - In Inspector, configure:
     - **Internet Module**: Create and assign
     - **IP Address**: Set to ESP32 IMU server (e.g., `ws://192.168.1.100/ws`)
     - **Screen Text**: Create Text component in scene for status display, then assign
     - **Cube**: Assign the IMUCube script component reference
     - **Enable Logging**: Check to see angle data in console

3. Run lens and move your physical ESP32 device
4. The 3D object mirrors the device rotation in real-time

**What Each Script Does:**

**IMUData.ts** - Connection and data parsing:
- Connects to WebSocket server streaming IMU data
- Receives CSV format: `"angleX,angleZ,angleY"` (degrees)
- Validates and parses angle values
- Forwards parsed angles to IMUCube component
- Updates screen text with connection status
- Provides reconnection and status query API

**IMUCube.ts** - 3D visualization:
- Receives angle arrays from IMUData
- Converts Euler angles (degrees) to quaternion rotation
- Applies rotation to 3D object transform
- **(Optional)** Smoothly follows camera position (50cm in front) if camera assigned
- Uses lerp interpolation for natural movement
- Provides rotation query and reset API

**Data Flow:**
```
ESP32 IMU → WebSocket → IMUData (parse CSV) → IMUCube (apply rotation) → 3D Object
```

## Script Highlights

### TextEcho.ts

Simple WebSocket echo client for testing connectivity and learning WebSocket basics. Connects to any WebSocket server on scene start, sends initial text message "Message 1" and binary message "Message 2", receives and logs all responses (both text and binary frames), handles Blob binary data with async text() conversion, manages connection lifecycle with onopen/onmessage/onclose/onerror event handlers, implements proper cleanup in destroy event to close socket, includes comprehensive error handling with try-catch blocks, provides public sendMessage() API for external message transmission with connected state validation, exposes getConnectionStatus() for connection state queries, supports manual reconnection via reconnect() method, and includes dual logging controls (enableLogging for connection events, enableLoggingLifecycle for component lifecycle) for flexible debugging workflows.

**Use Case:** Testing WebSocket connectivity, debugging server implementations, learning WebSocket protocol basics, prototyping bidirectional communication patterns.

### IMUData.ts

IMU sensor data receiver for real-time motion tracking and 3D visualization. Connects to WebSocket server streaming IMU angle data in CSV format, parses comma-separated values "angleX,angleZ,angleY" in degrees, validates angle array length (must be exactly 3 values) and checks for NaN values before processing, forwards validated angles to IMUCube component via setRotationAngle(), displays connection status on screen Text component ("Connecting...", "Connected!", "Disconnected", "Connection error", "Socket error"), handles both text frames and Blob binary frames with async text conversion, implements connection lifecycle management with automatic socket creation and cleanup, provides public reconnect() API for manual connection restart, exposes getConnectionStatus() for external state queries returning isConnected boolean and server URL, includes comprehensive error handling for connection failures and data parsing issues, and features dual logging controls for debugging connection events and data reception.

**Use Case:** Real-time motion tracking from ESP32/Arduino IMU sensors, interactive AR experiences controlled by physical device movement, sensor data visualization, gesture-based controls.

**Expected Data Format:**
```
Server → Specs: "45.2,-10.5,30.1"
Format: CSV (Comma-Separated Values)
Values: angleX, angleZ, angleY (degrees, not radians)
Update Rate: ~50Hz recommended for smooth visualization
```

### IMUCube.ts

3D rotation handler for IMU data visualization with optional camera-following behavior. Receives angle arrays [x, y, z] in degrees from IMUData component, converts Euler angles to quaternion rotation using quat.fromEulerVec() with MathUtils.DegToRad conversion, applies world rotation to target object transform with setWorldRotation(), optionally implements smooth camera-following where object maintains fixed distance (50cm default) in front of camera if camera is assigned, uses vec3.lerp() for position interpolation with configurable follow speed (default: 6) when camera following is enabled, positions object along camera's forward vector using transform.forward.uniformScale(-CAM_DISTANCE), updates position and rotation every frame via @bindUpdateEvent, validates angle array length and checks for NaN before processing, includes comprehensive error handling for invalid data and transform operations, provides getCurrentRotation() API returning current angles in degrees as [x, y, z] array, exposes resetRotation() method to reset object to identity rotation (zero angles), features dual logging controls for debugging rotation updates and position changes, and supports optional camera object assignment for flexible scene hierarchies or static positioning.

**Use Case:** Used in conjunction with IMUData script to provide smooth 3D visualization of physical device orientation, creating mirror effects where virtual objects match real-world sensor movement. Camera following is optional for convenience but not required.

**Configuration:**
- **CAM_DISTANCE**: 50 (cm in front of camera, only used if camera assigned)
- **FOLLOW_SPEED**: 6 (lerp interpolation speed, only used if camera assigned)

## Core API Methods

### TextEcho

```typescript
// Configuration inputs
@input internetModule: InternetModule        // Required WebSocket connectivity
@input ipAddress: string                     // Server URL (e.g., "ws://192.168.1.100/ws")
@input enableLogging: boolean                // Connection events, messages sent/received
@input enableLoggingLifecycle: boolean       // Component lifecycle (onAwake, onStart, onDestroy)

// Public API
sendMessage(message: string): void           // Send custom text message
reconnect(): void                            // Manually reconnect to server
getConnectionStatus(): {
  isConnected: boolean,                      // True if socket state is OPEN (1)
  url: string                                // Configured server URL
}
```

### IMUData

```typescript
// Configuration inputs
@input internetModule: InternetModule        // Required WebSocket connectivity
@input ipAddress: string                     // ESP32/IMU server URL
@input screenText: Text                      // Status display component
@input cube: IMUCube                         // IMUCube component reference
@input enableLogging: boolean                // Connection events, angle data received
@input enableLoggingLifecycle: boolean       // Component lifecycle events

// Public API
reconnect(): void                            // Manually reconnect to server
getConnectionStatus(): {
  isConnected: boolean,                      // True if connected and ready
  url: string                                // Configured server URL
}

// Expected data format from server
// CSV: "angleX,angleZ,angleY" (degrees)
// Example: "45.2,-10.5,30.1"
```

### IMUCube

```typescript
// Configuration inputs
@input camObj: SceneObject                   // (Optional) Camera for smooth following - leave empty to disable
@input enableLogging: boolean                // Rotation updates, position changes
@input enableLoggingLifecycle: boolean       // Component lifecycle events

// Public API
setRotationAngle(angle: number[]): void      // Set rotation from angle array [x,y,z] in degrees
getCurrentRotation(): number[]               // Get current rotation as [x,y,z] degrees
resetRotation(): void                        // Reset to identity rotation (zero angles)

// Constants (only used if camera assigned)
const CAM_DISTANCE = 50;                     // Distance in front of camera (cm)
const FOLLOW_SPEED = 6;                      // Position lerp speed
```

## Hardware Setup

### ESP32 Server Examples (Included)

This package includes complete ESP32 reference implementations in two frameworks:

**Arduino Framework (Beginner-Friendly):**
- Located in: `INO/` folder
- `WebsocketExample.ino` - Simple echo server with LED feedback
- `ESP32/ESP32.ino` - IMU sensor streaming with MPU6050
- Uses Arduino IDE with WebSockets_Generic library
- Easy WiFi configuration with SSID/password constants

**ESP-IDF Framework (Professional):**
- Located in: `ESP-IDF/` folder
- Complete C++ project with CMake build system
- Production-grade echo server implementation
- Kconfig menu configuration (`idf.py menuconfig`)
- Static IP support, LED GPIO configuration
- Comprehensive documentation in included README.md

### Quick ESP32 Setup (Arduino)

**For Text Echo:**
1. Open `INO/WebsocketExample.ino` in Arduino IDE
2. Install WebSockets_Generic library (Library Manager)
3. Update WiFi credentials in code
4. Flash to ESP32, note IP from Serial Monitor
5. Update Specs ipAddress to match

**For IMU Visualization:**
1. Wire MPU6050 to ESP32: SDA→GPIO21, SCL→GPIO22, VCC→3.3V, GND→GND
2. Open `INO/ESP32/ESP32.ino` in Arduino IDE
3. Install WebSockets_Generic and MPU6050_light libraries
4. Update WiFi credentials
5. Flash to ESP32, note IP from Serial Monitor
6. Update Specs ipAddress to match
7. Move ESP32 to see cube mirror the movement

**Network Requirements:**
- Specs and ESP32 must be on same WiFi network
- Use router's DHCP to find ESP32 IP, or configure static IP
- Default WebSocket port: 80
- Default endpoint: `/ws`

### Alternative Servers

These scripts work with any WebSocket server (RFC 6455):
- **Node.js** (ws library)
- **Python** (websockets library)
- **Desktop** (local development server)
- **Raspberry Pi** (any language with WebSocket support)
- **Cloud Services** (AWS, Google Cloud, Azure WebSocket endpoints)

**Requirements:**
- Standard WebSocket protocol (RFC 6455)
- Same network as Specs device
- For IMU example: Must send CSV format `"angleX,angleZ,angleY"` in degrees

## Troubleshooting

### Connection Fails

**Symptom:** "Socket error" or immediate disconnection

**Solutions:**
1. Verify Specs and server on same WiFi network
2. Ping server IP from computer: `ping 192.168.1.100`
3. Confirm server is running and listening on correct port
4. Check firewall settings on server device
5. Test from browser first: Use Chrome DevTools Console:
   ```javascript
   const ws = new WebSocket("ws://192.168.1.100/ws");
   ws.onopen = () => console.log("Connected");
   ws.onerror = (e) => console.error("Error", e);
   ```

### No Data Received

**Symptom:** Connected but no console messages

**Solutions:**
1. Enable `enableLogging` on script to see all events
2. Verify server is actually sending data (check server logs)
3. For IMU: Ensure format is exactly `"x,y,z"` with no spaces
4. Check Text component is assigned (IMUData)
5. Verify IMUCube component reference is assigned (IMUData)

### Cube Not Rotating

**Symptom:** Connected but cube doesn't move

**Solutions:**
1. Check IMUCube script is assigned to `cube` input in IMUData
2. Enable logging to see if angles are being received
3. Confirm data format: `"angleX,angleZ,angleY"` (CSV, degrees)
4. Test with known values: Temporarily hardcode angles in IMUData to verify IMUCube works
5. Note: If cube is not following camera, ensure `camObj` is assigned (optional feature)

## Additional Resources

- **Included ESP32 Examples**: See `INO/` and `ESP-IDF/` folders for complete server implementations
- [WebSocket Protocol (RFC 6455)](https://tools.ietf.org/html/rfc6455)
- [Lens Studio Documentation](https://docs.snap.com/lens-studio/)
- [ESP32 Getting Started](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/)
- [SnapDecorators Documentation](https://developers.snap.com/lens-studio/references/guides/lens-features/adding-interactivity/helper-scripts/snap-decorators)

---

*Maintained with 👽 by the SPECS Team*








