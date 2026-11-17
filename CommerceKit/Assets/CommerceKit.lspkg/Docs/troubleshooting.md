# CommerceKit troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when the catalog, product panel or purchase promise does not behave as expected.

| Symptom | Cause | Fix / next check |
|---|---|---|
| “Commerce client is not available in editor. Mock flow initiated.” | Native-client promise deliberately rejects in Lens Studio | Expected mock-mode message; use product-info/ownership/mock purchase methods without `client()` in editor. |
| Product not found / mock purchase fails | productId differs from catalog or catalog has not initialized | Configure the exact ID and start ProductCatalog before the purchase panel. |
| Awaiting client does not wait | Code uses `await kit.client` rather than `client()` | Use the method on device and handle rejection. |
| UI price or name does not load | Missing Text input or unknown product ID | Resolve every prefab component input and guard an absent product. |
| Unsupported currency error | Formatter only implements USD | Set USD; the typedef Inspector also exposes USD only. |
| Catalog updates are ignored | A nonempty catalog is already initialized | There is no public replace method; configure once per Lens session. |
| Price is off by 100× | Caller supplies integer cents instead of decimal | Enter 1.99, not 199; CommerceKit converts for its device client. |
| Purchase result has no success property | Device launch catch prints and returns undefined | Guard the result before accessing it; see [examples](examples.md). |
| Purchase UI never leaves Pending | Acknowledgement/history errors can print without settling pending callers | Device transaction harness required; [known gaps](api-status.md#known-gaps) are not verified fixes. |
| Purchased mock item becomes Unset after reset | Ownership is in-memory editor state | Expected. Device history requires separate QA. |
| No real premium behavior appears | Example's premium-feature method only prints | Implement entitlement/content changes in your controller. |
| Purchase button stops responding after a mock purchase | ExamplePurchaseController disables `purchaseButton` after a successful purchase (and on start when the product is already owned) | Expected: status reads "Purchase successful!" / "Premium Owned". Reset the Lens to clear mock ownership. |
| Invalid panel shows N/A and "Product not found" | `suss_purchase` is intentionally missing from the prefab catalog | Expected; pressing Purchase prints `Product suss_purchase doesn't exist in catalog.` and shows "Purchase failed". |
| Purchase panel is cut off or hidden behind another panel | The prefab panels sit at eye level, 100 cm away (Frame bounds about 22 × 27 cm); a UIKit panel closer to the user (a menu or carousel) draws over them | Keep the whole panel inside the view and above or beside nearer panels. QA demo: panels re-anchored about 120 cm away, centered about 6 cm above eye level, with the carousel below. |
| Missing-script component on the prefab instance | Scene saved with the removed in-package GuideDismissPanel | Remove the dangling ScriptComponent, or re-instantiate the prefab. |
| Old floating editor guide remains | Stale prefab instance or legacy in-package guide script | Use the refreshed prefab instance; it carries the current guide and carousel (scripts in `Example/`). |

## QA boundaries

Editor mock QA does not exercise real payments, purchase cancellation, device history, pending recovery, receipt acknowledgement or current publish-access eligibility. Keep these checks in device QA; do not label the package financially verified from its preview.
