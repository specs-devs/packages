# CommerceKit components

[← Agent usage index](../README.md)

## Use when

Read for exact import paths, inputs, defaults and signatures in this revision.

## CommerceKit

Import `CommerceKit.lspkg/CommerceKit`. Plain singleton class, not a SceneObject component.

| Method | Return / behavior |
|---|---|
| `static getInstance()` | Shared CommerceKit |
| `initializeCatalog(productCatalog: CommerceProduct[])` | Async initialization; validates prices, builds native client; ignores later initialization when local catalog nonempty |
| `client(): Promise<Commerce.Client>` | Initialized device client; deliberately rejects in editor mock mode |
| `purchaseProduct(productId: string)` | Declared `Promise<{success: boolean; cancelled?: boolean}>`; editor marks known product purchased; device error catch can return undefined |
| `isProductOwned(productId: string): boolean` | Cached Purchased state |
| `getProductInfo(productId: string): Promise<CommerceProduct>` | Local catalog in editor (unknown id can return undefined); device product details with cents converted to decimal |
| `checkPurchaseStatus(productId: string): Promise<Commerce.PurchaseState>` | Local mock state in editor; device history query; absent item Unset |

No public product-added or purchase-completed event is exported. Handle the returned promises; `onPurchasesUpdated` and its handlers are private.

## ProductCatalog

Import `CommerceKit.lspkg/ProductCatalog`; `@component`. Awake calls `initializeCatalog`.

| Input | Type | Default |
|---|---|---|
| `productCatalog` | readonly CommerceProduct[] | No source initializer; configure it in Inspector |
| `enableLogging` | boolean | false |
| `enableLoggingLifecycle` | boolean | false |

## CommerceProduct

Import `CommerceKit.lspkg/Helper/CommerceProduct`; `@typedef` class.

| Input | Type | Default / meaning |
|---|---|---|
| `id` | string | Required unique catalog identifier; no initializer |
| `type` | string | NonConsumable; only combo-box choice |
| `displayName` | string | Display title; no initializer |
| `description` | string | Inspector label Category; no initializer |
| `price` | CommercePrice | Configure amount/currency; no initializer |
| `iconUri` | string | Optional URI; no initializer |
| `extras` | string | Optional JSON metadata; no initializer |

## CommercePrice

Import `CommerceKit.lspkg/Helper/CommercePrice`; `@typedef` class.

| Input | Type | Default / constraints |
|---|---|---|
| `price` | number (`float`) | 1.99; Inspector SpinBox 1.99–99.99, step .01; code rounds to 2 decimals and rejects negative values |
| `currency` | string | USD, only supported formatter and Inspector choice |

The class has no display/format/conversion methods. Those operations happen inside CommerceKit.

## ExamplePurchaseController

Import `CommerceKit.lspkg/Examples/ExamplePurchaseController`; `@component`.

| Input | Type | Default |
|---|---|---|
| `productId` | string | premium_upgrade |
| `purchaseButton` | UIKit BaseButton | Configure component reference |
| `nameText`, `priceText`, `statusText` | Text | Configure component references |
| `enableLogging`, `enableLoggingLifecycle` | boolean | false |

On start, registers trigger-up and fills UI from the product catalog. It awaits `client()` only on device, catches initialization failures and disables unavailable purchase controls. Pressing Purchase checks cached ownership, guards concurrent presses and updates status. Successful purchase disables the button, preventing a repeat submission. `enablePremiumFeatures` is a private example that prints a message; wire real entitlement behavior in your own controller. Other methods are private.

## Utilities and prefab

`Utils/Singleton` supplies the decorator used by CommerceKit. `Utils/Event` supplies a general typed callback helper; it is not a commerce transaction event API and CommerceKit exposes no events built on it.

| Export (`CommerceKit.lspkg/Utils/Event`) | Signature / behavior |
|---|---|
| `default class Event<Arg = void>` | `constructor(...callbacks)`; undefined callbacks are dropped |
| `add(handler: callback<Arg>): unsubscribe` | Registers a handler; returns a function that removes it |
| `remove(handler: callback<Arg>): void` | Removes the handler |
| `invoke(arg: Arg): void` | Calls every handler in registration order |
| `publicApi(): PublicApi<Arg>` | Callable object (`api(cb)` = `add`) with `add` / `remove` but no `invoke` |
| `type callback<Arg>`, `type unsubscribe`, `interface PublicApi<Arg>` | Helper types |

`CommerceKit__PLACE_IN_SCENE.prefab` is the self-contained demo. Its root `CommerceKit__PLACE_IN_SCENE` holds, in order: `Guide`, `ExampleCarousel`, `ProductCatalog` (catalog: `glow_up_hoodie`, Glow Up Hoodie, 1.99 USD) and two purchase panels, `Missing Product` (`productId` `suss_purchase`, intentionally absent from the catalog) and `Valid Product` (`productId` `glow_up_hoodie`). Each panel has an `ExamplePurchaseController` and a UIKit `Frame` with a `PurchaseUI` child (name/price/status Texts and a `RectangleButton`). Both panels sit at y −27, z −100; the carousel shows one at a time. You don't need the prefab to use CommerceKit in your own Lens.

## Demo scaffolding (`Example/`)

These scripts ship in `CommerceKit.lspkg/Example/` and are wired inside `CommerceKit__PLACE_IN_SCENE.prefab`. They only present the example; they are not part of the CommerceKit API. Both import SpectaclesUIKit and SpectaclesInteractionKit.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel, Missing Product and Valid Product); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here Valid Product, then Missing Product), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here: the carousel steps through `examples`), `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the example info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` (10 here) |

Keep the Guide above the examples in the hierarchy: it hides its targets in `onAwake`. `ProductCatalog` stays out of `hideUntilDismissed` so the catalog initializes at start.
