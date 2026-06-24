/**
 * @file WebsocketExample.ino
 * @brief WebSocket Echo Server with LED Feedback (Arduino Version)
 *
 * This example demonstrates:
 * 1. Connecting to WiFi (Station Mode)
 * 2. Starting a WebSocket server that listens for incoming messages
 * 3. Echoing any received text message back to the sender
 * 4. Toggling an LED to provide visual feedback for every message received
 *
 * Hardware Required:
 * - ESP32 Development Board
 * - USB cable for power and programming
 *
 * Libraries Required:
 * - WiFi (built-in ESP32)
 * - WebSockets_Generic by Khoi Hoang (install via Library Manager)
 *   Based on WebSockets library by Markus Sattler
 *
 * How to use:
 * 1. Install the WebSockets_Generic library via Arduino Library Manager
 * 2. Update WIFI_SSID and WIFI_PASSWORD below with your network credentials
 * 3. Update LED_PIN if your board uses a different pin (default is GPIO 2)
 * 4. Upload to your ESP32
 * 5. Open Serial Monitor to see the ESP32's IP address
 * 6. Connect to ws://<ESP32_IP>/ws using a WebSocket client
 * 7. Send a message and watch the LED toggle!
 */

#if !defined(ESP32)
  #error This code is intended to run only on the ESP32 boards ! Please check your Tools->Board setting.
#endif

#include <WiFi.h>
#include <WebSocketsServer_Generic.h>

// ============================================================================
// CONFIGURATION - Update these values for your setup
// ============================================================================

// WiFi Credentials (set password to "" for open networks)
const char* WIFI_SSID = "Starbucks5G";
const char* WIFI_PASSWORD = "bluehouse";

// Optional: Static IP Configuration (set to 0.0.0.0 to use DHCP)
// Uncomment and configure if you need a static IP:

IPAddress staticIP(10, 236, 19, 100);
IPAddress gateway(10, 236, 19, 15);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);


// LED Configuration
const int LED_PIN = 2;  // GPIO pin for LED (GPIO 2 is common on ESP32 boards)

// WebSocket Server Configuration
const int WEBSOCKET_PORT = 80;  // Port for WebSocket server

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

WebSocketsServer webSocket = WebSocketsServer(WEBSOCKET_PORT);
int ledState = LOW;  // Current state of the LED

// ============================================================================
// WEB SOCKET EVENT HANDLER
// ============================================================================

/**
 * @brief Handle WebSocket events
 *
 * This function is called by the WebSocketsServer library whenever an event occurs:
 * - WStype_CONNECTED: A client connects
 * - WStype_DISCONNECTED: A client disconnects
 * - WStype_TEXT: Text data is received from a client
 * - WStype_BIN: Binary data is received from a client
 */
void webSocketEvent(const uint8_t& num, const WStype_t& type, uint8_t * payload, const size_t& length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[%u] Disconnected!\n", num);
            break;

        case WStype_CONNECTED: {
            IPAddress ip = webSocket.remoteIP(num);
            Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\n",
                          num, ip[0], ip[1], ip[2], ip[3], payload);
            break;
        }

        case WStype_TEXT:
            // Echo the received message back to the client
            Serial.printf("[%u] Received: %s\n", num, payload);

            // Send the message back (echo)
            webSocket.sendTXT(num, payload, length);

            // Toggle LED for visual feedback
            ledState = !ledState;
            digitalWrite(LED_PIN, ledState);
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

/**
 * @brief Connect to WiFi network
 *
 * Attempts to connect to the configured WiFi network.
 * Blocks until connection is established or fails after retries.
 */
void connectToWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);

    // Configure static IP if defined
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
        // In a real application, you might want to restart or enter AP mode here
    }
}

// ============================================================================
// ARDUINO SETUP FUNCTION
// ============================================================================

void setup() {
    // Initialize Serial communication
    Serial.begin(115200);

    // Wait for Serial Monitor to connect (ESP32 Serial is always "ready",
    // but this delay helps avoid garbled boot messages)
    delay(1000);

    Serial.print("\nStarting ESP32_WebSocketServer on ");
    Serial.println(ARDUINO_BOARD);
    Serial.println(WEBSOCKETS_GENERIC_VERSION);
    Serial.println();

    // Configure LED pin
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    Serial.printf("LED configured on GPIO %d\n", LED_PIN);

    // Connect to WiFi
    connectToWiFi();

    // Start WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    Serial.printf("WebSocket server started on port %d\n", WEBSOCKET_PORT);
    Serial.println("Ready! Connect to ws://<ESP32_IP>/ws");
    Serial.println();
}

// ============================================================================
// ARDUINO LOOP FUNCTION
// ============================================================================

void loop() {
    // Handle WebSocket events (must be called regularly)
    webSocket.loop();

    // Optional: Reconnect WiFi if connection is lost
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi connection lost. Reconnecting...");
        connectToWiFi();
    }
}
