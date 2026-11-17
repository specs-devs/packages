# Commerce Kit

## What it is
A package you drop into a Specs project to sell in-Lens products: non-consumables, consumables and auto-renewing
subscriptions. Products are defined on the Specs developer portal
([developers.specs.com/lenses](https://developers.specs.com/lenses)); the Lens refers to them by product ID. One
singleton owns the connection to the commerce service, restores and finalizes purchases and delivers consumables, and
the package ships three example panels built with UI Kit.

## What it does
1. Create your products on the developer portal and note their IDs.
2. Add a `ProductCatalog` component (or the place-in-scene prefab): on awake it calls
   `CommerceKit.getInstance().initialize()`, which connects, restores purchases and finalizes pending ones.
3. Your UI calls `getProductInfo` (portal details, localized `nativeProduct.price.displayPrice`), `purchaseProduct(id,
   offerId?)`, `isProductOwned`, `getPurchase` and listens to `onPurchasesChanged`.
4. Consumables are granted in a `registerConsumable` handler before CommerceKit consumes them; every other completed
   purchase is acknowledged automatically, so it is not refunded.
5. In Lens Studio Preview the commerce service is simulated: every product ID is a $0.99 product, checkouts succeed at
   once, subscriptions are not simulated.

## Highlights
- Products, prices and subscription plans live in the cloud: change them without republishing the Lens.
- Safe lifecycle: interrupted purchases are finalized on the next launch, and nobody is charged twice.
- 3.x calls keep their signatures; `initializeCatalog` is deprecated and the in-Lens product list is gone.
- Failures reject with a typed `CommerceKitError` carrying a `Commerce.ResponseCode`.
- The demo prefab shows a non-consumable (`glow_up_hoodie`), a consumable (`coins_100`) and a subscription
  (`premium_pass`).

## Core scripts
| Script | What it does |
|---|---|
| `CommerceKit.ts` | Singleton: connection, restore, purchase, delivery, acknowledgement, recovery, ownership and subscription state; `CommerceKitError`. |
| `ProductCatalog.ts` | Component that starts CommerceKit on awake; links to the developer portal. |
| `Helper/CommerceProduct.ts`, `Helper/CommercePrice.ts` | Result of `getProductInfo()`: 3.x fields plus `nativeProduct`. |
| `Helper/SubscriptionOffers.ts` | `describeOffer()` and `getFreeTrialPhase()`. |
| `Helper/PreviewCommerceClient.ts` | The simulated commerce service used in Lens Studio Preview. |
| `Examples/ExampleProductPanel.ts` | Base class of the example panels. |
| `Examples/ExamplePurchaseController.ts`, `ExampleConsumableController.ts`, `ExampleSubscriptionController.ts` | The non-consumable, consumable and subscription panels. |
| `Utils/Singleton.ts`, `Utils/Event.ts` | Singleton decorator and the typed event behind `onPurchasesChanged`. |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities, SnapDecorators, Motion, Icons, and a product catalog on the developer
  portal. Real purchases, failed payments and subscriptions only happen on Specs and need authorized commerce QA.
- **Get started:** `CommerceKit__PLACE_IN_SCENE.prefab` (guide, example carousel, product catalog and three product
  panels). In your own Lens you only need `ProductCatalog` plus your own UI calling `CommerceKit`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - portal products, product types and Preview rules, read first.
  - [components.md](components.md) - inputs, defaults and public methods.
  - [examples.md](examples.md) - the three product types, events and errors.
  - [guide.md](guide.md) - full workflow, purchase lifecycle, API reference and 3.x migration.
  - [api-status.md](api-status.md) - what changed in 4.0, deprecations and device-only behavior.
  - [troubleshooting.md](troubleshooting.md) - initialization, UI and transaction symptoms.
