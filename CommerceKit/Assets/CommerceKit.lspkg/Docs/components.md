# CommerceKit components

[← Agent usage index](../README.md)

## Use when

Read for exact import paths, inputs, defaults and signatures in this revision. The full behavior of every method is in the [guide](guide.md#api-reference).

## CommerceKit

Import `CommerceKit.lspkg/CommerceKit`. Plain singleton class, not a SceneObject component.

| Member | Return / behavior |
|---|---|
| `static getInstance()` | Shared CommerceKit. Do not create another client with `CommerceKitModule.createClient()`. |
| `initialize(): Promise<void>` | Connect, restore purchases, finalize pending ones. Concurrent calls share one attempt; a failed attempt is retried by the next call. |
| `getProductInfo(productId): Promise<CommerceProduct>` | Product defined on the developer portal, cached for the session. Rejects `ItemUnavailable` for an unknown or unpublished ID. |
| `purchaseProduct(productId, offerId?): Promise<PurchaseOutcome>` | Opens checkout and resolves once the purchase is finalized. `offerId` only for subscriptions. A second call for the same product while one is running returns the same promise. |
| `registerConsumable(productId, deliver): () => void` | Delivery handler for a consumable; required before selling it. Returns an unregister function. |
| `isProductOwned(productId): boolean` | Owned non-consumable or active subscription, from the last sync. |
| `getPurchase(productId): Commerce.Purchase \| null` | Most relevant purchase record from the last sync (state, token, renewal, expiry). |
| `checkPurchaseStatus(productId): Promise<Commerce.PurchaseState>` | Sync, then the purchase state (`Unset` if never bought or already consumed). |
| `refresh(): Promise<void>` | Sync purchases and finalize pending ones, e.g. when the Lens resumes or after a native call. |
| `onPurchasesChanged` | Event (`add(handler)` returns an unsubscribe function). Fires on restore, completed/finalized purchases, refunds and subscription changes. |
| `client(): Promise<Commerce.Client>` | The same client CommerceKit uses (the simulated one in Preview). Do not call `startConnection`, `endConnection` or `acknowledgePurchase` on it. |
| `initializeCatalog(productCatalog)` | Deprecated 3.x entry point: calls `initialize()`, never rejects, ignores the products. |

| Type | Shape |
|---|---|
| `PurchaseOutcome` | `{ status: "purchased" \| "alreadyOwned" \| "cancelled" \| "pending"; success: boolean; cancelled: boolean; purchase: Commerce.Purchase \| null }` (`purchase` is always null for consumables) |
| `ConsumableDeliveryHandler` | `(purchase: Commerce.Purchase) => boolean \| void \| Promise<boolean \| void>`; return `false` to keep the purchase pending |
| `CommerceKitError` | `Error` with `code: Commerce.ResponseCode`, `message`, `debugMessage` |

## ProductCatalog

Import `CommerceKit.lspkg/ProductCatalog`; `@component`. Starts CommerceKit; products are not listed here (its Inspector links to the developer portal).

| Input | Type | Default |
|---|---|---|
| `initializeOnAwake` | boolean | true: connect and restore purchases on awake. Off: CommerceKit connects on first use. |
| `enableLogging` | boolean | false |
| `enableLoggingLifecycle` | boolean | false |

Connection failures on awake are always printed, even with logging off.

## CommerceProduct and CommercePrice

Import `CommerceKit.lspkg/Helper/CommerceProduct` / `CommerceKit.lspkg/Helper/CommercePrice`. Plain classes returned by `getProductInfo()`; no longer Inspector types.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Product ID |
| `type` | string | `NonConsumable`, `Consumable`, `Subscription` or `Unknown` |
| `displayName`, `description` | string | From the developer portal |
| `price.price` | number | Decimal amount in major units (as in 3.x) |
| `price.currency` | string | ISO 4217 code |
| `iconUri`, `extras` | string | Or empty strings |
| `nativeProduct` | Commerce.Product | The Lens API product: `price.displayPrice` (show this), `type`, `subscriptionOfferDetails` |

## SubscriptionOffers

Import `CommerceKit.lspkg/Helper/SubscriptionOffers`.

| Function | Returns |
|---|---|
| `describeOffer(offer)` | English label of all pricing phases, e.g. `"Free for 1 week, then $4.99 / month"` |
| `getFreeTrialPhase(offer)` | The free trial phase, or `null` |

## Example panels

`CommerceKit.lspkg/Examples/`. `ExampleProductPanel` is the abstract base: it connects, loads the product, keeps the button busy during an action, re-renders on `onPurchasesChanged` and shows `CommerceKitError` messages. Subclasses implement `prepare()`, `describe()` and `runAction()`.

| Input (all panels) | Type | Meaning |
|---|---|---|
| `productId` | string | Product ID from the developer portal |
| `purchaseButton` | UIKit BaseButton | The action button (bound on trigger-up) |
| `buttonText` | Text (optional) | Label of the action button |
| `nameText`, `priceText`, `statusText` | Text | Product name, price and status |
| `enableLogging`, `enableLoggingLifecycle` | boolean | false |

| Panel | Product in the prefab | Behavior |
|---|---|---|
| `ExamplePurchaseController` | `glow_up_hoodie` | Non-consumable: Buy, then "Owned". |
| `ExampleConsumableController` (+ `amountPerPurchase: number = 100`) | `coins_100` | Registers a delivery handler in `onAwake`, credits coins once per token (balance in `persistentStorageSystem`), shows "Balance: N coins". |
| `ExampleSubscriptionController` | `premium_pass` | Describes the first offer, subscribes with its `offerId`, shows "Active, renews …" / "Active until …", cancels through `client()`. In Preview shows "Test subscriptions on device". |

## Utilities and prefab

`Utils/Singleton` supplies the decorator used by CommerceKit. `Utils/Event` is the typed event behind `onPurchasesChanged`.

| Export (`CommerceKit.lspkg/Utils/Event`) | Signature / behavior |
|---|---|
| `default class Event<Arg = void>` | `constructor(...callbacks)`; undefined callbacks are dropped |
| `add(handler: callback<Arg>): unsubscribe` | Registers a handler; returns a function that removes it |
| `remove(handler: callback<Arg>): void` | Removes the handler |
| `invoke(arg: Arg): void` | Calls every handler in registration order; a handler that throws is logged with its stack and the others still run |
| `publicApi(): PublicApi<Arg>` | Callable object (`api(cb)` = `add`) with `add` / `remove` but no `invoke` |
| `type callback<Arg>`, `type unsubscribe`, `interface PublicApi<Arg>` | Helper types |

`CommerceKit__PLACE_IN_SCENE.prefab` is the self-contained demo. Its root `CommerceKit__PLACE_IN_SCENE` holds, in order: `Guide`, `ExampleCarousel`, `ProductCatalog` and three panels, `Consumable` (`coins_100`), `Non Consumable` (`glow_up_hoodie`) and `Subscription` (`premium_pass`). Each panel has its example controller and a UIKit `Frame` with a `PurchaseUI` child (name/price/status Texts and a `RectangleButton`). All panels sit at y −27, z −100; the carousel shows one at a time. You don't need the prefab to use CommerceKit in your own Lens.

## Demo scaffolding (`Example/`)

These scripts ship in `CommerceKit.lspkg/Example/` and are wired inside `CommerceKit__PLACE_IN_SCENE.prefab`. They only present the example; they are not part of the CommerceKit API. Both import UIKit and InteractionKit.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel and the three panels); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here Non Consumable, Consumable, Subscription), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here: the carousel steps through `examples`), `stepInfo: string[] = []`, `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` (10 here) |

Keep the Guide above the examples in the hierarchy: it hides its targets in `onAwake`. `ProductCatalog` stays out of `hideUntilDismissed` so CommerceKit connects at start. The carousel title is the object name up to the first "-", which is why the non-consumable panel is named `Non Consumable`.
