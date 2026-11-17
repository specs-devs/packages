/**
 * SPECS Inc. 2027
 * Example implementation of Snap3D text-to-3D generation. Demonstrates submitting prompts,
 * tracking generation progress through multiple stages (image, base mesh, refined mesh), and
 * instantiating generated 3D assets with loading spinners and status updates. In the demo carousel
 * the generation starts by itself when the step is shown; results of a step that was left are
 * ignored (see Example/DemoLog).
 */
import { Snap3D } from "../Snap3D";
import { Snap3DTypes } from "../Snap3DTypes";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";
import { AvaliableApiTypes } from "../../RemoteServiceGatewayCredentials";
import { DemoLogPanel, DemoRun, DemoStep } from "../../Example/DemoLog/DemoLog";

@component
export class ExampleSnap3D extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Generation Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure Snap3D generation parameters and display objects</span>')

  @ui.group_start("Submit and Get Status Example")
  @input
  @widget(new TextAreaWidget())
  private prompt: string = "A cute dog wearing a hat";
  @input
  private refineMesh: boolean = true;
  @input
  private useVertexColor: boolean = false;
  @ui.group_end
  @input
  @allowUndefined
  imageRoot: Image;

  @input
  @allowUndefined
  baseMeshRoot: SceneObject;

  @input
  @allowUndefined
  refinedMeshRoot: SceneObject;

  @input
  @allowUndefined
  modelMat: Material;

  @input
  @allowUndefined
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
  private loaderSpinnerImage: SceneObject;
  private baseMeshSpinner: SceneObject;
  private refinedMeshSpinner: SceneObject;

  private baseMeshSceneObject: SceneObject = null;
  private refinedMeshSceneObject: SceneObject = null;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExampleSnap3D", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.initalizeSpinners();
    this.imageRoot.enabled = false;

    // Runs by itself when the carousel shows this example.
    DemoStep.join({
      owner: this,
      name: "Snap3D",
      order: 0,
      tokens: [AvaliableApiTypes.Snap],
      panel: new DemoLogPanel(this.sceneObject, this.logPanelOffset),
      run: (run) => this.runDemo(run),
      stop: () => this.enableSpinners(false),
    });
  }

  async runDemo(run: DemoRun = DemoRun.detached("Snap3D")) {
    if (this.runOnTap) {
      await this.generate(run);
    }
  }

  /** Text to 3D: preview image, then base mesh, then refined mesh. Resolves when the task ends. */
  async generate(run: DemoRun = DemoRun.detached("Snap3D")) {
    this.resetAssets();
    this.hintText.text = "Requested Snap3D generation. Please wait...";
    this.enableSpinners(true);

    const results = await run.call(
      "Snap3D submit",
      () =>
        Snap3D.submitAndGetStatus({
          prompt: this.prompt,
          format: "glb",
          refine: this.refineMesh,
          use_vertex_color: this.useVertexColor,
        }),
      (result) => "task " + result.task_id
    );
    if (!results) {
      this.enableSpinners(false);
      this.hintText.text = "Generation failed: see the log above";
      return;
    }
    run.log("polling status…");
    await run.guard(
      new Promise<void>((resolve) => {
        results.event.add(([value, assetOrError]) => {
          // Results of a step that was left are ignored.
          if (!run.alive) {
            resolve();
            return;
          }
          if (value === "image") {
            run.log("← preview image");
            this.generateImageAsset(assetOrError as Snap3DTypes.TextureAssetData);
          } else if (value === "base_mesh") {
            run.log("← base mesh");
            this.generateBaseMeshAsset(assetOrError as Snap3DTypes.GltfAssetData);
            if (!this.refineMesh) {
              resolve();
            }
          } else if (value === "refined_mesh") {
            run.log("← refined mesh: done");
            this.generateRefinedMeshAsset(assetOrError as Snap3DTypes.GltfAssetData);
            resolve();
          } else if (value === "failed") {
            this.enableSpinners(false);
            const error = assetOrError as Snap3DTypes.ErrorData;
            run.error("✗ task failed: " + error.errorCode + " " + error.errorMsg);
            this.hintText.text = "Generation failed: see the log above";
            resolve();
          }
        });
      })
    );
  }

  private generateImageAsset(textureAssetData: Snap3DTypes.TextureAssetData) {
    this.imageRoot.mainPass.baseTex = textureAssetData.texture;
    this.loaderSpinnerImage.enabled = false;
    this.imageRoot.enabled = true;
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
    this.hintText.text = "Generation completed.";
  }
  private resetAssets() {
    this.imageRoot.enabled = false;
    if (!isNull(this.baseMeshSceneObject)) {
      this.baseMeshSceneObject.destroy();
      this.baseMeshSceneObject = null;
    }
    if (!isNull(this.refinedMeshSceneObject)) {
      this.refinedMeshSceneObject.destroy();
      this.refinedMeshSceneObject = null;
    }
  }
  private initalizeSpinners() {
    this.loaderSpinnerImage = this.imageRoot.sceneObject.getChild(1);
    this.baseMeshSpinner = this.baseMeshRoot.getChild(1);
    this.refinedMeshSpinner = this.refinedMeshRoot.getChild(1);
    this.enableSpinners(false);
  }
  private enableSpinners(enable: boolean) {
    this.loaderSpinnerImage.enabled = enable;
    this.baseMeshSpinner.enabled = enable;
    this.refinedMeshSpinner.enabled = enable;
  }
}
