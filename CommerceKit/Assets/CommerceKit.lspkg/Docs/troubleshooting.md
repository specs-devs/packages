# CommerceKit troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when initialization, a product panel or a purchase does not behave as expected.

| Symptom | Cause | Fix / next check |
|---|---|---|
| "Product not found" / `ItemUnavailable` | The product ID does not match a product of your Lens at [developers.specs.com/lenses](https://developers.specs.com/lenses), or the product is not published | Use the exact portal ID and publish the product. |
| Preview shows the product ID and $0.99 instead of the real name and price | Expected: Preview simulates every product | The device uses the developer portal. |
| A consumable behaves like a non-consumable in Preview | Its handler was registered after the product was first used | Call `registerConsumable()` in `onAwake`, before anything queries the product. |
| `purchaseProduct()` rejects with `Error` before checkout | Consumable without a `registerConsumable` handler | Register the handler first. |
| A purchase stays pending | The consumable handler threw or returned `false`, or the device is offline | Look for a CommerceKit warning; pending purchases are finalized on the next `refresh()`, launch or purchase attempt (without charging again). |
| A purchase takes very long to resolve | The checkout result was lost (e.g. the commerce service restarted) | Call `refresh()`, e.g. when the Lens resumes; CommerceKit completes the purchase from the inventory. |
| "Session already started or connecting" | Another script created its own client with `CommerceKitModule.createClient()` | Use `CommerceKit.getInstance()` / `client()` everywhere. |
| Subscription panel shows "Test subscriptions on device" | Preview does not simulate subscriptions | Expected; test on device. |
| Non-consumable button reads "Owned" after a Preview purchase | Simulated ownership lasts until Preview restarts | Expected; restart Preview to reset it. |
| Product entries from a 3.x scene are ignored | Products moved to the developer portal in 4.0 | Create the same products on the portal; `ProductCatalog` no longer lists them. |
| A store UI does not update after a refund or renewal | The UI only renders after its own calls | Re-render on `onPurchasesChanged`. |
| Purchase panel is cut off or hidden behind another panel | The prefab panels sit at eye level, 100 cm away; a UIKit panel closer to the user (a menu or carousel) draws over them | Keep the whole panel inside the view and above or beside nearer panels. |
| Missing-script component on an old prefab instance | Scene saved with the 3.x demo (removed GuideDismissPanel or the old example controller) | Re-instantiate `CommerceKit__PLACE_IN_SCENE.prefab`. |

## QA boundaries

Preview QA does not exercise real payments, cancelled or failed payments, real product details, subscriptions or the recovery of interrupted purchases. Keep these checks in device QA with an authorized commerce setup; do not label the package financially verified from Preview.
