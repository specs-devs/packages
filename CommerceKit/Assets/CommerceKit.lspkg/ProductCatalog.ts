/**
 * Specs Inc. 2026
 * Product catalog component that initializes CommerceKit with your product definitions.
 * Add this component to your scene and configure your products to enable in-app purchases.
 */
import { CommerceKit } from "./CommerceKit";
import { CommerceProduct } from "./Helper/CommerceProduct";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class ProductCatalog extends BaseScriptComponent {
  @ui.label(
    '<div>⚠️ <span style="color: #FFCC80; font-weight: bold;">CommerceKit is currently in Closed Beta.</span></div>'
  )
  @ui.label(
    '<div style="color: #e2e2e2ff;">You can test CommerceKit in a draft environment, but will need to request access to publish your Lens. For more details please visit our <a href="https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started" target="_blank" style="color: #00D4FF; text-decoration: underline;">docs</a>.</div>'
  )
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Product Catalog</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define your products here including IDs, prices, and metadata</span>')

  /**
   * Array of products that make up the commerce catalog.
   * Configure these products through the Lens Studio component interface.
   */
  @input
  readonly productCatalog: CommerceProduct[];

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

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ProductCatalog", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    // Initialize catalog
    CommerceKit.getInstance().initializeCatalog(this.productCatalog);
  }
}
