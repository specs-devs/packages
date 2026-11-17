/**
 * SPECS Inc. 2027
 * Example implementation of Snap3D image-to-3D generation. Demonstrates using an existing image
 * URL to generate 3D models, bypassing the text-to-image stage. This example shows how to
 * submit an image directly for mesh generation and handle the resulting 3D assets. In the demo
 * carousel the generation starts by itself when the step is shown; results of a step that was left
 * are ignored (see Example/DemoLog).
 */
import { Snap3D } from "../Snap3D";
import { Snap3DTypes } from "../Snap3DTypes";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { Promisfy } from "../../Utils/Promisfy";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleSnap3DImageTo3D extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Image-to-3D Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Generate 3D models directly from image URLs</span>')

  @ui.group_start("Image-to-3D Generation")
  @input
  @widget(new TextAreaWidget())
  @hint("URL of the image to convert to 3D (must be publicly accessible)")
  private imageUrl: string =
    "https://raw.githubusercontent.com/specs-devs/packages/main/RemoteServiceGateway/Assets/AssetImage/RemoteServiceGateway.png";

  @input
  @widget(new TextAreaWidget())
  @hint("Optional prompt to guide 3D generation (e.g., 'a toy car', 'a vase')")
  private prompt: string = "an object";

  @input
  @hint("Enable mesh refinement for higher quality (slower)")
  private refineMesh: boolean = true;

  @input
  @hint("Use vertex colors instead of textures")
  private useVertexColor: boolean = false;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Display Configuration</span>')

  @input
  @allowUndefined
  @hint("Image component to display the source image")
  sourceImage: Image;

  @input
  @allowUndefined
  @hint("Parent object for base mesh")
  baseMeshRoot: SceneObject;

  @input
  @allowUndefined
  @hint("Parent object for refined mesh")
  refinedMeshRoot: SceneObject;

  @input
  @allowUndefined
  @hint("Material to apply to generated meshes")
  modelMat: Material;

  @input
  @allowUndefined
  @hint("Text component for status messages")
  hintText: Text;

  @input
  @label("Run in demo")
  @hint("Generate when the demo carousel shows this example (formerly: on tap)")
  runOnTap: boolean = false;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  @input
  @hint("Where the demo's live log panel sits, relative to this object (cm)")
  logPanelOffset: vec3 = new vec3(0, 10, 0);

  // Logger instance
  private logger: Logger;
  private baseMeshSpinner: SceneObject;
  private refinedMeshSpinner: SceneObject;

  private baseMeshSceneObject: SceneObject = null;
  private refinedMeshSceneObject: SceneObject = null;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleSnap3DImageTo3D", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.initializeSpinners();

    // Runs by itself when the carousel shows this example.
    DemoStep.join({
      owner: this,
      name: "Image to 3D",
      order: 0,
      tokens: [AvaliableApiTypes.Snap],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.enableSpinners(false),
    });
  }

  async runDemo(run: DemoRun = DemoRun.detached("Image to 3D")) {
    if (!this.runOnTap) {
      return;
    }
    if (!this.imageUrl || this.imageUrl.trim() === "") {
      run.error("imageUrl is empty: set a public image URL");
      return;
    }
    await this.startImageTo3DGeneration(run);
  }

  /**
   * Shows the source image, then generates a 3D model from it (the text-to-image stage is skipped).
   * Resolves when the task ends.
   */
  async startImageTo3DGeneration(run: DemoRun = DemoRun.detached("Image to 3D")) {
    this.resetAssets();
    this.hintText.text = "Converting image to 3D. Please wait...";

    // Load and display the source image first
    const texture = await run.call("source image fetch", () => this.loadSourceImage(this.imageUrl));
    if (texture) {
      this.sourceImage.mainPass.baseTex = texture;
      this.sourceImage.enabled = true;
    }

    this.enableSpinners(true);
    // Submit with image_url to skip text-to-image generation
    const results = await run.call(
      "Snap3D submit (image_url)",
      () =>
        Snap3D.submitAndGetStatus({
          prompt: this.prompt,
          format: "glb",
          refine: this.refineMesh,
          use_vertex_color: this.useVertexColor,
          image_url: this.imageUrl, // This tells the API to use the provided image
        }),
      (result) => "task " + result.task_id
    );
    if (!results) {
      this.enableSpinners(false);
      this.hintText.text = "Generation failed: see the log above";
      return;
    }
    this.hintText.text = "Generating 3D model from image...";
    run.log("polling status…");
    await run.guard(
      new Promise<void>((resolve) => {
        results.event.add(([artifactType, assetOrError]) => {
          // Results of a step that was left are ignored.
          if (!run.alive) {
            resolve();
            return;
          }
          if (artifactType === "image") {
            run.log("← image confirmed");
          } else if (artifactType === "base_mesh") {
            run.log("← base mesh");
            this.generateBaseMeshAsset(assetOrError as Snap3DTypes.GltfAssetData);
            this.hintText.text = "Base mesh generated. Refining...";
            if (!this.refineMesh) {
              resolve();
            }
          } else if (artifactType === "refined_mesh") {
            run.log("← refined mesh: done");
            this.generateRefinedMeshAsset(assetOrError as Snap3DTypes.GltfAssetData);
            this.hintText.text = "Generation complete!";
            resolve();
          } else if (artifactType === "failed") {
            const error = assetOrError as Snap3DTypes.ErrorData;
            this.enableSpinners(false);
            run.error("✗ task failed: " + error.errorCode + " " + error.errorMsg);
            this.hintText.text = "Generation failed: see the log above";
            resolve();
          }
        });
      })
    );
  }

  /**
   * Fetches the source image from its URL
   */
  private loadSourceImage(url: string): Promise<Texture> {
    const internetModule = require("LensStudio:InternetModule") as InternetModule;
    const remoteMediaModule =
      require("LensStudio:RemoteMediaModule") as RemoteMediaModule;
    // makeResourceFromUrl: on Specs (LS 5.25) performHttpRequest(...).asResource() comes back empty.
    return Promisfy.RemoteMediaModule.loadResourceAsImageTexture(
      remoteMediaModule,
      internetModule.makeResourceFromUrl(url)
    );
  }


  private generateBaseMeshAsset(gltfAssetData: Snap3DTypes.GltfAssetData) {
    this.baseMeshSceneObject = gltfAssetData.gltfAsset.tryInstantiate(
      this.baseMeshRoot,
      this.modelMat
    );
    this.baseMeshSpinner.enabled = false;
  }

  private generateRefinedMeshAsset(gltfAssetData: Snap3DTypes.GltfAssetData) {
    this.refinedMeshSceneObject = gltfAssetData.gltfAsset.tryInstantiate(
      this.refinedMeshRoot,
      this.modelMat
    );
    this.refinedMeshSpinner.enabled = false;
  }

  private resetAssets() {
    this.sourceImage.enabled = false;
    if (!isNull(this.baseMeshSceneObject)) {
      this.baseMeshSceneObject.destroy();
      this.baseMeshSceneObject = null;
    }
    if (!isNull(this.refinedMeshSceneObject)) {
      this.refinedMeshSceneObject.destroy();
      this.refinedMeshSceneObject = null;
    }
  }

  private initializeSpinners() {
    this.baseMeshSpinner = this.baseMeshRoot.getChild(0);
    this.refinedMeshSpinner = this.refinedMeshRoot.getChild(0);
    this.enableSpinners(false);
  }

  private enableSpinners(enable: boolean) {
    this.baseMeshSpinner.enabled = enable;
    this.refinedMeshSpinner.enabled = enable;
  }
}
