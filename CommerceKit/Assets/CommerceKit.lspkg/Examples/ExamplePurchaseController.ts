/**
 * SPECS Inc. 2027
 * Example panel for a non-consumable: bought once with purchaseProduct() and owned from then on
 * (isProductOwned). Consumables and subscriptions use different calls; see ExampleConsumableController
 * and ExampleSubscriptionController. The shared panel logic is in ExampleProductPanel.
 */
import { ExampleProductPanel } from "./ExampleProductPanel";
import type { PanelView } from "./ExampleProductPanel";

@component
export class ExamplePurchaseController extends ExampleProductPanel {
  protected readonly logName = "ExamplePurchaseController";
  protected readonly idleButtonLabel = "Buy";

  protected prepare(product: Commerce.Product): string | null {
    switch (product.type) {
      case Commerce.ProductType.Consumable:
        return "Use ExampleConsumableController";
      case Commerce.ProductType.Subscription:
        return "Use ExampleSubscriptionController";
      default:
        return null;
    }
  }

  protected describe(product: Commerce.Product): PanelView {
    const owned = this.commerceKit.isProductOwned(this.productId);
    const purchase = this.commerceKit.getPurchase(this.productId);
    // Paid but not finalized yet; tapping Buy finishes it without charging again.
    const pending = !!purchase && purchase.purchaseState === Commerce.PurchaseState.Pending;
    return {
      price: product.price.displayPrice,
      status: owned ? "Owned" : pending ? "Pending, tap to finish" : "Not owned",
      button: owned ? "Owned" : "Buy",
      buttonEnabled: !owned,
    };
  }

  protected async runAction(): Promise<string> {
    this.render("Processing purchase...");
    const outcome = await this.commerceKit.purchaseProduct(this.productId);
    switch (outcome.status) {
      case "purchased":
        return "Purchase successful!";
      case "alreadyOwned":
        return "Already owned";
      case "cancelled":
        return "Purchase cancelled";
      default:
        return "Payment received, finishing up...";
    }
  }
}
