# CommerceKit 

CommerceKit is a comprehensive in-app purchase framework designed specifically for Specs applications. It provides a complete commerce solution for managing product catalogs, processing transactions, delivering purchases, and tracking user ownership of non-consumable items. The framework handles all aspects of the purchase lifecycle including product validation, purchase flow initiation, transaction acknowledgment, and purchase history management.

## Features

- **Product Catalog Management**: Define and manage multiple products with pricing in different currencies
- **Automated Purchase Flow**: Built-in UI flow for secure payment processing on Specs
- **Purchase State Tracking**: Real-time tracking of purchase status (pending, purchased, unset)
- **Purchase History**: Query and validate user ownership across sessions
- **Price Validation**: Automatic validation and formatting of product prices
- **Editor Testing**: Mock purchase flows for development and testing in Lens Studio
- **Type-Safe API**: Fully typed TypeScript interfaces for reliable development
- **Singleton Architecture**: Easy global access to commerce functionality

## Quick Start

CommerceKit requires initial setup with a product catalog. Add the `ProductCatalog` component to a scene object and configure your products:

```typescript
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";
import { CommerceProduct } from "CommerceKit.lspkg/Helper/CommerceProduct";
import { CommercePrice } from "CommerceKit.lspkg/Helper/CommercePrice";

// Access the CommerceKit singleton
const commerceKit = CommerceKit.getInstance();

// Check if a product is owned
if (commerceKit.isProductOwned("premium_upgrade")) {
  print("User owns premium features!");
}

// Initiate a purchase
const result = await commerceKit.purchaseProduct("premium_upgrade");
if (result.success) {
  print("Purchase completed successfully!");
} else if (result.cancelled) {
  print("User cancelled the purchase");
}
```

## Setting Up Your Product Catalog

Configure products using the `ProductCatalog` component in the Lens Studio inspector:

```typescript
@component
export class ProductCatalog extends BaseScriptComponent {
  @input
  readonly productCatalog: CommerceProduct[];

  onAwake() {
    CommerceKit.getInstance().initializeCatalog(this.productCatalog);
  }
}
```

Each product in the catalog requires:
- **ID**: Unique identifier for the product
- **Type**: Currently supports "NonConsumable" items
- **Display Name**: User-facing product name
- **Price**: Price object with amount and currency (e.g., 2.99 USD)
- **Description**: Product category or description
- **Icon URI** (optional): Image resource for the product
- **Extras** (optional): Additional JSON metadata

## Script Highlights

- **CommerceKit.ts**: Core commerce framework implementing the singleton pattern. Manages the commerce client connection, product catalog initialization, purchase flow orchestration, and purchase state management. Handles price validation and conversion from decimal format to cents, manages purchase callbacks, and provides methods for checking ownership status and querying product information.

- **ProductCatalog.ts**: Component for defining and initializing the product catalog. Attach this to a scene object and configure your products through the Lens Studio inspector. Automatically initializes the CommerceKit singleton with your product definitions on scene awake.

- **ExamplePurchaseController.ts**: Complete reference implementation demonstrating purchase UI management. Shows how to display product information, handle purchase button interactions, update UI based on ownership status, and process purchase results including success, cancellation, and error states.

- **CommerceProduct.ts**: Type definition for product catalog entries. Defines the complete product schema including ID, type, display name, pricing information, description, and optional metadata. Used for both catalog configuration and runtime product queries.

- **CommercePrice.ts**: Helper class for product pricing information. Encapsulates price amount and currency code, handles price display formatting, and manages price conversion between decimal and cents representation.

## Core API Methods

### Purchase Management

```typescript
// Purchase a product
async purchaseProduct(productId: string): Promise<{ success: boolean; cancelled?: boolean }>

// Example usage
try {
  const result = await commerceKit.purchaseProduct("premium_upgrade");
  if (result.success) {
    // Enable premium features
    this.enablePremiumFeatures();
  } else if (result.cancelled) {
    // User cancelled, show appropriate message
    this.showMessage("Purchase cancelled");
  }
} catch (error) {
  print(`Purchase error: ${error}`);
}
```

### Ownership Checking

```typescript
// Check if user owns a product (synchronous)
isProductOwned(productId: string): boolean

// Example usage
if (commerceKit.isProductOwned("premium_upgrade")) {
  this.showPremiumContent();
} else {
  this.showPurchaseButton();
}

// Check purchase status with full state information (async)
async checkPurchaseStatus(productId: string): Promise<Commerce.PurchaseState>

// Example usage
const status = await commerceKit.checkPurchaseStatus("premium_upgrade");
if (status === Commerce.PurchaseState.Purchased) {
  print("Product is owned");
} else if (status === Commerce.PurchaseState.Pending) {
  print("Purchase is pending acknowledgment");
}
```

### Product Information

```typescript
// Get detailed product information
async getProductInfo(productId: string): Promise<CommerceProduct>

// Example usage
const product = await commerceKit.getProductInfo("premium_upgrade");
this.nameText.text = product.displayName;
this.priceText.text = `${product.price.price} ${product.price.currency}`;
this.descriptionText.text = product.description;
```

## Advanced Usage

### Building a Complete Purchase UI

Here's a complete example of a purchase controller with UI management:

```typescript
import { BaseButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/BaseButton";
import { CommerceKit } from "CommerceKit.lspkg/CommerceKit";

@component
export class PurchaseController extends BaseScriptComponent {
  @input productId: string = "premium_upgrade";
  @input purchaseButton: BaseButton;
  @input nameText: Text;
  @input priceText: Text;
  @input statusText: Text;

  private commerceKit: CommerceKit = CommerceKit.getInstance();
  private pendingPurchase: boolean = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }

  private async onStart() {
    this.setupPurchaseButton();
    this.updateUI();
  }

  private setupPurchaseButton() {
    this.purchaseButton.onTriggerUp.add(() => {
      this.onPurchaseButtonPressed();
    });
  }

  private async updateUI() {
    // Wait for commerce client to be ready
    await this.commerceKit.client();

    const isOwned = this.commerceKit.isProductOwned(this.productId);
    this.purchaseButton.enabled = !isOwned;
    this.statusText.text = isOwned ? "Premium Owned" : "Tap to Purchase";

    // Display product information
    const product = await this.commerceKit.getProductInfo(this.productId);
    if (isNull(product)) {
      this.statusText.text = "Product not found";
    } else {
      this.nameText.text = product.displayName;
      this.priceText.text = `${product.price.price} ${product.price.currency}`;
    }
  }

  private async onPurchaseButtonPressed() {
    if (this.commerceKit.isProductOwned(this.productId)) {
      this.statusText.text = "Already owned!";
      return;
    }

    if (this.pendingPurchase) {
      return;
    }

    try {
      this.pendingPurchase = true;
      this.statusText.text = "Processing purchase...";

      const result = await this.commerceKit.purchaseProduct(this.productId);

      if (result.success) {
        this.statusText.text = "Purchase successful!";
        this.enablePremiumFeatures();
      } else if (result.cancelled) {
        this.statusText.text = "Purchase cancelled";
      } else {
        this.statusText.text = "Purchase failed";
      }

      this.pendingPurchase = false;
    } catch (error) {
      this.statusText.text = `Purchase failed: ${error.message}`;
      print(`Purchase error: ${error}`);
      this.pendingPurchase = false;
    }
  }

  private enablePremiumFeatures() {
    // Your premium feature logic here
    print("Premium features unlocked!");
  }
}
```

### Managing Multiple Products

```typescript
@component
export class MultiProductManager extends BaseScriptComponent {
  private commerceKit = CommerceKit.getInstance();
  private productIds = ["premium_skin", "extra_levels", "power_boost"];

  async onStart() {
    // Wait for commerce to initialize
    await this.commerceKit.client();

    // Check ownership of all products
    for (const productId of this.productIds) {
      const isOwned = this.commerceKit.isProductOwned(productId);
      print(`Product ${productId}: ${isOwned ? "Owned" : "Not owned"}`);

      if (isOwned) {
        this.activateProduct(productId);
      }
    }
  }

  private activateProduct(productId: string) {
    // Enable features based on product ID
    switch (productId) {
      case "premium_skin":
        this.enablePremiumSkin();
        break;
      case "extra_levels":
        this.unlockExtraLevels();
        break;
      case "power_boost":
        this.enablePowerBoost();
        break;
    }
  }
}
```

### Handling Purchase State Changes

The framework automatically handles purchase state updates through callbacks:

```typescript
// The framework manages these states internally:
// - Commerce.PurchaseState.Unset: Not purchased
// - Commerce.PurchaseState.Pending: Purchase initiated but not acknowledged
// - Commerce.PurchaseState.Purchased: Successfully purchased and acknowledged

// Purchase flow with state handling
private async handlePurchase(productId: string) {
  const initialState = await this.commerceKit.checkPurchaseStatus(productId);

  if (initialState === Commerce.PurchaseState.Pending) {
    print("Product has pending purchase, attempting to acknowledge");
    // Framework automatically handles pending acknowledgment
  }

  const result = await this.commerceKit.purchaseProduct(productId);

  if (result.success) {
    const finalState = await this.commerceKit.checkPurchaseStatus(productId);
    print(`Purchase complete. Final state: ${finalState}`);
  }
}
```

## Testing in Lens Studio Editor

CommerceKit includes mock purchase flows for testing in the editor:

- Products start in `Unset` state
- `purchaseProduct()` immediately succeeds for valid product IDs
- `isProductOwned()` returns true after mock purchase
- All API methods work identically to device behavior
- Test your purchase UI without requiring device deployment

## Important Notes

- **Closed Beta**: CommerceKit is currently in Closed Beta. You can test in draft mode but need approval to publish
- **Non-Consumables Only**: Currently supports non-consumable products (one-time purchases that persist)
- **Price Format**: Prices are automatically converted from decimal format (2.99) to cents (299) for the commerce module
- **USD Only**: Currently only supports USD currency
- **Ownership Persistence**: Purchase history is automatically synced and persisted across sessions
- **Acknowledgment Required**: Purchases must be acknowledged to complete the transaction (handled automatically)

## Documentation

For complete documentation and integration guides, visit:
[CommerceKit Documentation](https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started)

---

*Maintained with 👽 by the SPECS Team* <!-- --> <!-- --> <!-- --> <!-- -->




