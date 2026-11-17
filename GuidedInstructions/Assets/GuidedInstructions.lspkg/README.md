<p align="center">
  <img src="Docs/media/GuidedInstructions.png" width="250px" alt="GuidedInstructions"/>
</p>

# GuidedInstructions 

GuidedInstructions is a sample package for building **voice-driven, AI-assisted guided experiences** on SPECS. It combines depth understanding, speech input, a Gemini API integration, and world-space UI so you can prototype flows like step-by-step AR guidance, labeled points of interest, and conversational responses tied to the user’s environment.

The **example scenario uses Nespresso Vertuo**-style content (copy, manuals, and knowledge helpers) only as a **concrete, recognizable object** many people may already have at home, so you can exercise the sample end-to-end and then **swap in your own brand or product**. **There is no partnership, sponsorship, endorsement, or commercial agreement** with Nespresso or any related company; the reference is **not an endorsement** and is **only for demonstration**. Before publishing a lens, replace that material with your own assets and data.

## Features

- **Scene orchestration**: Single entry prefab (`GuidedInstructions__PLACE_IN_SCENE`) wires panels, speech, depth, and API modules
- **Speech & ASR**: Speech UI and ASR controller patterns for capturing user voice
- **Depth & camera**: Depth cache and face/camera helpers for spatial context
- **AI responses**: Gemini API module for model calls; response UI for showing answers
- **World labels & arrows**: Prefabs and scripts for placing labels and directional cues in the world
- **Guidance & loading UX**: Guidance panel, loading states, and touch interactions

## Usage

This section ships with the package and describes the installed package. Generic Lens scripting, scene construction and Specs spatial design live in the CLAD skills; this package owns its speech/depth/Gemini wiring and limits.

### Package identity

- Descriptor: `package.native` (package version and Lens Studio target are recorded there).
- Import prefix: `GuidedInstructions.lspkg/Scripts/`.
- Prefab: `GuidedInstructions.lspkg/GuidedInstructions__PLACE_IN_SCENE.prefab`.
- The `__PLACE_IN_SCENE` prefab is self-contained: besides `RemoteServiceGatewayCredentials`, the guided-instructions demo (`GuidedInstructionsDemo`, whose children host
  SpeechUI, SceneController + GeminiAPI, ASRController (on the `VoiceController` object), ResponseUI, Loading, DepthCache + DebugVisualizer,
  GuidancePanel and TouchDownButton) and its `Camera Object`, it includes the
  red `CredentialsWarning`, the onboarding `Guide` and the `ExampleCarousel`, so dropping it into an empty Specs scene gives the full demo. Their demo-only
  scripts ship in `GuidedInstructions.lspkg/Example/` (`CredentialsWarning/`, `ExampleCarousel/`, `GuideDismissPanel/`). Delete
  `CredentialsWarning`, `Guide` and `ExampleCarousel` from your instance when you build your own Lens ([components](Docs/components.md#demo-scaffolding-example)).
- Credentials: set the **Google** token (Gemini) on `RemoteServiceGatewayCredentials`; no other token and no Snap Cloud project is
  needed. Until it's set, a red-framed "Credentials needed" panel shows before the guide ([setup](Docs/setup.md)).
- Declared companions: SpectaclesInteractionKit, SpectaclesUIKit, RemoteServiceGateway, SnapDecorators, Utilities, Motion and Icons. See `package_dependencies.json`.

### Version and API status

Read [API status](Docs/api-status.md) before assuming Preview depth, credentials or AI failure behavior.

### Applicability

Use this example for voice-triggered image understanding with depth-projected labels and optional step guidance. A manual GuidancePanel is usable without an AI request; the full orchestrator still initializes native ASR, camera and depth components. Replace the scenario knowledge/assets when adapting it.

### Related CLAD skills

[specs-build-ui](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-build-ui/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for readiness, request and depth-cache rules.
- [Components](Docs/components.md): read every input, public event and source signature.
- [API status](Docs/api-status.md): read current model/API and verification gaps.
- [Examples](Docs/examples.md): read for manual guidance and event consumers.
- [Setup](Docs/setup.md): read for credentials, native modules and prefab wiring.
- [Troubleshooting](Docs/troubleshooting.md): read for stalled requests and missing labels.
- [Guide](Docs/guide.md): read retained setup/customization guidance.

### Verification

1. Compile all wired components and confirm prefab references.
2. Navigate manual guidance steps and check the zero-based step-change event.
3. On Specs, confirm partial/final ASR and a usable synchronized depth/color pair.
4. Make a configured Gemini request; confirm response text and projected labels.
5. Test image-encoding/API failure and repeated requests, confirming button/loading recovery.

## Built with 👽 by the SPECS team
