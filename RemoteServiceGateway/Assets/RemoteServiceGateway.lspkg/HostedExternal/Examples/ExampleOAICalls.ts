/**
 * SPECS Inc. 2027
 * Example implementations of OpenAI API calls. Demonstrates chat completions with GPT models,
 * function calling with color manipulation, GPT Image generation and editing, and TTS speech
 * synthesis. In the demo carousel the calls run by themselves, one after the other, when the step
 * is shown, and stop when it is left (see Example/DemoLog).
 */
import { OpenAI } from "../OpenAI";
import { OpenAITypes } from "../OpenAITypes";
import { Promisfy } from "../../Utils/Promisfy";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";
import { DynamicAudioOutput } from "../../Helpers/DynamicAudioOutput";

@component
export class ExampleOAICalls extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">OpenAI API Examples</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure and test OpenAI chat, image, voice, and function calling capabilities</span>')

  @ui.group_start("Chat Completions Example")
  @input
  @allowUndefined
  textDisplay: Text;
  @input
  @widget(new TextAreaWidget())
  private systemPrompt: string =
    "You are an incredibly smart but witty AI assistant who likes to answer life's greatest mysteries in under two sentences";
  @input
  @widget(new TextAreaWidget())
  private userPrompt: string = "Is a hotdog a sandwich";
  @input
  @label("Run in demo")
  private doChatCompletionsOnTap: boolean = false;
  @ui.group_end
  @ui.separator
  @ui.group_start("Image Generation Example")
  @input
  @allowUndefined
  private imgObject: SceneObject;
  @input
  @widget(new TextAreaWidget())
  private imageGenerationPrompt: string = "The future of augmented reality";
  @input
  @label("Run in demo")
  private generateImageOnTap: boolean = false;
  @ui.group_end
  @ui.separator
  @ui.group_start("Image Edit Example")
  @input
  @allowUndefined
  private editBaseImg: Texture;
  @input
  @allowUndefined
  private editMaskImg: Texture;
  @input
  @allowUndefined
  private editResultObject: SceneObject;
  @input
  @widget(new TextAreaWidget())
  private imageEditPrompt: string = "Add a cat into the image";
  @input
  @label("Run in demo")
  private doEditImageOnTap: boolean = false;
  @ui.group_end
  @ui.separator
  @ui.group_start("Voice Generation Example")
  @input
  @widget(new TextAreaWidget())
  private voiceGenerationPrompt: string =
    "Get ready for the future of augmented reality with Lens Studio!";
  @input
  @widget(new TextAreaWidget())
  private voiceGenerationInstructions: string =
    "Serious, movie trailer voice, insert pauses for dramatic effect";
  @input
  @label("Run in demo")
  private generateVoiceOnTap: boolean = false;
  @ui.group_end
  @ui.separator
  @ui.group_start("Function Calling Example")
  @input
  @widget(new TextAreaWidget())
  private functionCallingPrompt: string = "Make the text display yellow";
  @input
  @label("Run in demo")
  private doFunctionCallingOnTap: boolean = false;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  @ui.group_end
  @ui.separator
  @input
  @hint("Where the demo's live log panel sits, relative to this object (cm)")
  logPanelOffset: vec3 = new vec3(0, 14, 0);

  // Logger instance
  private logger: Logger;
  private rmm = require("LensStudio:RemoteMediaModule") as RemoteMediaModule;
  private internetModule =
    require("LensStudio:InternetModule") as InternetModule;
  private loaderSpinnerImage: SceneObject;
  private speechAudio: AudioComponent;
  private finishSpeech: (() => void) | null = null;
  private speechOutput: DynamicAudioOutput | null = null;
  /** PNG bytes of the last generated image; the edit step edits this image. */
  private lastGeneratedPng: Uint8Array | null = null;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleOAICalls", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.initializeSpinner();
    this.speechAudio = this.sceneObject.createComponent("AudioComponent");
    this.speechAudio.setOnFinish(() => this.endSpeech());

    // Runs by itself when the carousel shows this example, stops when it is left.
    DemoStep.join({
      owner: this,
      name: "OpenAI",
      order: 0,
      tokens: [AvaliableApiTypes.OpenAI],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.stopDemo(),
    });
  }

  /** The enabled calls, in order: chat, function calling, image, image edit, speech. */
  async runDemo(run: DemoRun = DemoRun.detached("OpenAI")) {
    this.textDisplay.textFill.color = new vec4(1, 1, 1, 1);
    this.textDisplay.text = "";
    if (this.doChatCompletionsOnTap) {
      await this.doChatCompletions(run);
    }
    if (this.doFunctionCallingOnTap) {
      await this.doFunctionCalling(run);
    }
    if (this.generateImageOnTap) {
      await this.doImageGeneration(run);
    }
    if (this.doEditImageOnTap) {
      await this.doImageEdit(run);
    }
    if (this.generateVoiceOnTap) {
      await this.doSpeechGeneration(run);
    }
  }

  /** Stops the speech and the spinner. Late responses are ignored by the run token. */
  stopDemo() {
    if (this.speechAudio && this.speechAudio.isPlaying()) {
      this.speechAudio.stop(false);
    }
    this.endSpeech();
    if (this.speechOutput) {
      this.speechOutput.interruptAudioOutput();
      this.speechOutput = null;
    }
    if (this.loaderSpinnerImage) {
      this.loaderSpinnerImage.enabled = false;
    }
  }

  async doChatCompletions(run: DemoRun = DemoRun.detached("OpenAI")) {
    this.textDisplay.sceneObject.enabled = true;
    this.textDisplay.text = "Generating...";
    const response = await run.call(
      "gpt-5.6-luna chat",
      () =>
        OpenAI.chatCompletions({
          model: "gpt-5.6-luna",
          messages: [
            {
              role: "system",
              content: this.systemPrompt,
            },
            {
              role: "user",
              content: this.userPrompt,
            },
          ],
        }),
      (result) => result.choices[0].message.content ?? "(no text)"
    );
    if (response) {
      this.textDisplay.text = response.choices[0].message.content ?? "";
    } else {
      this.textDisplay.text = "Error: see the log above";
    }
  }

  async doImageGeneration(run: DemoRun = DemoRun.detached("OpenAI")) {
    this.imgObject.enabled = true;
    this.loaderSpinnerImage.enabled = true;
    const response = await run.call(
      "gpt-image-2 generate",
      () =>
        OpenAI.imagesGenerate({
          model: "gpt-image-2",
          prompt: this.imageGenerationPrompt,
          n: 1,
          size: "1024x1024",
        }),
      (result) => (result.data[0]?.url ? "image URL" : "base64 image")
    );
    if (!response) {
      this.loaderSpinnerImage.enabled = false;
      return;
    }
    this.lastGeneratedPng = response.data[0]?.b64_json
      ? Base64.decode(response.data[0].b64_json)
      : null;
    const texture = await run.call("image decode", () =>
      this.textureFromImageObject(response.data[0])
    );
    this.loaderSpinnerImage.enabled = false;
    if (texture) {
      this.setImage(this.imgObject, texture);
    }
  }

  async doImageEdit(run: DemoRun = DemoRun.detached("OpenAI")) {
    // Edit the image generated just before, from the PNG bytes the API returned. Encoding a scene
    // texture with Base64.encodeTextureAsync aborts the Lens on Specs ("global command buffer
    // disabled", device log 2026-11-10), so the demo never encodes textures.
    if (!this.lastGeneratedPng) {
      run.error("gpt-image-2 edit: no generated image to edit (image generation must succeed first)");
      return;
    }
    this.editResultObject.enabled = true;
    const imageEditRequest: OpenAITypes.ImageEdits.Request = {
      prompt: this.imageEditPrompt,
      image: this.lastGeneratedPng,
      n: 1,
      size: "1024x1024",
      model: "gpt-image-2",
    };
    const response = await run.call(
      "gpt-image-2 edit",
      () => OpenAI.imagesEdit(imageEditRequest),
      (result) => (result.data[0]?.url ? "image URL" : "base64 image")
    );
    if (!response) {
      return;
    }
    const texture = await run.call("edited image decode", () =>
      this.textureFromImageObject(response.data[0])
    );
    if (texture) {
      this.setImage(this.editResultObject, texture);
    }
  }

  async doSpeechGeneration(run: DemoRun = DemoRun.detached("OpenAI")) {
    const track = await run.call(
      "gpt-4o-mini-tts speech",
      () =>
        OpenAI.speech({
          model: "gpt-4o-mini-tts",
          input: this.voiceGenerationPrompt,
          voice: "coral",
          instructions: this.voiceGenerationInstructions,
        }),
      () => "audio track"
    );
    if (!track) {
      // On Specs the audio_speech response can arrive with an empty resource. Fall back to a
      // chat completion with audio output: the speech comes back as base64 PCM16 in the JSON.
      await this.speakWithChatAudio(run);
      return;
    }
    run.log("♪ speech playing");
    await run.guard(
      new Promise<void>((resolve) => {
        this.endSpeech();
        this.finishSpeech = resolve;
        this.speechAudio.audioTrack = track;
        this.speechAudio.play(1);
      })
    );
    run.log("♪ speech finished");
  }

  /** Speaks voiceGenerationPrompt with gpt-audio-mini (chat completion, audio output, PCM16 24 kHz). */
  private async speakWithChatAudio(run: DemoRun) {
    const output = this.findDynamicAudioOutput();
    if (!output) {
      run.error("speech fallback: no DynamicAudioOutput in the scene");
      return;
    }
    const response = await run.call(
      "gpt-audio-mini speech (chat audio)",
      () =>
        OpenAI.chatCompletions({
          model: "gpt-audio-mini",
          modalities: ["text", "audio"],
          audio: { voice: "coral", format: "pcm16" },
          messages: [
            { role: "system", content: "Read the user's text aloud exactly as written. Say nothing else." },
            { role: "user", content: this.voiceGenerationPrompt },
          ],
        } as OpenAITypes.ChatCompletions.Request),
      (result: any) => (result?.choices?.[0]?.message?.audio?.transcript ?? "audio")
    );
    const audioData = (response as any)?.choices?.[0]?.message?.audio?.data;
    if (!audioData) {
      if (response) {
        run.error("speech fallback: the response has no audio");
      }
      return;
    }
    const pcm = Base64.decode(audioData);
    const seconds = pcm.length / (24000 * 2);
    this.speechOutput = output;
    output.initialize(24000);
    output.addAudioFrame(pcm, 1);
    run.log("♪ speech playing (" + seconds.toFixed(1) + " s)");
    await run.wait(seconds + 0.3);
    run.log("♪ speech finished");
  }

  /** The shared DynamicAudioOutput the realtime examples also use. */
  private findDynamicAudioOutput(): DynamicAudioOutput | null {
    const visit = (object: SceneObject): DynamicAudioOutput | null => {
      for (const component of object.getComponents("Component.ScriptComponent")) {
        if (component instanceof DynamicAudioOutput) {
          return component;
        }
      }
      for (let i = 0; i < object.getChildrenCount(); i++) {
        const found = visit(object.getChild(i));
        if (found) {
          return found;
        }
      }
      return null;
    };
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const found = visit(global.scene.getRootObject(i));
      if (found) {
        return found;
      }
    }
    return null;
  }

  private endSpeech() {
    const finish = this.finishSpeech;
    this.finishSpeech = null;
    if (finish) {
      finish();
    }
  }

  private initializeSpinner() {
    this.loaderSpinnerImage = this.imgObject.getChild(0);
    this.loaderSpinnerImage.enabled = false;
  }

  private setImage(target: SceneObject, texture: Texture) {
    const imgComponent = target.getComponent("Image");
    const imageMaterial = imgComponent.mainMaterial.clone();
    imgComponent.mainMaterial = imageMaterial;
    imgComponent.mainPass.baseTex = texture;
  }

  private encodeTexture(texture: Texture): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      Base64.encodeTextureAsync(
        texture,
        (base64) => resolve(Base64.decode(base64)),
        () => reject("Failure to encode texture"),
        CompressionQuality.LowQuality,
        EncodingType.Png
      );
    });
  }

  /** Loads an image result, whether the API answered with a URL or with base64. */
  private textureFromImageObject(
    datum: OpenAITypes.ImageGenerate.ImageObject
  ): Promise<Texture> {
    if (datum?.url) {
      // makeResourceFromUrl: on Specs (LS 5.25) performHttpRequest(...).asResource() comes back empty.
      return Promisfy.RemoteMediaModule.loadResourceAsImageTexture(
        this.rmm,
        this.internetModule.makeResourceFromUrl(datum.url)
      );
    }
    if (datum?.b64_json) {
      const b64 = datum.b64_json;
      return new Promise<Texture>((resolve, reject) => {
        Base64.decodeTextureAsync(
          b64,
          (texture) => resolve(texture),
          () => reject("Failure to decode texture from base64")
        );
      });
    }
    return Promise.reject("The response has neither url nor b64_json");
  }

  async doFunctionCalling(run: DemoRun = DemoRun.detached("OpenAI")) {
    this.textDisplay.sceneObject.enabled = true;

    // Define available functions
    const tools: OpenAITypes.Common.Tool[] = [
      {
        type: "function",
        function: {
          name: "set-text-color",
          description: "Set the color of the text display",
          parameters: {
            type: "object",
            properties: {
              r: {
                type: "number",
                description: "Red component of the color (0-255)",
              },
              g: {
                type: "number",
                description: "Green component of the color (0-255)",
              },
              b: {
                type: "number",
                description: "Blue component of the color (0-255)",
              },
            },
            required: ["r", "g", "b"],
          },
        },
      },
    ];

    const response = await run.call(
      "function calling",
      () =>
        OpenAI.chatCompletions({
          model: "gpt-5.6-luna",
          messages: [
            {
              role: "user",
              content: this.functionCallingPrompt,
            },
          ],
          tools: tools,
          tool_choice: "auto",
          // gpt-5.6-luna rejects function tools on /v1/chat/completions unless reasoning is off.
          reasoning_effort: "none",
        }),
      (result) => {
        const call = result.choices[0].message.tool_calls?.[0];
        return call
          ? call.function.name + " " + call.function.arguments
          : "no tool call: " + (result.choices[0].message.content ?? "");
      }
    );
    const toolCall = response?.choices[0].message.tool_calls?.[0];
    if (toolCall && toolCall.function.name === "set-text-color") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        this.textDisplay.textFill.color = new vec4(
          args.r / 255,
          args.g / 255,
          args.b / 255,
          1
        );
        this.textDisplay.text += `\n\nText color set to RGB(${args.r}, ${args.g}, ${args.b})`;
      } catch (e) {
        run.error("set-text-color: bad arguments " + toolCall.function.arguments);
      }
    }
  }
}
