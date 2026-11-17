/**
 * SPECS Inc. 2027
 * Example panel for a consumable, such as a pack of coins. Unlike other products, a consumable purchase
 * is only finished once the Lens has processed it: the panel registers a delivery handler with
 * registerConsumable(), CommerceKit calls it for every completed purchase (including purchases paid in
 * an earlier session but never processed), and only after the handler has processed the purchase token
 * does CommerceKit acknowledge the purchase, which consumes it. The shared panel logic is in
 * ExampleProductPanel.
 */
import { ExampleProductPanel } from "./ExampleProductPanel";
import type { PanelView } from "./ExampleProductPanel";

// Enough to recognize purchases that are offered again; CommerceKit only offers unfinished ones.
const REMEMBERED_TOKENS = 50;

@component
export class ExampleConsumableController extends ExampleProductPanel {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Delivery</span>')
  @input
  @hint("Coins credited for each purchase. The balance is saved with persistentStorageSystem.")
  amountPerPurchase: number = 100;

  protected readonly logName = "ExampleConsumableController";
  protected readonly idleButtonLabel = "Buy";

  onAwake(): void {
    super.onAwake();
    if (!this.configured) {
      // ExampleProductPanel has logged what is missing; registerConsumable would throw on an empty ID.
      return;
    }
    // Registered before CommerceKit restores purchases, so a purchase paid in an earlier session but
    // never processed is delivered right away. In Lens Studio Preview, registering before the product is
    // first used also makes it a simulated consumable.
    this.addCleanup(this.commerceKit.registerConsumable(this.productId, (purchase) => this.processPurchase(purchase)));
  }

  protected prepare(product: Commerce.Product): string | null {
    return product.type === Commerce.ProductType.Consumable ? null : "Not a consumable";
  }

  protected describe(product: Commerce.Product): PanelView {
    const purchase = this.commerceKit.getPurchase(this.productId);
    // Paid but not processed yet: tapping Buy processes it again instead of charging again.
    const pending = !!purchase && purchase.purchaseState === Commerce.PurchaseState.Pending;
    return {
      price: product.price.displayPrice,
      status: pending ? "Pending, tap to finish" : `Balance: ${this.balance()} coins`,
      button: "Buy",
      buttonEnabled: true,
    };
  }

  // Resolves only after processPurchase has processed the token and CommerceKit has acknowledged
  // (consumed) the purchase, so nothing is left to do with the purchase here.
  protected async runAction(): Promise<string> {
    this.render("Processing purchase...");
    const outcome = await this.commerceKit.purchaseProduct(this.productId);
    switch (outcome.status) {
      case "purchased":
        return `+${this.amountPerPurchase} coins`;
      case "cancelled":
        return "Purchase cancelled";
      default:
        // The handler has not processed the purchase yet; CommerceKit keeps it pending.
        return "Payment received, finishing up...";
    }
  }

  // The registerConsumable handler. CommerceKit calls it with the paid purchase while it is still
  // pending (not acknowledged), and acknowledges it, which consumes it, only after this resolves:
  // 1. Process the purchase token, here with a stand-in for your server.
  // 2. If it could not be processed yet, return false: the purchase stays pending and is not
  //    acknowledged, and CommerceKit offers it again on the next refresh, Lens launch or purchase attempt
  //    without charging again. Throwing does the same and logs a warning.
  // 3. Otherwise return true, and CommerceKit acknowledges the purchase.
  private async processPurchase(purchase: Commerce.Purchase): Promise<boolean> {
    const processed = await this.processToken(purchase.token);
    if (!processed) {
      return false;
    }
    this.logger.info(`Credited ${this.amountPerPurchase} coins; CommerceKit now acknowledges the purchase`);
    return true;
  }

  // Stands in for your server. A real Lens usually sends the token to its backend, which checks it and
  // credits the user's account. It must be idempotent per token: until the handler completes, the same
  // purchase is offered again, for example after the Lens closed in the middle of processing it.
  private async processToken(token: string): Promise<boolean> {
    const store = this.store();
    if (!store) {
      // Nowhere to credit the coins: keep the purchase pending so it is offered again, not lost.
      this.logger.error("persistentStorageSystem is unavailable; the purchase stays pending");
      return false;
    }
    const tokensKey = this.storageKey("tokens");
    const credited = store.has(tokensKey) ? store.getStringArray(tokensKey) : [];
    if (credited.indexOf(token) < 0) {
      store.putInt(this.storageKey("balance"), this.balance() + this.amountPerPurchase);
      store.putStringArray(tokensKey, credited.concat(token).slice(-REMEMBERED_TOKENS));
    }
    return true;
  }

  private balance(): number {
    const store = this.store();
    const key = this.storageKey("balance");
    return store && store.has(key) ? store.getInt(key) : 0;
  }

  /** The persistent store, or undefined where persistent storage isn't available. */
  private store(): GeneralDataStore | undefined {
    return global.persistentStorageSystem?.store;
  }

  private storageKey(name: string): string {
    return `ExampleConsumableController.${this.productId}.${name}`;
  }
}
