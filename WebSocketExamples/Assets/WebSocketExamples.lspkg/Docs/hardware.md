# WebSocketExamples hardware references

[← Agent usage index](../README.md)

## Use when

Configure included server sources and understand their actual wire behavior.

## Shipped sources

- [INO/WebsocketExample.ino](../INO/WebsocketExample.ino): ESP32 WiFi/WebSockets_Generic echo on port80; text frames echoed, LED GPIO2 toggled. WStype_BIN is not handled.
- [INO/ESP32/ESP32.ino](../INO/ESP32/ESP32.ino): ESP32 + MPU6050_light/Wire, default SDA21/SCL22, VCC3.3V/GND. Sensor initialization/calibration blocks until available. Streams only to the latest connected client, nominal interval10ms (~100Hz), via `mpu.getAngleX(), getAngleZ(), getAngleY()` CSV.
- [ESP-IDF/main/main.cpp](../ESP-IDF/main/main.cpp): `/ws` endpoint with ESP HTTP server receive/send echo, configured LED GPIO; frame type is received/preserved for echo. HTTPD_WS_SUPPORT must be enabled.
- [ESP-IDF/main/wifi_connect.cpp](../ESP-IDF/main/wifi_connect.cpp): menuconfig networking, optional static IP under CONFIG_STATIC_IP_ENABLE, retries up to5; failure releases wait and app proceeds to start HTTP server without proven Wi-Fi readiness.
- [ESP-IDF/main/Kconfig.projbuild](../ESP-IDF/main/Kconfig.projbuild): the `menuconfig` "Application Configuration" menu: `WIFI_SSID` / `WIFI_PASSWORD` (defaults `myssid` / `mypassword`), `STATIC_IP_ENABLE` (default off) with `STATIC_IP_ADDR` / `STATIC_IP_NETMASK` / `STATIC_IP_GW`, and `LED_GPIO` (default 2).
- [ESP-IDF/sdkconfig.defaults](../ESP-IDF/sdkconfig.defaults): sets `CONFIG_LED_GPIO=2` only.
- [ESP-IDF/test_ws.py](../ESP-IDF/test_ws.py) (+ [requirements.txt](../ESP-IDF/requirements.txt), `websockets`): desktop test client that connects, sends `Hello ESP32! Message #N` once a second and prints each echo. The server URI is hard-coded in the script; change it to your board's address before running.
- [ESP-IDF/README.md](../ESP-IDF/README.md): full existing board/menuconfig/build/test guide retained inside package.

## Configuration boundaries

Arduino files include Wi-Fi credential constants and active developer-local static IP/gateway/netmask/DNS configuration. Replace/configure your own network values; never copy credentials into docs/reports. `WiFi.config` is called unconditionally in both sketches despite "optional" comments. These docs do not disclose or modify credential contents.

Use the recorded Serial Monitor IP to set Lens ipAddress. Default port80 and suggested /ws path refer to these server examples; other servers require their actual path/port. Same-network setup is the sample baseline, not protocol proof that all standards-compliant cloud endpoints have identical reachability/authentication.

Arduino IMU loops every10ms after connection and does not implement a sender-rate Inspector setting. The original README's ~50Hz suggestion is guidance, not shipped firmware interval. It tracks one current client; later connection replaces the destination. The receiver sends `HI FROM Glasses` but the IMU sketch only logs text; no special handshake state is required there.

CSV slots from hardware are X,Z,Y; Lens applies slots directly to Euler X,Y,Z. Decide the intended axis mapping and calibrate against board orientation. Wi-Fi connectivity and sensor initialization are separate requirements; a connected socket alone does not prove correctly oriented measurements.

No Arduino/ESP-IDF build, board flash, SDK installation or physical test was run. Follow the preserved [Guide](guide.md) and ESP-IDF README with your own board/toolchain; do not infer "production-ready" guarantees from old introductory prose.
