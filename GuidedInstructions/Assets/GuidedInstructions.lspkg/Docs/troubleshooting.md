# GuidedInstructions troubleshooting

[← Agent usage index](../README.md)

## Use when

A part of the guided flow doesn't react, stalls, or overlaps other UI.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Mic shows "Listening…" forever in the Preview; log has `Login to My Lenses is required for testing of the VoiceML API` and `startListening failed with result code 3` | ASR needs a My Lenses login in the Preview | Log in to My Lenses in Lens Studio, or test speech on Specs |
| A red "Credentials needed" panel shows before the guide | The Google token on `RemoteServiceGatewayCredentials` is empty or still the `[INSERT …]` placeholder (the shipped prefab never contains a token) | Set the Google token (Gemini) on `RemoteServiceGatewayCredentials` and the panel won't appear. "Continue without credentials" closes it for this run; Gemini requests fail until the token is set |
| Mic answers nothing / Gemini requests fail; no token hint shows | The Google token isn't set and `CredentialsWarning` was removed or dismissed (the floating "Set your API Token…" Text was removed) | Set the token in RemoteServiceGatewayCredentials (from your Remote Service Gateway setup; never commit real tokens). To show a hint in your own Lens, attach APIKeyHint to a Text inside a UI panel. It checks Snap, OpenAI and Google, even though the flow only calls Gemini |
| Your own APIKeyHint Text is invisible although enabled | A top-aligned Text in a tall layout rect sits well above its object | Use a centered Text, or move the object down to where the text should appear |
| Other head-locked UI is hidden behind or covers the panels | Both panels follow the camera at 50 cm, closer than most UI | Place your UI above the panels (the demo carousel uses `extraPanelDrop = -30`), or hide SpeechUI / GuidancePanel while it shows |
| Manual Previous / Next does nothing | Panel is in AUTO mode | `toggleMode()` back to MANUAL |
| `setAutoStep` does nothing | MANUAL mode, id 0, unknown id, or the same step | Check `autoMode` and pass the one-based `MaintenanceStep.id` |
| Loading never clears after an image-encoding error (older builds) | The encode failure callback didn't complete the request | Fixed: it now calls back with the fallback response |
| Inspector "pinch up" callback never runs without a "pinch down" one (older builds) | Up registration was nested in the Down branch | Fixed: both are registered independently |
| Log shows `No depth frame yet - request skipped, try again` | The transcript arrived before DepthCache paired its first depth frame (right after launch). The request is skipped and the mic is re-enabled | Speak again after a moment. With `testTexture` set the request still runs, but no world labels are placed without depth |
| Labels missing although the bubble shows text | Pixel falls outside the depth frame, or no valid depth samples | Check the log for `Point is outside of depth frame`; verify on Specs |
| Speech button stays disabled | A transcript arrived while a request was running; the collider is disabled before the guard returns | Wait for the running request to finish (its callback re-enables the button) |
| Authored children under ResponseUI disappear | `clearLabels()` destroys every child of the ResponseUI object | Keep that object dedicated to spawned labels |
| UIKit buttons fail to initialize | ThemeService preload import removed | Keep `import "UIKit.lspkg/Scripts/Themes/ThemeService"` first in the scripts that have it |
