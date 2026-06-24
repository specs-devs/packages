#pragma once

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Connect to WiFi
 *
 * This function initializes the WiFi driver in Station mode and attempts to connect
 * to the SSID and Password defined in menuconfig.
 *
 * It blocks execution until a connection is established or it fails after retries.
 */
void wifi_connect(void);

#ifdef __cplusplus
}
#endif
