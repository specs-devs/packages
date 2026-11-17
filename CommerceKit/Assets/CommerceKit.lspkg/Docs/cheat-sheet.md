# CommerceKit cheat sheet

[← Agent usage index](../README.md)

## Use when

Read before adding a catalog or wiring purchase UI.

1. **Initialize one catalog first.** ProductCatalog starts `initializeCatalog` in awake. A nonempty existing catalog is not replaced by later calls. → [Catalog lifecycle](guide.md#catalog-and-lifecycle)
2. **Use decimal USD prices.** `CommercePrice.price` defaults to 1.99, currency USD. Initialization rounds to two decimals, then sends integer cents; other currencies throw. → [Price type](components.md#commerceprice)
3. **Treat editor purchases as local mocks.** No device purchase flow is launched by the editor branch; ownership resets with the Lens session. `client()` rejects deliberately in the editor. → [Mock workflow](guide.md#editor-testing)
4. **Await the method, not its function object.** `client` is a method: `await kit.client()` on device. Guard the editor branch before using it. → [Core API](components.md#commercekit)
5. **Guard every purchase result.** The device error catch can return undefined despite the public signature. Catch exceptions and check the result before reading success/cancelled. → [Examples](examples.md)
6. **Wire UIKit trigger-up.** ExamplePurchaseController binds `purchaseButton.onTriggerUp`; scene inputs must point at the button component, not the SceneObject. → [Example controller](components.md#examplepurchasecontroller)
7. **Do not equate cached ownership with a fresh device receipt.** `isProductOwned` reads cached state; `checkPurchaseStatus` queries history on device. → [Ownership](guide.md#ownership-and-purchase-state)
8. **Keep device acknowledgement gaps visible.** Pending-state acknowledgement currently passes productId instead of a purchase token, and acknowledgement failures can leave a promise pending. → [Known gaps](api-status.md#known-gaps)
