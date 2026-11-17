# CommerceKit guide

[← Agent usage index](../README.md)

## Use when

Read for the catalog setup, complete purchase UI, multiple-product and state-change workflows formerly in README. APIs below are corrected against this revision; executable recipes are in [examples](examples.md).

## Catalog and lifecycle

Place `CommerceKit__PLACE_IN_SCENE.prefab`, or add ProductCatalog with its typed CommerceProduct entries. Configure unique IDs, NonConsumable type, display name, USD CommercePrice and optional metadata. ExamplePurchaseController.productId must match an entry.

ProductCatalog starts async initialization in awake. CommerceKit validates/rounds decimal prices and sends integer cents to the device client. A second initialization is ignored once the catalog is nonempty; there is no public replace/reset catalog method. Await `client()` before device-native operations. The editor mock keeps its catalog available while deliberately rejecting the native-client promise.

## Complete purchase UI

The bundled controller fills name/price/status and binds the UIKit button's trigger-up. Inputs point to the actual BaseButton and Text components. Use your own controller to display descriptions, show errors or enable content; the package's premium-feature method only prints.

For your own UI: load product details, check cached ownership, disable duplicate purchase submissions, handle success/cancel/rejection plus missing result, then request fresh status. Keep status strings and entitlement application in one flow. The package exports no transaction-completed event.

## Multiple products

Put every product in the one catalog. Use one purchase controller per panel or dispatch one UI's selected product ID. IDs select both the catalog entry and pending-purchase map. Duplicate catalog IDs are not validated by the package and must be avoided.

The editor mock changes the selected entry's cached state to Purchased; other entries stay Unset. Repeated calls for a Purchased ID return success immediately.

## Ownership and purchase state

`isProductOwned` is synchronous cached state. `checkPurchaseStatus` queries device purchase history; missing products return Unset. Refresh your UI after the purchase promise resolves or when your flow reopens; no public purchase-state observer is exported.

Device acknowledgement and cancellation gaps are listed in [API status](api-status.md#known-gaps). A pending purchase is not equivalent to a confirmed receipt, and that recovery path was not tested here.

## Editor testing

Lens Studio's mock branch does not call `launchPurchaseFlow`. It initializes all configured products as Unset, marks a known purchased product Purchased and returns local product information. The native-client rejection message is expected in this branch. Resetting the Lens rebuilds the singleton and mock ownership; this is not persisted payment history.

## Device setup and access

The ProductCatalog inspector links to the service's access documentation and labels it Closed Beta. Review those requirements for your account before device billing or publishing. Source inspection and editor mocks cannot establish service eligibility or validate a financial transaction.
