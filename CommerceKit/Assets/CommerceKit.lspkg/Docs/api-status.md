# CommerceKit API status

[← Agent usage index](../README.md)

## Use when

Read before adapting 3.x catalog or purchase code. Facts below describe the CommerceKit 4.0.0 source that ships in this package.

## Current

| Consumer path | Surface |
|---|---|
| `CommerceKit.lspkg/CommerceKit` | `CommerceKit.getInstance`, `initialize`, `getProductInfo`, `purchaseProduct(productId, offerId?)`, `registerConsumable`, `isProductOwned`, `getPurchase`, `checkPurchaseStatus`, `refresh`, `onPurchasesChanged`, `client()`; types `PurchaseOutcome`, `PurchaseStatus`, `ConsumableDeliveryHandler`; class `CommerceKitError` |
| `CommerceKit.lspkg/ProductCatalog` | `ProductCatalog` component: `initializeOnAwake` and logging inputs, no product list |
| `CommerceKit.lspkg/Helper/CommerceProduct` | `CommerceProduct`: the 3.x fields mapped from the Lens API product, plus `nativeProduct` |
| `CommerceKit.lspkg/Helper/CommercePrice` | `CommercePrice`: decimal `price` and ISO 4217 `currency` |
| `CommerceKit.lspkg/Helper/SubscriptionOffers` | `describeOffer(offer)`, `getFreeTrialPhase(offer)` |
| `CommerceKit.lspkg/Helper/PreviewCommerceClient` | The simulated commerce service used in Lens Studio Preview (internal; selected automatically) |
| `CommerceKit.lspkg/Examples/*` | `ExampleProductPanel` base and the non-consumable, consumable and subscription panels |

## Changed in 4.0.0

- Products are defined on the Specs developer portal ([developers.specs.com/lenses](https://developers.specs.com/lenses)), not in the Lens. `ProductCatalog` has no product entries; product entries saved in existing scenes are ignored.
- Consumables (`registerConsumable`) and auto-renewing subscriptions (`purchaseProduct(productId, offerId)`, `getPurchase`) are supported.
- `purchaseProduct` resolves a `PurchaseOutcome` with `status` and `purchase` in addition to the 3.x `success` / `cancelled`, and failures reject with `CommerceKitError` instead of resolving undefined.
- `client()` resolves to the simulated client in Lens Studio Preview instead of rejecting.
- Prices and currencies come from the service; the 3.x USD-only formatter is gone.
- `CommerceProduct` and `CommercePrice` are no longer Inspector `@typedef` types.
- A listener of `onPurchasesChanged` (or any `Utils/Event` subscriber) that throws is logged with its stack and does not block the others.

## Deprecated

`initializeCatalog(productCatalog)` still works: it calls `initialize()`, never rejects (failures are logged) and ignores the products, with a warning when the list is not empty. Call `initialize()` in new code.

## Removed

- The product list of `ProductCatalog` and the USD-only price formatter.
- The demo's "missing product" panel: Preview now simulates every product ID, so the prefab shows a consumable and a subscription panel instead.

## Device-only behavior

Real product names and prices, failed and cancelled payments, unknown product IDs, subscriptions and the recovery of interrupted purchases only happen on Specs. Preview simulation does not exercise them; keep them in device QA with an authorized commerce setup.
