/**
 * SPECS Inc. 2027
 * Example implementation of Gemini Live API with real-time multimodal interaction. Demonstrates
 * WebSocket-based streaming with audio input/output, optional video capture, voice selection,
 * and bidirectional communication for conversational AI experiences. In the demo carousel the
 * session opens by itself when the step is shown (the model greets you first) and closes, with the
 * microphone, camera and audio output, when the step is left (see Example/DemoLog).
 */
import { AudioProcessor } from "../../Helpers/AudioProcessor";
import { DynamicAudioOutput } from "../../Helpers/DynamicAudioOutput";
import { Gemini } from "../GoogleGenAI";
import { GeminiTypes } from "../GoogleGenAITypes";
import { MicrophoneRecorder } from "../../Helpers/MicrophoneRecorder";
import { VideoController } from "../../Helpers/VideoController";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleGeminiLive extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Gemini Live Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure real-time multimodal AI interaction with audio and video inputs</span>')

  @ui.group_start("Setup")
  @input
  @allowUndefined
  private websocketRequirementsObj: SceneObject;
  @input @allowUndefined private dynamicAudioOutput: DynamicAudioOutput;
  @input @allowUndefined private microphoneRecorder: MicrophoneRecorder;
  @input @allowUndefined private textDisplay: Text;
  @ui.group_end
  @ui.separator
  @ui.group_start("Inputs")
  @input
  @widget(new TextAreaWidget())
  private instructions: string =
    "You are a helpful assistant that loves to make puns";
  @input private haveVideoInput: boolean = false;
  @ui.group_end
  @ui.separator
  @ui.group_start("Outputs")
  @ui.label(
    '<span style="color: yellow;">⚠️ To prevent audio feedback loop in Lens Studio Editor, use headphones or manage your microphone input.</span>'
  )
  @input
  private haveAudioOutput: boolean = false;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;  @input
  @showIf("haveAudioOutput", true)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Puck", "Puck"),
      new ComboBoxItem("Charon", "Charon"),
      new ComboBoxItem("Kore", "Kore"),
      new ComboBoxItem("Fenrir", "Fenrir"),
      new ComboBoxItem("Aoede", "Aoede"),
      new ComboBoxItem("Leda", "Leda"),
      new ComboBoxItem("Orus", "Orus"),
      new ComboBoxItem("Zephyr", "Zephyr"),
    ])
  )
  private voice: string = "Puck";

  @ui.group_end
  @ui.separator
  @ui.group_start("Demo")
  @input
  @widget(new TextAreaWidget())
  @hint("Sent as the first user turn once the session is ready, so the model speaks first. Empty: wait for the user.")
  private greeting: string =
    "Say hello in one short sentence and ask what I would like to talk about.";
  @input
  @hint("Where the demo's live log panel sits, relative to this object (cm)")
  logPanelOffset: vec3 = new vec3(0, 12, 0);
  @ui.group_end

  private audioProcessor: AudioProcessor = new AudioProcessor();
  private videoController: VideoController = new VideoController();
  private socket: ReturnType<typeof Gemini.liveConnect> | null = null;
  private onMicFrame = (audioFrame: Float32Array) => this.audioProcessor.processFrame(audioFrame);
  private onAudioChunk: ((chunk: string) => void) | null = null;
  private onVideoFrame: ((frame: string) => void) | null = null;
  private videoRecording = false;
  private endSession: (() => void) | null = null;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleGeminiLive", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.websocketRequirementsObj.enabled = true;

    global.deviceInfoSystem.onInternetStatusChanged.add((args) => {
      if (this.sceneObject.isEnabledInHierarchy) {
        this.textDisplay.text = args.isInternetAvailable
          ? "Reconnected to internet"
          : "No internet";
      }
    });

    // Opens the session when the carousel shows this example, closes it when the step is left.
    DemoStep.join({
      owner: this,
      name: "Gemini Live",
      order: 0,
      tokens: [AvaliableApiTypes.Google],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.stopDemo(),
    });
  }

  /** Opens the session and keeps the step's run alive until the socket closes or the step is left. */
  async runDemo(run: DemoRun = DemoRun.detached("Gemini Live")) {
    if (!global.deviceInfoSystem.isInternetAvailable()) {
      run.error("no internet");
    }
    this.textDisplay.textFill.color = new vec4(1, 1, 1, 1);
    this.textDisplay.text = "Connecting...";
    this.dynamicAudioOutput.initialize(24000);
    this.microphoneRecorder.setSampleRate(16000);
    await run.guard(
      new Promise<void>((resolve) => {
        this.endSession = resolve;
        this.createGeminiLiveSession(run);
      })
    );
  }

  /** Closes the socket and stops the microphone, the camera and the audio output. Safe to call anytime. */
  stopDemo() {
    this.microphoneRecorder.stopRecording();
    this.microphoneRecorder.onAudioFrame.remove(this.onMicFrame);
    if (this.onAudioChunk) {
      this.audioProcessor.onAudioChunkReady.remove(this.onAudioChunk);
      this.onAudioChunk = null;
    }
    if (this.onVideoFrame) {
      this.videoController.onEncodedFrame.remove(this.onVideoFrame);
      this.onVideoFrame = null;
    }
    if (this.videoRecording) {
      this.videoRecording = false;
      this.videoController.stopRecording();
    }
    this.dynamicAudioOutput.interruptAudioOutput();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.close();
    }
    const end = this.endSession;
    this.endSession = null;
    if (end) {
      end();
    }
  }

  createGeminiLiveSession(run: DemoRun = DemoRun.detached("Gemini Live")) {
    const openedAt = getTime();
    const modelUri = `models/gemini-live-2.5-flash`;
    run.log(modelUri + " → opening socket");
    const GeminiLive = Gemini.liveConnect();
    this.socket = GeminiLive;
    // Events of a socket from a step that was left are ignored.
    const live = () => run.alive && this.socket === GeminiLive;

    GeminiLive.onOpen.add((event) => {
      if (!live()) {
        return;
      }
      run.log("← socket open in " + (getTime() - openedAt).toFixed(1) + " s");

      let generationConfig: GeminiTypes.Common.GenerationConfig = {
        responseModalities: ["AUDIO"],
        temperature: 1,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.voice,
            },
          },
        },
      };

      if (!this.haveAudioOutput) {
        generationConfig = {
          responseModalities: ["TEXT"],
        };
      }

      // Define a tool for changing text color
      const tools = [
        {
          function_declarations: [
            {
              name: "change_text_color",
              description: "Changes the color of the displayed text",
              parameters: {
                type: "object",
                properties: {
                  r: {
                    type: "number",
                    description:
                      "Value for the red component of the color (0-255)",
                  },
                  g: {
                    type: "number",
                    description:
                      "Value for the green component of the color (0-255)",
                  },
                  b: {
                    type: "number",
                    description:
                      "Value for the blue component of the color (0-255)",
                  },
                },
                required: ["r", "g", "b"],
              },
            },
          ],
        },
      ];

      // Send the session setup message
      const sessionSetupMessage: GeminiTypes.Live.Setup = {
        setup: {
          model: modelUri,
          generation_config: generationConfig,
          system_instruction: {
            parts: [
              {
                text: this.instructions,
              },
            ],
          },
          tools: tools,
          contextWindowCompression: {
            triggerTokens: 20000,
            slidingWindow: { targetTokens: 16000 },
          },
          output_audio_transcription: {},
        },
      };
      GeminiLive.send(sessionSetupMessage);
      run.log("→ setup (" + (this.haveAudioOutput ? "audio, voice " + this.voice : "text") + ")");
    });

    let completedTextDisplay = true;
    let audioLogged = false;

    GeminiLive.onMessage.add((message) => {
      if (!live()) {
        return;
      }
      // Setup complete, begin sending data
      if (message.setupComplete) {
        run.log("← setupComplete");
        // Process microphone input to send to the server
        if (this.onAudioChunk) {
          this.audioProcessor.onAudioChunkReady.remove(this.onAudioChunk);
        }
        this.onAudioChunk = (encodedAudioChunk) => {
          const message = {
            realtime_input: {
              media_chunks: [
                {
                  mime_type: "audio/pcm",
                  data: encodedAudioChunk,
                },
              ],
            },
          } as GeminiTypes.Live.RealtimeInput;
          GeminiLive.send(message);
        };
        this.audioProcessor.onAudioChunkReady.add(this.onAudioChunk);

        // Configure the microphone
        this.microphoneRecorder.onAudioFrame.remove(this.onMicFrame);
        this.microphoneRecorder.onAudioFrame.add(this.onMicFrame);
        this.microphoneRecorder.startRecording();
        run.log("🎤 microphone on, streaming");

        if (this.haveVideoInput) {
          // Configure the video controller
          this.onVideoFrame = (encodedFrame) => {
            const message = {
              realtime_input: {
                media_chunks: [
                  {
                    mime_type: "image/jpeg",
                    data: encodedFrame,
                  },
                ],
              },
            } as GeminiTypes.Live.RealtimeInput;
            GeminiLive.send(message);
          };
          this.videoController.onEncodedFrame.add(this.onVideoFrame);
          this.videoController.startRecording();
          this.videoRecording = true;
          run.log("camera frames streaming");
        }

        // The model speaks first, so the step shows an answer without the user saying anything.
        if (this.greeting.trim().length > 0) {
          const greetingMessage: GeminiTypes.Live.ClientContent = {
            client_content: {
              turns: [{ role: "user", parts: [{ text: this.greeting }] }],
              turn_complete: true,
            },
          };
          GeminiLive.send(greetingMessage);
          run.log("→ client_content (greeting)");
        }
      }

      if (message?.serverContent) {
        const content = (message as GeminiTypes.Live.ServerContentEvent).serverContent;
        // Playback the audio response
        if (content?.modelTurn?.parts?.[0]?.inlineData?.mimeType?.startsWith("audio/pcm")) {
          if (!audioLogged) {
            audioLogged = true;
            run.log("♪ model speaking");
          }
          const audio = Base64.decode(content.modelTurn.parts[0].inlineData.data);
          this.dynamicAudioOutput.addAudioFrame(audio);
        }

        // Show output transcription
        else if (content?.outputTranscription?.text) {
          if (completedTextDisplay) {
            this.textDisplay.text = content.outputTranscription.text;
          } else {
            this.textDisplay.text += content.outputTranscription.text;
          }
          completedTextDisplay = false;
        }

        // Show text response
        else if (content?.modelTurn?.parts?.[0]?.text) {
          if (completedTextDisplay) {
            this.textDisplay.text = content.modelTurn.parts[0].text;
          } else {
            this.textDisplay.text += content.modelTurn.parts[0].text;
          }
          completedTextDisplay = false;
        }

        // Determine if the response is complete
        else if (content?.turnComplete) {
          completedTextDisplay = true;
          audioLogged = false;
          run.log("← turn complete: " + this.textDisplay.text);
        }
      }

      if (message.toolCall) {
        const toolCall = (message as GeminiTypes.Live.ToolCallEvent).toolCall;
        // Handle tool calls
        toolCall.functionCalls.forEach((functionCall) => {
          run.log("← tool call " + functionCall.name + " " + JSON.stringify(functionCall.args));
          if (functionCall.name === "change_text_color") {
            const args = functionCall.args;
            this.textDisplay.textFill.color = new vec4(
              args.r / 255,
              args.g / 255,
              args.b / 255,
              1
            );

            // Send a message back to the server indicating the function call was successful
            const messageToSend: GeminiTypes.Live.ToolResponse = {
              tool_response: {
                function_responses: [
                  {
                    name: functionCall.name,
                    response: { content: "Successfully changed text color" },
                  },
                ],
              },
            };

            GeminiLive.send(messageToSend);
          }
        });
      }
    });

    GeminiLive.onError.add((event) => {
      if (!live()) {
        return;
      }
      run.error("✗ socket error");
    });

    GeminiLive.onClose.add((event) => {
      if (!live()) {
        return;
      }
      this.textDisplay.text = "Connection closed: " + event.reason;
      run.error("socket closed: " + event.code + " " + (event.reason || "(no reason)"));
      this.stopDemo();
    });
  }
}
