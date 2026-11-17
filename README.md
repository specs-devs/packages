<div align="center">

<img src="https://raw.githubusercontent.com/specs-devs/.github/main/profile/SPECS.jpeg" width="600" height="auto" align="center">

# SPECS Packages

**Asset packages and utilities for building Lenses on SPECS.**

[![Release](https://img.shields.io/badge/Release-5.24.1-1a1a1a?style=flat&labelColor=1a1a1a)](https://github.com/specs-devs/packages/releases/tag/5.24.1)
[![Lens Studio](https://img.shields.io/badge/Lens%20Studio-5.24.1-FFFC00?style=flat&labelColor=FFFC00&logo=snapchat&logoColor=black)](https://ar.snap.com/lens-studio)
[![Developers](https://img.shields.io/badge/-Developers-1a1a1a?style=flat&labelColor=1a1a1a&logo=readthedocs&logoColor=white)](https://developers.specs.com/)
[![Reddit](https://img.shields.io/badge/-Reddit-ff4500?style=flat&labelColor=ff4500&logo=reddit&logoColor=white)](https://www.reddit.com/r/Spectacles/)
[![YouTube](https://img.shields.io/badge/YouTube-ff0000?style=flat&logo=youtube&logoColor=white)](https://www.youtube.com/@specsfordevs)

---

</div>

Each folder is a Lens Studio project that contains one package. The same packages are available from the Lens Studio **Asset Library**.

## Releases

| Branch | Lens Studio | Device | Release |
|:--|:--|:--|:--|
| [`main`](https://github.com/specs-devs/packages/tree/main) | 5.25.0 | SPECS 27 | [5.25.0](https://github.com/specs-devs/packages/releases/tag/5.25.0) |
| [`5.24.1`](https://github.com/specs-devs/packages/tree/5.24.1) | 5.24.1 | SPECS 27 | [5.24.1](https://github.com/specs-devs/packages/releases/tag/5.24.1) ← you are here |
| [`5.24`](https://github.com/specs-devs/packages/tree/5.24) | 5.24.0 | SPECS 27 | [5.24.0](https://github.com/specs-devs/packages/releases/tag/5.24.0) |
| [`5.22`](https://github.com/specs-devs/packages/tree/5.22) | 5.22.0 | SPECS 27 | [5.22.0](https://github.com/specs-devs/packages/releases/tag/5.22.0) |
| [`5.15.4`](https://github.com/specs-devs/packages/tree/5.15.4) | 5.15.4 | Spectacles (2024) | [5.15.4](https://github.com/specs-devs/packages/releases/tag/5.15.4) |

> [!IMPORTANT]
> Use the branch that matches your Lens Studio version. `main` always carries the latest release.
> **Spectacles (2024) is supported only on `5.15.4`.** Everything `5.22.0`+ targets SPECS 27.

## Getting Started

Clone everything:

```bash
git clone --branch 5.24.1 https://github.com/specs-devs/packages.git
```

Or clone a single project with sparse checkout:

```bash
git clone --branch 5.24.1 --filter=blob:none --sparse https://github.com/specs-devs/packages.git
cd packages && git sparse-checkout add "Utilities"
```

Then open the project folder in Lens Studio.

## Package index

| | | |
|:--|:--|:--|
| [AccessComponents](./AccessComponents/) | [AiPreviewAgentInspect](./AiPreviewAgentInspect/) | [AiPreviewAgentInteract](./AiPreviewAgentInteract/) |
| [AnimationExamples](./AnimationExamples/) | [AutoFloorFinder](./AutoFloorFinder/) | [BodyMesh](./BodyMesh/) |
| [CommerceKit](./CommerceKit/) | [CompositeCameraTexture](./CompositeCameraTexture/) | [CropCameraTexture](./CropCameraTexture/) |
| [EasyTeleprompter](./EasyTeleprompter/) | [FaceMesh](./FaceMesh/) | [FunctionCallHelper](./FunctionCallHelper/) |
| [GuidedInstructions](./GuidedInstructions/) | [HandAttacher](./HandAttacher/) | [Instantiation](./Instantiation/) |
| [InteractableHelper](./InteractableHelper/) | [MarkerTrackingHelper](./MarkerTrackingHelper/) | [Midi](./Midi/) |
| [MocopiReceiver](./MocopiReceiver/) | [ReachyReceiver](./ReachyReceiver/) | [RemoteServiceGateway](./RemoteServiceGateway/) |
| [RuntimeGizmos](./RuntimeGizmos/) | [SnapCloudExamples](./SnapCloudExamples/) | [SnapDecorators](./SnapDecorators/) |
| [Solvers](./Solvers/) | [HandHints3D](./HandHints3D/) | [InteractionKitExamples](./InteractionKitExamples/) |
| [NavigationKit](./NavigationKit/) | [ShaderLibrary](./ShaderLibrary/) | [SupabaseClient](./SupabaseClient/) |
| [SurfacePlacement](./SurfacePlacement/) | [Utilities](./Utilities/) | [VolumetricLine](./VolumetricLine/) |
| [WebSocketExamples](./WebSocketExamples/) | [WorldQueryHit](./WorldQueryHit/) | [BezierLine](./BezierLine/) |
| [CustomLocations](./CustomLocations/) | [AnchorExamples](./AnchorExamples/) | [AuthKit](./AuthKit/) |
| [AuthKitExamples](./AuthKitExamples/) | | |

## Core Frameworks

The frameworks at the heart of building for SPECS

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./RemoteServiceGateway/">
        <img src="./RemoteServiceGateway/Assets/AssetImage/RemoteServiceGateway.png" alt="remote-service-gateway" width="250px" />
      </a>
      <h3>Remote Service Gateway</h3>
      <!-- tags:RemoteServiceGateway -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/overview"><img src="https://img.shields.io/badge/Remote%20Service%20Gateway-blue?color=78CDFC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list"><img src="https://img.shields.io/badge/AI%20%26%20LLM-blue?color=74C8FB" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization"><img src="https://img.shields.io/badge/Auth-blue?color=326CD4" /></a>
      </p>
      <!-- /tags:RemoteServiceGateway -->
      <p>A package that provides a set of tools that allow to publish lenses with access to user-sensitive data.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./InteractionKitExamples/">
        <img src="./InteractionKitExamples/Assets/AssetImage/InteractionKitExamples.png" alt="interaction-kit-examples" width="250px" />
      </a>
      <h3>Interaction Kit Examples</h3>
      <!-- tags:InteractionKitExamples -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module"><img src="https://img.shields.io/badge/Gesture%20%26%20Hands-blue?color=6FC2FB" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:InteractionKitExamples -->
      <p>Example scenes and prefabs for SpectaclesInteractionKit and SpectaclesUIKit, including Rocket Workshop and UI starter patterns.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./CommerceKit/">
        <img src="./CommerceKit/Assets/AssetImage/CommerceKit.png" alt="commerce-kit" width="250px" />
      </a>
      <h3>Commerce Kit</h3>
      <!-- tags:CommerceKit -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization"><img src="https://img.shields.io/badge/Auth-blue?color=326CD4" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/getting-started"><img src="https://img.shields.io/badge/Commerce-blue?color=224499" /></a>
      </p>
      <!-- /tags:CommerceKit -->
      <p>Framework for handling in-app purchases for non-consumable items in SPECS.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./NavigationKit/">
        <img src="./NavigationKit/Assets/AssetImage/NavigationKit.png" alt="navigation-kit" width="250px" />
      </a>
      <h3>Navigation Kit</h3>
      <!-- tags:NavigationKit -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/location"><img src="https://img.shields.io/badge/Location%20%26%20GPS-blue?color=4F9BF8" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/getting-started"><img src="https://img.shields.io/badge/Navigation-blue?color=4B96F7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:NavigationKit -->
      <p>Set of components designed to simplify the development of navigation experiences for SPECS.</p>
    </td>
    <td width="33%"></td>
    <td width="33%"></td>
  </tr>
</table>

## AI Agents

Agentic helpers for building and testing Lenses

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./AiPreviewAgentInteract/">
        <img src="./AiPreviewAgentInteract/Assets/AssetImage/AiPreviewAgentInteract.png" alt="ai-preview-agent-interact" width="250px" />
      </a>
      <h3>AI Preview Agent – Interact</h3>
      <!-- tags:AiPreviewAgentInteract -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list"><img src="https://img.shields.io/badge/AI%20%26%20LLM-blue?color=74C8FB" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module"><img src="https://img.shields.io/badge/Gesture%20%26%20Hands-blue?color=6FC2FB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:AiPreviewAgentInteract -->
      <p>Lets an external AI agent drive a running Lens by synthesizing pinch, poke, and drag hand interactions for end-to-end agent verification.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AiPreviewAgentInspect/">
        <img src="./AiPreviewAgentInspect/Assets/AssetImage/AiPreviewAgentInspect.png" alt="ai-preview-agent-inspect" width="250px" />
      </a>
      <h3>AI Preview Agent – Inspect</h3>
      <!-- tags:AiPreviewAgentInspect -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list"><img src="https://img.shields.io/badge/AI%20%26%20LLM-blue?color=74C8FB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:AiPreviewAgentInspect -->
      <p>Lens-side bridge that lets an external AI agent observe a running Lens through live scene queries and orthographic render captures.</p>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Cloud Services

Backend, storage, and realtime data

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./SupabaseClient/">
        <img src="./SupabaseClient/Assets/AssetImage/SupabaseClient.png" alt="supabase-client" width="250px" />
      </a>
      <h3>Supabase Client</h3>
      <!-- tags:SupabaseClient -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/web-socket"><img src="https://img.shields.io/badge/WebSocket-blue?color=387BEB" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/lens-studio/features/lens-cloud/lens-cloud-overview"><img src="https://img.shields.io/badge/Snap%20Cloud-blue?color=3471DC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization"><img src="https://img.shields.io/badge/Auth-blue?color=326CD4" /></a>
      </p>
      <!-- /tags:SupabaseClient -->
      <p>Client library for connecting to Supabase backend infrastructure.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SnapCloudExamples/">
        <img src="./SnapCloudExamples/Assets/AssetImage/SnapCloudExamples.png" alt="snap-cloud-examples" width="250px" />
      </a>
      <h3>Snap Cloud Examples</h3>
      <!-- tags:SnapCloudExamples -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module"><img src="https://img.shields.io/badge/Camera%20Access-blue?color=4690F7" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/lens-studio/features/lens-cloud/lens-cloud-overview"><img src="https://img.shields.io/badge/Snap%20Cloud-blue?color=3471DC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization"><img src="https://img.shields.io/badge/Auth-blue?color=326CD4" /></a>
      </p>
      <!-- /tags:SnapCloudExamples -->
      <p>Collection of examples demonstrating Supabase integration for authentication, real-time data, and cloud storage.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./AuthKit/">
        <img src="./AuthKit/Assets/AssetImage/AuthKit.png" alt="auth-kit" width="250px" />
      </a>
      <h3>Auth Kit</h3>
      <!-- tags:AuthKit -->
      <p>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization"><img src="https://img.shields.io/badge/Auth-blue?color=326CD4" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:AuthKit -->
      <p>OAuth2 authentication framework with PKCE, token refresh and deep links.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AuthKitExamples/">
        <img src="./AuthKitExamples/Assets/AssetImage/AuthKitExamples.png" alt="auth-kit-examples" width="250px" />
      </a>
      <h3>Auth Kit Examples</h3>
      <!-- tags:AuthKitExamples -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization"><img src="https://img.shields.io/badge/Auth-blue?color=326CD4" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/External%20API-blue?color=203F91" /></a>
      </p>
      <!-- /tags:AuthKitExamples -->
      <p>Ready-to-run OAuth2 sign-in examples (Spotify and generic providers) built on Auth Kit.</p>
    </td>
  </tr>
</table>

## Input Helpers

Hands, gestures, and input affordances

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./HandHints3D/">
        <img src="./HandHints3D/Assets/AssetImage/HandHints3D.png" alt="hand-hints-3-d" width="250px" />
      </a>
      <h3>3D Hints</h3>
      <!-- tags:HandHints3D -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module"><img src="https://img.shields.io/badge/Gesture%20%26%20Hands-blue?color=6FC2FB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:HandHints3D -->
      <p>Suite of animated Hand Gestures Hints.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./InteractableHelper/">
        <img src="./InteractableHelper/Assets/AssetImage/InteractableHelper.png" alt="interactable-helper" width="250px" />
      </a>
      <h3>Interactable Helper</h3>
      <!-- tags:InteractableHelper -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module"><img src="https://img.shields.io/badge/Gesture%20%26%20Hands-blue?color=6FC2FB" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/audio/playing-audio"><img src="https://img.shields.io/badge/Audio%20%26%20Microphone-blue?color=428AF7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:InteractableHelper -->
      <p>Low to medium fidelity prototyping tool for SPECS Interaction Kit components without code.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./FunctionCallHelper/">
        <img src="./FunctionCallHelper/Assets/AssetImage/FunctionCallHelper.png" alt="function-call-helper" width="250px" />
      </a>
      <h3>Function Call Helper</h3>
      <!-- tags:FunctionCallHelper -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:FunctionCallHelper -->
      <p>System for exposing function callbacks in the inspector, allowing you to configure and trigger script functions through UI buttons.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./HandAttacher/">
        <img src="./HandAttacher/Assets/AssetImage/HandAttacher.png" alt="hand-attacher" width="250px" />
      </a>
      <h3>Hand Attacher</h3>
      <!-- tags:HandAttacher -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module"><img src="https://img.shields.io/badge/Gesture%20%26%20Hands-blue?color=6FC2FB" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:HandAttacher -->
      <p>Attach objects to hand joints in world space with customizable offsets and smooth interpolation.</p>
    </td>
    <td width="33%"></td>
    <td width="33%"></td>
  </tr>
</table>

## Hardware

External devices and hardware bridges

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./MocopiReceiver/">
        <img src="./MocopiReceiver/Assets/AssetImage/MocopiReceiver.png" alt="mocopi-receiver" width="250px" />
      </a>
      <h3>Mocopi Receiver</h3>
      <!-- tags:MocopiReceiver -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/body-tracking/overview"><img src="https://img.shields.io/badge/Body%20Tracking%20%26%20Mocap-blue?color=54A1F8" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/web-socket"><img src="https://img.shields.io/badge/WebSocket-blue?color=387BEB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Robotics%20%26%20Devices-blue?color=2449A0" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/External%20API-blue?color=203F91" /></a>
      </p>
      <!-- /tags:MocopiReceiver -->
      <p>Full-body motion capture integration for Sony mocopi sensors with WebSocket streaming and automatic bone mapping.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./ReachyReceiver/">
        <img src="./ReachyReceiver/Assets/AssetImage/ReachyReceiver.png" alt="reachy-receiver" width="250px" />
      </a>
      <h3>Reachy Receiver</h3>
      <!-- tags:ReachyReceiver -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/web-socket"><img src="https://img.shields.io/badge/WebSocket-blue?color=387BEB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Robotics%20%26%20Devices-blue?color=2449A0" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/External%20API-blue?color=203F91" /></a>
      </p>
      <!-- /tags:ReachyReceiver -->
      <p>Integration for Reachy humanoid robot with WebSocket streaming.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./WebSocketExamples/">
        <img src="./WebSocketExamples/Assets/AssetImage/WebSocketExamples.png" alt="web-socket-examples" width="250px" />
      </a>
      <h3>WebSocket Examples</h3>
      <!-- tags:WebSocketExamples -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/web-socket"><img src="https://img.shields.io/badge/WebSocket-blue?color=387BEB" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/Fetch%20%26%20HTTP-blue?color=3676E3" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/External%20API-blue?color=203F91" /></a>
      </p>
      <!-- /tags:WebSocketExamples -->
      <p>WebSocket examples for real-time data exchange including TextEcho, IMUData, and IMUCube.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./Midi/">
        <img src="./Midi/Assets/AssetImage/Midi.png" alt="midi" width="250px" />
      </a>
      <h3>Midi</h3>
      <!-- tags:Midi -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/audio/playing-audio"><img src="https://img.shields.io/badge/Audio%20%26%20Microphone-blue?color=428AF7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Robotics%20%26%20Devices-blue?color=2449A0" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch"><img src="https://img.shields.io/badge/External%20API-blue?color=203F91" /></a>
      </p>
      <!-- /tags:Midi -->
      <p>Parse BLE-MIDI into note, control-change and clock events with reconstructed instrument timing.</p>
    </td>
    <td width="33%"></td>
    <td width="33%"></td>
  </tr>
</table>

## Essentials

Small building blocks most projects want

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./Instantiation/">
        <img src="./Instantiation/Assets/AssetImage/Instantiation.png" alt="instantiation" width="250px" />
      </a>
      <h3>Instantiation</h3>
      <!-- tags:Instantiation -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:Instantiation -->
      <p>Examples for dynamic object creation.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./Solvers/">
        <img src="./Solvers/Assets/AssetImage/Solvers.png" alt="solvers" width="250px" />
      </a>
      <h3>Solvers</h3>
      <!-- tags:Solvers -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:Solvers -->
      <p>Collections of spatial behaviors for Spatial UI or scene objects.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AccessComponents/">
        <img src="./AccessComponents/Assets/AssetImage/AccessComponents.png" alt="access-components" width="250px" />
      </a>
      <h3>Access Components</h3>
      <!-- tags:AccessComponents -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:AccessComponents -->
      <p>Collection of scripts to showcase how to reference and access classes.</p>
    </td>
  </tr>
</table>

## World Understanding

Sense and use the world around the wearer

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./GuidedInstructions/">
        <img src="./GuidedInstructions/Assets/AssetImage/GuidedInstructions.png" alt="guided-instructions" width="250px" />
      </a>
      <h3>Guided Instructions</h3>
      <!-- tags:GuidedInstructions -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/overview"><img src="https://img.shields.io/badge/Remote%20Service%20Gateway-blue?color=78CDFC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list"><img src="https://img.shields.io/badge/AI%20%26%20LLM-blue?color=74C8FB" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/asr-module"><img src="https://img.shields.io/badge/Speech%20%26%20Voice-blue?color=3A80F2" /></a>
      </p>
      <!-- /tags:GuidedInstructions -->
      <p>Voice-driven, AI-assisted guided AR experiences: speech, depth, Gemini integration, and world-space UI.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./WorldQueryHit/">
        <img src="./WorldQueryHit/Assets/AssetImage/WorldQueryHit.png" alt="world-query-hit" width="250px" />
      </a>
      <h3>World Query Module</h3>
      <!-- tags:WorldQueryHit -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/world/surface-detection"><img src="https://img.shields.io/badge/World%20%26%20Surfaces-blue?color=66B7FA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/world-mesh-api"><img src="https://img.shields.io/badge/World%20Query%20%26%20Raycast-blue?color=62B1FA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:WorldQueryHit -->
      <p>Performs hit tests for real-world surfaces.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SurfacePlacement/">
        <img src="./SurfacePlacement/Assets/AssetImage/SurfacePlacement.png" alt="surface-placement" width="250px" />
      </a>
      <h3>Surface Placement</h3>
      <!-- tags:SurfacePlacement -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module"><img src="https://img.shields.io/badge/Gesture%20%26%20Hands-blue?color=6FC2FB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/world/surface-detection"><img src="https://img.shields.io/badge/World%20%26%20Surfaces-blue?color=66B7FA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/world-mesh-api"><img src="https://img.shields.io/badge/World%20Query%20%26%20Raycast-blue?color=62B1FA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
      </p>
      <!-- /tags:SurfacePlacement -->
      <p>Places content on floors and walls using head pose, with optional pinch/tap and near-surface modes.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./FaceMesh/">
        <img src="./FaceMesh/Assets/AssetImage/FaceMesh.png" alt="face-mesh" width="250px" />
      </a>
      <h3>Face Mesh</h3>
      <!-- tags:FaceMesh -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/face/overview"><img src="https://img.shields.io/badge/Face%20Tracking-blue?color=59A6F9" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:FaceMesh -->
      <p>Face mesh tracking setup with customizable materials and transform matching for smooth tracking motion.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./BodyMesh/">
        <img src="./BodyMesh/Assets/AssetImage/BodyMesh.png" alt="body-mesh" width="250px" />
      </a>
      <h3>Body Mesh</h3>
      <!-- tags:BodyMesh -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/body-tracking/overview"><img src="https://img.shields.io/badge/Body%20Tracking%20%26%20Mocap-blue?color=54A1F8" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:BodyMesh -->
      <p>Body mesh tracking and rigging utilities for full-body AR experiences.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AutoFloorFinder/">
        <img src="./AutoFloorFinder/Assets/AssetImage/AutoFloorFinder.png" alt="auto-floor-finder" width="250px" />
      </a>
      <h3>Auto Floor Finder</h3>
      <!-- tags:AutoFloorFinder -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/world/surface-detection"><img src="https://img.shields.io/badge/World%20%26%20Surfaces-blue?color=66B7FA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/world-mesh-api"><img src="https://img.shields.io/badge/World%20Query%20%26%20Raycast-blue?color=62B1FA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:AutoFloorFinder -->
      <p>Self-calibrating automatic floor-height detection with a lock and revalidate lifecycle.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./CustomLocations/">
        <img src="./CustomLocations/Assets/AssetImage/CustomLocations.png" alt="custom-locations" width="250px" />
      </a>
      <h3>Custom Locations</h3>
      <!-- tags:CustomLocations -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/world/surface-detection"><img src="https://img.shields.io/badge/World%20%26%20Surfaces-blue?color=66B7FA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/location"><img src="https://img.shields.io/badge/Location%20%26%20GPS-blue?color=4F9BF8" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:CustomLocations -->
      <p>Helpers for Custom Locations: activate content when the wearer is close and looking at a scanned place, plus a status panel and an example group.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AnchorExamples/">
        <img src="./AnchorExamples/Assets/AssetImage/AnchorExamples.png" alt="anchor-examples" width="250px" />
      </a>
      <h3>Anchor Examples</h3>
      <!-- tags:AnchorExamples -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/world/surface-detection"><img src="https://img.shields.io/badge/World%20%26%20Surfaces-blue?color=66B7FA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/world-mesh-api"><img src="https://img.shields.io/badge/World%20Query%20%26%20Raycast-blue?color=62B1FA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
      </p>
      <!-- /tags:AnchorExamples -->
      <p>Native AnchorModule wrapper and a persistent-widgets example: create, save, resolve and track spatial anchors across sessions.</p>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Helpers

Utilities and effects

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./Utilities/">
        <img src="./Utilities/Assets/AssetImage/Utilities.png" alt="utilities" width="250px" />
      </a>
      <h3>Utilities</h3>
      <!-- tags:Utilities -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:Utilities -->
      <p>Comprehensive utility library for scene object management, math operations, animations, and type conversions.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SnapDecorators/">
        <img src="./SnapDecorators/Assets/AssetImage/SnapDecorators.png" alt="snap-decorators" width="250px" />
      </a>
      <h3>Decorators</h3>
      <!-- tags:SnapDecorators -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:SnapDecorators -->
      <p>TypeScript decorators for simplified event binding and dependency injection to reduce boilerplate code.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./RuntimeGizmos/">
        <img src="./RuntimeGizmos/Assets/AssetImage/RuntimeGizmos.png" alt="runtime-gizmos" width="250px" />
      </a>
      <h3>Gizmos</h3>
      <!-- tags:RuntimeGizmos -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:RuntimeGizmos -->
      <p>Collections of line based tools for debugging or visualization.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./EasyTeleprompter/">
        <img src="./EasyTeleprompter/Assets/AssetImage/EasyTeleprompter.png" alt="easy-teleprompter" width="250px" />
      </a>
      <h3>Easy Teleprompter</h3>
      <!-- tags:EasyTeleprompter -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/asr-module"><img src="https://img.shields.io/badge/Speech%20%26%20Voice-blue?color=3A80F2" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/web-socket"><img src="https://img.shields.io/badge/WebSocket-blue?color=387BEB" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:EasyTeleprompter -->
      <p>Teleprompter lens for rehearsal and live public speaking with text display in field of view.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./CompositeCameraTexture/">
        <img src="./CompositeCameraTexture/Assets/AssetImage/CompositeCameraTexture.png" alt="composite-camera-texture" width="250px" />
      </a>
      <h3>Composite View</h3>
      <!-- tags:CompositeCameraTexture -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module"><img src="https://img.shields.io/badge/Camera%20Access-blue?color=4690F7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:CompositeCameraTexture -->
      <p>Advanced camera texture compositing and blending system.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./CropCameraTexture/">
        <img src="./CropCameraTexture/Assets/AssetImage/CropCameraTexture.png" alt="crop-camera-texture" width="250px" />
      </a>
      <h3>Crop Camera Texture</h3>
      <!-- tags:CropCameraTexture -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module"><img src="https://img.shields.io/badge/Camera%20Access-blue?color=4690F7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:CropCameraTexture -->
      <p>Camera texture cropping and region selection tools.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./VolumetricLine/">
        <img src="./VolumetricLine/Assets/AssetImage/VolumetricLine.png" alt="volumetric-line" width="250px" />
      </a>
      <h3>Volumetric Line</h3>
      <!-- tags:VolumetricLine -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:VolumetricLine -->
      <p>Advanced volumetric line rendering system for 3D graphics.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AnimationExamples/">
        <img src="./AnimationExamples/Assets/AssetImage/AnimationExamples.png" alt="animation-examples" width="250px" />
      </a>
      <h3>Animation Examples</h3>
      <!-- tags:AnimationExamples -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/Spatial%20UI-blue?color=6BBDFA" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:AnimationExamples -->
      <p>Native AnimationPlayer tween examples — scale, opacity, push-Z, squish, and timeline-driven animations driven from script.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./MarkerTrackingHelper/">
        <img src="./MarkerTrackingHelper/Assets/AssetImage/MarkerTrackingHelper.png" alt="marker-tracking-helper" width="250px" />
      </a>
      <h3>Marker Tracking Helper</h3>
      <!-- tags:MarkerTrackingHelper -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/ar-tracking/marker-tracking/overview"><img src="https://img.shields.io/badge/Marker%20Tracking-blue?color=5DACF9" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:MarkerTrackingHelper -->
      <p>Provides Marker Tracking Examples.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./ShaderLibrary/">
        <img src="./ShaderLibrary/Assets/AssetImage/ShaderLibrary.png" alt="shader-library" width="250px" />
      </a>
      <h3>Shader Library</h3>
      <!-- tags:ShaderLibrary -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview"><img src="https://img.shields.io/badge/Materials%20%26%20Shaders-blue?color=3067CD" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AnimationPlayer.html"><img src="https://img.shields.io/badge/Animation%20%26%20Tween-blue?color=2C5DBE" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
      </p>
      <!-- /tags:ShaderLibrary -->
      <p>Collection of seven optimized shaders designed to enhance power efficiency without sacrificing visual quality.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./BezierLine/">
        <img src="./BezierLine/Assets/AssetImage/BezierLine.png" alt="bezier-line" width="250px" />
      </a>
      <h3>Bezier Line</h3>
      <!-- tags:BezierLine -->
      <p>
        <a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview"><img src="https://img.shields.io/badge/SIK-blue?color=7DD3FC" /></a>
        <a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview"><img src="https://img.shields.io/badge/3D%20Rendering%20%26%20Meshes-blue?color=2E62C6" /></a>
        <a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs"><img src="https://img.shields.io/badge/Prefabs%20%26%20Instantiation-blue?color=2A58B7" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Scripting-blue?color=2853AF" /></a>
        <a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview"><img src="https://img.shields.io/badge/Debugging%20%26%20Dev%20Tools-blue?color=264EA8" /></a>
      </p>
      <!-- /tags:BezierLine -->
      <p>Camera-facing cubic Bézier ribbon between two scene objects with runtime mesh generation.</p>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Additional Resources

- **[SPECS Developer Documentation](https://developers.specs.com/)** - Guides and API references
- **[Lens Studio](https://ar.snap.com/lens-studio)** - Download Lens Studio
- **[Community](https://www.reddit.com/r/Spectacles/)** - Connect with other developers and get support
- **[SPECS on GitHub](https://github.com/specs-devs)** - Samples, packages, core frameworks and icons

---

*Built with 👽 by the SPECS team*
