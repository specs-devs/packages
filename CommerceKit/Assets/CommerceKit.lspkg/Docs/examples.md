# CommerceKit examples

[← Agent usage index](../README.md)

## Use when

Read for compile-correct consumer usage. Configure ProductCatalog and the example prefab's inputs before pressing Purchase.

## Query a configured product

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

async function describeProduct(id: string): Promise<string> {
  const kit = CommerceKit.getInstance();
  const product = await kit.getProductInfo(id);
  if (!product) return "Product not found";
  return `${product.displayName}: ${product.price.price} ${product.price.currency}`;
}
```

Run after ProductCatalog awake has initialized the local catalog. On device, product details come from the connected commerce client.

## Purchase with guarded output

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

async function purchaseConfiguredProduct(id: string): Promise<string> {
  const kit = CommerceKit.getInstance();
  if (kit.isProductOwned(id)) return "Already owned";
  try {
    const result = await kit.purchaseProduct(id);
    if (!result) return "Purchase did not complete";
    if (result.success) return "Purchased";
    return result.cancelled ? "Cancelled" : "Purchase failed";
  } catch (error) {
    return `Purchase failed: ${error}`;
  }
}
```

In Lens Studio this uses the mock branch. On a device this launches a real commerce flow; test it only as part of the appropriate billing QA.

## Read fresh status

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

async function queryOwnership(id: string): Promise<boolean> {
  return (await CommerceKit.getInstance().checkPurchaseStatus(id)) === Commerce.PurchaseState.Purchased;
}
```

`isProductOwned` reads the cache; `checkPurchaseStatus` queries device history. Neither emits an event: your UI needs to request an update.

## Use the native client only on device

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

async function readDeviceHistory(): Promise<Commerce.Purchase[]> {
  if (global.deviceInfoSystem.isEditor()) return [];
  const client = await CommerceKit.getInstance().client();
  return client.queryPurchaseHistory();
}
```
