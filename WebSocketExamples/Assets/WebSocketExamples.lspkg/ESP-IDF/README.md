# ESP32 WebSocket Echo Sample

A reference-quality ESP32 C++ project demonstrating a WebSocket Echo server.

## Features

- **Language**: C++
- **Protocol**: WebSocket (Echo)
- **Networking**: Station Mode (Connects to existing WiFi) with Static IP support.
- **Feedback**: Activity-based LED pulsing (LED flashes only when data is processed).

## Hardware Required

- ESP32 Development Board (e.g., ESP32-DevKitC, ESP32-S3, etc.).
- A USB cable for power and programming.

## Setup & Configuration

1. **Install ESP-IDF**:
   Ensure you have the ESP-IDF development environment set up. Follow the official [ESP-IDF Getting Started Guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/).

2. **Configure ESP-IDF Parameters**:

   Before building, you need to configure ESP-IDF for your specific board:

   - **Flash Method**: Select `UART` for flashing (default for most ESP32 boards)
   - **Board Type**: Select your ESP32 variant (e.g., `ESP32` for base model, `ESP32-S3`, etc.)
   - **Port**: ESP-IDF can automatically detect the port, or you can use the script:
     ```bash
     idf.py flash
     ```
     The script will prompt you to select the port if multiple are found.

   **Note**: Project configuration can be done using the Python command-line tools (`idf.py menuconfig`) OR through the ESP-IDF IDE extension commands in VS Code/other IDEs.

3. **Configure Project**:

   Run the configuration menu:

   ```bash
   idf.py menuconfig
   ```

   Or use the ESP-IDF IDE extension configuration commands.

   Navigate to **Application Configuration**:

   - **WiFi Configuration**:

     - `WiFi SSID`: Enter your network name.
     - `WiFi Password`: Enter your network password.
     - `Use Static IP`: Enable this if you need a fixed IP.
       - `Static IP Address`: e.g., `192.168.1.100` (see below for finding your network range)
       - `Subnet Mask`: e.g., `255.255.255.0` (Verify this matches your router settings).
       - `Gateway Address`: e.g., `192.168.1.1` (typically your router's IP)

   - **LED Configuration**:
     - `LED GPIO Number`: Set the pin number (e.g., 2 or 5 for most ESP32 boards).

   Navigate to **Component config** → **HTTP Server**:

   - **WebSocket support**: Enable this option (required for WebSocket functionality).
     - Path: `Component config` → `HTTP Server` → `[*] WebSocket support`
     - You can also search for `HTTPD_WS_SUPPORT` in menuconfig (press `/` to search).

4. **Build and Flash**:
   Build the project, flash it to the board, and open the serial monitor:

   ```bash
   idf.py build flash monitor
   ```

   **Note**: This can also be done using the ESP-IDF IDE extension commands in VS Code/other IDEs.

## Troubleshooting

### Flashing Issues

If flashing hangs or fails:

1. **Put ESP32 into download mode manually**:
   - Hold the **BOOT** button (or GPIO0)
   - Press and release the **RESET** button while holding BOOT
   - Release the **BOOT** button
   - Then retry flashing

2. **Try different flash methods**:
   - In `idf.py menuconfig`, navigate to **Serial flasher config**
   - Try both **ESP-PROG** and **ESP-PROG2-2** options if available
   - Some boards work better with one method over the other

3. **Lower baud rate**:
   ```bash
   idf.py flash --baud 115200
   ```

4. **Check serial port**:
   - Verify the correct port is selected
   - Ensure no other program is using the serial port
   - Try unplugging and replugging the USB cable

## Finding Your Network IP Configuration

To determine what IP address to use for static IP configuration:

### On macOS:

1. Open **System Settings** > **Network**
2. Select your active WiFi connection
3. Click **Details** or **Advanced**
4. Note the **Router** IP address (this is your gateway, e.g., `192.168.1.1`)
5. Check your current IP address (e.g., `192.168.1.50`)
6. Use an IP in the same subnet range (e.g., `192.168.1.100`)

Alternatively, use Terminal:

```bash
netstat -rn | grep default
```

This shows your gateway IP. Your network range will be similar (e.g., if gateway is `192.168.1.1`, use `192.168.1.x`).

### On Windows:

1. Open **Settings** > **Network & Internet** > **Wi-Fi**
2. Click on your connected network
3. Scroll down to find **IPv4 address** and **IPv4 DNS servers**
4. The gateway/router IP is typically the first three octets with `.1` (e.g., if your IP is `192.168.1.50`, gateway is likely `192.168.1.1`)
5. Use an IP in the same subnet range (e.g., `192.168.1.100`)

Alternatively, use Command Prompt:

```cmd
ipconfig
```

Look for **Default Gateway** under your WiFi adapter. Use an IP in the same subnet (e.g., if gateway is `192.168.1.1`, use `192.168.1.x`).

## Testing

Once the device connects to WiFi, you will see the IP address in the logs (e.g., `Got IP: 192.168.1.100`).

### 1. Connection Test (Ping)

Open a terminal on your computer and ping the device:

```bash
ping <DEVICE_IP_ADDRESS>
```

### 2. WebSocket Test (Python)

Use the provided Python script to test the echo server. The script sends messages every second.

1. Set up a virtual environment (recommended):

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

   Or install directly:

   ```bash
   pip install websockets
   ```

3. Run the script (update the IP inside `test_ws.py` if necessary):

   ```bash
   python3 test_ws.py
   ```

   Or if using the virtual environment:

   ```bash
   venv/bin/python test_ws.py
   ```

   The script will continuously send messages every second. Press `Ctrl+C` to stop.

### 3. WebSocket Test (Browser)

1. Open your browser's Developer Tools (F12) > Console.
2. Run the following JavaScript (replace IP with your device's IP):
   ```javascript
   var ws = new WebSocket("ws://<DEVICE_IP_ADDRESS>/ws")
   ws.onopen = function () {
     ws.send("Hello ESP32")
   }
   ws.onmessage = function (e) {
     console.log("Echo: " + e.data)
   }
   ```

You should see "Echo: Hello ESP32" in the console, and the LED on the ESP32 will pulse once.

**Note**: If using a static IP, make sure to update the IP address in `test_ws.py` to match your configured static IP address.
