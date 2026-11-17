# GuidedInstructions guide

[← Agent usage index](../README.md)

## Use when

Read retained setup, script highlights and customization context.

The focused docs govern exact package behavior. The original Asset Library update instruction below is generic install guidance; this QA branch intentionally retains its bundled dependency builds. Native speech/depth and real Gemini responses need Specs and credentials; see [API status](api-status.md) for what was verified in the Preview.

## Quick Start

1. Install the dependencies declared in **`package_dependencies.json`** (**InteractionKit**, **UIKit**, **RemoteServiceGateway**, **SnapDecorators**, **Utilities**, **Motion**, **Icons**) from the Asset Library.
2. Drag **`GuidedInstructions__PLACE_IN_SCENE.prefab`** from the package into your scene (or follow your project’s instantiator flow).
3. Set the Google token on the prefab's **`RemoteServiceGatewayCredentials`** ([setup](setup.md)). `GeminiAPI` and `SpeechUI` have no API settings of their own; GeminiAPI only has logging inputs.
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

The scripts import **`Utilities`** (`Logger`) and **`SnapDecorators`**. **UIKit** and **InteractionKit** are hard dependencies, not optional: the scripts import `UIKit.lspkg/Scripts/Themes/ThemeService` and InteractionKit utilities (`animate`, `Event`), and the UI uses UIKit buttons and frames. **RemoteServiceGateway** provides the Gemini call and credentials.

## Customization

Replace sample manuals, images, and copy under **`Manuals/`** and **`Prefabs/`** with your own content. Keep API keys and endpoints out of source control; use Lens Studio resources or runtime configuration for secrets.
