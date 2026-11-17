# CommerceKit guide

[← Agent usage index](../README.md)

## Use when

Read for the full CommerceKit 4.0 workflow: products defined on the Specs developer portal, the three product types, the purchase lifecycle, Preview simulation, the complete API reference and migration from 3.x. Shorter, task-focused pages: [cheat sheet](cheat-sheet.md), [components](components.md), [examples](examples.md), [troubleshooting](troubleshooting.md).

## Overview

CommerceKit is a simplified wrapper around Lens Studio's `CommerceKitModule` for selling products inside SPECS Lenses. Products (non-consumables, consumables and subscriptions) are defined in the cloud, on the Specs developer portal at [developers.specs.com/lenses](https://developers.specs.com/lenses); your Lens only refers to them by product ID. CommerceKit connects to the commerce service, restores and finalizes purchases, and delivers consumables exactly when it is safe to. In Lens Studio Preview, where the commerce service is not available, it simulates purchases so you can build your store UI without a device.

> **Get started**: configure your product catalog on the Specs developer portal at [developers.specs.com/lenses](https://developers.specs.com/lenses), then follow the [CommerceKit get-started guide](https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started).

## Features

- **Products defined in the cloud**: names, descriptions, localized prices and subscription plans come from the Specs developer portal. Change them without republishing the Lens; no product data is stored in the Lens.
- **Three product types**: non-consumables (one-time unlocks), consumables (coins, lives, hints) and auto-renewing subscriptions with free trials and introductory prices.
- **Safe purchase lifecycle**: every completed purchase is acknowledged, because unacknowledged purchases are refunded automatically. Purchases interrupted by closing the Lens are finalized on the next launch, a user is never charged again while an earlier purchase of the same product is still being finalized, and CommerceKit reconnects by itself if the commerce service restarts.
- **Consumable delivery**: your handler grants the item before CommerceKit consumes the purchase, and a delivered purchase is not delivered again, even across Lens sessions.
- **Subscriptions**: list offers, describe them ("Free for 1 week, then $4.99 / month") and show renewal status. Less common operations, such as cancelling, go through the underlying client.
- **Works in Lens Studio Preview**: purchases are simulated without any setup, as in CommerceKit 3.x.
- **Compatible with CommerceKit 3.x**: existing calls such as `purchaseProduct()`, `getProductInfo()` and `isProductOwned()` keep their signatures; new capabilities are new methods or optional parameters.
- **Typed API and errors**: typed product and purchase records, and a `CommerceKitError` carrying a `Commerce.ResponseCode`.

## Requirements

- Lens Studio 5.25 or later, targeting Specs (CommerceKit 4.0.0 ships with the Lens Studio 5.25 package set).
- A product catalog for your Lens, configured at [developers.specs.com/lenses](https://developers.specs.com/lenses).

## How It Works

```
Specs developer portal (developers.specs.com/lenses)
your products: IDs, names, prices, types, subscription offers
        |
        |  product IDs, used in your scripts
        v
CommerceKit.getInstance()  -->  CommerceKitModule (on device)
(connection, restore,           simulation (Lens Studio Preview)
 finalize, deliver)
```

Your scripts refer to products by their product IDs. On device, all product details come from the developer portal. In Lens Studio Preview, CommerceKit simulates the commerce service (see [Testing in Lens Studio Preview](#testing-in-lens-studio-preview)). The `ProductCatalog` component only starts CommerceKit when the Lens starts; products are not listed in it.

## Quick Start

1. **Create your products** for your Lens at [developers.specs.com/lenses](https://developers.specs.com/lenses) and note their product IDs.
2. **Start CommerceKit**: add the `ProductCatalog` component to a scene object (or drag `CommerceKit__PLACE_IN_SCENE.prefab` into the scene). It connects when the Lens starts; there is nothing to list in it.
3. **Sell from your scripts** using the product IDs, from `OnStartEvent` or later:

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

const commerceKit = CommerceKit.getInstance();

// Connects, restores purchases and finalizes any pending ones.
await commerceKit.initialize();

// On device, product details always come from the developer portal.
const product = await commerceKit.getProductInfo("remove_ads");
priceText.text = product.nativeProduct.price.displayPrice; // "$1.99", "1,99 €", ...

if (!commerceKit.isProductOwned("remove_ads")) {
  const outcome = await commerceKit.purchaseProduct("remove_ads");
  if (outcome.success) {
    hideAds();
  } else if (outcome.cancelled) {
    print("User closed the checkout");
  }
}
```

## Product Types

| Type | Typical use | How CommerceKit finalizes a purchase | Ownership |
|------|-------------|--------------------------------------|-----------|
| Non-consumable | Unlock a character, remove ads | Acknowledges it automatically | `isProductOwned()` is true from then on (unless refunded) |
| Consumable | Coins, lives, hints | Calls your `registerConsumable` handler, then consumes it | Never "owned"; can be bought again right away |
| Subscription | Premium tier, season pass | Acknowledges it automatically | `isProductOwned()` is true while the subscription is active |

### Non-Consumables

```typescript
const owned = commerceKit.isProductOwned("glow_up_hoodie");
unlockHoodie(owned);

commerceKit.onPurchasesChanged.add(() => {
  // Purchases restored, completed, or refunded.
  unlockHoodie(commerceKit.isProductOwned("glow_up_hoodie"));
});
```

### Consumables

A consumable must have a delivery handler before it can be sold. CommerceKit calls the handler for every completed purchase, including purchases that were interrupted when the Lens closed, and acknowledges (consumes) the purchase only after the handler completes. For each purchase the order is:

1. The checkout succeeds; the commerce service reports the purchase as Pending, not acknowledged.
2. CommerceKit calls your handler with the purchase. The handler processes `purchase.token`, for example by granting the item or by having your server redeem the token, and CommerceKit waits until it completes.
3. CommerceKit acknowledges the purchase, which consumes it.
4. `purchaseProduct()` resolves.

Process tokens only in the handler: by the time `purchaseProduct()` resolves, the purchase is consumed, and its outcome carries no purchase record for consumables. Persist whatever the handler grants:

```typescript
const store = global.persistentStorageSystem.store;

commerceKit.registerConsumable("coins_100", (purchase) => {
  store.putInt("coins", store.getInt("coins") + 100);
});

const outcome = await commerceKit.purchaseProduct("coins_100");
if (outcome.status === "purchased") {
  coinsText.text = `${store.getInt("coins")}`;
}
```

If your server processes purchases, for example to validate the token and credit the user's account, do it in the handler. Return `false` to leave the purchase for next time without acknowledging it:

```typescript
commerceKit.registerConsumable("coins_100", async (purchase) => {
  // redeemOnServer is your own code. It must be idempotent per token: CommerceKit offers the same
  // purchase again until the handler completes.
  const result = await redeemOnServer(purchase.productId, purchase.token);
  if (result.status !== "done") {
    return false; // not processed yet: keep the purchase pending, try again later
  }
  coinsText.text = `${result.balance}`;
});
```

Register handlers early, for example in `onAwake`, so purchases recovered at startup are delivered right away, and so Lens Studio Preview simulates the product as a consumable (it only does when the handler exists before the product is first used).

If the handler returns `false`, throws or rejects, the purchase stays pending and is offered to it again later: on the next `refresh()`, in the next Lens session, or on the next `purchaseProduct()` call for that product (which finalizes it instead of charging again). Throwing also logs a warning; returning `false` does not. Once the handler has completed, CommerceKit remembers the delivery in persistent storage and only retries the acknowledgement, so the handler is not called again for that purchase even if the acknowledgement fails and the Lens closes. For strict once-only delivery, also record `purchase.token` together with what you granted (or let your server deduplicate it) and ignore tokens you have already seen.

A handler must eventually return or throw. If it processes the token asynchronously, it must return that work's promise (or be `async` and `await` it): CommerceKit acknowledges the purchase as soon as the handler's result settles. It may call other CommerceKit methods, such as `refresh()`, but not `purchaseProduct()`. `Examples/ExampleConsumableController.ts` shows a complete handler.

### Subscriptions

```typescript
import { describeOffer } from "CommerceKit.lspkg/Helper/SubscriptionOffers";

const premium = await commerceKit.getProductInfo("premium_pass");
const offers = premium.nativeProduct.subscriptionOfferDetails || [];
offers.forEach((offer) => print(describeOffer(offer)));
// For example, a monthly plan with a 1-week free trial offer:
// $4.99 / month
// Free for 1 week, then $4.99 / month

const outcome = await commerceKit.purchaseProduct("premium_pass", offers[0].offerId);

const purchase = commerceKit.getPurchase("premium_pass");
if (commerceKit.isProductOwned("premium_pass") && purchase && purchase.expiryTime) {
  const date = new Date(purchase.expiryTime).toDateString();
  statusText.text = purchase.isAutoRenewing ? `Renews ${date}` : `Active until ${date}`;
}
```

Offer IDs are opaque: pass them back unchanged. Omit the offer ID to buy the product's default offer. Switching an active subscription to another plan is not supported yet.

To let users cancel, call the native `cancelSubscription()` through [`client()`](#client-promisecommerceclient), then `refresh()`. The user keeps access until `expiryTime`; the subscription then expires instead of renewing:

```typescript
const purchase = commerceKit.getPurchase("premium_pass");
if (purchase && purchase.isAutoRenewing) {
  const client = await commerceKit.client();
  const result = await client.cancelSubscription(purchase.token);
  await commerceKit.refresh(); // CommerceKit sees the change after a sync
  if (result.responseCode !== Commerce.ResponseCode.Success) {
    statusText.text = "Could not cancel, try again later";
  }
}
```

`Examples/ExampleSubscriptionController.ts` puts these steps together in one panel. Subscriptions are not simulated in Lens Studio Preview; test them on device.

## Purchase Lifecycle

You do not have to manage these steps; they explain what CommerceKit does on your behalf:

1. `purchaseProduct()` opens the system checkout. When the user pays, the commerce service reports the purchase as **Pending**.
2. CommerceKit finalizes it: a consumable is first processed by your handler and only then acknowledged, which consumes it; other purchases are acknowledged right away and become **Purchased**. If delivery or acknowledgement fails, CommerceKit syncs with the commerce service and tries once more before resolving.
3. Purchases that are never acknowledged are refunded automatically after a grace period. That is why CommerceKit also finalizes pending purchases on `initialize()` and `refresh()`, after every checkout, and when a consumable handler is registered.
4. If a purchase still cannot be finalized, for example because the device went offline, `purchaseProduct()` resolves with status `"pending"`. The payment went through; the purchase is finalized automatically later, and buying the same product again finalizes it instead of charging again.
5. If the checkout result never reaches the Lens (for example because the commerce service restarted), CommerceKit completes the purchase as soon as a sync such as `refresh()` finds it. On Lens runtimes that provide `setTimeout`, it stops waiting after 10 minutes and rejects with `Error`; the purchase is still finalized if it shows up later.
6. If the commerce service restarts, CommerceKit reconnects with a new connection on the next request and retries it once.

## Testing in Lens Studio Preview

Lens Studio has no commerce service, so `CommerceKitModule` cannot connect in Preview. CommerceKit simulates the service there, without any setup, so your store UI keeps working in the editor:

- Every product ID your scripts use is a product named after its ID that costs $0.99. It is a consumable if a `registerConsumable()` handler was registered for it before its first use, otherwise a non-consumable. The Logger says so once per product.
- Every checkout succeeds right away. Non-consumables become owned; consumables go through your handler, are consumed and can be bought again.
- Simulated purchases last until Preview restarts.
- `client()` resolves to the simulated client. It does not simulate subscriptions: `cancelSubscription()` resolves with `ItemNotOwned` and `updateSubscription()` with `Error`.

Real names and prices, cancelled and failed payments, unknown product IDs and subscriptions can only be tested on device.

## API Reference

All methods are on the singleton returned by `CommerceKit.getInstance()`. Methods that need the commerce service connect on first use, so calling `initialize()` first is optional, but it is the best place to handle connection errors. Errors are `CommerceKitError` instances; see [Errors](#errors).

### At a Glance

| Member | Since | Purpose | Native `Commerce.Client` calls |
|--------|-------|---------|--------------------------------|
| `CommerceKit.getInstance()` | 3.x | The shared instance. | None until first use. |
| `initialize()` | New | Connect, restore purchases, finalize pending ones. | `CommerceKitModule.createClient()`, `startConnection()`, `queryPurchase()` per product type, `acknowledgePurchase()` |
| `getProductInfo(productId)` | 3.x | Details of one product. | `queryProductDetails()`, once per product |
| `purchaseProduct(productId, offerId?)` | 3.x; `offerId` is new | Buy a product and finalize the purchase. | `launchPurchaseFlow()`, the `onPurchasesUpdated` callback, `queryPurchase()`, `acknowledgePurchase()` |
| `registerConsumable(productId, deliver)` | New | Deliver consumables before they are consumed. | None: it decides when CommerceKit calls `acknowledgePurchase()` |
| `isProductOwned(productId)` | 3.x | Owned non-consumable or active subscription. | None: reads the last sync |
| `getPurchase(productId)` | New | The purchase record: state, token, renewal. | None: reads the last sync |
| `checkPurchaseStatus(productId)` | 3.x | Sync, then the purchase state. | Like `refresh()` |
| `refresh()` | New | Sync and finalize pending purchases. | `queryPurchase()` per product type, `acknowledgePurchase()` |
| `onPurchasesChanged` | New | Event fired when purchases change. | None |
| `client()` | 3.x | The underlying client, for everything else. | Returns it |
| `initializeCatalog(productCatalog)` | 3.x, deprecated | Same as `initialize()`; the products are ignored. | Like `initialize()` |

### `CommerceKit.getInstance(): CommerceKit`

Returns the shared instance. Do not create commerce clients with `CommerceKitModule.createClient()` alongside it: a Lens can hold only one connection to the commerce service.

### `initialize(): Promise<void>`

Connects to the commerce service, restores the user's purchases and finalizes purchases left pending by an earlier session. Safe to call many times and from many scripts: concurrent calls share one attempt, and after a failure the next call tries again.

- **Resolves** when purchases are restored and pending non-consumables and subscriptions are acknowledged. Recovered consumables are delivered in the background, as soon as their handler is registered.
- **Errors**: `NetworkError`, `ServiceUnavailable`, `ServiceDisconnected` or `Error` when the service cannot be reached.
- **Native calls**: `CommerceKitModule.createClient(new Commerce.ClientOptions(onPurchasesUpdated))` once, `startConnection()`, `queryPurchase()` for each product type, and `acknowledgePurchase()` for each pending purchase.

```typescript
try {
  await commerceKit.initialize();
} catch (error) {
  storeText.text = "Store unavailable, try again later";
}
```

### `getProductInfo(productId: string): Promise<CommerceProduct>`

Fetches the details of one product defined on the developer portal. Results are cached for the session.

- **Resolves** with a `CommerceProduct`: the CommerceKit 3.x fields, mapped from the Lens API product, and that product itself as `nativeProduct`:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | `string` | Product ID. |
| `type` | `string` | `"NonConsumable"`, `"Consumable"`, `"Subscription"` or `"Unknown"`. |
| `displayName`, `description` | `string` | Shown to users. |
| `price.price` | `number` | Amount in major units, for example `1.99` (as in 3.x). |
| `price.currency` | `string` | ISO 4217 code, for example `"USD"`. |
| `iconUri`, `extras` | `string` | Icon URI and custom metadata, or empty strings. |
| `nativeProduct` | `Commerce.Product` | New: the product as returned by the Lens API, with everything it provides: `price.displayPrice` (the price formatted for the user, for example `"$1.99"`; use it to show prices), `price.price` in the smallest currency unit, `type` as a `Commerce.ProductType`, and for subscriptions `subscriptionOfferDetails`, the offers that can be bought. |

- **Errors**: `ItemUnavailable` when the Lens has no product with this ID (or it is not published), or a connection error.
- **Native calls**: `queryProductDetails([productId])`, once per product per session.

### `purchaseProduct(productId: string, offerId?: string | null): Promise<PurchaseOutcome>`

Buys a product: opens the system checkout and resolves once the purchase is complete and finalized. Calling it again for the same product while a purchase is in progress returns the same promise; the second call's `offerId` is ignored.

| Parameter | Type | Meaning |
|-----------|------|---------|
| `productId` | `string` | Product ID from the developer portal. |
| `offerId` | `string \| null` (optional) | Subscriptions only: `offerId` of one of `product.nativeProduct.subscriptionOfferDetails`. Omit it to buy the default offer. Ignored, with a warning, for other product types. |

**Resolves** with a `PurchaseOutcome`:

| Field | Type | Meaning |
|-------|------|---------|
| `status` | `"purchased" \| "alreadyOwned" \| "cancelled" \| "pending"` | `purchased`: completed and delivered or activated. `alreadyOwned`: the user already owns the non-consumable or has an active subscription; nothing was charged. `cancelled`: the user closed the checkout. `pending`: paid, but not finalized yet; finalized automatically later (see [Purchase Lifecycle](#purchase-lifecycle)). |
| `success` | `boolean` | `true` for `purchased` and `alreadyOwned`. |
| `cancelled` | `boolean` | `true` for `cancelled`. |
| `purchase` | `Commerce.Purchase \| null` | The purchase record, when one is involved: `token`, `productId`, `purchaseState`, `isAcknowledged`, `isAutoRenewing`, `expiryTime`. Always `null` for consumables: their purchase only goes to the `registerConsumable` handler, before it is acknowledged. |

**Errors** (in every case but the last, nothing was charged):
- `ItemUnavailable`: unknown product or offer, or a product without a valid type on the developer portal.
- `Error`: a consumable without a `registerConsumable` handler. This is checked before checkout opens.
- The code reported when checkout fails: usually `Error`, or for example `PaymentUnavailable` or `NetworkError`.
- `ServiceDisconnected`: the commerce session was lost while starting the checkout. CommerceKit does not retry the launch, because the first attempt may have reached the service; the next call reconnects.
- `Error` after 10 minutes without a checkout result (see [Purchase Lifecycle](#purchase-lifecycle)). This is the only case where the user may have paid; the purchase is finalized if it shows up later.

Cancelling is not an error; check `outcome.cancelled`.

**Native calls**: `launchPurchaseFlow(productId, offerId)`; once the result arrives through the `onPurchasesUpdated` callback, `queryPurchase()` and `acknowledgePurchase(token)`. The product's details are loaded first with `queryProductDetails()` if they are not cached.

```typescript
try {
  const outcome = await commerceKit.purchaseProduct("glow_up_hoodie");
  switch (outcome.status) {
    case "purchased":
    case "alreadyOwned":
      unlockHoodie(true);
      break;
    case "pending":
      statusText.text = "Payment received, finishing up...";
      break;
    case "cancelled":
      break;
  }
} catch (error) {
  statusText.text = `Purchase failed: ${error.message}`;
}
```

### `registerConsumable(productId: string, deliver: ConsumableDeliveryHandler): () => void`

Registers how a consumable is delivered. Required before the consumable can be sold.

- **`deliver`**: `(purchase: Commerce.Purchase) => boolean | void | Promise<boolean | void>`. Processes the purchase, for example by granting the item or having your server redeem `purchase.token`. CommerceKit calls it for every completed purchase, including purchases recovered after the Lens closed mid-purchase, and acknowledges (consumes) the purchase only after it completes. Return `false` to leave the purchase pending for next time; throwing or rejecting does the same and logs a warning. It must eventually settle, and must not call `purchaseProduct()`.
- **Returns** a function that removes the handler. Registering again replaces the handler.
- **Errors**: throws `CommerceKitError` (`Error`) when the product ID is empty or `deliver` is not a function.
- **Native calls**: none. The native API consumes a consumable when it is acknowledged; the handler decides when CommerceKit calls `acknowledgePurchase(token)`.

### `isProductOwned(productId: string): boolean`

Whether the user currently owns a non-consumable or has an active subscription. Consumables are never owned. Reads the state of the last sync without network access; `false` until `initialize()` completes.

### `getPurchase(productId: string): Commerce.Purchase | null`

The user's most relevant purchase record of a product, from the last sync, or `null`. Reads it without network access.

| Field | Meaning |
|-------|---------|
| `purchaseState` | `Pending` (paid, not finalized yet), `Purchased` (owned, or subscription active), `Expired` (subscription ended) or `Invalidated` (refunded or revoked). Consumed consumables have no record. |
| `token` | Identifies the purchase, for example for native calls through `client()`. |
| `isAutoRenewing` | Subscriptions: `false` once cancelled. |
| `expiryTime` | Subscriptions: end of the current billing period, in milliseconds since the Unix epoch. |
| `purchaseTime` | Not reported by the commerce service yet: always `0`. |

When a cancelled subscription's paid period ends, `isProductOwned()` becomes `false` right away, while the record keeps saying `Purchased` until a sync reports `Expired`.

### `checkPurchaseStatus(productId: string): Promise<Commerce.PurchaseState>`

Syncs with the commerce service, then returns the state of the user's most relevant purchase of the product:

| State | Meaning |
|-------|---------|
| `Purchased` | Owned, or subscription active. |
| `Pending` | Paid but not finalized yet. |
| `Expired` | The subscription ended without renewing. |
| `Invalidated` | Refunded or revoked. |
| `Unset` | Never bought, or a consumable that was already consumed. |

- **Errors**: connection errors.
- **Native calls**: like `refresh()`.

### `refresh(): Promise<void>`

Syncs purchases with the commerce service, for example after the Lens resumes or after a change made through `client()`, and finalizes any pending ones. Like `initialize()`, it waits for non-consumables and subscriptions to be acknowledged and delivers consumables in the background. Calls `initialize()` when needed.

- **Errors**: connection errors.
- **Native calls**: `queryPurchase()` for each product type, and `acknowledgePurchase()` for each pending purchase.

### `onPurchasesChanged`

Event fired whenever the known purchases change: purchases restored, a purchase completed or finalized, or a sync that finds a change such as an expired or cancelled subscription or a refunded purchase. Read the new state with `isProductOwned()` or `getPurchase()`. A listener that throws is logged and does not affect the others.

```typescript
const unsubscribe = commerceKit.onPurchasesChanged.add(() => this.updateStoreUI());
// later, for example in OnDestroyEvent:
unsubscribe();
```

### `client(): Promise<Commerce.Client>`

The underlying commerce client, for less common operations that CommerceKit does not wrap, such as cancelling a subscription (see [Subscriptions](#subscriptions)). It resolves once CommerceKit is initialized, and is the same client CommerceKit uses, so:

- Purchase updates still flow through CommerceKit, which finalizes them (consumables through their registered handler).
- CommerceKit does not see changes you make directly through the client until it syncs. Call `refresh()` afterwards.
- Do not call `startConnection()`, `endConnection()` or `acknowledgePurchase()` yourself: CommerceKit manages the connection and acknowledges purchases.

In Lens Studio Preview it is the simulated client (see [Testing in Lens Studio Preview](#testing-in-lens-studio-preview)).

```typescript
const client = await commerceKit.client();
const history = await client.queryPurchaseHistory();
```

### `initializeCatalog(productCatalog: readonly unknown[]): Promise<void>` (deprecated)

Kept so CommerceKit 3.x code keeps working. It calls `initialize()` and, as in 3.x, never rejects: failures are logged. Products are no longer defined in the Lens, so `productCatalog` is ignored, with a warning when it is not empty. New code should call `initialize()`.

### Errors

Every failure is a `CommerceKitError` (exported from `CommerceKit.lspkg/CommerceKit`):

| Field | Type | Meaning |
|-------|------|---------|
| `code` | `Commerce.ResponseCode` | What went wrong. |
| `message` | `string` | Developer-facing description. |
| `debugMessage` | `string` | Raw detail from the commerce service, when available. |

Common codes: `ItemUnavailable` (no such product or offer), `PaymentUnavailable` (payment failed), `NetworkError` (offline), `ServiceUnavailable` (commerce service down; try again later), `ServiceDisconnected` (the session was lost and reconnecting failed; try again later), and `Error` (anything else, including most failed checkouts).

```typescript
import { CommerceKitError } from "CommerceKit.lspkg/CommerceKit";

try {
  await commerceKit.purchaseProduct("coins_100");
} catch (error) {
  if (error instanceof CommerceKitError && error.code === Commerce.ResponseCode.NetworkError) {
    statusText.text = "You're offline";
  }
}
```

### Subscription Helpers

`CommerceKit.lspkg/Helper/SubscriptionOffers` turns offers into English labels:

| Function | Returns |
|----------|---------|
| `describeOffer(offer)` | All pricing phases in order, with the service's `displayPrice`: `"Free for 1 week, then $4.99 / month"`, `"$4.99 / month for 3 months, then $9.99 / month"`. |
| `getFreeTrialPhase(offer)` | The offer's free trial phase, or `null`. |

### ProductCatalog Component

Starts CommerceKit when the Lens starts. Products are not listed here: its inspector links to [developers.specs.com/lenses](https://developers.specs.com/lenses), where products are defined.

| Input | Meaning |
|-------|---------|
| Initialize On Awake | Connect and restore purchases when the Lens starts (default). When off, CommerceKit connects on first use. |
| Enable Logging, Enable Logging Lifecycle | Logs of this component. CommerceKit itself always logs connection, checkout and finalization events, and warnings. |

## Migrating from CommerceKit 3.x

Products moved from the Lens to the cloud, and consumables and subscriptions were added:

| CommerceKit 3.x | Now |
|-----------------|-----|
| `ProductCatalog` defined products (prices, names) inside the Lens | Products are defined only on the Specs developer portal ([developers.specs.com/lenses](https://developers.specs.com/lenses)); scripts use their product IDs. `ProductCatalog` has no product entries anymore, and entries saved in existing scenes are ignored: create the same products on the portal. |
| `initializeCatalog(products)` | Still works, but deprecated: it just calls `initialize()` and ignores the products. Call `initialize()` in new code. |
| `getProductInfo(id)` | Unchanged signature and fields (`price.price` is still a decimal amount); `type` can also be `"Consumable"` or `"Subscription"`. New: `nativeProduct`, the Lens API product, with the formatted `price.displayPrice` and `subscriptionOfferDetails`. `CommerceProduct` and `CommercePrice` are no longer Inspector types (`@typedef`), since products are not listed in the Lens anymore. |
| `purchaseProduct(id)` resolved `{ success, cancelled? }`, non-consumables only | Same call and fields, plus `status`, `purchase` and an optional `offerId` for subscriptions. Consumables need `registerConsumable()` first. Failures reject with `CommerceKitError`. |
| `isProductOwned(id)`, `checkPurchaseStatus(id)` | Unchanged. `isProductOwned` also covers active subscriptions. New: `getPurchase()`, `onPurchasesChanged`. |
| `client()` | Unchanged. In Lens Studio Preview it now resolves to the simulated client instead of rejecting. |
| Prices limited to USD | Prices and currencies come from the portal. |
| In the editor, buying a product from the list succeeded at once; other IDs failed | In Lens Studio Preview, buying any product ID succeeds at once, at $0.99. Products with a `registerConsumable()` handler are simulated as consumables. |

## Script Highlights

- **CommerceKit.ts**: the singleton. Owns the connection, restores purchases, finalizes them (delivery, acknowledgement, retries, recovery), tracks ownership and subscription state, and exposes the API above and `CommerceKitError`.
- **ProductCatalog.ts**: scene component that starts CommerceKit. Its inspector points to the developer portal, where products are defined.
- **Helper/CommerceProduct.ts**, **Helper/CommercePrice.ts**: the result of `getProductInfo()`: the CommerceKit 3.x fields mapped from the Lens API product, which is kept as `nativeProduct`.
- **Helper/PreviewCommerceClient.ts**: the simulated commerce service used in Lens Studio Preview.
- **Helper/SubscriptionOffers.ts**: `describeOffer()` and `getFreeTrialPhase()`.
- **Utils/Event.ts**: event type behind `onPurchasesChanged`.
- **Examples/ExampleProductPanel.ts**: base class of the example panels. It holds what they share (UI inputs, connecting, loading the product, the busy button, re-rendering on `onPurchasesChanged`, error messages); a subclass only implements `prepare()`, `describe()` and `runAction()` for its product type.
- **Examples/ExamplePurchaseController.ts**: panel for a non-consumable: bought once with `purchaseProduct()`, owned from then on (`isProductOwned()`).
- **Examples/ExampleConsumableController.ts**: panel for a consumable: registers a delivery handler with `registerConsumable()` in `onAwake`, processes each purchase token in it (a stand-in for your server that credits coins once per token and saves the balance), and returns `false` when a token cannot be processed yet, so CommerceKit acknowledges (consumes) a purchase only once it has been processed.
- **Examples/ExampleSubscriptionController.ts**: panel for a subscription: shows an offer with `describeOffer()`, subscribes with `purchaseProduct(productId, offerId)`, shows the renewal status from `getPurchase()` and cancels through `client()`.
- **CommerceKit__PLACE_IN_SCENE.prefab**: the self-contained demo: a guide panel ("Ok, I understood"), the example carousel, a `ProductCatalog` and three panels: a non-consumable (`glow_up_hoodie`), a consumable (`coins_100`) and a subscription (`premium_pass`). The first two work in Lens Studio Preview as they are; the subscription panel needs a device, because Preview does not simulate subscriptions. On device, replace the IDs with your own product IDs from the developer portal.
- **Example/ExampleCarousel/**, **Example/GuideDismissPanel/**: demo scaffolding used by the prefab (the carousel and the guide). Not part of the CommerceKit API; see [components](components.md#demo-scaffolding-example).

## Troubleshooting

- **"Product not found" / `ItemUnavailable`**: the product ID does not match a product of your Lens at [developers.specs.com/lenses](https://developers.specs.com/lenses), or the product is not published.
- **A purchase stays pending**: look for a CommerceKit warning in the Logger. Usually a consumable has no `registerConsumable` handler, or the handler throws. Pending purchases are finalized on the next `refresh()`, Lens launch or purchase attempt.
- **A purchase takes very long to resolve**: its checkout result may have been lost. Call `refresh()`, for example when the Lens resumes; CommerceKit then completes the purchase from the inventory.
- **"Session already started or connecting"**: another script created its own client with `CommerceKitModule.createClient()`. Use `CommerceKit.getInstance()` (or `client()`) everywhere instead.
- **Preview shows the product ID and $0.99 instead of the real name and price**: expected. Preview simulates every product; the device uses the developer portal.
- **A consumable behaves like a non-consumable in Preview**: register its handler with `registerConsumable()` before the product is first used, for example in `onAwake`.

## Documentation

For complete documentation and integration guides, visit the [CommerceKit documentation](https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started).
