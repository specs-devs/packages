/**
 * @file main.cpp
 * @brief WebSocket Echo Server with LED Feedback
 *
 * This example demonstrates:
 * 1. Connecting to WiFi (Station Mode) via a helper function.
 * 2. Starting a WebSocket server that listens for incoming messages.
 * 3. Echoing any received text message back to the sender.
 * 4. Toggling an LED to provide visual feedback for every message received.
 *
 * How to use:
 * - Configure your WiFi SSID and Password in 'idf.py menuconfig' -> 'Example Configuration'.
 * - Flash the code to your ESP32.
 * - Monitor the output to find the ESP32's IP address.
 * - Connect to ws://<ESP32_IP>/ws using a WebSocket client (e.g., Postman, wscat).
 * - Send a message and watch the LED toggle!
 */

#include <vector>
#include "esp_log.h"
#include "nvs_flash.h"
#include "driver/gpio.h"
#include "esp_http_server.h"
#include "wifi_connect.h" // Simplified WiFi connection helper

static const char *TAG = "app";

// LED Configuration
// This maps the Kconfig value (set in menuconfig) to a GPIO number type.
static const gpio_num_t LED_GPIO = static_cast<gpio_num_t>(CONFIG_LED_GPIO);

/**
 * @brief WebSocket Handler
 *
 * This function is called by the HTTP server whenever a request is made to /ws.
 * It handles the WebSocket handshake and processes incoming frames.
 *
 * @param req The HTTP request structure provided by ESP-IDF.
 * @return esp_err_t ESP_OK on success, or an error code.
 */
static esp_err_t echo_handler(httpd_req_t *req) {
    // 1. Handshake: If the request is a GET request, it's the initial WebSocket handshake.
    // The server library handles the handshake details automatically if we return ESP_OK.
    if (req->method == HTTP_GET) {
        ESP_LOGI(TAG, "Handshake done, new connection opened");
        return ESP_OK;
    }

    // 2. Prepare to receive a WebSocket frame
    httpd_ws_frame_t ws_pkt = {};
    ws_pkt.type = HTTPD_WS_TYPE_TEXT; // We expect text frames

    // 3. First call: Get the length of the incoming frame
    // Passing max_len=0 allows us to inspect the frame header (specifically 'len')
    // before allocating memory for the payload.
    esp_err_t ret = httpd_ws_recv_frame(req, &ws_pkt, 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "httpd_ws_recv_frame failed to get frame len: %d", ret);
        return ret;
    }

    // 4. If there is a payload, allocate memory and receive it
    if (ws_pkt.len) {
        // Use std::vector for automatic memory management (RAII).
        // It will automatically free the memory when 'buf' goes out of scope.
        // We add +1 for a null terminator, just in case we want to treat it as a C-string.
        std::vector<uint8_t> buf(ws_pkt.len + 1);

        ws_pkt.payload = buf.data(); // Point the packet payload to our buffer

        // Second call: Actually read the payload data into our buffer
        ret = httpd_ws_recv_frame(req, &ws_pkt, ws_pkt.len);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "httpd_ws_recv_frame failed: %d", ret);
            return ret;
        }

        // 'ws_pkt.payload' is now filled with the message.
        // Since we zero-initialized the vector, the byte at [len] is 0, so it's safe to print.
        ESP_LOGI(TAG, "Received: %s", ws_pkt.payload);

        // 5. Echo back the same message
        ret = httpd_ws_send_frame(req, &ws_pkt);
        if (ret == ESP_OK) {
            // 6. Visual Feedback: Toggle the LED
            // 'static' means this variable keeps its value between function calls.
            static int led_state = 0;
            led_state = !led_state;
            gpio_set_level(LED_GPIO, led_state);
        } else {
            ESP_LOGE(TAG, "httpd_ws_send_frame failed: %d", ret);
        }
    }
    return ret;
}

// URI Handler Configuration
// This struct tells the server how to route requests.
static const httpd_uri_t ws = {
    .uri = "/ws",                       // The endpoint (e.g., ws://192.168.1.5/ws)
    .method = HTTP_GET,                 // WebSockets start with a GET request
    .handler = echo_handler,            // Function to call when this URI is hit
    .user_ctx = nullptr,                // No user context needed
    .is_websocket = true,               // Enable WebSocket support for this handler
    .handle_ws_control_frames = false,  // Let us handle PING/PONG if we want (or ignore)
    .supported_subprotocol = nullptr    // No specific sub-protocol (like 'chat', 'mqtt')
};

/**
 * @brief Start the Web Server
 *
 * Initializes the HTTP server and registers the WebSocket URI handler.
 */
static httpd_handle_t start_webserver() {
    httpd_handle_t server = nullptr;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();

    ESP_LOGI(TAG, "Starting server on port: %d", config.server_port);

    // Start the httpd server
    if (httpd_start(&server, &config) == ESP_OK) {
        ESP_LOGI(TAG, "Registering URI handlers");
        httpd_register_uri_handler(server, &ws);
        return server;
    }

    ESP_LOGI(TAG, "Error starting server!");
    return nullptr;
}

/**
 * @brief Main Application Entry Point
 *
 * This function is called by the FreeRTOS scheduler after boot.
 */
extern "C" void app_main(void) {
    // 1. Initialize NVS (Non-Volatile Storage)
    // This is required for WiFi to store its configuration (SSID/Password, calibration, etc.)
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        // NVS partition was truncated and needs to be erased
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 2. Initialize LED (Simple GPIO)
    // Reset the pin to default state, set as output, and turn off initially.
    ESP_LOGI(TAG, "Configuring LED on GPIO %d", LED_GPIO);
    gpio_reset_pin(LED_GPIO);
    gpio_set_direction(LED_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_level(LED_GPIO, 0);

    // 3. Connect to WiFi
    // This function blocks until a connection is established (check wifi_connect.cpp for details).
    ESP_LOGI(TAG, "Starting WiFi Station");
    wifi_connect();

    // 4. Start the Web Server
    start_webserver();

    // app_main returns, but the server and WiFi tasks continue running in the background.
}
