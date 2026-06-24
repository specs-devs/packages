/**
 * Specs Inc. 2026
 * Example controller demonstrating CommerceKit integration for in-app purchases.
 * Shows how to handle purchase flows, check ownership status, and update UI based on purchase state.
 */
// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { BaseButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/BaseButton";
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class ExamplePurchaseController extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Product Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the product ID from your commerce catalog that this controller manages</span>')

  @input
  productId: string = "premium_upgrade"; // Set your product ID here

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">UI References</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Connect the UI elements for purchase button and product information display</span>')

  @input
  purchaseButton: BaseButton;
  @input
  nameText: Text;
  @input
  priceText: Text;
  @input
  statusText: Text;

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

  private commerceKit: CommerceKit = CommerceKit.getInstance();

  private pendingPurchase: boolean = false;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ExamplePurchaseController", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    // Setup start event
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }

  private async onStart() {
    // Setup UI
    this.setupPurchaseButton();
    this.updateUI();
  }
  private setupPurchaseButton() {
    this.purchaseButton.onTriggerUp.add(() => {
      this.onPurchaseButtonPressed();
    });
  }
  private async updateUI() {
    await this.commerceKit.client;
    const isOwned = this.commerceKit.isProductOwned(this.productId);

    this.purchaseButton.enabled = !isOwned;
    this.statusText.text = isOwned ? "Premium Owned" : "Tap to Purchase";

    const product = await this.commerceKit.getProductInfo(this.productId);
    if (isNull(product)) {
      this.statusText.text = "Product not found";
    } else {
      this.nameText.text = product.displayName;
      this.priceText.text = `${product.price.price} ${product.price.currency}`;
    }
  }
  private async onPurchaseButtonPressed() {
    if (this.commerceKit.isProductOwned(this.productId)) {
      this.statusText.text = "Already owned!";
      return;
    }
    if (this.pendingPurchase) {
      return;
    }

    try {
      this.pendingPurchase = true;
      this.statusText.text = "Processing purchase...";

      const result = await this.commerceKit.purchaseProduct(this.productId);
      if (result.success) {
        this.statusText.text = "Purchase successful!";
        this.enablePremiumFeatures();
      } else if (result.cancelled) {
        this.statusText.text = "Purchase cancelled";
      } else if (!result.success) {
        this.statusText.text = "Purchase failed";
      }
      this.pendingPurchase = false;
    } catch (error) {
      this.statusText.text = `Purchase failed: ${error.message}`;
      print(`Purchase error: ${error}`);
      this.pendingPurchase = false;
    }
  }
  private enablePremiumFeatures() {
    // Enable your premium features here
    print("Premium features unlocked!");
  }
}
