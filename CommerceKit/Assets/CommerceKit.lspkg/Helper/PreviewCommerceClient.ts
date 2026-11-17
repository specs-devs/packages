/**
 * SPECS Inc. 2027
 * Stand-in for the commerce service in Lens Studio Preview, where CommerceKitModule cannot connect. It
 * needs no setup: every product ID is simulated as a product named after its ID that costs $0.99, and
 * every checkout succeeds right away. A product is a consumable if a delivery handler was registered
 * for it before its first use, otherwise a non-consumable; subscriptions are only available on device.
 * Purchases behave like on device: they arrive pending through the purchase-update callback,
 * acknowledging consumes consumables and activates everything else, and they last until Preview
 * restarts.
 */

type PurchasesUpdatedCallback = (result: Commerce.PurchaseResult, purchases: Commerce.Purchase[]) => void;

type ConsumableHandlerCheck = (productId: string) => boolean;

interface InventoryItem {
  token: string;
  productId: string;
  type: Commerce.ProductType;
  state: Commerce.PurchaseState;
  isAcknowledged: boolean;
}

interface CheckoutUpdate {
  result: Commerce.PurchaseResult;
  purchases: Commerce.Purchase[];
}

const PRICE_CENTS = 99;
const DISPLAY_PRICE = "$0.99";
const CURRENCY = "USD";

function makeResult(code: Commerce.ResponseCode, debugMessage: string = ""): Commerce.PurchaseResult {
  return { responseCode: code, debugMessage } as unknown as Commerce.PurchaseResult;
}

function toPurchase(item: InventoryItem): Commerce.Purchase {
  return {
    token: item.token,
    productId: item.productId,
    // The device does not report purchase times yet; keep Preview consistent with it.
    purchaseTime: 0,
    purchaseState: item.state,
    isAcknowledged: item.isAcknowledged,
    isAutoRenewing: false,
    expiryTime: null,
  } as unknown as Commerce.Purchase;
}

// Like the device, a failed checkout reports a record without a token that names the product.
function productStub(productId: string): Commerce.Purchase {
  return {
    token: "",
    productId,
    purchaseTime: 0,
    purchaseState: Commerce.PurchaseState.Unset,
    isAcknowledged: false,
    isAutoRenewing: false,
    expiryTime: null,
  } as unknown as Commerce.Purchase;
}

// Simulated products and inventory of one Lens session. Shared by every Preview client CommerceKit
// creates, so reconnecting keeps simulated purchases the way the device keeps real ones.
class PreviewStore {
  inventory: InventoryItem[] = [];
  private readonly types = new Map<string, Commerce.ProductType>();
  private nextToken = 1;
  private readonly tokenPrefix: string;

  constructor(now: () => number) {
    // Unique per session, so tokens never collide with ones remembered from an earlier Preview run.
    this.tokenPrefix = `preview-${now().toString(36)}`;
  }

  // Decided on a product's first use and then kept, like a product type on the developer portal, so
  // CommerceKit and the simulation always agree on it.
  typeOf(productId: string, hasConsumableHandler: ConsumableHandlerCheck): Commerce.ProductType {
    const known = this.types.get(productId);
    if (known !== undefined) {
      return known;
    }
    const consumable = hasConsumableHandler(productId);
    const type = consumable ? Commerce.ProductType.Consumable : Commerce.ProductType.NonConsumable;
    this.types.set(productId, type);
    const simulated = consumable
      ? `a consumable for ${DISPLAY_PRICE}, because it has a registerConsumable() handler`
      : `a non-consumable for ${DISPLAY_PRICE}; products with a registerConsumable() handler registered ` +
        "before their first use are simulated as consumables";
    print(
      `[CommerceKit] Lens Studio Preview simulates "${productId}" as ${simulated}. ` +
        "On device, products come from https://developers.specs.com/lenses."
    );
    return type;
  }

  issueToken(productId: string): string {
    return `${this.tokenPrefix}-${productId}-${this.nextToken++}`;
  }
}

/**
 * Returns a function that creates Preview clients sharing one simulated inventory. Used by CommerceKit
 * when running in Lens Studio.
 *
 * @param now - Clock used to make purchase tokens unique per Preview session
 */
export function createPreviewClientFactory(
  now: () => number = () => Date.now()
): (onPurchasesUpdated: PurchasesUpdatedCallback, hasConsumableHandler: ConsumableHandlerCheck) => PreviewCommerceClient {
  const store = new PreviewStore(now);
  return (onPurchasesUpdated, hasConsumableHandler) =>
    new PreviewCommerceClient(onPurchasesUpdated, hasConsumableHandler, store);
}

/**
 * Lens Studio Preview stand-in for {@link Commerce.Client}. CommerceKit creates it when running in the
 * editor; it is not meant to be created directly or used on device.
 */
export class PreviewCommerceClient {
  private readonly onPurchasesUpdated: PurchasesUpdatedCallback;
  private readonly hasConsumableHandler: ConsumableHandlerCheck;
  private readonly store: PreviewStore;
  private connected = false;

  constructor(
    onPurchasesUpdated: PurchasesUpdatedCallback,
    hasConsumableHandler: ConsumableHandlerCheck,
    store: PreviewStore
  ) {
    this.onPurchasesUpdated = onPurchasesUpdated;
    this.hasConsumableHandler = hasConsumableHandler;
    this.store = store;
  }

  startConnection(): Promise<void> {
    if (this.connected) {
      return Promise.reject(new Error("Error: Session already started or connecting"));
    }
    this.connected = true;
    return Promise.resolve();
  }

  endConnection(): void {
    this.connected = false;
  }

  queryProductDetails(productIds: string[]): Promise<Commerce.Product[]> {
    return this.whenConnected(() => (productIds || []).map((id) => this.toProduct(id)));
  }

  // Subscriptions are not simulated, so there is no offer to apply.
  launchPurchaseFlow(productId: string, _offerId?: string | null): Promise<Commerce.PurchaseResult> {
    return this.whenConnected(() => {
      const update = this.checkout(productId);
      // Reported asynchronously through the callback, as on device.
      Promise.resolve().then(() => {
        if (this.connected) {
          this.onPurchasesUpdated(update.result, update.purchases);
        }
      });
      return makeResult(Commerce.ResponseCode.Success);
    });
  }

  queryPurchaseHistory(): Promise<Commerce.Purchase[]> {
    return this.whenConnected(() => this.store.inventory.map(toPurchase));
  }

  queryPurchase(productType: Commerce.ProductType): Promise<Commerce.Purchase[]> {
    return this.whenConnected(() =>
      this.store.inventory.filter((item) => item.type === productType).map(toPurchase)
    );
  }

  acknowledgePurchase(purchaseToken: string): Promise<Commerce.PurchaseResult> {
    return this.whenConnected(() => {
      const item = this.store.inventory.find((candidate) => candidate.token === purchaseToken);
      if (!item) {
        throw new Error(`ItemUnavailable: Unknown purchase token "${purchaseToken}"`);
      }
      if (item.isAcknowledged) {
        throw new Error(`Error: Purchase "${purchaseToken}" was already acknowledged`);
      }
      if (item.type === Commerce.ProductType.Consumable) {
        this.store.inventory = this.store.inventory.filter((candidate) => candidate !== item);
      } else {
        item.isAcknowledged = true;
        item.state = Commerce.PurchaseState.Purchased;
      }
      return makeResult(Commerce.ResponseCode.Success);
    });
  }

  // Not simulated. Like a failed operation on device, these resolve with an error code instead of
  // throwing, so code that calls them through CommerceKit.client() still runs in Preview.
  cancelSubscription(_purchaseToken: string): Promise<Commerce.PurchaseResult> {
    return this.whenConnected(() =>
      makeResult(Commerce.ResponseCode.ItemNotOwned, "Lens Studio Preview does not simulate subscriptions")
    );
  }

  updateSubscription(_purchaseToken: string, _params: unknown): Promise<Commerce.PurchaseResult> {
    return this.whenConnected(() =>
      makeResult(Commerce.ResponseCode.Error, "Lens Studio Preview does not simulate subscriptions")
    );
  }

  private whenConnected<T>(operation: () => T): Promise<T> {
    if (!this.connected) {
      return Promise.reject(new Error("Error: No active session"));
    }
    try {
      return Promise.resolve(operation());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private toProduct(productId: string): Commerce.Product {
    return {
      id: productId,
      type: this.store.typeOf(productId, this.hasConsumableHandler),
      displayName: productId,
      description: "",
      price: { price: PRICE_CENTS, displayPrice: DISPLAY_PRICE, currency: CURRENCY },
      iconUri: null,
      extras: null,
      subscriptionOfferDetails: null,
    } as unknown as Commerce.Product;
  }

  private checkout(productId: string): CheckoutUpdate {
    const type = this.store.typeOf(productId, this.hasConsumableHandler);
    // A non-consumable stays owned, and a consumable cannot be bought again until it is consumed.
    if (this.store.inventory.some((item) => item.productId === productId)) {
      // The device reports every checkout failure as ResponseCode.Error.
      return {
        result: makeResult(Commerce.ResponseCode.Error, `"${productId}" is already owned`),
        purchases: [productStub(productId)],
      };
    }
    const item: InventoryItem = {
      token: this.store.issueToken(productId),
      productId,
      type,
      state: Commerce.PurchaseState.Pending,
      isAcknowledged: false,
    };
    this.store.inventory.push(item);
    return { result: makeResult(Commerce.ResponseCode.Success), purchases: [toPurchase(item)] };
  }
}
