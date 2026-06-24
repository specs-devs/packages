# GuidedInstructions 

GuidedInstructions is a sample package for building **voice-driven, AI-assisted guided experiences** on Spectacles. It combines depth understanding, speech input, a Gemini API integration, and world-space UI so you can prototype flows like step-by-step AR guidance, labeled points of interest, and conversational responses tied to the user’s environment.

The **example scenario uses Nespresso Vertuo**-style content (copy, manuals, and knowledge helpers) only as a **concrete, recognizable object** many people may already have at home, so you can exercise the sample end-to-end and then **swap in your own brand or product**. **There is no partnership, sponsorship, endorsement, or commercial agreement** with Nespresso or any related company; the reference is **not an endorsement** and is **only for demonstration**. Before publishing a lens, replace that material with your own assets and data.

## Features

- **Scene orchestration**: Single entry prefab (`GuidedInstructionsExample__PLACE_IN_SCENE`) wires panels, speech, depth, and API modules
- **Speech & ASR**: Speech UI and ASR controller patterns for capturing user voice
- **Depth & camera**: Depth cache and face/camera helpers for spatial context
- **AI responses**: Gemini API module for model calls; response UI for showing answers
- **World labels & arrows**: Prefabs and scripts for placing labels and directional cues in the world
- **Guidance & loading UX**: Guidance panel, loading states, and touch interactions

## Quick Start

1. Install dependencies declared in **`package_dependencies.json`** (**SpectaclesInteractionKit**, **SpectaclesUIKit**, **RemoteServiceGateway**, **SnapDecorators**, **Utilities**) from the Asset Library, then pull updates so versions match your editor.
2. Drag **`GuidedInstructionsExample__PLACE_IN_SCENE.prefab`** from the package into your scene (or follow your project’s instantiator flow).
3. Fill in API / project settings as required by **`GeminiAPI`**, **`SpeechUI`**, and related components in the Inspector.
4. Use **`SceneController`** as the top-level orchestrator reference and assign **`GuidancePanel`**, **`ResponseUI`**, **`SpeechUI`**, **`GeminiAPI`**, **`DepthCache`**, and **`DebugVisualizer`** as documented in the prefab.

```typescript
// Typical pattern: SceneController coordinates subsystems on start.
// See Scripts/SceneController.ts for wire-up and lifecycle.
```

## Script highlights

- **`SceneController.ts`**: Main orchestrator; connects speech, Gemini, depth, loading, guidance, and response UI.
- **`GuidancePanel.ts` / `ResponseUI.ts`**: On-screen guidance and AI output presentation.
- **`SpeechUI.ts` / `ASRController.ts`**: Voice capture and recognition flow.
- **`GeminiAPI.ts`**: Smart Gate / model request helpers (configure credentials in Lens Studio).
- **`DepthCache.ts` / `FaceCamera.ts` / `DebugVisualizer.ts`**: Environment and debug tooling.
- **`WorldLabel.ts` / `Labels.ts`**: World-anchored label behavior.

## Dependencies

Consume **`Utilities`** (e.g. `Logger`) and **`SnapDecorators`** decorators where referenced. Add **SpectaclesUIKit** / **SIK** if you expand UI or interaction—align versions with your Lens Studio Asset Library.

## Customization

Replace sample manuals, images, and copy under **`Manuals/`** and **`Prefabs/`** with your own content. Keep API keys and endpoints out of source control; use Lens Studio resources or runtime configuration for secrets.
