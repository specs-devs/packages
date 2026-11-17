# GuidedInstructions setup

[← Agent usage index](../README.md)

## Use when

Configure the actual dependency, credential and native-module requirements.

1. Keep declared branch builds; do not update packages blindly to fix an import mismatch.
2. Place `GuidedInstructions__PLACE_IN_SCENE.prefab`, SIK and the required camera/input setup. Keep its SceneController, SpeechUI, response/loading, DepthCache and optional GuidancePanel bindings.
3. Set the **Google** token on the prefab's `RemoteServiceGatewayCredentials` object (the only token the demo needs: Gemini). Do not embed real tokens in shared source or Markdown; the shipped prefab only has `[INSERT …]` placeholders. While the Google token is unset, a red-framed **Credentials needed** panel (`CredentialsWarning`) shows before the guide and lists what's missing; "Continue without credentials" closes it and the guide follows. With the token set the panel doesn't appear. This package doesn't use Snap Cloud. If you attach APIKeyHint to a Text of your own, it shows its hint while any of the three provider tokens is empty or an `[INSERT …]` placeholder, so it can show when only Gemini is configured; that hint is not proof the request cannot run.
4. GeminiAPI uses the package RSG HostedExternal/Gemini model gemini-2.5-pro. No separate apiKey input exists on GeminiAPI.
5. ASRController requires LensStudio:AsrModule; DepthCache requires LensStudio:DepthModule and CameraModule. Verify these on Specs. Preview may not provide live native services.
6. The supplied prefab has a non-null testTexture binding. Inspect/remove it for live camera inference; setting it does not stop camera/depth acquisition or guarantee a usable depth pair.
7. Wire both world-label prefabs to components containing WorldLabel and textComp; ResponseUI reads these directly.
8. The sample uses NespressoKnowledge data and assets as its concrete demo scenario. Preserve original demo attribution context and replace the knowledge/assets for your own product.

The prefab holds, in order, `RemoteServiceGatewayCredentials`, `CredentialsWarning`, `Guide`, `ExampleCarousel` ([demo scaffolding](components.md#demo-scaffolding-example)), `GuidedInstructionsDemo` (child objects SpeechUI, SceneController, VoiceController, ResponseUI, DepthCache, GuidancePanel, ImageTest; `VoiceController` is the object that hosts ASRController, and SceneController also hosts GeminiAPI, DepthCache also hosts DebugVisualizer) and `Camera Object`. The guide hides the carousel, SpeechUI and GuidancePanel until "Ok, I understood" is pressed.
