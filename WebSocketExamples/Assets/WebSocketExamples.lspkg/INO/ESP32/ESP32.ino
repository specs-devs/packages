/**
 * @file ESP32.ino
 * @brief IMU WebSocket Server - Sends MPU6050 euler angles over WebSocket
 *
 * This example demonstrates:
 * 1. Connecting to WiFi (Station Mode)
 * 2. Initializing and calibrating MPU6050 IMU
 * 3. Starting a WebSocket server
 * 4. Streaming IMU euler angles to connected clients
 *
 * Hardware Required:
 * - ESP32 Development Board
 * - MPU6050 IMU module (connected via I2C)
 * - USB cable for power and programming
 *
 * Libraries Required:
 * - WiFi (built-in ESP32)
 * - WebSockets_Generic by Khoi Hoang (install via Library Manager)
 * - MPU6050_light by rfetick (install via Library Manager)
 *
 * Wiring:
 * - MPU6050 VCC -> ESP32 3.3V
 * - MPU6050 GND -> ESP32 GND
 * - MPU6050 SDA -> ESP32 GPIO 21 (default I2C SDA)
 * - MPU6050 SCL -> ESP32 GPIO 22 (default I2C SCL)
 *
 * How to use:
 * 1. Install required libraries via Arduino Library Manager
 * 2. Update WIFI_SSID and WIFI_PASSWORD below
 * 3. Upload to your ESP32
 * 4. Open Serial Monitor to see the ESP32's IP address
 * 5. Connect from Spectacles using ws://<ESP32_IP>/ws
 */

#if !defined(ESP32)
  #error This code is intended to run only on the ESP32 boards ! Please check your Tools->Board setting.
#endif

#include <WiFi.h>
#include <WebSocketsServer_Generic.h>
#include <MPU6050_light.h>
#include <Wire.h>

// ============================================================================
// CONFIGURATION - Update these values for your setup
// ============================================================================

// WiFi Credentials (set password to "" for open networks)
const char* WIFI_SSID = "ssid";
const char* WIFI_PASSWORD = "password";  // Empty for open network

// Optional: Static IP Configuration
//10.236.19.100
//gateway: 10.236.19.15
IPAddress staticIP(10, 236, 19, 100);
IPAddress gateway(10, 236, 19, 15);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

// WebSocket Server Configuration
const int WEBSOCKET_PORT = 80;

// IMU update interval in milliseconds
const int IMU_UPDATE_INTERVAL_MS = 10;

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

WebSocketsServer webSocket = WebSocketsServer(WEBSOCKET_PORT);
MPU6050 mpu(Wire);

bool clientConnected = false;
uint8_t connectedClientNum = 0;
unsigned long lastIMUUpdate = 0;

// ============================================================================
// WEBSOCKET EVENT HANDLER
// ============================================================================

void webSocketEvent(const uint8_t& num, const WStype_t& type, uint8_t* payload, const size_t& length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[%u] Disconnected!\n", num);
            if (num == connectedClientNum) {
                clientConnected = false;
            }
            break;

        case WStype_CONNECTED: {
            IPAddress ip = webSocket.remoteIP(num);
            Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\n",
                          num, ip[0], ip[1], ip[2], ip[3], payload);
            clientConnected = true;
            connectedClientNum = num;
            break;
        }

        case WStype_TEXT:
            // Handle incoming messages from Spectacles
            Serial.printf("[%u] Received: %s\n", num, payload);
            break;

        case WStype_ERROR:
            Serial.printf("[%u] Error!\n", num);
            break;

        default:
            break;
    }
}

// ============================================================================
// WIFI CONNECTION FUNCTION
// ============================================================================

void connectToWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);

     if (!WiFi.config(staticIP, gateway, subnet, dns)) {
         Serial.println("Failed to configure static IP!");
     }
    // Connect - handles both open and password-protected networks
    if (strlen(WIFI_PASSWORD) == 0) {
        WiFi.begin(WIFI_SSID);
    } else {
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }

    int retryCount = 0;
    const int MAX_RETRIES = 20;

    while (WiFi.status() != WL_CONNECTED && retryCount < MAX_RETRIES) {
        delay(500);
        Serial.printf(".[%d]", WiFi.status());  // Debug: show status code
        retryCount++;
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("WiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("WiFi connection failed!");
        Serial.println("Please check your credentials and try again.");
    }
}

// ============================================================================
// IMU INITIALIZATION
// ============================================================================

void initIMU() {
    Wire.begin();
    byte status = mpu.begin();
    Serial.print(F("MPU6050 status: "));
    Serial.println(status);

    while (status != 0) {
        Serial.println(F("MPU6050 connection failed! Retrying..."));
        delay(1000);
        status = mpu.begin();
    }

    Serial.println(F("Calculating offsets, do not move MPU6050"));
    delay(1000);
    mpu.calcOffsets();
    Serial.println(F("IMU calibration done!"));
}

// ============================================================================
// ARDUINO SETUP FUNCTION
// ============================================================================

void setup() {
    Serial.begin(115200);

    // Wait for Serial Monitor
    delay(1000);

    Serial.println("\n========================================");
    Serial.println("ESP32 IMU WebSocket Server");
    Serial.println("========================================\n");

    // Initialize IMU first
    initIMU();

    // Connect to WiFi
    connectToWiFi();

    // Start WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    Serial.printf("WebSocket server started on port %d\n", WEBSOCKET_PORT);
    Serial.print("Connect to: ws://");
    Serial.print(WiFi.localIP());
    Serial.println("/ws");
    Serial.println();
}

// ============================================================================
// ARDUINO LOOP FUNCTION
// ============================================================================

void loop() {
    // Handle WebSocket events
    webSocket.loop();

    // Send IMU data if client is connected
    if (clientConnected) {
        unsigned long currentTime = millis();
        if (currentTime - lastIMUUpdate >= IMU_UPDATE_INTERVAL_MS) {
            lastIMUUpdate = currentTime;

            // Update IMU readings
            mpu.update();

            // Format: "angleX,angleZ,angleY" (same format as original BLE version)
            String msg = String(mpu.getAngleX()) + "," +
                         String(mpu.getAngleZ()) + "," +
                         String(mpu.getAngleY());

            // Send to connected client
            webSocket.sendTXT(connectedClientNum, msg);
        }
    }

    // Reconnect WiFi if connection is lost
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi connection lost. Reconnecting...");
        connectToWiFi();
    }
}
