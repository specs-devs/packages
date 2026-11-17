# CommerceKit API status

[← Agent usage index](../README.md)

## Use when

Read before adapting older catalog/purchase code. Facts below describe the CommerceKit source that ships in this package.

## Current

| Consumer path | Surface |
|---|---|
| `CommerceKit.lspkg/CommerceKit` | `CommerceKit.getInstance`, `initializeCatalog`, `client()`, `purchaseProduct`, `isProductOwned`, `getProductInfo`, `checkPurchaseStatus` |
| `CommerceKit.lspkg/ProductCatalog` | `ProductCatalog` component with catalog and logging inputs |
| `CommerceKit.lspkg/Helper/CommerceProduct` | `CommerceProduct` typedef |
| `CommerceKit.lspkg/Helper/CommercePrice` | `CommercePrice` typedef, decimal USD amount |
| `CommerceKit.lspkg/Examples/ExamplePurchaseController` | Configured purchase panel component |

## Experimental / service status

ProductCatalog's inspector text says Closed Beta, with draft testing and publish-access requirements linked to <https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started>. This is the shipped label; current access and availability need the service's own documentation.

## Deprecated

No public member is explicitly marked deprecated in the source. Old snippets that await `kit.client` await a function object; use the method and respect the editor mock branch.

## Removed

No commerce API is removed. The in-package demo `Scripts/GuideDismissPanel/GuideDismissPanel.ts` and the GuideDismissPanel component on the prefab were removed in this revision; the overview guide and example carousel now ship as demo scaffolding in `Example/` and are part of the prefab. Scenes that still reference the old script show a missing-script component — remove it.

## Known gaps

- Only USD is formatted; the single product-type input is NonConsumable.
- The editor's `client()` promise rejects intentionally; `initializeCatalog` catches and prints that mock-mode message.
- `purchaseProduct` catches a device launch failure, prints and returns undefined despite its declared result type.
- Pending ownership acknowledgement passes productId rather than a transaction token. Do not describe that recovery path as verified.
- In `onSuccessfulPurchase`, a caught acknowledgement/history failure is only printed; pending callers may never settle.
- An empty purchase list returns before success/cancel/error handlers, so those outcomes may leave pending callers.
- The pending context is registered after `launchPurchaseFlow` resolves; transaction callback timing has not been verified on device.
- `getProductInfo` on device rebuilds id/type/name/price but does not copy description/icon/extras.
- Price validation rejects negative/non-numeric values but has no finite-number check; validate NaN/Infinity in your catalog authoring.
- Duplicate IDs and empty initialization are not rejected as a full catalog validation step.

Device billing behavior remains unverified. These gaps are documented rather than changed without a device transaction harness.
