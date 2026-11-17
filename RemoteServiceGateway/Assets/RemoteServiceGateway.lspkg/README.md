<p align="center">
  <img src="Docs/media/RemoteServiceGateway.png" width="250px" alt="RemoteServiceGateway"/>
</p>

# RemoteServiceGateway

Connect Specs experiences to OpenAI, Gemini, Imagen, Lyria, DeepSeek and Snap3D through Snap's Remote Service Gateway. The package includes request wrappers, realtime WebSockets, microphone/audio helpers and a provider demo prefab.

## Features

- Chat, image generation/editing, text-to-speech and realtime voice through OpenAI.
- Gemini text and live sessions, Imagen images and Lyria music.
- Snap-hosted DeepSeek responses and Snap3D model generation.
- Provider-specific credentials and typed request/response modules.
- Microphone capture, audio processing, streamed playback and video helpers.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and Specs spatial design live in the CLAD skills; the package-specific API and setup live here.

### Package identity

- Descriptor: `package.native`.
- Consumer import prefix: `RemoteServiceGateway.lspkg/` (without a leading `./`).
- Demo prefab: `RemoteServiceGateway__PLACE_IN_SCENE.prefab`.
- The prefab includes the demo guide panel and example carousel: dragging it into an empty Specs scene gives the full demo. Their scripts ship in `RemoteServiceGateway.lspkg/Example/` (`CredentialsWarning`, `ExampleCarousel`, `GuideDismissPanel`, see [Components](Docs/components.md#demo-scaffolding-example)). They only present the demo; the RemoteServiceGateway scripts don't import them.
- Credentials: set the Snap, OpenAI and Google tokens on the prefab's `RemoteServiceGatewayCredentials` object (the prefab ships placeholders only; never commit real tokens). Until they are set, the demo's `CredentialsWarning` shows a red-framed "Credentials needed" panel before the guide. This package does not use Snap Cloud (`SnapCloudRequirements`). See [Setup](Docs/setup.md#2-put-the-tokens-in-the-lens).
- Declared companions: Utilities, SnapDecorators, SpectaclesInteractionKit, SpectaclesUIKit, Motion and Icons; see `package_dependencies.json`.
- The API and example scripts import Utilities (`Logger`) and SnapDecorators (12 files import the decorators but none applies them). The `Example/` demo scaffolding (`CredentialsWarning`, `ExampleCarousel`, `GuideDismissPanel`) imports SpectaclesInteractionKit and SpectaclesUIKit. Motion and Icons are not imported.

### Version and API status

Read [API status](Docs/api-status.md) before adapting older snippets. It records corrected credential handling, the hidden-example pinch guard, removed guide assets, deprecated names and known gaps. Model strings in the source are examples; this package does not establish current service availability.

### Applicability

Use this package for the services routed through Remote Service Gateway. Use InternetModule for ordinary HTTP and the CLAD WebSocket guidance for direct WebSocket services. The gateway tokens and request types are specific to this package.

### Related CLAD skills

- [specs-ai-remote-service](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-ai-remote-service/SKILL.md): route an AI integration to this package.
- [specs-audio](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-audio/SKILL.md): microphone and playback configuration.
- [specs-camera](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-camera/SKILL.md): camera frame access and permissions.
- [specs-internet](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-internet/SKILL.md) / [specs-websocket](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-websocket/SKILL.md): direct network integrations.
- [scene-construction](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/scene-construction/SKILL.md) / [specs-build-ui](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-build-ui/SKILL.md): project scene and UI construction.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first; import, credentials and lifecycle rules.
- [API status](Docs/api-status.md): compatibility, removed names and current limitations.
- [Components](Docs/components.md): modules, public members, inputs and defaults, plus the `Example/` demo scaffolding.
- [Setup](Docs/setup.md): token configuration, service assets and Preview prerequisites.
- [Examples](Docs/examples.md): corrected chat/context, dynamic image prompts, image editing, realtime voice, speech, Snap3D, music and multi-model recipes. The former README tutorials now live here.
- [Troubleshooting](Docs/troubleshooting.md): package-specific symptoms and fixes found in QA.

### Verification

1. Compile against the installed package's declarations with the import paths above.
2. In the demo project, dismiss the guide and step through all six provider views; check that each fits above the carousel and that wraparound works.
3. Hidden call examples must ignore right-hand pinches. Check the current example's flags separately from navigation input.
4. For live calls, use valid gateway tokens and sign in to My Lenses in Lens Studio. Confirm each enabled call's success/error output and each realtime socket's actual open/message/close events.
5. On device, check microphone/playback and the known overlap between carousel pinches and the visible example's global pinch handler. Credentialed service behavior was not verified in the offline QA pass.

## Built with 👽 by the SPECS team









