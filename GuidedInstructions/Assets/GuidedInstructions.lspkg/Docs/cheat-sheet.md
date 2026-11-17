# GuidedInstructions cheat-sheet

[← Agent usage index](../README.md)

## Use when

Read first before wiring speech, image requests or projected labels.

1. Keep the complete prefab references and branch companion packages; generic script attachments alone do not initialize this graph. → [Setup](setup.md)
2. The full flow requires native ASR, Left_Grayscale camera and DepthModule; testTexture only overrides Gemini's image input. → [API status](api-status.md)
3. Request only after a valid color/depth pair exists. DepthCache has no ready event; poll `hasDepthFrame()` (SceneController skips the request until it is true, unless `testTexture` is set). `getCamImageWithID` returns `null` for an unknown id or an empty pair. → [Troubleshooting](troubleshooting.md)
4. SceneController's exact public spelling is onSpeechRecieved; Loading's method is activateLoder; Labels has loadLables. → [Components](components.md)
5. GuidancePanel starts MANUAL, with a zero-based onStepChanged index; setAutoStep takes a one-based step ID and is ignored in manual mode. → [Examples](examples.md)
6. RemoteServiceGateway owns credentials. The prefab has no token-hint Text; APIKeyHint (optional, attach to your own Text) shows a hint while any Snap/OpenAI/Google token is empty or an `[INSERT …]` placeholder, although this flow only calls Gemini. → [Setup](setup.md)
7. GuidancePanel and SpeechUI follow the camera at 50 cm. Keep other head-locked UI (guides, menus) clear of that band, or hide the panels while it shows. → [Troubleshooting](troubleshooting.md)
8. ResponseUI.clearLabels destroys all children under its SceneObject; keep unrelated authored children elsewhere. → [Components](components.md)
9. Preserve ThemeService preload imports before UIKit visuals; they are an initialization-order workaround. → [Troubleshooting](troubleshooting.md)
