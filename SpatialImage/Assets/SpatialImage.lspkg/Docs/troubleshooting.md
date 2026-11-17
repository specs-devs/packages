# SpatialImage troubleshooting

| Symptom | Fix |
|---|---|
| Only the flat photo shows, never the 3D mesh | Set the Snap token on `RemoteServiceGatewayCredentials`; on device check the internet connection; read the `Spatialization failed` log line. |
| Red "Credentials needed" panel | Expected without a token; set it or pinch Continue without credentials. |
| Depth stays flat | You are outside the valid zone: look at the frame from the front, or widen it with `setValidZoneAngle`. |
| Slows down after several images | Each spatialized image keeps its mesh in memory; destroy frames you no longer show and keep images reasonably small. |
