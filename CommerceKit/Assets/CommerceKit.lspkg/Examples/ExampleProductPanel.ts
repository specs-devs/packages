/**
 * SPECS Inc. 2027
 * Base class of the example product panels. It holds what every panel shares: the UI inputs,
 * connecting and loading the product, the action button with its busy state, re-rendering when
 * purchases change, and error messages. Subclasses only implement what differs between product types:
 * which products they handle (prepare), what they show (describe) and what the button does
 * (runAction). See ExamplePurchaseController (non-consumables), ExampleConsumableController and
 * ExampleSubscriptionController.
 */
// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "UIKit.lspkg/Scripts/Themes/ThemeService";
import { BaseButton } from "UIKit.lspkg/Scripts/Components/Button/BaseButton";
import { CommerceKit, CommerceKitError } from "CommerceKit.lspkg/CommerceKit";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

/**
 * What a panel shows for its loaded product.
 */
export interface PanelView {
  /** Price or offer, for example "$1.99" or "Free for 1 week, then $4.99 / month". */
  price: string;
  /** Purchase state, for example "Owned" or "Active, renews Mon Nov 09 2026". */
  status: string;
  /** Label of the action button. */
  button: string;
  /** Whether the button can be pressed; it is also disabled while an action runs. */
  buttonEnabled: boolean;
}

export abstract class ExampleProductPanel extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Product Configuration</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">ID of a product defined on the Specs developer portal at developers.specs.com/lenses</span>'
  )
  @input
  productId: string = "";

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">UI References</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">Connect the UI elements for the action button and product information display</span>'
  )
  @input
  purchaseButton: BaseButton;

  @input
  @allowUndefined
  @hint("Optional label of the action button")
  buttonText: Text;

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

  protected logger: Logger;
  protected readonly commerceKit: CommerceKit = CommerceKit.getInstance();
  private product: Commerce.Product | null = null;
  private busy = false;
  private cleanups: (() => void)[] = [];
  /** False when a required input is missing (set in onAwake); the panel then stays idle. */
  protected configured: boolean = false;

  /** Name used in log messages. */
  protected abstract readonly logName: string;
  /** Button label shown before the product is loaded. */
  protected abstract readonly idleButtonLabel: string;

  /**
   * Called once the product is loaded.
   *
   * @returns null when the panel handles this product, otherwise the message to show instead
   */
  protected abstract prepare(product: Commerce.Product): string | null;

  /** Describes the product and its purchase state; called whenever purchases change. */
  protected abstract describe(product: Commerce.Product): PanelView;

  /**
   * Runs the button's action. It may call {@link render} with a progress message first.
   *
   * @returns The message to show once it is done
   * @throws {CommerceKitError} When the action fails
   */
  protected abstract runAction(product: Commerce.Product): Promise<string>;

  onAwake(): void {
    this.logger = new Logger(this.logName, this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.configured = this.hasRequiredInputs();
    if (!this.configured) {
      return;
    }

    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
    this.createEvent("OnDestroyEvent").bind(() => {
      this.cleanups.forEach((cleanup) => cleanup());
      this.cleanups = [];
    });
  }

  /**
   * True when the required inputs are set: the product ID and the button and text references. Logs an
   * error for each missing one; the panel then stays idle instead of failing on first use.
   */
  private hasRequiredInputs(): boolean {
    const missing: string[] = [];
    if (!this.productId) missing.push("productId");
    if (!this.purchaseButton) missing.push("purchaseButton");
    if (!this.nameText) missing.push("nameText");
    if (!this.priceText) missing.push("priceText");
    if (!this.statusText) missing.push("statusText");
    for (const name of missing) {
      this.logger.error(`${name} is not set; assign it in the Inspector`);
    }
    if (this.statusText && missing.length > 0) {
      this.statusText.text = `Not configured: ${missing.join(", ")}`;
    }
    return missing.length === 0;
  }

  /** Runs `cleanup` when the panel is destroyed, for example to remove a handler. */
  protected addCleanup(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /**
   * Shows the product, or `message` instead of its status. While an action runs, the status keeps the
   * last progress message.
   */
  protected render(message?: string): void {
    const product = this.product;
    if (!product) {
      this.nameText.text = this.productId;
      this.priceText.text = "N/A";
      this.statusText.text = message || "Product not loaded";
      this.setButton(this.idleButtonLabel, false);
      return;
    }

    const view = this.describe(product);
    this.nameText.text = product.displayName;
    this.priceText.text = view.price;
    this.setButton(view.button, view.buttonEnabled && !this.busy);
    if (message || !this.busy) {
      this.statusText.text = message || view.status;
    }
  }

  private async onStart() {
    this.purchaseButton.onTriggerUp.add(() => {
      this.onButtonPressed();
    });
    this.addCleanup(this.commerceKit.onPurchasesChanged.add(() => this.render()));
    this.render("Connecting...");

    try {
      await this.commerceKit.initialize();
      // The Lens API product: getProductInfo() maps the CommerceKit 3.x fields and keeps it as nativeProduct.
      const product = (await this.commerceKit.getProductInfo(this.productId)).nativeProduct;
      const unsupported = this.prepare(product);
      if (unsupported) {
        this.render(unsupported);
        return;
      }
      this.product = product;
      this.render();
    } catch (error) {
      this.render(this.describeError(error));
    }
  }

  private async onButtonPressed() {
    const product = this.product;
    if (!product || this.busy) {
      return;
    }
    this.busy = true;
    try {
      const message = await this.runAction(product);
      this.busy = false;
      this.render(message);
    } catch (error) {
      this.logger.error(`Action failed: ${error}`);
      this.busy = false;
      this.render(this.describeError(error));
    }
  }

  private setButton(label: string, enabled: boolean) {
    this.purchaseButton.inactive = !enabled;
    if (this.buttonText) {
      this.buttonText.text = label;
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof CommerceKitError) {
      switch (error.code) {
        case Commerce.ResponseCode.ItemUnavailable:
          return "Product not found";
        case Commerce.ResponseCode.NetworkError:
          return "No connection, try again";
        case Commerce.ResponseCode.PaymentUnavailable:
          return "Payment failed";
        default:
          return "Purchase failed";
      }
    }
    return "Something went wrong";
  }
}
