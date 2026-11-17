# DecartAI API status

[← Agent usage index](../README.md)

## Use when

Check compatibility and current limitations before choosing an API.

The package version is in `package.native`. Status is derived from this source tree, not a runtime certification.

## Current

| Surface | Installed behavior |
|---|---|
| `DecartRealtimeRestyle` | Main engine component, prompt/start/stop and display-tuning API; editor bridge and HTTP paths implemented |
| `DecartControlsUI` | Engine-bound runtime prompt, presets, Start/Stop, display sliders and Menu/Hide |
| `DecartRequirements` | Shared placeholder-aware key lookup and optional reminder Text |
| `LazyTether` | Yaw-only soft-follow rig with angle/distance deadzones |

## Experimental

| Surface | Validation needed |
|---|---|
| Engine device-native path | Compatible device, library permissions, SDP/ICE and decoded frame round trip |
| `DecartWebRTCSession` | WebSocket signaling dialect and native session result handling; no automatic reconnect |
| `DecartWebRTCNativeModule` and exports | Device ABI/library availability; exports mirror bundled native module |
| `DecartWebRTCController` | Optional standalone device smoke test; not the main transport engine |

## Deprecated / compatibility-only

No source annotation declares a deprecated method. These public Inspector fields nevertheless have no effective native-path control in the main engine:

| Field | Effective setting / replacement |
|---|---|
| `nativeEndpoint` | Forced `wss://api3.decart.ai/v1/stream` |
| `nativeModel` | Source constant `NATIVE_MODEL='lucy-restyle-2'` |
| `nativeUseH265` | Forced false (H.264) |
| `nativeBitrateKbps` | Source constant `NATIVE_UPLINK_KBPS=4000` |
| `nativeDownlinkKbps` | Explicitly inactive; native requestDownlinkKbps is a no-op in included C++ |

Do not advertise those Inspector fields as live controls. Changing constants requires a package source change and revalidation.

## Removed

| Symbol | Notes |
|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel` | Old guide presenter deleted together with the prefab's `Guide_ReadMe`. The current demo guide presenter ships as demo scaffolding in `Example/GuideDismissPanel/` (not package API); see [components](components.md#demo-scaffolding-example). |
| Prefab `AiPreviewAgent Handler` | Preview-tooling object (AgentInspect/AgentInteract) removed from `DecartAI__PLACE_IN_SCENE.prefab`; it was never package API. |

## Migrations

`target` / `mode` ComboBox items were declared `(value, label)` instead of the engine's `(label, value)`, so the Inspector saved the label text (e.g. `Realtime via Mac bridge (fast)`) and every saved `mode` ran the HTTP branch. The items are now `(label, value)`, the prefab stores `auto` / `bridge`, and `onAwake` maps old label text back to the key (`Auto…`→`auto`, `Editor…`→`editor`, `Device…`→`device`, `Realtime…`→`bridge`, `Cloud…`→`http`). An old scene that had picked "device" will now really force the native path, which cannot load in Preview — set it to `auto`.

The preserved tutorial's latency and pipeline claims are historical and were not re-tested; the effective main engine is described above.
