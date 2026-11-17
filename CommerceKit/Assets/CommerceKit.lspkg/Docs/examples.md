# CommerceKit examples

[← Agent usage index](../README.md)

## Use when

Read for compile-correct consumer usage. Product IDs refer to products defined on the Specs developer portal ([developers.specs.com/lenses](https://developers.specs.com/lenses)); in Lens Studio Preview every ID is simulated as a $0.99 product.

## Start and show a product

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

async function showProduct(id: string, nameText: Text, priceText: Text): Promise<void> {
  const kit = CommerceKit.getInstance();
  try {
    await kit.initialize();
    const product = await kit.getProductInfo(id);
    nameText.text = product.displayName;
    priceText.text = product.nativeProduct.price.displayPrice;
  } catch (error) {
    priceText.text = "Store unavailable";
  }
}
```

## Sell a non-consumable

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

async function buyOnce(id: string): Promise<string> {
  const kit = CommerceKit.getInstance();
  if (kit.isProductOwned(id)) return "Owned";
  try {
    const outcome = await kit.purchaseProduct(id);
    switch (outcome.status) {
      case "purchased":
      case "alreadyOwned":
        return "Owned";
      case "pending":
        return "Payment received, finishing up...";
      case "cancelled":
        return "Cancelled";
    }
  } catch (error) {
    return `Purchase failed: ${error.message}`;
  }
}
```

## Sell a consumable

Register the handler early (for example in `onAwake`) so purchases recovered at startup are delivered, and so Preview simulates the product as a consumable.

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

const store = global.persistentStorageSystem.store;
const kit = CommerceKit.getInstance();

kit.registerConsumable("coins_100", (purchase) => {
  store.putInt("coins", store.getInt("coins") + 100); // grant before CommerceKit consumes the purchase
});

async function buyCoins(): Promise<number> {
  const outcome = await kit.purchaseProduct("coins_100");
  return outcome.status === "purchased" ? store.getInt("coins") : -1;
}
```

Return `false` from the handler to keep a purchase pending (for example when your server could not redeem `purchase.token` yet). See [Consumables](guide.md#consumables) for once-only delivery.

## Subscribe and show renewal status

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";
import { describeOffer } from "CommerceKit.lspkg/Helper/SubscriptionOffers";

async function subscribe(id: string, statusText: Text): Promise<void> {
  const kit = CommerceKit.getInstance();
  const product = await kit.getProductInfo(id);
  const offers = product.nativeProduct.subscriptionOfferDetails || [];
  if (offers.length > 0) statusText.text = describeOffer(offers[0]);

  await kit.purchaseProduct(id, offers.length > 0 ? offers[0].offerId : null);

  const purchase = kit.getPurchase(id);
  if (kit.isProductOwned(id) && purchase && purchase.expiryTime) {
    const date = new Date(purchase.expiryTime).toDateString();
    statusText.text = purchase.isAutoRenewing ? `Renews ${date}` : `Active until ${date}`;
  }
}
```

Subscriptions are not simulated in Preview; test them on device.

## React to purchase changes

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

const kit = CommerceKit.getInstance();
const unsubscribe = kit.onPurchasesChanged.add(() => {
  premiumContent.enabled = kit.isProductOwned("premium_pass");
});
// later, for example in OnDestroyEvent: unsubscribe();
```

## Handle errors by code

```typescript
import { CommerceKit, CommerceKitError } from "CommerceKit.lspkg/CommerceKit";

async function tryPurchase(id: string): Promise<string> {
  try {
    await CommerceKit.getInstance().purchaseProduct(id);
    return "Done";
  } catch (error) {
    if (error instanceof CommerceKitError && error.code === Commerce.ResponseCode.NetworkError) return "You're offline";
    if (error instanceof CommerceKitError && error.code === Commerce.ResponseCode.ItemUnavailable) return "Product not found";
    return `Purchase failed: ${error.message}`;
  }
}
```
