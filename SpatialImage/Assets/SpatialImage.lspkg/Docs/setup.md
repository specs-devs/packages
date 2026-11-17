# SpatialImage setup

1. Drag `SpatialImage__PLACE_IN_SCENE.prefab` into a Specs scene that has a Camera and InteractionKit.
2. Select `RemoteServiceGatewayCredentials` inside the instance and paste your **Snap** token
   ([Remote Service Gateway](https://developers.snap.com/spectacles/about-spectacles-features/apis/remoteservice-gateway)).
   Don't commit the token.
3. Preview (device type SPECS): the first photo spatializes. Without a token the Logger shows `Spatialization failed: API Call Error: Bad Request`.
4. On device, make sure the glasses are online.

Without a token, the red **Credentials needed** panel appears; pinch **Continue without credentials** to see the flat photos only.
