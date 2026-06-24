idf_component_register(SRCS "main.cpp" "wifi_connect.cpp"
                       INCLUDE_DIRS "."
                       REQUIRES nvs_flash esp_wifi esp_event esp_http_server driver)
