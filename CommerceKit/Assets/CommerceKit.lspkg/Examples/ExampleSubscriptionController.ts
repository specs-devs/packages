/**
 * SPECS Inc. 2027
 * Example panel for a subscription. Subscriptions use different calls than one-time purchases: the
 * offers come from the product's subscriptionOfferDetails (described with describeOffer),
 * subscribing buys one offer with purchaseProduct(productId, offerId), the renewal status comes from
 * getPurchase(), and cancelling goes through the native client returned by client(). The shared panel
 * logic is in ExampleProductPanel. Lens Studio Preview does not simulate subscriptions; test this panel
 * on device.
 */
import { ExampleProductPanel } from "./ExampleProductPanel";
import type { PanelView } from "./ExampleProductPanel";
import { CommerceKitError } from "CommerceKit.lspkg/CommerceKit";
import { describeOffer, getFreeTrialPhase } from "CommerceKit.lspkg/Helper/SubscriptionOffers";

@component
export class ExampleSubscriptionController extends ExampleProductPanel {
  protected readonly logName = "ExampleSubscriptionController";
  protected readonly idleButtonLabel = "Subscribe";
  private offer: Commerce.SubscriptionOfferDetails | null = null;

  protected prepare(product: Commerce.Product): string | null {
    if (product.type !== Commerce.ProductType.Subscription) {
      // Lens Studio Preview simulates every product as a one-time purchase.
      return global.deviceInfoSystem.isEditor() ? "Test subscriptions on device" : "Not a subscription";
    }
    // Prefers an offer with a free trial; real Lenses usually let the user choose. Offer IDs are opaque.
    const offers = product.subscriptionOfferDetails || [];
    this.offer = offers.find((offer) => getFreeTrialPhase(offer) !== null) || offers[0] || null;
    return null;
  }

  protected describe(product: Commerce.Product): PanelView {
    const active = this.commerceKit.isProductOwned(this.productId);
    const purchase = this.commerceKit.getPurchase(this.productId);
    const renewing = active && !!purchase && purchase.isAutoRenewing;
    return {
      price: this.offer ? describeOffer(this.offer) : product.price.displayPrice,
      status: this.describeStatus(active, purchase),
      button: renewing ? "Cancel" : active ? "Cancelled" : "Subscribe",
      buttonEnabled: renewing || !active,
    };
  }

  protected async runAction(): Promise<string> {
    const purchase = this.commerceKit.getPurchase(this.productId);
    if (purchase && purchase.isAutoRenewing && this.commerceKit.isProductOwned(this.productId)) {
      this.render("Cancelling...");
      await this.cancel(purchase);
      return "Subscription cancelled";
    }
    this.render("Subscribing...");
    // Without an offer ID, the product's default offer is bought.
    const outcome = await this.commerceKit.purchaseProduct(this.productId, this.offer ? this.offer.offerId : null);
    switch (outcome.status) {
      case "purchased":
        return "Subscribed!";
      case "alreadyOwned":
        return "Already subscribed";
      case "cancelled":
        return "Checkout cancelled";
      default:
        return "Payment received, finishing up...";
    }
  }

  // CommerceKit does not wrap cancelling: call the native client, then refresh so CommerceKit sees the
  // change. The user keeps access until the end of the paid period.
  private async cancel(purchase: Commerce.Purchase): Promise<void> {
    const client = await this.commerceKit.client();
    const result = await client.cancelSubscription(purchase.token);
    await this.commerceKit.refresh();
    if (result.responseCode !== Commerce.ResponseCode.Success) {
      throw new CommerceKitError(result.responseCode, "Cancelling the subscription failed", result.debugMessage);
    }
  }

  private describeStatus(active: boolean, purchase: Commerce.Purchase | null): string {
    if (active) {
      if (purchase && purchase.expiryTime) {
        const date = new Date(purchase.expiryTime).toDateString();
        return purchase.isAutoRenewing ? `Active, renews ${date}` : `Active until ${date}`;
      }
      return "Active";
    }
    if (!purchase) {
      return "Not subscribed";
    }
    switch (purchase.purchaseState) {
      // Paid but not finalized yet; tapping Subscribe finishes it without charging again.
      case Commerce.PurchaseState.Pending:
        return "Pending, tap to finish";
      // Purchased but not active: cancelled, and the paid period is over.
      case Commerce.PurchaseState.Purchased:
      case Commerce.PurchaseState.Expired:
        return "Expired";
      default:
        return "Not subscribed";
    }
  }
}
