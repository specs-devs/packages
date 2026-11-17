# RemoteServiceGateway examples

[← Agent usage index](../README.md)

## Use when

You need a starting point for a call, or you want to know what the example
prefab contains. Copy the smallest snippet that does the job, and build the
rest of the experience (UI, interaction, placement) yourself. The snippets use
only names that exist in this revision ([components](components.md)). They
assume the tokens are set ([setup](setup.md)).

Rules every snippet follows:

- Import with the consumer prefix `RemoteServiceGateway.lspkg/...`.
- Call the services from a handler or after `OnStartEvent`, not from `onAwake`,
  so the `RemoteServiceGatewayCredentials` component has awoken first.
- Always `.catch` (or `try/catch`). Every call rejects without a valid token.

## Example prefab

Drag `RemoteServiceGateway.lspkg/RemoteServiceGateway__PLACE_IN_SCENE.prefab`
into the scene. Hierarchy, from the prefab's `Name:` fields (local positions in
cm, `OFF` = SceneObject disabled):

```text
RemoteServiceGateway__PLACE_IN_SCENE        (0, 0, 0)
├── ThemeManager                                    UIKit theme (System 3.0)
├── RemoteServiceGatewayCredentials                 RemoteServiceGatewayCredentials (placeholder tokens)
├── CredentialsWarning                              CredentialsWarning (Snap, OpenAI and Google required)
├── Guide                                           GuideDismissPanel + UIKit Frame (0, 0, -100)
├── ExampleCarousel                                 ExampleCarousel (0, -22, -100), 7 steps (below)
├── Snap Hosted Examples                            (0, 5, -110)
│   ├── Snap3D                                      (0, -10, 0)     step 6
│   │   └── ExampleSnap3D                           ExampleSnap3D (runOnTap = run in demo: true)
│   │       ├── ImageRoot          Image            (-15, -13, 0)  children: Text, LoadingSpinner
│   │       ├── BaseMeshRoot                        (0, -13, 0)    children: Text, LoadingSpinner
│   │       ├── RefinedMeshRoot                     (15, -13, 0)   children: Text, LoadingSpinner
│   │       └── Snap3D Title       Text             hintText (status line)
│   ├── Title / Hint               Text  OFF
│   └── ImageTo3D                                   (0, -10, 0)     step 7
│       └── ExampleSnap3DImageTo3D                  ExampleSnap3DImageTo3D (public image URL, run in demo: true)
└── External Hosted Examples                        (0, 5, -110)
    ├── Websocket requirements
    │   ├── MicrophoneRecorder                      MicrophoneRecorder (micAudioTrack = Resources/Microphone Audio)
    │   └── DynamicAudioOutput                      DynamicAudioOutput + AudioComponent (shared by Realtime, Live, Lyria)
    ├── OpenAI                                      (0, -10, 0)     step 1
    │   ├── ExampleOAICalls                         ExampleOAICalls (every call on)
    │   │   ├── TextOutput         Text             (-13, 0, 0)
    │   │   └── ImageOutputExample Image            (13, -5, 0)   child: LoadingSpinner
    │   ├── Title                  Text  OFF
    │   └── OpenAI Realtime        OFF              ExampleOAIRealtime (13, -5, 0), audioOutput on, voice ash   step 2
    │       └── TextOutput         Text
    ├── Gemini and Imagen                           (0, -10, 0)     step 3
    │   ├── ExampleGeminiCalls                      ExampleGeminiCalls (text + function calling on)
    │   │   ├── TextOutput         Text             (-13, 0, 0)
    │   │   └── ImageOutputExample Image            (13, -5, 0)   child: LoadingSpinner
    │   ├── Title                  Text  OFF
    │   ├── Gemini Live            OFF              ExampleGeminiLive (0, -5, 0), haveAudioOutput on   step 4
    │   │   └── TextOutput         Text
    │   └── ExampleImagenCalls                      ExampleImagenCalls (imgObject = Gemini ImageOutputExample)
    ├── Title / Hint               Text  OFF
    └── Lyria                                       (0, -10, 0)     step 5
        └── ExampleLyriaCall                        ExampleLyriaCall (generate + play on)
```

### Auto-run demo

Each carousel step runs its own demo as soon as it is shown (on start for the
first step, then on every Previous / Next). Nothing needs a tap. Inside a step
the calls run one after the other, each awaited. Leaving a step stops it: open
sockets are closed, the microphone and audio output are stopped, music and
speech stop, and late responses from the old step are ignored.

| Step | What runs, in order |
|---|---|
| 1 OpenAI | `gpt-5.6-luna` chat → function calling (`set-text-color`) → `gpt-image-2` generate (shown on the right) → `gpt-image-2` edit with the mask (replaces it) → `gpt-4o-mini-tts` speech, played to the end |
| 2 OpenAI Realtime | `gpt-realtime-mini` socket opens → `session.update` (audio, voice `ash`) → mic streams → `response.create` with the greeting, so the model speaks first. Talk back, or ask it to change the text color |
| 3 Gemini and Imagen | `gemini-2.5-flash` text → Gemini function calling (`set_text_color`) → `Imagen.generateContent` with `gemini-3.1-flash-image` (shown on the right) |
| 4 Gemini Live | `models/gemini-live-2.5-flash` socket opens → `setup` (audio, voice `Puck`) → mic streams → a greeting turn, so the model speaks first |
| 5 Lyria | `lyria-002` generates a clip (about 30 s, the request itself takes a while) → the WAV is played to the end |
| 6 Snap3D | `Snap3D.submitAndGetStatus` → preview image → base mesh → refined mesh |
| 7 Image to 3D | the source image is fetched and shown → `Snap3D.submitAndGetStatus` with `image_url` → base mesh → refined mesh |

Each example's run flags (`...OnTap`, `runOnTap`; labelled "Run in demo") choose
which of its calls take part. `ExampleGeminiCalls.generateImageOnTap` (the same
image model through the Gemini route) is off, because Imagen draws in that step.

### Live log panel

A dark panel with a blue border sits just above each step's content and shows
the last 8 lines of what is happening, stamped with seconds since the step
started:

```text
OpenAI · live log
+0.0s   gpt-5.6-luna chat → request sent
+1.8s   gpt-5.6-luna chat ← ok in 1.8 s: Technically yes, emotionally no…
+1.8s   function calling → request sent
+5.2s   gpt-image-2 generate ✗ after 2.1 s: 404 model not found
```

Errors turn the border red. Every line is also printed (`[RSG demo +1.8s] ...`,
errors as `ERROR`). When a token is missing or still a placeholder, the step logs
`✗ OpenAI token missing: set openAIToken on RemoteServiceGatewayCredentials` and
does nothing else. Responses are summarized, not their HTTP code: the wrappers
resolve with the parsed body and reject with the error body
([common behavior](components.md#common-behavior-of-the-service-modules)).

The coordinator, the panel and the run handle are demo scaffolding in
`Example/DemoLog/DemoLog.ts` ([components](components.md#demo-scaffolding-example)).
Your own code can call the same methods (`doChatCompletions()`,
`generateImageExample()`, ...). Without a run handle they log to `print` only.

To try the demo: put real tokens on `RemoteServiceGatewayCredentials`, sign in to
My Lenses for Preview calls, then step through the carousel. Use headphones in
the editor for the realtime steps (mic and speaker feedback). Placement and
other surprises: [troubleshooting](troubleshooting.md).

The prefab's title and hint texts ship turned off, so no loose text floats in
the scene. Snap3D shows its results left to right: preview image, base mesh,
refined mesh. `Snap3D Title` stays on because it is the Snap3D examples' status line.

## Chat with context (OpenAI)

```typescript
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { OpenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAITypes";

@component
export class ChatWithHistory extends BaseScriptComponent {
  @input output: Text;
  @input systemPrompt: string = "You are a friendly AR tour guide.";

  private history: OpenAITypes.ChatCompletions.Message[] = [];

  ask(userText: string) {
    if (this.history.length === 0) {
      this.history.push({ role: "system", content: this.systemPrompt });
    }
    this.history.push({ role: "user", content: userText });
    this.output.text = "Thinking...";

    OpenAI.chatCompletions({
      model: "gpt-5.6-luna",
      messages: this.history,
    })
      .then((response) => {
        const reply = response.choices[0].message.content ?? "";
        this.history.push({ role: "assistant", content: reply });
        this.output.text = reply;
      })
      .catch((error) => {
        this.output.text = "Error: " + error;
      });
  }
}
```

Function calling works the same way. Pass `tools: OpenAITypes.Common.Tool[]`
and `tool_choice: "auto"`, then read `response.choices[0].message.tool_calls`.
See `ExampleOAICalls.doFunctionCalling()`.

## Gemini text generation

```typescript
import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini";
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";

@component
export class AskGemini extends BaseScriptComponent {
  @input output: Text;

  ask(prompt: string) {
    const request: GoogleGenAITypes.Gemini.Models.GenerateContentRequest = {
      model: "gemini-2.5-flash",
      type: "generateContent",
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      },
    };
    Gemini.models(request)
      .then((response) => {
        this.output.text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      })
      .catch((error) => {
        this.output.text = "Error: " + error;
      });
  }
}
```

`import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAI"`
resolves to the same class. For an image answer, add
`generationConfig: { responseModalities: ["TEXT", "IMAGE"] }` to `body` (model
`gemini-3.1-flash-image` in the example). Then decode `part.inlineData.data` with
`Base64.decodeTextureAsync`.

## Imagen into an Image component

The Imagen route serves the Gemini image models (`gemini-3.1-flash-image`,
`gemini-3.1-flash-lite-image`) with generateContent requests. The image comes
back as an `inlineData` part. The older `imagen-3.0` / `imagen-4.0` predict
models are no longer served, so `Imagen.generateImage` is deprecated.

```typescript
import { Imagen } from "RemoteServiceGateway.lspkg/HostedExternal/Imagen";

@component
export class ImagenToImage extends BaseScriptComponent {
  @input image: Image;

  generate(prompt: string) {
    Imagen.generateContent({
      model: "gemini-3.1-flash-image",
      type: "generateContent",
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      },
    })
      .then((response) => {
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((part) => part?.inlineData?.data);
        if (!imagePart) {
          print("No image in the Imagen response");
          return;
        }
        Base64.decodeTextureAsync(
          imagePart.inlineData.data,
          (texture) => {
            // Clone so several Images do not share one material.
            this.image.mainMaterial = this.image.mainMaterial.clone();
            this.image.mainPass.baseTex = texture;
          },
          () => print("Could not decode the Imagen texture")
        );
      })
      .catch((error) => print("Imagen failed: " + error));
  }
}
```

Gemini image models can take more than 30 seconds to answer.

## OpenAI image generation

GPT Image models (`gpt-image-2` and newer) always answer `b64_json`. The DALL-E
models and `gpt-image-1` are retired upstream.

```typescript
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";

@component
export class GptImageToImage extends BaseScriptComponent {
  @input image: Image;

  async generate(prompt: string) {
    try {
      const response = await OpenAI.imagesGenerate({
        model: "gpt-image-2",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });
      const b64 = response.data[0].b64_json;
      if (!b64) {
        print("No image data returned");
        return;
      }
      Base64.decodeTextureAsync(
        b64,
        (texture) => {
          this.image.mainPass.baseTex = texture;
        },
        () => print("Could not decode the image")
      );
    } catch (error) {
      print("Image generation failed: " + error);
    }
  }
}
```

## OpenAI image edit with a mask

`imagesEdit` needs PNG bytes (`Uint8Array`), not a texture. Encode with
`Base64.encodeTextureAsync`, then `Base64.decode`. In the mask, transparent
pixels mark the area to edit (OpenAI's rule, not something this package
checks).

```typescript
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";

function textureToPng(texture: Texture): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    Base64.encodeTextureAsync(
      texture,
      (base64) => resolve(Base64.decode(base64)),
      () => reject("Could not encode texture"),
      CompressionQuality.LowQuality,
      EncodingType.Png
    );
  });
}

export async function editImage(base: Texture, mask: Texture, prompt: string): Promise<string | undefined> {
  // One encode at a time: concurrent Base64.encodeTextureAsync calls crash the Lens on Specs.
  const image = await textureToPng(base);
  const maskBytes = await textureToPng(mask);
  const response = await OpenAI.imagesEdit({
    model: "gpt-image-2",
    prompt: prompt,
    image: image, // a single Uint8Array; Uint8Array[] is not encoded
    mask: maskBytes,
    n: 1,
    size: "1024x1024",
  });
  return response.data[0].b64_json;
}
```

## Text to speech (reuse one AudioComponent)

```typescript
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";

@component
export class Speak extends BaseScriptComponent {
  @input audio: AudioComponent;

  say(text: string) {
    OpenAI.speech({
      model: "gpt-4o-mini-tts",
      input: text,
      voice: "coral",
      instructions: "Warm and friendly",
    })
      .then((track) => {
        this.audio.stop(false);
        this.audio.audioTrack = track;
        this.audio.play(1);
      })
      .catch((error) => print("Speech failed: " + error));
  }
}
```

`ExampleOAICalls.doSpeechGeneration()` creates a new `AudioComponent` on every
call instead ([troubleshooting](troubleshooting.md)).

## Snap3D text to 3D

```typescript
import { Snap3D } from "RemoteServiceGateway.lspkg/HostedSnap/Snap3D";
import { Snap3DTypes } from "RemoteServiceGateway.lspkg/HostedSnap/Snap3DTypes";

@component
export class Generate3D extends BaseScriptComponent {
  @input meshParent: SceneObject;
  @input meshMaterial: Material;
  @input status: Text;

  private busy = false;

  generate(prompt: string) {
    if (this.busy) return;
    this.busy = true;
    this.status.text = "Generating...";

    Snap3D.submitAndGetStatus({
      prompt: prompt,
      format: "glb",
      refine: true,
      use_vertex_color: false,
    })
      .then((results) => {
        results.event.add(([kind, data]) => {
          if (kind === "image") {
            this.status.text = "Preview image ready";
          } else if (kind === "base_mesh") {
            this.status.text = "Base mesh ready, refining...";
          } else if (kind === "refined_mesh") {
            (data as Snap3DTypes.GltfAssetData).gltfAsset.tryInstantiate(
              this.meshParent,
              this.meshMaterial
            );
            this.status.text = "Done";
            this.busy = false;
          } else if (kind === "failed") {
            const error = data as Snap3DTypes.ErrorData;
            this.status.text = "Failed: " + error.errorMsg + " (" + error.errorCode + ")";
            this.busy = false;
          }
        });
      })
      .catch((error) => {
        this.status.text = "Error: " + error;
        this.busy = false;
      });
  }
}
```

For image-to-3D, call `Snap3D.submitImageTo3D(publicImageUrl, { prompt: "a toy car" })`.
It returns the same `SubmitGetStatusResults`. Keep `refine: true` (see
[API status](api-status.md#known-gaps)).

## Gemini Live voice assistant

This fixes the old README's version. It uses snake_case client keys, the
`onAudioFrame` event plus `AudioProcessor` for the mic, and `addAudioFrame` for
playback. Put it on a SceneObject whose `mic` / `speaker` inputs point at the
prefab's `Websocket requirements` children, or at your own `MicrophoneRecorder`
and `DynamicAudioOutput` (+ `AudioComponent`). Only one live session should use
them at a time.

```typescript
import { Gemini, GeminiLiveWebsocket } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini";
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";
import { MicrophoneRecorder } from "RemoteServiceGateway.lspkg/Helpers/MicrophoneRecorder";
import { DynamicAudioOutput } from "RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput";
import { AudioProcessor } from "RemoteServiceGateway.lspkg/Helpers/AudioProcessor";

@component
export class GeminiVoice extends BaseScriptComponent {
  @input mic: MicrophoneRecorder;
  @input speaker: DynamicAudioOutput;
  @input transcript: Text;

  private live: GeminiLiveWebsocket;
  private processor = new AudioProcessor(100);

  onAwake() {
    // OnStart: the credentials component and the helpers have awoken by now.
    this.createEvent("OnStartEvent").bind(() => this.connect());
    this.createEvent("OnDestroyEvent").bind(() => {
      this.mic.stopRecording();
      this.live?.close();
    });
  }

  private connect() {
    this.speaker.initialize(24000);
    this.mic.setSampleRate(16000);
    this.live = Gemini.liveConnect();

    this.live.onOpen.add(() => {
      const setup: GoogleGenAITypes.Gemini.Live.Setup = {
        setup: {
          model: "models/gemini-live-2.5-flash",
          generation_config: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
          },
          system_instruction: { parts: [{ text: "You are a helpful AR assistant." }] },
          output_audio_transcription: {},
        },
      };
      this.live.send(setup);
    });

    this.live.onMessage.add((message) => {
      if (message.setupComplete) {
        this.processor.onAudioChunkReady.add((chunk) => {
          const input: GoogleGenAITypes.Gemini.Live.RealtimeInput = {
            realtime_input: { media_chunks: [{ mime_type: "audio/pcm", data: chunk }] },
          };
          this.live.send(input);
        });
        this.mic.onAudioFrame.add((frame) => this.processor.processFrame(frame));
        this.mic.startRecording();
      }
      const part = message.serverContent?.modelTurn?.parts?.[0];
      if (part?.inlineData?.mimeType?.startsWith("audio/pcm")) {
        this.speaker.addAudioFrame(Base64.decode(part.inlineData.data));
      }
      const said = message.serverContent?.outputTranscription?.text;
      if (said) {
        this.transcript.text += said;
      }
      if (message.serverContent?.turnComplete) {
        this.transcript.text = "";
      }
    });

    this.live.onError.add(() => print("Gemini Live error"));
    this.live.onClose.add((event) => print("Gemini Live closed: " + event.reason));
  }
}
```

To send a typed turn instead of audio:
`this.live.send({ client_content: { turns: [{ role: "user", parts: [{ text: "Hello" }] }], turn_complete: true } })`.
`send` drops the message silently until the socket is open.

OpenAI Realtime follows the same shape:
`OpenAI.createRealtimeSession({ model: "gpt-realtime-mini" })`, a
GA `session.update` message on `onOpen` (`session.type: "realtime"`,
`output_modalities`, `audio.input` / `audio.output`), `input_audio_buffer.append` with the
`AudioProcessor` chunk (mic at 24000 Hz), and `response.output_audio.delta` →
`addAudioFrame(Base64.decode(message.delta))`. The full version is
`HostedExternal/Examples/ExampleOAIRealtime.ts`.

## Ask several models at once

```typescript
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini";

export function askAll(prompt: string): Promise<string[]> {
  const asText = (p: Promise<string>) => p.catch((error) => "Error: " + error);
  return Promise.all([
    asText(
      OpenAI.chatCompletions({ model: "gpt-5.6-luna", messages: [{ role: "user", content: prompt }] })
        .then((r) => r.choices[0].message.content ?? "")
    ),
    asText(
      Gemini.models({
        model: "gemini-2.5-flash",
        type: "generateContent",
        body: { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      }).then((r) => r.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
    ),
  ]);
}
```

This needs both token types (OpenAI and Google).

## Lyria music

```typescript
import { Lyria } from "RemoteServiceGateway.lspkg/HostedExternal/Lyria";
import { DynamicAudioOutput } from "RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput";

@component
export class MakeMusic extends BaseScriptComponent {
  @input speaker: DynamicAudioOutput;

  play(prompt: string) {
    this.speaker.initialize(48000);
    Lyria.performLyriaRequest({
      model: "lyria-002",
      type: "predict",
      body: { instances: [{ prompt: prompt, negative_prompt: "vocals" }], parameters: { sample_count: 1 } },
    })
      .then((response) => {
        for (const prediction of response.predictions) {
          this.speaker.addAudioFrame(Base64.decode(prediction.bytesBase64Encoded), 2);
        }
      })
      .catch((error) => print("Lyria failed: " + error));
  }
}
```

This mirrors `ExampleLyriaCall`, including feeding the whole WAV as stereo
PCM16 (see [API status](api-status.md#known-gaps)).
