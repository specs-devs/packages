/**
 * SPECS Inc. 2027
 * Example implementations of Google Gemini API calls. Demonstrates text generation, function
 * calling with color manipulation and multimodal image generation. In the demo carousel the
 * enabled calls run by themselves, one after the other, when the step is shown (see Example/DemoLog).
 */
import { Gemini } from "../GoogleGenAI";
import { GeminiTypes } from "../GoogleGenAITypes";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleGeminiCalls extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Gemini API Examples</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure and test Gemini text, image, and function calling capabilities</span>')

  @ui.group_start("Text Generation Example")
  @input
  @allowUndefined
  textDisplay: Text;
  @input
  @widget(new TextAreaWidget())
  private modelPrompt: string =
    "You are an incredibly smart but witty AI assistant who likes to answers life's greatest mysteries in under two sentences";
  @input
  @widget(new TextAreaWidget())
  private textPrompt: string = "Is a hotdog a sandwich?";
  @input
  @label("Run in demo")
  private doTextGenerationOnTap: boolean = false;
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
  private loaderSpinnerImage: SceneObject;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleGeminiCalls", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.initializeSpinner();

    // Runs by itself when the carousel shows this example (before ExampleImagenCalls on the same step).
    DemoStep.join({
      owner: this,
      name: "Gemini",
      order: 0,
      tokens: [AvaliableApiTypes.Google],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.stopDemo(),
    });
  }

  /** The enabled calls, in order: text, function calling, image. */
  async runDemo(run: DemoRun = DemoRun.detached("Gemini")) {
    this.textDisplay.textFill.color = new vec4(1, 1, 1, 1);
    this.textDisplay.text = "";
    if (this.doTextGenerationOnTap) {
      await this.textToTextExample(run);
    }
    if (this.doFunctionCallingOnTap) {
      await this.functionCallingExample(run);
    }
    if (this.generateImageOnTap) {
      await this.generateImageExample(run);
    }
  }

  stopDemo() {
    if (this.loaderSpinnerImage) {
      this.loaderSpinnerImage.enabled = false;
    }
  }

  async textToTextExample(run: DemoRun = DemoRun.detached("Gemini")) {
    this.textDisplay.sceneObject.enabled = true;
    this.textDisplay.text = "Generating...";
    const request: GeminiTypes.Models.GenerateContentRequest = {
      model: "gemini-2.5-flash",
      type: "generateContent",
      body: {
        contents: [
          {
            parts: [
              {
                text: this.modelPrompt,
              },
            ],
            role: "model",
          },
          {
            parts: [
              {
                text: this.textPrompt,
              },
            ],
            role: "user",
          },
        ],
      },
    };

    const response = await run.call(
      "gemini-2.5-flash text",
      () => Gemini.models(request),
      (result) => result.candidates[0].content.parts[0].text ?? "(no text)"
    );
    this.textDisplay.text = response
      ? response.candidates[0].content.parts[0].text ?? ""
      : "Error: see the log above";
  }

  async generateImageExample(run: DemoRun = DemoRun.detached("Gemini")) {
    this.imgObject.enabled = true;
    this.loaderSpinnerImage.enabled = true;
    const request: GeminiTypes.Models.GenerateContentRequest = {
      model: "gemini-3.1-flash-image",
      type: "generateContent",
      body: {
        contents: [
          {
            parts: [
              {
                text: this.imageGenerationPrompt,
              },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      },
    };
    const response = await run.call(
      "gemini-3.1-flash-image (Gemini route)",
      () => Gemini.models(request),
      (result) =>
        result.candidates[0].content.parts.some((part) => !!part?.inlineData)
          ? "image received"
          : "no image part"
    );
    const imagePart = response?.candidates[0].content.parts.find(
      (part) => !!part?.inlineData
    );
    if (!imagePart) {
      this.loaderSpinnerImage.enabled = false;
      return;
    }
    const b64Data = imagePart.inlineData.data;
    const texture = await run.call(
      "image decode",
      () =>
        new Promise<Texture>((resolve, reject) =>
          Base64.decodeTextureAsync(b64Data, resolve, () =>
            reject("Failed to decode texture from base64 data.")
          )
        )
    );
    this.loaderSpinnerImage.enabled = false;
    if (texture) {
      const imgComponent = this.imgObject.getComponent("Image");
      const imageMaterial = imgComponent.mainMaterial.clone();
      imgComponent.mainMaterial = imageMaterial;
      imgComponent.mainPass.baseTex = texture;
    }
  }

  private initializeSpinner() {
    this.loaderSpinnerImage = this.imgObject.getChild(0);
    this.loaderSpinnerImage.enabled = false;
  }

  async functionCallingExample(run: DemoRun = DemoRun.detached("Gemini")) {
    this.textDisplay.sceneObject.enabled = true;

    const request: GeminiTypes.Models.GenerateContentRequest = {
      model: "gemini-2.5-flash",
      type: "generateContent",
      body: {
        contents: [
          {
            parts: [
              {
                text: this.functionCallingPrompt,
              },
            ],
            role: "user",
          },
        ],
        tools: [
          {
            functionDeclarations: [
              {
                name: "set_text_color",
                description: "Set the color of the text display",
                parameters: {
                  type: "object",
                  properties: {
                    red: {
                      type: "number",
                      description: "Red component of the color (0-255)",
                    },
                    green: {
                      type: "number",
                      description: "Green component of the color (0-255)",
                    },
                    blue: {
                      type: "number",
                      description: "Blue component of the color (0-255)",
                    },
                  },
                  required: ["red", "green", "blue"],
                },
              },
            ],
          },
        ],
      },
    };

    const response = await run.call(
      "function calling",
      () => Gemini.models(request),
      (result) => {
        const part = result.candidates[0]?.content?.parts?.[0];
        return part?.functionCall
          ? part.functionCall.name + " " + JSON.stringify(part.functionCall.args)
          : "no function call: " + (part?.text ?? "");
      }
    );
    if (!response) {
      return;
    }
    // Check for function calls in the response
    const functionCall = response.candidates[0]?.content?.parts?.[0]?.functionCall;
    if (functionCall && functionCall.name === "set_text_color") {
      const args = functionCall.args || {};
      const r = args.red || 0;
      const g = args.green || 0;
      const b = args.blue || 0;
      this.textDisplay.textFill.color = new vec4(r / 255, g / 255, b / 255, 1);
      this.textDisplay.text += `\n\nText color set to RGB(${r}, ${g}, ${b})`;
    }
  }
}
