# VideoCallS2S examples

[← Agent usage index](../README.md)

## Use when

Place the entry prefab or use exact typed pairing/native-capability helpers.

## Entry prefab

Drag `VideoCallS2S.lspkg/VideoCallS2S__PLACE_IN_SCENE.prefab` into a configured Specs scene. Wire manager.snapCloud to its SnapCloudModule component and assign your SupabaseProject on the prefab's SnapCloudRequirements object. Manager builds runtime HomeUI, incoming dialog and call panel; public state-changing call methods are not exported. Do not try to invoke private callFriend/accept/hangup operations by cast.

The prefab carries its own demo onboarding: a `CredentialsWarning` panel, a `Guide` panel and an `ExampleCarousel` (scripts in `Example/`, see [components](components.md#demo-scaffolding-example)). The package objects sit under `VideoCallS2SDemo`. For your own Lens, keep `SnapCloudRequirements` (the `Snap Cloud` object reads the project from it) and `VideoCallS2SDemo`'s children, and drop the warning, guide and carousel.

## Normalize a peer code and derive the session

This pure helper validates code shape only. It does not authenticate a peer or make a mailbox connected. Callee code defines the shared call session.

```typescript
import {normalizePairingCode, callSessionId} from "VideoCallS2S.lspkg/Scripts/App/Types"

export function peerMailboxSession(typedCode: string): string | null {
  const peerCode = normalizePairingCode(typedCode)
  return peerCode === null ? null : callSessionId(peerCode)
}
```

Normalization removes non-digits and accepts exactly four remaining digits. makePairingCode randomly selects four digits, including possible leading zero; the code alone is not a secure or globally unique identity.

## Check native generation without claiming media connection

The controller publishes null until native load succeeds. Capability checks ping >=3, catches ping failure and returns false. This is a module-generation check, not isConnected/auth/frame/audio proof.

```typescript
import {WebRTCController} from "VideoCallS2S.lspkg/Scripts/WebRTC/WebRTCController"
import {WebRTCSession} from "VideoCallS2S.lspkg/Scripts/WebRTC/WebRTCSession"

export function hasCompatibleS2SModule(): boolean {
  const native = WebRTCController.native
  return native !== null && WebRTCSession.isS2SCapable(native)
}
```

For a real call, caller is offerer and callee is answerer. Assign nullable frame/audio callbacks before starting resources you own; stop them on teardown. The manager already owns its inbox/outbox/streamer lifecycle, so a helper observer must not create competing camera/mic sessions.

## Verification recipe

Editor without ready cloud: previewTestPattern true permits CALL FRIEND to show synthetic panel, even absent/invalid peer code; that branch is explicitly preview-only. Capture animation at two timestamps and check the layout/quality/hangup controls separately.

Two devices: own cloud configured/authenticated, exact schema/policies, one caller/one callee, native generation >=3; then ring, accept, both videos/voices, quality cycling, busy/deny/timeouts and repeat-call hangup. No hardware pass was executed here.
