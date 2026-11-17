# RemoteServiceGateway examples

[← Agent usage index](../README.md)

## Use when

You need a starting point for a call, or you want to know what the example
prefab contains. Copy the smallest snippet that does the job, and build the
rest of the experience (UI, interaction, placement) with the CLAD skills
(`specs-build-ui`, `specs-interaction-recipes`, `lens-api`). The snippets use
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
├── Guide                                         GuideDismissPanel + UIKit Frame (0, 0, -100), see [components](components.md#demo-scaffolding-example)
├── ExampleCarousel                               ExampleCarousel (0, -22, -100)
├── RemoteServiceGatewayCredentials                 RemoteServiceGatewayCredentials (placeholder tokens)
├── Snap Hosted Examples                            (0, -10, -180)
│   ├── Snap 3D Examples                            (20, -10, 0)
│   │   └── ExampleSnap3D                           ExampleSnap3D (runOnTap false)
│   │       ├── ImageRoot          Image            (-15, -13, 0)  children: Text (OFF), LoadingSpinner
│   │       ├── BaseMeshRoot                        (0, -13, 0)    children: Text (OFF), LoadingSpinner
│   │       ├── RefinedMeshRoot                     (15, -13, 0)   children: Text (OFF), LoadingSpinner
│   │       └── Snap3D Title       Text             ExampleSnap3D hintText (status line)
│   ├── DeepSeek Examples                           (-20, -10, 0)
│   │   ├── ExampleDeepseekCalls                    ExampleDeepseekCalls (runOnTap false)
│   │   │   └── TextOutput         Text             (0, -5, 0)
│   │   └── Deepseek Title         Text  OFF
│   ├── Title                      Text  OFF        "Snap Hosted APIs"
│   └── Hint                       Text  OFF        "Check ExampleDeepseekCalls and ExampleSnap3D in inspector!"
└── External Hosted Examples                        (0, 40, -180)
    ├── Websocket requirements
    │   ├── MicrophoneRecorder                      MicrophoneRecorder (micAudioTrack = Resources/Microphone Audio)
    │   └── DynamicAudioOutput                      DynamicAudioOutput + AudioComponent (Resources/Audio Output)
    ├── OpenAI Examples                             (-20, -10, 0)
    │   ├── ExampleOAICalls                         ExampleOAICalls (all ...OnTap false)
    │   │   ├── TextOutput         Text             (-13, 0, 0)
    │   │   └── ImageOutputExample Image            (13, -5, 0)   child: LoadingSpinner
    │   ├── Title                  Text  OFF        "OpenAI"
    │   └── ExampleOpenAIRealtime  OFF              ExampleOAIRealtime (10, -20, 0)
    │       └── TextOutput         Text
    ├── GoogleGenAI Examples                        (22, -10, 0)
    │   ├── ExampleGeminiCalls                      ExampleGeminiCalls (all ...OnTap false)
    │   │   ├── TextOutput         Text             (-13, 0, 0)
    │   │   └── ImageOutputExample Image            (13, -5, 0)   child: LoadingSpinner
    │   ├── Title                  Text  OFF        "Gemini"
    │   ├── ExampleGeminiLive      OFF              ExampleGeminiLive (0, -20, 0)
    │   │   └── TextOutput         Text
    │   ├── ExampleLyriaCall                        ExampleLyriaCall (generateMusicOnTap false, playAudioOnTap true)
    │   └── ExampleImagenCalls                      ExampleImagenCalls (doGenerateOnTap TRUE, imgObject = Gemini ImageOutputExample)
    ├── Title                      Text  OFF        "External Hosted APIs"
    └── Hint                       Text  OFF        "Check ExampleOAICalls and ExampleGeminiCalls in inspector!"
```

To try an example: put real tokens on `RemoteServiceGatewayCredentials`, turn
on **one** `...OnTap` / `runOnTap` flag, then tap in the Preview, or pinch with
the right hand on device. For a realtime example, enable `ExampleOpenAIRealtime`
**or** `ExampleGeminiLive` (one at a time). The **Image To 3D** step runs
`ExampleSnap3DImageTo3D` on a public image URL. Placement and other surprises: [troubleshooting](troubleshooting.md).

The prefab's title, caption and hint texts ship turned off, so no loose text floats in
the scene. Their guidance lives here: each example's prompt and run flags are on its
`Example...` script in the Inspector (`ExampleSnap3D`, `ExampleDeepseekCalls`,
`ExampleOAICalls`, `ExampleGeminiCalls`, `ExampleOAIRealtime`, `ExampleGeminiLive`).
Snap3D shows its results left to right: preview image, base mesh, refined mesh.
`Snap3D Title` stays on because it is `ExampleSnap3D`'s status line.

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

## DeepSeek R1 (Snap-hosted)

```typescript
import { DeepSeek } from "RemoteServiceGateway.lspkg/HostedSnap/Deepseek";

@component
export class AskDeepSeek extends BaseScriptComponent {
  @input output: Text;

  ask(question: string) {
    DeepSeek.chatCompletions({
      model: "DeepSeek-R1",
      messages: [
        { role: "system", content: "Give your reasoning in no more than one sentence." },
        { role: "user", content: question },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    })
      .then((response) => {
        const message = response.choices[0].message;
        this.output.text =
          "Reasoning: " + message.reasoning_content + "\n\nAnswer: " + message.content;
      })
      .catch((error) => {
        this.output.text = "Error: " + error;
      });
  }
}
```

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
  const [image, maskBytes] = await Promise.all([textureToPng(base), textureToPng(mask)]);
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
import { DeepSeek } from "RemoteServiceGateway.lspkg/HostedSnap/Deepseek";

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
    asText(
      DeepSeek.chatCompletions({ model: "DeepSeek-R1", messages: [{ role: "user", content: prompt }] })
        .then((r) => r.choices[0].message.content)
    ),
  ]);
}
```

This needs all three token types (OpenAI, Google, Snap).

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
