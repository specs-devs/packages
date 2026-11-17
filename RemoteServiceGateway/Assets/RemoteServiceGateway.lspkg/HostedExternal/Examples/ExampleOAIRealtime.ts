/**
 * SPECS Inc. 2027
 * Example implementation of OpenAI Realtime API with streaming audio conversations. Demonstrates
 * WebSocket-based real-time chat with voice selection, microphone input, audio output, function
 * calling, and bidirectional communication using gpt-realtime-mini. In the demo carousel the
 * session opens by itself when the step is shown (the model greets you first) and closes, with the
 * microphone and audio output, when the step is left (see Example/DemoLog).
 */
import { AudioProcessor } from "../../Helpers/AudioProcessor";
import { DynamicAudioOutput } from "../../Helpers/DynamicAudioOutput";
import { MicrophoneRecorder } from "../../Helpers/MicrophoneRecorder";
import { OpenAI } from "../OpenAI";
import { OpenAITypes } from "../OpenAITypes";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleOAIRealtime extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">OpenAI Realtime Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure real-time voice AI interaction with audio streaming</span>')

  @ui.group_start("Setup")
  @input
  @allowUndefined
  private websocketRequirementsObj: SceneObject;
  @input
  @allowUndefined
  private dynamicAudioOutput: DynamicAudioOutput;
  @input
  @allowUndefined
  private microphoneRecorder: MicrophoneRecorder;
  @input
  @allowUndefined
  private textDisplay: Text;
  @ui.group_end
  @ui.separator
  @ui.group_start("Inputs")
  @input
  @widget(new TextAreaWidget())
  private instructions: string =
    "You are a helpful assistant that loves to make puns";
  @ui.group_end
  @ui.separator
  @ui.group_start("Outputs")
  @ui.label(
    '<span style="color: yellow;">⚠️ To prevent audio feedback loop in Lens Studio Editor, use headphones or manage your microphone input.</span>'
  )
  @input
  private audioOutput: boolean = false;

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
  @showIf("audioOutput", true)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("alloy", "alloy"),
      new ComboBoxItem("ash", "ash"),
      new ComboBoxItem("ballad", "ballad"),
      new ComboBoxItem("coral", "coral"),
      new ComboBoxItem("echo", "echo"),
      new ComboBoxItem("sage", "sage"),
      new ComboBoxItem("shimmer", "shimmer"),
      new ComboBoxItem("verse", "verse"),
    ])
  )
  private voice: string = "coral";
  @ui.group_end
  @ui.separator
  @ui.group_start("Demo")
  @input
  @widget(new TextAreaWidget())
  @hint("Sent as the first response request once the session is ready, so the model speaks first. Empty: wait for the user.")
  private greeting: string =
    "Greet the user in one short sentence and ask what they would like to talk about.";
  @input
  @hint("Where the demo's live log panel sits, relative to this object (cm)")
  logPanelOffset: vec3 = new vec3(0, 12, 0);
  @ui.group_end

  private audioProcessor: AudioProcessor = new AudioProcessor();
  private socket: ReturnType<typeof OpenAI.createRealtimeSession> | null = null;
  private onMicFrame = (audioFrame: Float32Array) => this.audioProcessor.processFrame(audioFrame);
  private onAudioChunk: ((chunk: string) => void) | null = null;
  private endSession: (() => void) | null = null;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleOAIRealtime", this.enableLogging || this.enableLoggingLifecycle, true);

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
      name: "OpenAI Realtime",
      order: 0,
      tokens: [AvaliableApiTypes.OpenAI],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.stopDemo(),
    });
  }

  /** Opens the session and keeps the step's run alive until the socket closes or the step is left. */
  async runDemo(run: DemoRun = DemoRun.detached("OpenAI Realtime")) {
    if (!global.deviceInfoSystem.isInternetAvailable()) {
      run.error("no internet");
    }
    this.textDisplay.textFill.color = new vec4(1, 1, 1, 1);
    this.textDisplay.text = "Connecting...";
    this.dynamicAudioOutput.initialize(24000);
    await run.guard(
      new Promise<void>((resolve) => {
        this.endSession = resolve;
        this.connectToWebsocket(run);
      })
    );
  }

  /** Closes the socket and stops the microphone and the audio output. Safe to call anytime. */
  stopDemo() {
    this.microphoneRecorder.stopRecording();
    this.microphoneRecorder.onAudioFrame.remove(this.onMicFrame);
    if (this.onAudioChunk) {
      this.audioProcessor.onAudioChunkReady.remove(this.onAudioChunk);
      this.onAudioChunk = null;
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

  connectToWebsocket(run: DemoRun = DemoRun.detached("OpenAI Realtime")) {
    const openedAt = getTime();
    run.log("gpt-realtime-mini → opening socket");
    const OAIRealtime = OpenAI.createRealtimeSession({
      model: "gpt-realtime-mini",
    });
    this.socket = OAIRealtime;
    // Events of a socket from a step that was left are ignored.
    const live = () => run.alive && this.socket === OAIRealtime;

    OAIRealtime.onOpen.add((event) => {
      if (!live()) {
        return;
      }
      run.log("← socket open in " + (getTime() - openedAt).toFixed(1) + " s");
      this.textDisplay.text = "Connected: say something";

      const setTextColor: OpenAITypes.Common.ToolDefinition = {
        type: "function",
        name: "set-text-color",
        description:
          "Use this function to set the text color of the text display",
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
      };

      // Set up the session (Realtime GA format: session.type, output_modalities, audio.input/output)
      const sessionUpdateMsg: OpenAITypes.Realtime.SessionUpdateRequest = {
        type: "session.update",
        session: {
          type: "realtime",
          instructions: this.instructions,
          // GA sessions answer in one modality: "audio" also streams a transcript.
          output_modalities: this.audioOutput ? ["audio"] : ["text"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true,
              },
            },
            output: {
              format: { type: "audio/pcm", rate: 24000 },
              voice: this.voice,
            },
          },
          tools: [setTextColor],
        },
      };
      OAIRealtime.send(sessionUpdateMsg);
      run.log("→ session.update (" + (this.audioOutput ? "audio, voice " + this.voice : "text") + ")");

      // Process microphone input to send to the server
      if (this.onAudioChunk) {
        this.audioProcessor.onAudioChunkReady.remove(this.onAudioChunk);
      }
      this.onAudioChunk = (encodedAudioChunk) => {
        const audioMsg: OpenAITypes.Realtime.ClientMessage = {
          type: "input_audio_buffer.append",
          audio: encodedAudioChunk,
        };
        OAIRealtime.send(audioMsg);
      };
      this.audioProcessor.onAudioChunkReady.add(this.onAudioChunk);

      // Configure the microphone
      this.microphoneRecorder.setSampleRate(24000);
      this.microphoneRecorder.onAudioFrame.remove(this.onMicFrame);
      this.microphoneRecorder.onAudioFrame.add(this.onMicFrame);
      this.microphoneRecorder.startRecording();
      run.log("🎤 microphone on, streaming");

      // The model speaks first, so the step shows an answer without the user saying anything.
      if (this.greeting.trim().length > 0) {
        const greetingMsg: OpenAITypes.Realtime.ResponseCreateRequest = {
          type: "response.create",
          response: { instructions: this.greeting },
        };
        OAIRealtime.send(greetingMsg);
        run.log("→ response.create (greeting)");
      }
    });

    let completedTextDisplay = true;
    let audioLogged = false;

    OAIRealtime.onMessage.add((message) => {
      if (!live()) {
        return;
      }
      if (message.type === "error") {
        const details = (message as OpenAITypes.Realtime.ErrorEvent).error;
        run.error("✗ server error: " + (details?.code ? details.code + " " : "") + (details?.message ?? JSON.stringify(message)));
        return;
      }
      if (message.type === "session.updated") {
        run.log("← session.updated");
        return;
      }
      if (message.type === "input_audio_buffer.speech_started") {
        run.log("← you are speaking…");
        return;
      }
      // Listen for text responses
      if (
        message.type === "response.output_text.delta" ||
        message.type === "response.output_audio_transcript.delta" ||
        message.type === "response.text.delta" ||
        message.type === "response.audio_transcript.delta"
      ) {
        if (!completedTextDisplay) {
          this.textDisplay.text += message.delta;
        } else {
          this.textDisplay.text = message.delta;
        }
        completedTextDisplay = false;
      } else if (message.type === "response.done") {
        completedTextDisplay = true;
        audioLogged = false;
        const status = (message as any).response?.status;
        if (status && status !== "completed") {
          const reason = (message as any).response?.status_details;
          run.error("← response " + status + (reason ? ": " + JSON.stringify(reason) : ""));
        } else {
          run.log("← response done: " + this.textDisplay.text);
        }
      }

      // Set up Audio Playback
      else if (
        message.type === "response.output_audio.delta" ||
        message.type === "response.audio.delta"
      ) {
        if (!audioLogged) {
          audioLogged = true;
          run.log("♪ model speaking");
        }
        const delta = Base64.decode(message.delta);
        this.dynamicAudioOutput.addAudioFrame(delta);
      }
      // Listen for function calls
      else if (message.type === "response.output_item.done") {
        if (message.item && message.item.type === "function_call") {
          const functionCall = message.item;
          run.log("← tool call " + functionCall.name + " " + functionCall.arguments);
          try {
            const args = JSON.parse(functionCall.arguments);
            this.textDisplay.textFill.color = new vec4(
              args.r / 255,
              args.g / 255,
              args.b / 255,
              1
            );
          } catch (e) {
            run.error("set-text-color: bad arguments " + functionCall.arguments);
          }

          // Send a message back to the server indicating the function call was successful
          const messageToSend: OpenAITypes.Realtime.ConversationItemCreateRequest =
            {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: functionCall.call_id,
                output:
                  "You have successfully called the function to set the text color.",
              },
            };

          OAIRealtime.send(messageToSend);
        }
      }
    });

    OAIRealtime.onError.add((event) => {
      if (!live()) {
        return;
      }
      run.error("✗ socket error");
    });

    OAIRealtime.onClose.add((event) => {
      if (!live()) {
        return;
      }
      this.textDisplay.text = "Websocket closed: " + event.reason;
      run.error("socket closed: " + event.code + " " + (event.reason || "(no reason)"));
      this.stopDemo();
    });
  }
}
