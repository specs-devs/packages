# Commerce Kit

## What it is
A package you drop into a Specs project to sell non-consumable in-Lens products. It manages a product catalog, the
purchase flow and cached ownership behind one singleton, and ships an example purchase panel built with UI Kit. It is
for developers adding paid unlocks to a Lens; the commerce service is labelled Closed Beta in the `ProductCatalog`
Inspector, which links to its access requirements.

## What it does
1. Add a `ProductCatalog` component (or the place-in-scene prefab) and configure `CommerceProduct` entries: unique `id`,
   `NonConsumable` type, display name, decimal USD `CommercePrice` and optional icon URI / JSON extras.
2. On awake, `ProductCatalog` calls `CommerceKit.getInstance().initializeCatalog(...)`, which validates and rounds
   prices and sends integer cents to the device commerce client. A nonempty catalog is not replaced by later calls.
3. Your UI calls `getProductInfo`, `isProductOwned` (cached state), `checkPurchaseStatus` (device purchase history) and
   `purchaseProduct(id)` to launch the purchase flow; successful purchases are acknowledged and cached as owned.
4. In Lens Studio an in-memory mock path is used instead: `client()` rejects on purpose, known products are marked
   Purchased locally, and ownership resets with the Lens session.
5. `ExamplePurchaseController` fills a panel's name, price and status texts, binds the UI Kit button's `onTriggerUp`,
   guards repeat presses and disables the button once the product is owned.

## Highlights
- Singleton access (`CommerceKit.getInstance()`) to catalog, product info and ownership; no SceneObject required.
- Prices are authored in decimal USD (`1.99`, not `199`); other currencies throw.
- Editor mock purchases let you test the UI flow without a payment.
- The demo prefab shows a valid product (`glow_up_hoodie`) and an intentionally missing one (`suss_purchase`) to
  exercise both paths.
- No public purchase events: handle the returned promises and guard a possibly undefined purchase result.

## Core scripts
| Script | What it does |
|---|---|
| `CommerceKit.ts` | Singleton: catalog initialization, native client, purchase flow, ownership and status queries. |
| `ProductCatalog.ts` | Component holding the product list; initializes the catalog on awake. |
| `Helper/CommerceProduct.ts` | Typedef for a catalog product (id, type, name, description, price, icon, extras). |
| `Helper/CommercePrice.ts` | Typedef for a decimal price and currency (USD). |
| `Examples/ExamplePurchaseController.ts` | Purchase panel: shows product details, runs the purchase and updates status. |
| `Utils/Singleton.ts` | Singleton decorator used by `CommerceKit`. |
| `Utils/Event.ts` | Generic typed callback helper (not a commerce event API). |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities, SnapDecorators, Motion, Icons. Real purchases, cancellation, history
  and acknowledgement only happen on Specs and need authorized commerce QA; the Lens Studio Preview runs the mock
  path only. Device acknowledgement gaps are listed in api-status.md.
- **Get started:** `CommerceKit__PLACE_IN_SCENE.prefab` (guide, example carousel, product catalog and two purchase
  panels). In your own Lens you only need `ProductCatalog` plus your own controller calling `CommerceKit`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - catalog, price units and mock rules, read first.
  - [components.md](components.md) - inputs, defaults and public methods.
  - [examples.md](examples.md) - product queries and guarded purchase calls.
  - [guide.md](guide.md) - catalog, multi-product and ownership workflows.
  - [api-status.md](api-status.md) - service status, compatibility and known device gaps.
  - [troubleshooting.md](troubleshooting.md) - initialization, UI and transaction symptoms.
