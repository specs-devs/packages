# GuidedInstructions api-status

[← Agent usage index](../README.md)

## Use when

Check supported revision behavior and live-service/native verification gaps.

| Status | Surface | Evidence / limit |
| --- | --- | --- |
| Current | SceneController | Speech→depth snapshot→Gemini→response/world labels; request guard |
| Current | GeminiAPI | RSG HostedExternal/Gemini, model gemini-2.5-pro; image + structured response |
| Current | DepthCache | Left_Grayscale camera plus DepthModule; cached reprojection; `hasDepthFrame()` added (requests wait for the first depth frame) |
| Current | ASRController/SpeechUI | Balanced ASR, 500ms silence termination, partial/final events |
| Current | GuidancePanel/NespressoKnowledge | Manual/auto guidance, 15-step knowledge source |
| Current | Response/Loading/WorldLabel/TouchDownButton helpers | Authored UI and input graph |
| Deprecated | None declared | Legacy RectangleButton remains the source type; no renamed API aliases |
| Experimental | Preview/static-texture full flow | testTexture does not bypass native depth initialization |
| Removed | `Prefabs/GUIDE_ReadAndDisable.prefab`, `Scripts/GuideDismissPanel/GuideDismissPanel.ts` | Old in-package guide note removed. The current demo guide presenter ships as demo scaffolding in `Example/GuideDismissPanel/` (not package API); see [components](components.md#demo-scaffolding-example) |

Prompt says showArrow while the response schema uses useArrow (the code maps useArrow → showArrow). Gemini errors and image-encoding failures both complete the request with the fallback response. Depth IDs use Date.now and can collide within one millisecond. Null pairs may remain cached because disposeDepthFrame only deletes non-null entries.

Verified in the Lens Studio Preview (2026-10-01): compile clean, no runtime errors, manual Previous/Next, Auto Mode toggle, mic button opens the speech bubble, API-token hint showed with placeholder tokens (that floating hint Text was later removed from the prefab). Not verified: ASR (the Preview needs a My Lenses login), depth, Gemini responses and world labels, which need Specs and a Remote Service Gateway token.
