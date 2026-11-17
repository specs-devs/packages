/**
 * SPECS Inc. 2027
 * Example implementation of Google Lyria API for AI music generation. Demonstrates creating
 * original music compositions with customizable prompts, negative prompts, seed values, and
 * playback through dynamic audio output. In the demo carousel the tune is generated and played by
 * itself when the step is shown, and stopped when it is left (see Example/DemoLog).
 */
import { Lyria } from "../Lyria";
import { GoogleGenAITypes } from "../GoogleGenAITypes";
import { DynamicAudioOutput } from "../../Helpers/DynamicAudioOutput";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleLyriaCall extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Lyria Music Generation</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure and test AI-powered music generation</span>')

  @ui.group_start("Music Generation Example")
  @input
  @widget(new TextAreaWidget())
  private musicPrompt: string =
    "An energetic electronic dance track with a fast tempo";

  @input
  @widget(new TextAreaWidget())
  private negativePrompt: string = "vocals, slow tempo";

  @input
  private seed: number = 12345;

  @input
  private sampleCount: number = 1;

  @input
  @label("Run in demo")
  private generateMusicOnTap: boolean = false;

  @input
  dynamicAudioOutput: DynamicAudioOutput;

  @ui.group_end
  @ui.separator
  @ui.group_start("Audio Output")
  @input
  @label("Play generated audio")
  private playAudioOnTap: boolean = false;

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
  logPanelOffset: vec3 = new vec3(0, 0, 0);

  // Logger instance
  private logger: Logger;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleLyriaCall", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    // Runs by itself when the carousel shows this example, stops the music when it is left.
    DemoStep.join({
      owner: this,
      name: "Lyria",
      order: 0,
      tokens: [AvaliableApiTypes.Google],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.stopDemo(),
    });
  }

  async runDemo(run: DemoRun = DemoRun.detached("Lyria")) {
    if (this.generateMusicOnTap) {
      await this.generateMusic(run);
    }
  }

  /** Stops the music. */
  stopDemo() {
    if (this.dynamicAudioOutput) {
      this.dynamicAudioOutput.interruptAudioOutput();
    }
  }

  async generateMusic(run: DemoRun = DemoRun.detached("Lyria")) {
    // Create the music generation request using the exact Lyria API specification
    const musicRequest: GoogleGenAITypes.Lyria.LyriaRequest = {
      model: "lyria-002",
      type: "predict",
      body: {
        instances: [
          {
            prompt: this.musicPrompt,
            negative_prompt: this.negativePrompt || undefined,
            seed: this.seed || undefined,
          },
        ],
        parameters: {
          sample_count: this.sampleCount || undefined,
        },
      },
    };
    run.log("generating music, this can take ~30 s…");
    const response = await run.call(
      "lyria-002 music",
      () => Lyria.performLyriaRequest(musicRequest),
      (result) =>
        (result.predictions?.length ?? 0) + " clip(s), " + (result.predictions?.[0]?.mimeType ?? "?")
    );
    const prediction = response?.predictions?.[0];
    if (!prediction || !prediction.bytesBase64Encoded) {
      if (response) {
        run.error("lyria-002: no audio in the response");
      }
      return;
    }
    if (!this.playAudioOnTap) {
      return;
    }
    const audio = ExampleLyriaCall.readWav(Base64.decode(prediction.bytesBase64Encoded));
    const seconds = audio.pcm.length / (2 * audio.channels * audio.sampleRate);
    this.dynamicAudioOutput.initialize(audio.sampleRate);
    this.dynamicAudioOutput.addAudioFrame(audio.pcm, audio.channels);
    run.log(
      "♪ playing " + seconds.toFixed(1) + " s (" + audio.sampleRate + " Hz, " + audio.channels + " ch)"
    );
    await run.wait(seconds);
    run.log("♪ playback finished");
  }

  /**
   * Splits a WAV file into its PCM16 samples and format. Lyria answers with a WAV: feeding the
   * header to the audio output as samples would click. Anything else is treated as 48 kHz stereo PCM16.
   */
  static readWav(bytes: Uint8Array): { pcm: Uint8Array; sampleRate: number; channels: number } {
    const text = (offset: number) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const u32 = (offset: number) =>
      (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
    const u16 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
    let sampleRate = 48000;
    let channels = 2;
    if (bytes.length < 12 || text(0) !== "RIFF" || text(8) !== "WAVE") {
      return { pcm: bytes, sampleRate, channels };
    }
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const id = text(offset);
      const size = u32(offset + 4);
      const body = offset + 8;
      if (id === "fmt ") {
        channels = u16(body + 2) || channels;
        sampleRate = u32(body + 4) || sampleRate;
      } else if (id === "data") {
        return { pcm: bytes.subarray(body, Math.min(bytes.length, body + size)), sampleRate, channels };
      }
      offset = body + size + (size % 2);
    }
    return { pcm: bytes.subarray(44), sampleRate, channels };
  }
}
