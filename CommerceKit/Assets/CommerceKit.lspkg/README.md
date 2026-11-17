<p align="center">
  <img src="Docs/media/CommerceKit.png" width="250px" alt="CommerceKit"/>
</p>

# CommerceKit

CommerceKit is a simplified wrapper around Lens Studio's `CommerceKitModule` for selling products inside SPECS Lenses. Products (non-consumables, consumables and subscriptions) are defined in the cloud, on the Specs developer portal at [developers.specs.com/lenses](https://developers.specs.com/lenses); your Lens only refers to them by product ID. CommerceKit connects to the commerce service, restores and finalizes purchases, and delivers consumables exactly when it is safe to. In Lens Studio Preview, where the commerce service is not available, it simulates purchases so you can build your store UI without a device.

> **Get started**: configure your product catalog on the Specs developer portal at [developers.specs.com/lenses](https://developers.specs.com/lenses), then follow the [CommerceKit get-started guide](https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started).

## Features

- **Products defined in the cloud**: names, descriptions, localized prices and subscription plans come from the Specs developer portal. Change them without republishing the Lens; no product data is stored in the Lens.
- **Three product types**: non-consumables (one-time unlocks), consumables (coins, lives, hints) and auto-renewing subscriptions with free trials and introductory prices.
- **Safe purchase lifecycle**: every completed purchase is acknowledged, because unacknowledged purchases are refunded automatically. Interrupted purchases are finalized on the next launch, and a user is never charged twice for a purchase that is still being finalized.
- **Consumable delivery**: your handler grants the item before CommerceKit consumes the purchase, and a delivered purchase is not delivered again, even across Lens sessions.
- **Subscriptions**: list offers, describe them ("Free for 1 week, then $4.99 / month") and show renewal status.
- **Works in Lens Studio Preview**: purchases are simulated without any setup.
- **Compatible with CommerceKit 3.x**: `purchaseProduct()`, `getProductInfo()` and `isProductOwned()` keep their signatures; new capabilities are new methods or optional parameters.
- **Typed API and errors**: typed product and purchase records, and a `CommerceKitError` carrying a `Commerce.ResponseCode`.

## Usage

This section ships with the package and describes the installed package. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; package-specific setup and APIs live here.

### Package identity

- Descriptor: `package.native` (package version and Lens Studio target are recorded there).
- Consumer import prefix: `CommerceKit.lspkg/`.
- Prefab entry point: `CommerceKit__PLACE_IN_SCENE.prefab`. The prefab is self-contained:
  it carries the guide panel ("Ok, I understood"), the example carousel, a `ProductCatalog` and
  three product panels (non-consumable, consumable and subscription), so dropping it into a Specs
  scene with a Camera and InteractionKit gives the full demo. You don't need it to use CommerceKit
  in your own Lens: add `ProductCatalog` (or call `CommerceKit.getInstance().initialize()`) and use
  your product IDs.
- Demo scaffolding: `CommerceKit.lspkg/Example/` holds the scripts the prefab uses
  (`ExampleCarousel/`, `GuideDismissPanel/`). They are not part of the CommerceKit API; see
  [components](Docs/components.md#demo-scaffolding-example).
- Declared companions: InteractionKit, UIKit, Utilities, SnapDecorators, Motion and Icons (see `package_dependencies.json`).

### Quick start

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

const commerceKit = CommerceKit.getInstance();
await commerceKit.initialize(); // connects, restores purchases, finalizes pending ones

const product = await commerceKit.getProductInfo("remove_ads");
priceText.text = product.nativeProduct.price.displayPrice; // "$1.99", "1,99 €", ...

if (!commerceKit.isProductOwned("remove_ads")) {
  const outcome = await commerceKit.purchaseProduct("remove_ads");
  if (outcome.success) hideAds();
}
```

Consumables need a delivery handler first (`registerConsumable()`); see the [guide](Docs/guide.md#consumables).

### Version and API status

CommerceKit 4.0.0 moves the product catalog from the Lens to the Specs developer portal and adds consumables and subscriptions. Read [API status](Docs/api-status.md) before copying 3.x recipes: `ProductCatalog` no longer lists products, and `initializeCatalog()` is deprecated.

### Applicability

Use CommerceKit for the native commerce flow. For a local experience with no payment, implement its own state instead of creating a commerce client. Preview simulation confirms UI behavior only: real names and prices, failed payments and subscriptions can only be tested on device.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first; portal products, product types and Preview rules.
- [API status](Docs/api-status.md): what changed in 4.0, deprecations and device-only behavior.
- [Components](Docs/components.md): inputs, defaults and public methods.
- [Examples](Docs/examples.md): initialization, the three product types and error handling.
- [Guide](Docs/guide.md): the full workflow, purchase lifecycle, API reference and 3.x migration.
- [Troubleshooting](Docs/troubleshooting.md): initialization, UI and transaction symptoms.

### Verification

1. Compile with the installed package's declarations and resolve every prefab input.
2. Dismiss the demo guide and step through the three panels with the carousel.
3. Non-consumable: Buy shows "Purchase successful!", then the button reads Owned.
4. Consumable: every Buy credits 100 coins through the delivery handler; it can be bought again.
5. Subscription: Preview shows "Test subscriptions on device"; subscriptions, real prices and failed payments need a device and authorized commerce QA.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->
