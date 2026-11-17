/**
 * SPECS Inc. 2027
 * Example implementation of Google Imagen API for AI image generation. Demonstrates text-to-image
 * generation with generateContent requests
 * using the Gemini image models served by the Imagen route. In the demo carousel it runs by itself
 * after ExampleGeminiCalls on the same step (see Example/DemoLog).
 */
import { Imagen } from "../Imagen";
import { GoogleGenAITypes } from "../GoogleGenAITypes";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleImagenCalls extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Imagen Image Generation</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure and test AI-powered image generation</span>')

  @ui.group_start("Generate Image Example")
  @input
  @allowUndefined
  private imgObject: SceneObject;
  @input
  @widget(new TextAreaWidget())
  private generatePrompt: string = "A futuristic cityscape at sunset";
  @input
  @label("Run in demo")
  private doGenerateOnTap: boolean = false;

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
  private logger: Logger;
  // Edit and Upscale are not supported by current proxy; removed from example

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleImagenCalls", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    // Runs by itself when the carousel shows this step, after the examples with a lower order.
    // It logs into the step's panel (hosted by ExampleGeminiCalls in the prefab).
    DemoStep.join({
      owner: this,
      name: "Imagen",
      order: 10,
      tokens: [AvaliableApiTypes.Google],
      run: (run) => this.runDemo(run),
      stop: () => this.showSpinner(false),
    });
  }

  async runDemo(run: DemoRun = DemoRun.detached("Imagen")) {
    if (this.doGenerateOnTap) {
      await this.generateImageExample(run);
    }
  }

  /** The output's first child is its loading spinner (as in the prefab), if it has one. */
  private showSpinner(show: boolean) {
    if (this.imgObject && this.imgObject.getChildrenCount() > 0) {
      this.imgObject.getChild(0).enabled = show;
    }
  }

  private setImageTexture(texture: Texture) {
    const imgComponent = this.imgObject.getComponent("Image");
    if (!imgComponent) {
      this.logger.debug("ExampleImagenCalls: SceneObject has no Image component.");
      return;
    }
    const imageMaterial = imgComponent.mainMaterial.clone();
    imgComponent.mainMaterial = imageMaterial;
    imgComponent.mainPass.baseTex = texture;
  }

  async generateImageExample(run: DemoRun = DemoRun.detached("Imagen")) {
    if (!this.imgObject) {
      run.error("imgObject not assigned");
      return;
    }
    this.logger.debug("Generating image with prompt: " + this.generatePrompt);
    this.imgObject.enabled = true;
    this.showSpinner(true);
    const request: GoogleGenAITypes.Imagen.GenerateContentRequest = {
      model: "gemini-3.1-flash-image",
      type: "generateContent",
      body: {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: this.generatePrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      },
    };

    const response = await run.call(
      "Imagen.generateContent gemini-3.1-flash-image",
      () => Imagen.generateContent(request),
      (result) =>
        (result.candidates?.[0]?.content?.parts ?? []).some((part) => part?.inlineData?.data)
          ? "image received"
          : "no image part: " + JSON.stringify(result)
    );
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part?.inlineData?.data);
    if (!imagePart) {
      this.showSpinner(false);
      return;
    }
    const b64 = imagePart.inlineData.data;
    const texture = await run.call(
      "image decode",
      () =>
        new Promise<Texture>((resolve, reject) =>
          Base64.decodeTextureAsync(b64, resolve, () =>
            reject("Failed to decode texture from base64 data.")
          )
        )
    );
    this.showSpinner(false);
    if (texture) {
      this.setImageTexture(texture);
    }
  }
}
