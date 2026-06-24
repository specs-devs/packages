# Specs Packages

Asset packages and utilities for building Lens experiences on **Specs**. This **README** is what you see on the [public GitHub mirror](https://github.com/specs-devs/packages); it only lists packages that are included in that mirror. Preview images use each package's `Assets/AssetImage` artwork.

> [!IMPORTANT]
> **This `main` branch targets SPECS 27 with Lens Studio 5.22.0+ and will NOT work with Spectacles (2024).**
> For Spectacles (2024), switch to the [`5.15.4` branch](https://github.com/specs-devs/packages/tree/5.15.4) or download the [`5.15.4` release](https://github.com/specs-devs/packages/releases/tag/5.15.4) zip.

## Package index

| | | |
|:--|:--|:--|
| [AiPreviewAgentInspect](./AiPreviewAgentInspect/) | [AiPreviewAgentInteract](./AiPreviewAgentInteract/) | [AccessComponents](./AccessComponents/) |
| [AnimationExamples](./AnimationExamples/) | [BodyMesh](./BodyMesh/) | [CommerceKit](./CommerceKit/) |
| [CompositeCameraTexture](./CompositeCameraTexture/) | [CropCameraTexture](./CropCameraTexture/) | [EasyTeleprompter](./EasyTeleprompter/) |
| [FaceMesh](./FaceMesh/) | [FunctionCallHelper](./FunctionCallHelper/) | [GuidedInstructions](./GuidedInstructions/) |
| [HandAttacher](./HandAttacher/) | [Instantiation](./Instantiation/) | [InteractableHelper](./InteractableHelper/) |
| [MarkerTrackingHelper](./MarkerTrackingHelper/) | [MocopiReceiver](./MocopiReceiver/) | [ReachyReceiver](./ReachyReceiver/) |
| [RemoteServiceGateway](./RemoteServiceGateway/) | [RuntimeGizmos](./RuntimeGizmos/) | [SnapCloudExamples](./SnapCloudExamples/) |
| [SnapDecorators](./SnapDecorators/) | [Solvers](./Solvers/) | [Specs3DHandHints](./Specs3DHandHints/) |
| [SpecsInteractionKitExamples](./SpecsInteractionKitExamples/) | [SpecsNavigationKit](./SpecsNavigationKit/) | [SpecsShaderLibrary](./SpecsShaderLibrary/) |
| [SupabaseClient](./SupabaseClient/) | [SurfacePlacement](./SurfacePlacement/) | [Utilities](./Utilities/) |
| [VolumetricLine](./VolumetricLine/) | [WebSocketExamples](./WebSocketExamples/) | [WorldQueryHit](./WorldQueryHit/) |

## Core

Essential packages for Specs development

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./RemoteServiceGateway/">
        <img src="./RemoteServiceGateway/Assets/AssetImage/RemoteServiceGateway.png" alt="remote-service-gateway" width="250px" />
      </a>
      <h3>Remote Service Gateway</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/overview">
  <img src="https://img.shields.io/badge/Remote%20Service%20Gateway-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch?">
  <img src="https://img.shields.io/badge/Fetch-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list">
  <img src="https://img.shields.io/badge/LLM-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>A package that provides a set of tools that allow to publish lenses with access to user-sensitive data.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SpecsNavigationKit/">
        <img src="./SpecsNavigationKit/Assets/AssetImage/SpecsNavigationKit.png" alt="spectacles-navigation-kit" width="250px" />
      </a>
      <h3>Specs Navigation Kit</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/getting-started">
  <img src="https://img.shields.io/badge/Navigation-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/location?">
  <img src="https://img.shields.io/badge/Location-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Set of components designed to simplify the development of navigation experiences for Specs.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./CommerceKit/">
        <img src="./CommerceKit/Assets/AssetImage/CommerceKit.png" alt="commerce-kit" width="250px" />
      </a>
      <h3>CommerceKit (Closed Beta)</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/getting-started">
  <img src="https://img.shields.io/badge/Commerce-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Framework for handling in-app purchases for non-consumable items in Specs.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./SpecsInteractionKitExamples/">
        <img src="./SpecsInteractionKitExamples/Assets/AssetImage/SpecsInteractionKitExamples.svg.png" alt="spectacles-interaction-kit-examples" width="250px" />
      </a>
      <h3>Specs Interaction Kit Examples</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/Spatial%20UI-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Example scenes and prefabs for SpectaclesInteractionKit and SpectaclesUIKit, including Rocket Workshop and UI starter patterns.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AiPreviewAgentInspect/">
        <img src="./AiPreviewAgentInspect/Assets/AssetImage/AiPreviewAgentInspect.png" alt="ai-preview-agent-inspect" width="250px" />
      </a>
      <h3>AI Preview Agent - Inspect</h3>
      <p>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list">
  <img src="https://img.shields.io/badge/LLM-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Lens-side bridge that lets an external AI agent observe a running Lens through live scene queries and orthographic render captures.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AiPreviewAgentInteract/">
        <img src="./AiPreviewAgentInteract/Assets/AssetImage/AiPreviewAgentInteract.png" alt="ai-preview-agent-interact" width="250px" />
      </a>
      <h3>AI Preview Agent - Interact</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list">
  <img src="https://img.shields.io/badge/LLM-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Lets an external AI agent drive a running Lens by synthesizing pinch, poke, and drag hand interactions for end-to-end agent verification.</p>
    </td>
  </tr>
</table>

## Cloud

Supabase and Snap Cloud integration

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./SupabaseClient/">
        <img src="./SupabaseClient/Assets/AssetImage/SupabaseClient.png" alt="supabase-client" width="250px" />
      </a>
      <h3>Supabase Client</h3>
      <p>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/authorization?">
  <img src="https://img.shields.io/badge/Auth-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/lens-cloud/lens-cloud-overview?">
  <img src="https://img.shields.io/badge/Cloud-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Client library for connecting to Supabase backend infrastructure.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SnapCloudExamples/">
        <img src="./SnapCloudExamples/Assets/AssetImage/SnapCloudExamples.png" alt="snap-cloud-examples" width="250px" />
      </a>
      <h3>Snap Cloud Examples</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/lens-cloud/lens-cloud-overview?">
  <img src="https://img.shields.io/badge/Cloud-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Collection of examples demonstrating Supabase integration for authentication, real-time data, and cloud storage.</p>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Input Helpers

User interface and input assistance tools

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./Specs3DHandHints/">
        <img src="./Specs3DHandHints/Assets/AssetImage/Specs3DHandHints.png" alt="spectacles-3d-hand-hints" width="250px" />
      </a>
      <h3>Specs 3D Hand Hints</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module?">
  <img src="https://img.shields.io/badge/Gesture%20Module-Light%20Gray?color=D3D3D3" />
</a>
<img src="https://img.shields.io/badge/Animation-Light%20Gray?color=D3D3D3" />
      </p>
      <p>Suite of animated Hand Gestures Hints.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./InteractableHelper/">
        <img src="./InteractableHelper/Assets/AssetImage/InteractableHelper.png" alt="interactable-helper" width="250px" />
      </a>
      <h3>Interactable Helper</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module?">
  <img src="https://img.shields.io/badge/Gesture%20Module-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Low to medium fidelity prototyping tool for Specs Interaction Kit components without code.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./FunctionCallHelper/">
        <img src="./FunctionCallHelper/Assets/AssetImage/FunctionCallHelper.png" alt="function-call-helper" width="250px" />
      </a>
      <h3>Function Call Helper</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/Spatial%20UI-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>System for exposing function callbacks in the inspector, allowing you to configure and trigger script functions through UI buttons.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./FaceMesh/">
        <img src="./FaceMesh/Assets/AssetImage/FaceMesh.png" alt="face-mesh" width="250px" />
      </a>
      <h3>Face Mesh</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/ar-tracking/face/overview?">
  <img src="https://img.shields.io/badge/Face%20Tracking-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Face mesh tracking setup with customizable materials and transform matching for smooth tracking motion.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./BodyMesh/">
        <img src="./BodyMesh/Assets/AssetImage/BodyMesh.png" alt="body-mesh" width="250px" />
      </a>
      <h3>Body Mesh</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/ar-tracking/body-tracking/overview?">
  <img src="https://img.shields.io/badge/Body%20Tracking-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Body mesh tracking and rigging utilities for full-body AR experiences.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./HandAttacher/">
        <img src="./HandAttacher/Assets/AssetImage/HandAttacher.png" alt="hand-attacher" width="250px" />
      </a>
      <h3>Hand Attacher</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module?">
  <img src="https://img.shields.io/badge/Gesture%20Module-Light%20Gray?color=D3D3D3" />
</a>
<a href="./ReachyReceiver/">
  <img src="https://img.shields.io/badge/Reachy-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Attach objects to hand joints in world space with customizable offsets and smooth interpolation.</p>
    </td>
  </tr>
</table>

## BLE and WebSockets

Game controllers, robotics, and real-time streaming over BLE and WebSocket

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./ReachyReceiver/">
        <img src="./ReachyReceiver/Assets/AssetImage/ReachyReceiver.png" alt="reachy-receiver" width="250px" />
      </a>
      <h3>Reachy Receiver</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Robotics-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/experimental-apis?">
  <img src="https://img.shields.io/badge/WebSocket-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Integration for Reachy humanoid robot with WebSocket streaming.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./MocopiReceiver/">
        <img src="./MocopiReceiver/Assets/AssetImage/MocopiReceiver.png" alt="mocopi-receiver" width="250px" />
      </a>
      <h3>Mocopi Receiver</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/experimental-apis?">
  <img src="https://img.shields.io/badge/Motion%20Capture-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Full-body motion capture integration for Sony mocopi sensors with WebSocket streaming and automatic bone mapping.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./WebSocketExamples/">
        <img src="./WebSocketExamples/Assets/AssetImage/WebsocketExamples.png" alt="websocket-examples" width="250px" />
      </a>
      <h3>WebSocket Examples</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/connected-lenses/overview?">
  <img src="https://img.shields.io/badge/Networking-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/experimental-apis?">
  <img src="https://img.shields.io/badge/WebSocket-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>WebSocket examples for real-time data exchange including TextEcho, IMUData, and IMUCube.</p>
    </td>
  </tr>
</table>

## Essentials

Core utilities and building blocks

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./Instantiation/">
        <img src="./Instantiation/Assets/AssetImage/Instantiation.png" alt="instantiation" width="250px" />
      </a>
      <h3>Instantiation</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/objects-and-assets/prefabs?">
  <img src="https://img.shields.io/badge/Prefabs-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Examples for dynamic object creation.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./Solvers/">
        <img src="./Solvers/Assets/AssetImage/Solvers.png" alt="solvers" width="250px" />
      </a>
      <h3>Solvers</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module?">
  <img src="https://img.shields.io/badge/Spatial%20UI-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Collections of spatial behaviors for Spatial UI or scene objects.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./AccessComponents/">
        <img src="./AccessComponents/Assets/AssetImage/AccessComponents.png" alt="access-components" width="250px" />
      </a>
      <h3>Access Components</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/component-system?">
  <img src="https://img.shields.io/badge/Component%20System-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Collection of scripts to showcase how to reference and access classes.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./WorldQueryHit/">
        <img src="./WorldQueryHit/Assets/AssetImage/WorldQueryHitExample.png" alt="world-query-hit" width="250px" />
      </a>
      <h3>World Query Hit - Spawn On Surface</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/world-mesh-api">
  <img src="https://img.shields.io/badge/World%20Query-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.RayCastHit.html">
  <img src="https://img.shields.io/badge/Raycast-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Performs hit tests for real-world surfaces.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SurfacePlacement/">
        <img src="./SurfacePlacement/Assets/AssetImage/SurfacePlacement.png" alt="surface-placement" width="250px" />
      </a>
      <h3>Surface Placement</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/ar-tracking/world/surface-detection?">
  <img src="https://img.shields.io/badge/Surface%20Detection-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/AR%20Tracking-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Detects and recognizes real-world surfaces.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SnapDecorators/">
        <img src="./SnapDecorators/Assets/AssetImage/SnapDecorators.png" alt="snap-decorators" width="250px" />
      </a>
      <h3>Snap Decorators</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/typescript?">
  <img src="https://img.shields.io/badge/TypeScript-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>TypeScript decorators for simplified event binding and dependency injection to reduce boilerplate code.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./Utilities/">
        <img src="./Utilities/Assets/AssetImage/Utilities.png" alt="utilities" width="250px" />
      </a>
      <h3>Utilities</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/component-system?">
  <img src="https://img.shields.io/badge/Utils-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Comprehensive utility library for scene object management, math operations, animations, and type conversions.</p>
    </td>
    <td width="33%"></td>
    <td width="33%"></td>
  </tr>
</table>

## Helpers

Development utilities and helper tools

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./AnimationExamples/">
        <img src="./AnimationExamples/Assets/AssetImage/AnimationExamples.svg" alt="animation-examples" width="250px" />
      </a>
      <h3>Animation Examples</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/Spatial%20UI-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Native AnimationPlayer tween examples — scale, opacity, push-Z, squish, and timeline-driven animations driven from script.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./RuntimeGizmos/">
        <img src="./RuntimeGizmos/Assets/AssetImage/RuntimeGizmos.png" alt="runtime-gizmos" width="250px" />
      </a>
      <h3>Runtime Gizmos</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview">
  <img src="https://img.shields.io/badge/Graphics%20Material%20Particles-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Collections of line based tools for debugging or visualization.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./MarkerTrackingHelper/">
        <img src="./MarkerTrackingHelper/Assets/AssetImage/MarkerTrackerHelper.png" alt="marker-tracking-helper" width="250px" />
      </a>
      <h3>Marker Tracking Helper</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/ar-tracking/marker-tracking/overview?">
  <img src="https://img.shields.io/badge/Marker%20Tracking-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/AR%20Tracking-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Provides Marker Tracking Examples.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./VolumetricLine/">
        <img src="./VolumetricLine/Assets/AssetImage/VolumetricLine.png" alt="volumetric-line" width="250px" />
      </a>
      <h3>Volumetric Line</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview?">
  <img src="https://img.shields.io/badge/Graphics%20Materials%20Particles-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview?">
  <img src="https://img.shields.io/badge/Shaders-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/rendering-overview?">
  <img src="https://img.shields.io/badge/3D%20Rendering-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Advanced volumetric line rendering system for 3D graphics.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./SpecsShaderLibrary/">
        <img src="./SpecsShaderLibrary/Assets/AssetImage/SpecsShaderLibrary.png" alt="spectacles-shader-library" width="250px" />
      </a>
      <h3>Specs Shader Library</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview?">
  <img src="https://img.shields.io/badge/Shaders-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview?">
  <img src="https://img.shields.io/badge/Graphics%20Materials%20Particles-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Collection of seven optimized shaders designed to enhance power efficiency without sacrificing visual quality.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./EasyTeleprompter/">
        <img src="./EasyTeleprompter/Assets/AssetImage/EasyTeleprompter.png" alt="easy-teleprompter" width="250px" />
      </a>
      <h3>Easy Teleprompter</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/Spatial%20UI-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/text/overview?">
  <img src="https://img.shields.io/badge/Text%20Rendering-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Teleprompter lens for rehearsal and live public speaking with text display in field of view.</p>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./GuidedInstructions/">
        <img src="./GuidedInstructions/Assets/AssetImage/GuidedInstructions.png" alt="guided-instructions" width="250px" />
      </a>
      <h3>Guided Instructions</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/overview">
  <img src="https://img.shields.io/badge/Remote%20Service%20Gateway-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/scripting/scripting-overview?">
  <img src="https://img.shields.io/badge/Scripting-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list">
  <img src="https://img.shields.io/badge/LLM-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Voice-driven, AI-assisted guided AR experiences: speech, depth, Gemini integration, and world-space UI.</p>
    </td>
    <td width="33%"></td>
    <td width="33%"></td>
  </tr>
</table>

## Camera & Image Processing

Camera texture manipulation and processing tools

<table>
  <tr>
    <td align="center" valign="top" width="33%">
      <a href="./CompositeCameraTexture/">
        <img src="./CompositeCameraTexture/Assets/AssetImage/CompositeCameraTexture.png" alt="composite-camera-texture" width="250px" />
      </a>
      <h3>Composite Camera Texture</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module?">
  <img src="https://img.shields.io/badge/Camera%20Access-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/overview?">
  <img src="https://img.shields.io/badge/Shaders-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Advanced camera texture compositing and blending system.</p>
    </td>
    <td align="center" valign="top" width="33%">
      <a href="./CropCameraTexture/">
        <img src="./CropCameraTexture/Assets/AssetImage/CropCameraTexture.png" alt="crop-camera-texture" width="250px" />
      </a>
      <h3>Crop Camera Texture</h3>
      <p>
<a href="https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?">
  <img src="https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module?">
  <img src="https://img.shields.io/badge/Camera%20Access-Light%20Gray?color=D3D3D3" />
</a>
<a href="https://developers.snap.com/lens-studio/features/graphics/materials/post-effects?">
  <img src="https://img.shields.io/badge/Post%20Effects-Light%20Gray?color=D3D3D3" />
</a>
      </p>
      <p>Camera texture cropping and region selection tools.</p>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Additional Resources

- **[Specs Developer Documentation](https://developers.snap.com/spectacles)** - Guides and API references
- **[Lens Studio](https://ar.snap.com/lens-studio)** - Download Lens Studio
- **[Community Forum](https://www.reddit.com/r/Spectacles/)** - Developer community

## Getting Started

1. Clone this repository (sparse checkout a single package if you prefer).
2. Open the package folder in Lens Studio.
3. Use **Asset Library** or project `Packages/` for dependencies declared in each package.

---*Maintained with 👽 by the SPECS Team*
