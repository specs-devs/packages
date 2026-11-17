# CommerceKit cheat sheet

[← Agent usage index](../README.md)

## Use when

Read before selling a product or wiring purchase UI.

1. **Products live on the Specs developer portal.** Create them at [developers.specs.com/lenses](https://developers.specs.com/lenses) and use their product IDs in scripts. `ProductCatalog` no longer lists products; entries saved by 3.x scenes are ignored. → [Guide](guide.md#how-it-works)
2. **Start once, from anywhere.** `ProductCatalog` (Initialize On Awake) or `CommerceKit.getInstance().initialize()` connects, restores purchases and finalizes pending ones. Concurrent calls share one attempt. → [Components](components.md#commercekit)
3. **Register consumables before selling them.** `registerConsumable(productId, handler)` in `onAwake`; without it `purchaseProduct()` rejects before checkout. Grant the item in the handler: it runs before the purchase is consumed. → [Consumables](guide.md#consumables)
4. **Show `nativeProduct.price.displayPrice`.** It is the localized string from the service; `price.price` keeps the 3.x decimal amount. → [Product info](guide.md#getproductinfoproductid-string-promisecommerceproduct)
5. **Read `outcome.status`.** `purchased`, `alreadyOwned`, `cancelled` or `pending` (paid, finalized later). Failures reject with `CommerceKitError`. → [Examples](examples.md)
6. **Re-render on `onPurchasesChanged`.** It fires on restore, completed and finalized purchases, refunds and subscription changes. → [Components](components.md#commercekit)
7. **Preview simulates, the device sells.** In Preview every product ID is a $0.99 product named after its ID; a product with a handler registered before first use is a consumable. Subscriptions are not simulated. → [Testing in Preview](guide.md#testing-in-lens-studio-preview)
8. **Use one client.** Never call `CommerceKitModule.createClient()` next to CommerceKit; use `client()` for native calls, then `refresh()`. → [client()](guide.md#client-promisecommerceclient)
