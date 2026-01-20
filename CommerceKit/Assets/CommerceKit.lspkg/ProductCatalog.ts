import { CommerceKit } from "./CommerceKit";
import { CommerceProduct } from "./Helper/CommerceProduct";

@component
export class ProductCatalog extends BaseScriptComponent {
  @ui.label(
    '<div>⚠️ <span style="color: #FFCC80; font-weight: bold;">CommerceKit is currently in Closed Beta.</span></div>'
  )
  @ui.label(
    '<div style="color: #e2e2e2ff;">You can test CommerceKit in a draft environment, but will need to request access to publish your Lens. For more details please visit our <a href="https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/getting-started" target="_blank" style="color: #00D4FF; text-decoration: underline;">docs</a>.</div>'
  )
  @ui.separator

  /**
   * Array of products that make up the commerce catalog.
   * Configure these products through the Lens Studio component interface.
   */
  @input
  readonly productCatalog: CommerceProduct[];

  onAwake() {
    CommerceKit.getInstance().initializeCatalog(this.productCatalog);
  }
}
