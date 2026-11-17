# RemoteServiceGateway setup

[← Agent usage index](../README.md)

## Use when

Read this before the first call: getting the API tokens, putting them into
`RemoteServiceGatewayCredentials`, and knowing which `.remoteServiceModule`
assets each module loads. The package ships no credentials. Every value below
is a placeholder.

## 1. Get the tokens

The setup link is in the `RemoteServiceGatewayCredentials` inspector (an
`@ui.label` in `RemoteServiceGatewayCredentials.ts`):
<https://developers.snap.com/spectacles/about-spectacles-features/apis/remoteservice-gateway#setup-instructions>.
Follow it to generate the tokens. The package source does not describe how
tokens are issued, so that page is the source of truth.

| Token type (`AvaliableApiTypes`) | Used by |
|---|---|
| `Snap` | `Snap3D` (`HostedSnap/Snap3D.ts`) |
| `OpenAI` | `OpenAI`, `OpenAIRealtimeWebsocket` (`HostedExternal/OpenAI.ts`) |
| `Google` | `Gemini`, `GeminiLiveWebsocket`, `Imagen`, `Lyria` (`HostedExternal/Gemini.ts`, `Imagen.ts`, `Lyria.ts`) |

Every request sends the token as the `api-token` parameter of the
`RemoteApiRequest` (or of the API WebSocket for the realtime modules).

## 2. Put the tokens in the Lens

### Option A: the component (what the prefab does)

Add `RemoteServiceGatewayCredentials` (`RemoteServiceGateway.lspkg/RemoteServiceGatewayCredentials.ts`)
to a SceneObject that sits **above** every script that makes calls. The
example prefab has it as its first child.

| Input | Type | Script default | Prefab value |
|---|---|---|---|
| `openAIToken` (label "OpenAI Token") | `string` | `"[INSERT OPENAI TOKEN HERE]"` | `"[INSERT OPEN AI TOKEN]"` |
| `googleToken` (label "Google Token") | `string` | `"[INSERT GOOGLE TOKEN HERE]"` | `"[INSERT GOOGLE TOKEN]"` |
| `snapToken` (label "Snap Token") | `string` | `"[INSERT SNAP TOKEN HERE]"` | `"[INSERT SNAP TOKEN]"` |
| `enableLogging` | `boolean` | `false` | `false` |
| `enableLoggingLifecycle` | `boolean` | `false` | `false` |

In `onAwake` the component copies the three inputs into private static fields.
That is the only thing it does. A placeholder left in an input is sent as the
token, and the call fails.

### Option B: at runtime

```typescript
import {
  AvaliableApiTypes,
  RemoteServiceGatewayCredentials,
} from "RemoteServiceGateway.lspkg/RemoteServiceGatewayCredentials";

RemoteServiceGatewayCredentials.setApiToken(AvaliableApiTypes.Snap, "<SNAP_TOKEN>");
RemoteServiceGatewayCredentials.setApiToken(AvaliableApiTypes.OpenAI, "<OPENAI_TOKEN>");
RemoteServiceGatewayCredentials.setApiToken(AvaliableApiTypes.Google, "<GOOGLE_TOKEN>");
const current = RemoteServiceGatewayCredentials.getApiToken(AvaliableApiTypes.Google);
```

- `setApiToken(type, token)` stores all three types in this revision. Before
  this branch it stored only `Snap`, and OpenAI and Google tokens were silently
  dropped.
- `getApiToken(type)` returns the stored string, or `""` when nothing is set.
  It never throws.
- Order matters. When a `RemoteServiceGatewayCredentials` component is in the
  scene, its `onAwake` **overwrites** all three statics with its inputs. Call
  `setApiToken` after that awake (for example from `OnStartEvent`), or leave the
  component out.
- Each module reads the token when the request is made (or, for the realtime
  modules, when the socket is created). A later `setApiToken` therefore applies
  to the next call, not to a socket that is already open.

### The "Credentials needed" warning in the demo prefab

The prefab's `CredentialsWarning` object (`Example/CredentialsWarning/CredentialsWarning.ts`)
checks `RemoteServiceGatewayCredentials` on awake. It is wired with
`requireSnapToken`, `requireOpenAIToken` and `requireGoogleToken` all `true`,
because the examples use all three token types (see the table in section 1).
A token counts as missing when it is empty or still starts with `[INSERT`.

- Any token missing: a red-framed "Credentials needed" panel appears **before**
  the "Ok, I understood" guide and lists each missing token. "Continue without
  credentials" closes it and the guide shows; the examples that need the
  missing tokens answer with errors.
- All three tokens set: the warning turns itself off and the guide shows
  directly.

The shipped prefab only holds placeholders, so a fresh install always shows the
warning. This package does not use Snap Cloud, so the warning's
`snapCloudRequirements` input is left empty and Snap Cloud is not checked.

> **Do not commit tokens.** The component itself shows the warning "Do not
> include your API token when sharing or uploading this project to version
> control." Keep real values out of shared scenes, prefabs and this
> documentation. Commit placeholders only.

## 3. Lens Studio Preview

- To make calls from the Lens Studio Preview you have to be logged in to My
  Lenses in Lens Studio.
- Without a valid token every call rejects. The bundled examples then write
  `Error: <response body>` into their `TextOutput` (Imagen and Lyria only print
  to the Logger; see [troubleshooting](troubleshooting.md)).

## 4. Remote service module assets

Each module loads its `.remoteServiceModule` assets with `requireAsset` at
module load, by a path relative to the script. Keep the package folder layout
intact: moving or renaming these files breaks the module at import time.

| Module | Assets (`requireAsset`) | Other modules it `require`s |
|---|---|---|
| `HostedExternal/OpenAI.ts` | `RemoteServiceModules/OpenAi_Completions`, `OpenAi_Generations`, `OpenAi_ImageEdits`, `OpenAi_Speech`, `OpenAi_Realtime` | `LensStudio:RemoteMediaModule` |
| `HostedExternal/Gemini.ts` | `RemoteServiceModules/Gemini_Sync`, `Gemini_Live` | none |
| `HostedExternal/Imagen.ts` | `RemoteServiceModules/Imagen_Sync` | none |
| `HostedExternal/Lyria.ts` | `RemoteServiceModules/Lyria_Sync` | none |
| `HostedExternal/GoogleGenAI.ts` | none itself, but it imports `Gemini`, `Lyria` and `Imagen`, so all four Google assets load | none |
| `HostedSnap/Snap3D.ts` | `RemoteServiceModules/Snap3D_Submit`, `Snap3D_GetStatus` | `LensStudio:RemoteMediaModule`, `LensStudio:InternetModule` |

`HostedSnap/RemoteServiceModules/Remote Media Module.remoteMediaModule` ships
in the package, but no script loads it with `requireAsset`. The scripts get the
module with `require("LensStudio:RemoteMediaModule")`.

The helpers need their own assets (see [components](components.md#helpers)):
`MicrophoneRecorder.micAudioTrack` takes `Resources/Microphone Audio.micaudio`,
and `DynamicAudioOutput.audioOutputTrack` takes `Resources/Audio Output.audioOutput`
plus an `AudioComponent` on the same SceneObject.

## 5. Capabilities

The scripts only `require` Lens Studio modules (Remote Service, Internet,
Remote Media, Gesture, VoiceML for the mic, Camera for `VideoController`). They
do not change project settings. The package source does not say which
permission or publishing settings apply when internet is combined with the
microphone or camera. See the camera, audio and
internet sections of the Specs documentation, and the SPECS publishing docs for your Lens Studio
version.
