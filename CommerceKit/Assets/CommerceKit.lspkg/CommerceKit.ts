/**
 * SPECS Inc. 2027
 * CommerceKit: a simplified wrapper around CommerceKitModule for in-Lens purchases. Products are
 * defined in the cloud, on the Specs developer portal (https://developers.specs.com/lenses); Lenses
 * refer to them by product ID. CommerceKit owns the connection to the commerce service, restores
 * purchases, finalizes (acknowledges) every completed purchase so it is not refunded, delivers
 * consumables through registered handlers before consuming them, and simulates purchases in Lens
 * Studio Preview, where the commerce service is not available.
 */
import type { CommercePrice } from "./Helper/CommercePrice";
import type { CommerceProduct } from "./Helper/CommerceProduct";
import { createPreviewClientFactory } from "./Helper/PreviewCommerceClient";
import Event from "./Utils/Event";
import type { PublicApi } from "./Utils/Event";

// The Commerce.Client operations every client CommerceKit creates provides, including the Lens Studio
// Preview simulation: the ones CommerceKit calls, and common ones a Lens calls through client().
type CommerceClient = Pick<
  Commerce.Client,
  | "startConnection"
  | "endConnection"
  | "queryProductDetails"
  | "launchPurchaseFlow"
  | "queryPurchaseHistory"
  | "queryPurchase"
  | "acknowledgePurchase"
  | "cancelSubscription"
>;

/**
 * How a call to {@link CommerceKit.purchaseProduct} ended.
 * - "purchased": the purchase completed and was delivered (consumables) or activated (everything else).
 * - "alreadyOwned": the user already owns the non-consumable or has an active subscription; nothing was charged.
 * - "cancelled": the user closed the checkout.
 * - "pending": the payment went through but the purchase could not be finalized yet (for example, a
 *   network error while acknowledging it, or a consumable handler that threw). CommerceKit finalizes it
 *   automatically later: on {@link CommerceKit.refresh}, in the next Lens session, or on the next
 *   purchase attempt of the same product, which never charges again while a purchase is pending.
 */
export type PurchaseStatus = "purchased" | "alreadyOwned" | "cancelled" | "pending";

/**
 * Result of {@link CommerceKit.purchaseProduct}.
 */
export interface PurchaseOutcome {
  status: PurchaseStatus;
  /** True for "purchased" and "alreadyOwned". */
  success: boolean;
  /** True for "cancelled". */
  cancelled: boolean;
  /**
   * The purchase record, when one is involved. Always null for consumables: their purchase token is
   * only passed to the {@link CommerceKit.registerConsumable} handler, before the purchase is
   * acknowledged.
   */
  purchase: Commerce.Purchase | null;
}

/**
 * Processes a consumable purchase, for example by having your server redeem `purchase.token` or by
 * adding coins to a persisted balance. The purchase is acknowledged (consumed) only after the handler
 * completes. Return (or resolve) `false` to leave it for next time, for example while your server is
 * still processing the token; throwing (or rejecting) does the same and logs a warning. The handler must
 * eventually settle, and must not call {@link CommerceKit.purchaseProduct}.
 */
export type ConsumableDeliveryHandler = (purchase: Commerce.Purchase) => boolean | void | Promise<boolean | void>;

// Persists the tokens of consumables that were delivered but not yet consumed, so a purchase whose
// acknowledgement failed is not delivered twice in a later Lens session.
interface TokenStore {
  load(): string[];
  save(tokens: string[]): void;
}

type PurchasesUpdatedCallback = (result: Commerce.PurchaseResult, purchases: Commerce.Purchase[]) => void;

// Starts a timer and returns a function that cancels it.
type TimerStarter = (callback: () => void, delayMs: number) => () => void;

interface CommerceKitDependencies {
  // The Preview client simulates products with a registered delivery handler as consumables.
  createClient: (
    onPurchasesUpdated: PurchasesUpdatedCallback,
    hasConsumableHandler: (productId: string) => boolean
  ) => CommerceClient;
  tokenStore: TokenStore | null;
  now: () => number;
  startTimer: TimerStarter | null;
}

interface CheckoutResult {
  code: Commerce.ResponseCode;
  debugMessage: string;
  purchases: Commerce.Purchase[];
  timedOut: boolean;
}

class Deferred<T> {
  readonly promise: Promise<T>;
  resolve!: (value: T) => void;

  constructor() {
    this.promise = new Promise<T>((resolve) => {
      this.resolve = resolve;
    });
  }
}

interface PurchaseFlow {
  productId: string;
  outcome: Promise<PurchaseOutcome>;
  checkout: Deferred<CheckoutResult> | null;
  checkoutSettled: boolean;
  cancelTimer: (() => void) | null;
  // Tokens of the product known when the checkout opened; any other token is the new purchase.
  knownTokens: Set<string>;
  completed: Commerce.Purchase | null;
}

interface LocalChange {
  record: Commerce.Purchase;
  at: number;
}

const RESPONSE_CODE_NAMES = [
  "Success",
  "UserCanceled",
  "ItemAlreadyOwned",
  "ItemNotOwned",
  "ItemUnavailable",
  "PaymentUnavailable",
  "Error",
  "ServiceUnavailable",
  "ServiceDisconnected",
  "NetworkError",
] as const;

type ResponseCodeName = (typeof RESPONSE_CODE_NAMES)[number];

const DELIVERED_TOKENS_KEY = "CommerceKit.deliveredConsumables";

const CHECKOUT_TIMEOUT_MS = 10 * 60 * 1000;

function responseCodeName(code: Commerce.ResponseCode): string {
  for (const name of RESPONSE_CODE_NAMES) {
    if (Commerce.ResponseCode[name] === code) {
      return name;
    }
  }
  return String(code);
}

/**
 * Error raised by CommerceKit. `code` tells what went wrong, for example
 * {@link Commerce.ResponseCode.ItemUnavailable} for a product ID the Lens does not have or
 * {@link Commerce.ResponseCode.NetworkError} when the device is offline.
 */
export class CommerceKitError extends Error {
  readonly code: Commerce.ResponseCode;
  /** Diagnostic text from the commerce service, when available. Not meant to be shown to users. */
  readonly debugMessage: string;

  constructor(code: Commerce.ResponseCode, message: string, debugMessage: string = "") {
    super(message);
    this.name = "CommerceKitError";
    this.code = code;
    this.debugMessage = debugMessage;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Native commerce errors name the response code in the message, for example "ItemUnavailable" or
// "NetworkError: <details>". Anything without a specific code maps to ResponseCode.Error.
const SPECIFIC_CODE_PATTERN = new RegExp(
  `\\b(${RESPONSE_CODE_NAMES.filter((name) => name !== "Success" && name !== "Error").join("|")})\\b`
);

// How the device reports a session it dropped after the commerce service restarted. Recovering needs
// a new client: the old one's purchase-update subscription is gone.
const CONNECTION_LOST_PATTERN = /No active session|service disconnected/i;

function isConnectionLost(error: unknown): boolean {
  return CONNECTION_LOST_PATTERN.test(errorMessage(error));
}

function toCommerceKitError(error: unknown, action: string): CommerceKitError {
  if (error instanceof CommerceKitError) {
    return error;
  }
  const message = errorMessage(error);
  const match = SPECIFIC_CODE_PATTERN.exec(message);
  let code = match ? Commerce.ResponseCode[match[1] as ResponseCodeName] : Commerce.ResponseCode.Error;
  if (isConnectionLost(error)) {
    code = Commerce.ResponseCode.ServiceDisconnected;
  }
  return new CommerceKitError(code, `${action} failed: ${message}`, message);
}

function isSellableType(type: Commerce.ProductType | undefined): boolean {
  return (
    type === Commerce.ProductType.NonConsumable ||
    type === Commerce.ProductType.Consumable ||
    type === Commerce.ProductType.Subscription
  );
}

function productTypeName(type: Commerce.ProductType): string {
  switch (type) {
    case Commerce.ProductType.NonConsumable:
      return "NonConsumable";
    case Commerce.ProductType.Consumable:
      return "Consumable";
    case Commerce.ProductType.Subscription:
      return "Subscription";
    default:
      return "Unknown";
  }
}

// The CommerceKit 3.x fields, mapped from the Lens API product: a decimal price, the type as a string and
// empty strings instead of null. Everything else is read from nativeProduct.
function toCommerceProduct(product: Commerce.Product): CommerceProduct {
  const price = {
    price: product.price ? product.price.price / 100 : 0,
    currency: product.price ? product.price.currency : "",
  } as CommercePrice;
  return {
    id: product.id,
    type: productTypeName(product.type),
    displayName: product.displayName,
    description: product.description,
    price,
    iconUri: product.iconUri || "",
    extras: product.extras || "",
    nativeProduct: product,
  } as CommerceProduct;
}

function persistentTokenStore(): TokenStore | null {
  try {
    const store = global.persistentStorageSystem ? global.persistentStorageSystem.store : null;
    if (!store) {
      return null;
    }
    return {
      load: () => (store.has(DELIVERED_TOKENS_KEY) ? store.getStringArray(DELIVERED_TOKENS_KEY) : []),
      save: (tokens: string[]) => {
        if (tokens.length > 0) {
          store.putStringArray(DELIVERED_TOKENS_KEY, tokens);
        } else {
          store.remove(DELIVERED_TOKENS_KEY);
        }
      },
    };
  } catch (_error) {
    return null;
  }
}

// setTimeout only exists on newer Lens runtimes; without it, checkouts have no timeout.
function defaultTimer(): TimerStarter | null {
  if (typeof setTimeout !== "function") {
    return null;
  }
  return (callback, delayMs) => {
    const id = setTimeout(callback, delayMs);
    return () => {
      if (typeof clearTimeout === "function") {
        clearTimeout(id);
      }
    };
  };
}

function defaultDependencies(): CommerceKitDependencies {
  // One simulated store per Lens session, so reconnecting in Preview keeps simulated purchases.
  const createPreviewClient = createPreviewClientFactory();
  return {
    createClient: (onPurchasesUpdated, hasConsumableHandler) => {
      // Resolved in the editor too, as earlier versions did, so the Lens keeps referencing the module even
      // though Preview uses the simulation: Lens Studio has no commerce service to connect to.
      const commerceModule = require("LensStudio:CommerceKitModule") as CommerceKitModule;
      if (global.deviceInfoSystem.isEditor()) {
        return createPreviewClient(onPurchasesUpdated, hasConsumableHandler);
      }
      return commerceModule.createClient(new Commerce.ClientOptions(onPurchasesUpdated));
    },
    tokenStore: persistentTokenStore(),
    now: () => Date.now(),
    startTimer: defaultTimer(),
  };
}

function stateRank(state: Commerce.PurchaseState): number {
  switch (state) {
    case Commerce.PurchaseState.Purchased:
      return 4;
    case Commerce.PurchaseState.Pending:
      return 3;
    case Commerce.PurchaseState.Expired:
      return 2;
    case Commerce.PurchaseState.Invalidated:
      return 1;
    default:
      return 0;
  }
}

/**
 * Singleton entry point for in-Lens purchases. Access it with {@link CommerceKit.getInstance}.
 *
 * @example
 * ```typescript
 * const commerceKit = CommerceKit.getInstance();
 * await commerceKit.initialize();
 * const outcome = await commerceKit.purchaseProduct("remove_ads");
 * if (outcome.success) {
 *   hideAds();
 * }
 * ```
 */
export class CommerceKit {
  private static instance: CommerceKit | null = null;

  /**
   * Returns the shared CommerceKit instance. Use it instead of creating commerce clients yourself:
   * a Lens can only hold one connection to the commerce service.
   */
  static getInstance(): CommerceKit {
    if (!CommerceKit.instance) {
      CommerceKit.instance = new CommerceKit(defaultDependencies());
    }
    return CommerceKit.instance;
  }

  private readonly deps: CommerceKitDependencies;

  private commerceClient: CommerceClient | null = null;
  private connection: Promise<void> | null = null;
  private connected = false;
  private initialization: Promise<void> | null = null;
  private ready = false;

  private readonly products = new Map<string, Commerce.Product>();
  private readonly productTypes = new Map<string, Commerce.ProductType>();
  private purchases = new Map<string, Commerce.Purchase[]>();
  private purchasesSignature = "";
  // Logical clock ordering local changes against inventory snapshots: a snapshot requested before a
  // local change cannot override it.
  private clock = 0;
  private readonly localChanges = new Map<string, LocalChange>();

  private readonly consumableHandlers = new Map<string, ConsumableDeliveryHandler>();
  private readonly warnedMissingHandlers = new Set<string>();
  private readonly finalizedTokens = new Set<string>();
  private readonly finalizing = new Map<string, Promise<boolean>>();
  // Delivered consumable tokens awaiting acknowledgement, with the clock time of their delivery.
  private deliveredTokens: Map<string, number> | null = null;

  private readonly flows = new Map<string, PurchaseFlow>();
  private syncChain: Promise<void> = Promise.resolve();
  private queuedSync: Promise<void> | null = null;

  private readonly purchasesChangedEvent = new Event<void>();

  /**
   * Fires whenever the known purchases change: purchases were restored, a purchase completed or was
   * finalized, or a sync found a change such as an expired or cancelled subscription or a refunded
   * purchase. Read the new state with {@link isProductOwned} or {@link getPurchase}.
   */
  readonly onPurchasesChanged: PublicApi<void> = this.purchasesChangedEvent.publicApi();

  private constructor(deps: CommerceKitDependencies) {
    this.deps = deps;
  }

  /**
   * Connects to the commerce service, restores the user's purchases and finalizes purchases left
   * pending by an earlier session. Resolves once pending non-consumables and subscriptions are
   * acknowledged; recovered consumables are delivered in the background as soon as their handler is
   * registered. Safe to call many times and from many places: concurrent calls share one attempt, and a
   * failed attempt is retried by the next call. Other methods call it when needed.
   *
   * Native calls: `CommerceKitModule.createClient()`, `startConnection()`, `queryPurchase()` for each
   * product type, and `acknowledgePurchase()` for each pending purchase.
   *
   * @returns Resolves when CommerceKit is ready
   * @throws {CommerceKitError} When the service cannot be reached, for example with code NetworkError
   */
  initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.requestSync()
        .then(() => this.finalizePending())
        .then(() => {
          this.ready = true;
          this.log("Ready");
        })
        .catch((error: unknown) => {
          this.initialization = null;
          throw toCommerceKitError(error, "Initializing CommerceKit");
        });
    }
    return this.initialization;
  }

  /**
   * Deprecated: kept so CommerceKit 3.x code keeps working. Products are no longer defined in the Lens:
   * create them on the Specs developer portal (https://developers.specs.com/lenses). This only calls
   * {@link initialize}; the given products are ignored. Like in 3.x, it never rejects: failures are
   * logged.
   *
   * @deprecated Call {@link initialize} instead.
   * @param productCatalog - Ignored. Any array is accepted, such as the 3.x catalog entries
   */
  async initializeCatalog(productCatalog: readonly unknown[]): Promise<void> {
    if (productCatalog && productCatalog.length > 0) {
      this.warn(
        "initializeCatalog() ignores its product list: products are defined at https://developers.specs.com/lenses."
      );
    }
    try {
      await this.initialize();
    } catch (error) {
      this.warn(`CommerceKit initialization failed: ${errorMessage(error)}`);
    }
  }

  /**
   * Fetches the details of one product defined on the Specs developer portal. Results are cached for
   * the session.
   *
   * Native calls: `queryProductDetails([productId])`, once per product.
   *
   * @param productId - A product ID from the developer portal
   * @returns The product, with the same fields as in CommerceKit 3.x (`price.price` is a decimal amount,
   *   `type` a string) and `nativeProduct`, the Lens API product with everything it provides, such as
   *   `price.displayPrice` and, for subscriptions, `subscriptionOfferDetails`
   * @throws {CommerceKitError} With code ItemUnavailable when the Lens has no such product (or it is not
   *   published), or a connection error code
   */
  async getProductInfo(productId: string): Promise<CommerceProduct> {
    return toCommerceProduct(await this.loadProduct(productId));
  }

  /**
   * Buys a product. Opens the system checkout and resolves once the purchase is complete: a consumable
   * is first processed by its {@link registerConsumable} handler and only then acknowledged, which
   * consumes it; everything else is acknowledged right away so it is not refunded. While a purchase of
   * the product is in progress, another call returns the same promise (its offerId is ignored).
   *
   * Native calls: `launchPurchaseFlow(productId, offerId)`, then, once the result arrives through the
   * `onPurchasesUpdated` callback, `queryPurchase()` and `acknowledgePurchase(token)`.
   *
   * @param productId - A product ID from the developer portal
   * @param offerId - Subscriptions only: the {@link Commerce.SubscriptionOfferDetails.offerId} to buy;
   *   omit it to use the product's default offer. Ignored for other product types
   * @returns How the purchase ended; see {@link PurchaseStatus}. Cancelling is not an error
   * @throws {CommerceKitError} ItemUnavailable for an unknown or misconfigured product or an unknown
   *   offer, Error when a consumable has no delivery handler (both checked before anything is charged),
   *   or the code reported by the commerce service when checkout fails, for example Error or
   *   NetworkError
   */
  purchaseProduct(productId: string, offerId?: string | null): Promise<PurchaseOutcome> {
    const id = (productId || "").trim();
    if (!id) {
      return Promise.reject(
        new CommerceKitError(Commerce.ResponseCode.ItemUnavailable, "purchaseProduct requires a product ID.")
      );
    }
    const running = this.flows.get(id);
    if (running) {
      return running.outcome;
    }
    // Registered before runPurchase starts so a second call made meanwhile joins this flow.
    const flow = {
      productId: id,
      checkout: null,
      checkoutSettled: false,
      cancelTimer: null,
      knownTokens: new Set<string>(),
      completed: null,
    } as unknown as PurchaseFlow;
    this.flows.set(id, flow);
    flow.outcome = this.runPurchase(flow, offerId || null).finally(() => {
      this.stopCheckout(flow);
      if (this.flows.get(id) === flow) {
        this.flows.delete(id);
      }
    });
    return flow.outcome;
  }

  /**
   * Registers how a consumable purchase is processed. CommerceKit calls `deliver` for every completed
   * purchase of the product, including purchases recovered after the Lens was closed mid-purchase, and
   * acknowledges (consumes) the purchase only after `deliver` completes. If `deliver` returns `false` or
   * throws, the purchase stays pending and is offered again later: on refresh(), in the next session, or
   * on the next purchase attempt of the product. Once `deliver` has completed, it is not called again
   * for that purchase, even if acknowledging it fails. Registration is required before the product can
   * be sold. Registering again replaces the handler.
   *
   * Persist what `deliver` grants (for example with `global.persistentStorageSystem`). When a server
   * processes the token, it should do so idempotently, because a purchase is offered again until
   * `deliver` completes. `deliver` must eventually settle, and must not call purchaseProduct().
   *
   * The native API has no equivalent: it decides when CommerceKit calls `acknowledgePurchase(token)`,
   * which consumes the purchase. In Lens Studio Preview, a product registered before its first use is
   * simulated as a consumable.
   *
   * @param productId - The consumable's product ID
   * @param deliver - Processes the purchase; may be async; returns false to leave it for next time
   * @returns A function that removes the handler
   */
  registerConsumable(productId: string, deliver: ConsumableDeliveryHandler): () => void {
    const id = (productId || "").trim();
    if (!id || typeof deliver !== "function") {
      throw new CommerceKitError(
        Commerce.ResponseCode.Error,
        "registerConsumable requires a product ID and a delivery function."
      );
    }
    this.consumableHandlers.set(id, deliver);
    this.warnedMissingHandlers.delete(id);
    const waiting = this.unfinalizedPurchases(id);
    if (waiting.length > 0) {
      this.finalizeAll(waiting).then(() => this.publishPurchases());
    }
    return () => {
      if (this.consumableHandlers.get(id) === deliver) {
        this.consumableHandlers.delete(id);
      }
    };
  }

  /**
   * Whether the user currently owns a non-consumable or has an active subscription. Consumables are
   * never owned: they are consumed when delivered. Reads the restored state without network access;
   * await {@link initialize} first, or listen to {@link onPurchasesChanged}.
   *
   * @param productId - A product ID from the developer portal
   */
  isProductOwned(productId: string): boolean {
    if (this.productTypes.get(productId) === Commerce.ProductType.Consumable) {
      return false;
    }
    return this.purchaseState(productId) === Commerce.PurchaseState.Purchased;
  }

  /**
   * The user's most relevant purchase record of a product, from the restored state, or null when the
   * user has none. Use it to show that a purchase is Pending (paid, not finalized yet), when a
   * subscription renews (`isAutoRenewing`, `expiryTime`), or to pass `token` to a native method
   * through {@link client}.
   *
   * The native API has no equivalent: it reads the records of the last `queryPurchase()` sync without
   * network access.
   *
   * @param productId - A product ID from the developer portal
   */
  getPurchase(productId: string): Commerce.Purchase | null {
    let best: Commerce.Purchase | null = null;
    for (const purchase of this.purchasesOf(productId)) {
      if (!best) {
        best = purchase;
        continue;
      }
      const rank = stateRank(this.effectiveState(purchase));
      const bestRank = stateRank(this.effectiveState(best));
      if (rank > bestRank || (rank === bestRank && (purchase.expiryTime || 0) > (best.expiryTime || 0))) {
        best = purchase;
      }
    }
    return best;
  }

  /**
   * Syncs with the commerce service, then returns the state of the user's most relevant purchase of the
   * product: Purchased (owned, or subscription active), Pending (paid, not finalized yet), Expired
   * (subscription ended), Invalidated (refunded or revoked) or Unset (never bought, or a consumed
   * consumable).
   *
   * Native calls: like {@link refresh}.
   *
   * @param productId - A product ID from the developer portal
   * @throws {CommerceKitError} When the service cannot be reached
   */
  async checkPurchaseStatus(productId: string): Promise<Commerce.PurchaseState> {
    await this.refresh();
    return this.purchaseState(productId);
  }

  /**
   * Re-syncs purchases with the commerce service (for example after the Lens resumes, or after a change
   * made through {@link client}) and finalizes pending ones. Like {@link initialize}, it waits for
   * non-consumables and subscriptions to be acknowledged and delivers consumables in the background.
   *
   * Native calls: `queryPurchase()` for each product type, and `acknowledgePurchase()` for each pending
   * purchase.
   *
   * @throws {CommerceKitError} When the service cannot be reached
   */
  async refresh(): Promise<void> {
    if (!this.ready) {
      await this.initialize();
      return;
    }
    await this.requestSync();
    await this.finalizePending();
  }

  /**
   * The underlying commerce client, for operations CommerceKit does not wrap, for example
   * `cancelSubscription(getPurchase(productId).token)`. Resolves once CommerceKit is initialized, with
   * the same client CommerceKit uses:
   * - Purchase updates still flow through CommerceKit, which finalizes them.
   * - CommerceKit does not see changes made directly through the client until it syncs; call
   *   {@link refresh} afterwards.
   * - Do not start or end the connection or acknowledge purchases yourself; CommerceKit does.
   * In Lens Studio Preview this is the simulated client. It does not simulate subscriptions:
   * `cancelSubscription()` resolves with ResponseCode.ItemNotOwned and `updateSubscription()` with
   * ResponseCode.Error.
   */
  async client(): Promise<Commerce.Client> {
    await this.initialize();
    return this.getClient() as Commerce.Client;
  }

  private getClient(): CommerceClient {
    if (!this.commerceClient) {
      this.commerceClient = this.deps.createClient(
        (result, purchases) => this.onPurchasesUpdated(result, purchases),
        (productId) => this.consumableHandlers.has(productId)
      );
    }
    return this.commerceClient;
  }

  private purchaseState(productId: string): Commerce.PurchaseState {
    const purchase = this.getPurchase(productId);
    return purchase ? this.effectiveState(purchase) : Commerce.PurchaseState.Unset;
  }

  private connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }
    if (!this.connection) {
      this.connection = this.call(() => this.getClient().startConnection(), "Connecting to the commerce service").then(
        () => {
          this.connected = true;
          this.log("Connected to the commerce service");
        },
        (error: unknown) => {
          this.connection = null;
          throw error;
        }
      );
    }
    return this.connection;
  }

  // Runs a client operation, reconnecting once with a new client when the device dropped the session.
  // Launching a checkout is not retried: the first attempt may have reached the service.
  private async request<T>(
    operation: (client: CommerceClient) => Promise<T>,
    action: string,
    retryAfterReconnect: boolean = true
  ): Promise<T> {
    await this.connect();
    const client = this.getClient();
    try {
      return await operation(client);
    } catch (error) {
      if (!isConnectionLost(error)) {
        throw toCommerceKitError(error, action);
      }
      this.log(`The commerce session was lost during "${action}"; reconnecting`);
      this.dropClient(client);
      if (!retryAfterReconnect) {
        throw toCommerceKitError(error, action);
      }
      try {
        await this.connect();
      } catch (reconnectError) {
        const failure = toCommerceKitError(reconnectError, action);
        throw new CommerceKitError(
          Commerce.ResponseCode.ServiceDisconnected,
          `${action} failed: the commerce session was lost and reconnecting failed (${failure.message}).`,
          failure.debugMessage
        );
      }
      return this.call(() => operation(this.getClient()), action);
    }
  }

  private dropClient(client: CommerceClient): void {
    if (this.commerceClient !== client) {
      return;
    }
    this.commerceClient = null;
    this.connection = null;
    this.connected = false;
    this.endClientConnection(client);
  }

  // Ending explicitly also stops the native client from ending the connection when it is garbage
  // collected, which would cancel the new client's purchase-update subscription.
  private endClientConnection(client: CommerceClient | null): void {
    if (!client) {
      return;
    }
    try {
      client.endConnection();
    } catch (error) {
      this.warn(`Closing the commerce connection failed: ${errorMessage(error)}`);
    }
  }

  private async call<T>(operation: () => Promise<T>, action: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toCommerceKitError(error, action);
    }
  }

  private cleanIds(productIds: string[]): string[] {
    const ids: string[] = [];
    for (const rawId of productIds) {
      const id = (rawId || "").trim();
      if (id && ids.indexOf(id) < 0) {
        ids.push(id);
      }
    }
    return ids;
  }

  private async loadProduct(productId: string): Promise<Commerce.Product> {
    const id = (productId || "").trim();
    if (id && !this.products.has(id)) {
      const action = "Loading product details";
      try {
        this.storeProducts(await this.request((client) => client.queryProductDetails([id]), action));
      } catch (error) {
        // The service rejects the query with ItemUnavailable when it has no such product.
        const failure = toCommerceKitError(error, action);
        if (failure.code !== Commerce.ResponseCode.ItemUnavailable) {
          throw failure;
        }
      }
    }
    const product = this.products.get(id);
    if (!product) {
      throw new CommerceKitError(
        Commerce.ResponseCode.ItemUnavailable,
        `Product "${id}" was not found. Check the product ID and that the product is published at ` +
          "https://developers.specs.com/lenses."
      );
    }
    return product;
  }

  private storeProducts(products: Commerce.Product[]): void {
    for (const product of products || []) {
      if (product && product.id) {
        this.products.set(product.id, product);
        this.productTypes.set(product.id, product.type);
      }
    }
  }

  private resolveOfferId(product: Commerce.Product, offerId: string | null): string | null {
    if (!offerId) {
      return null;
    }
    if (product.type !== Commerce.ProductType.Subscription) {
      this.warn(`Ignoring offer "${offerId}" for "${product.id}": offers only apply to subscriptions.`);
      return null;
    }
    const offers = product.subscriptionOfferDetails || [];
    if (!offers.some((offer) => offer.offerId === offerId)) {
      throw new CommerceKitError(
        Commerce.ResponseCode.ItemUnavailable,
        `Offer "${offerId}" is not available for "${product.id}".`
      );
    }
    return offerId;
  }

  private async runPurchase(flow: PurchaseFlow, offerId: string | null): Promise<PurchaseOutcome> {
    const outcome = await this.runCheckout(flow, offerId);
    // A consumable's token is only for its handler, which processes it before the purchase is
    // acknowledged. By now the purchase is consumed or still waiting for the handler, so its record is
    // not passed on: processing the token here would happen after acknowledgement.
    if (this.productTypes.get(flow.productId) === Commerce.ProductType.Consumable) {
      return { ...outcome, purchase: null };
    }
    return outcome;
  }

  private async runCheckout(flow: PurchaseFlow, offerId: string | null): Promise<PurchaseOutcome> {
    const productId = flow.productId;
    await this.initialize();
    const product = await this.loadProduct(productId);
    const type = product.type;
    if (!isSellableType(type)) {
      // Such purchases never come back from the service, so they could not be finalized and would be refunded.
      throw new CommerceKitError(
        Commerce.ResponseCode.ItemUnavailable,
        `"${productId}" has no valid product type. Check it at https://developers.specs.com/lenses.`
      );
    }
    if (type === Commerce.ProductType.Consumable && !this.consumableHandlers.has(productId)) {
      throw new CommerceKitError(
        Commerce.ResponseCode.Error,
        `"${productId}" is a consumable. Call registerConsumable("${productId}", handler) before selling it.`
      );
    }
    const launchOfferId = this.resolveOfferId(product, offerId);

    const unfinished = this.unfinalizedPurchases(productId);
    if (unfinished.length > 0) {
      const earlierOutcome = await this.finishEarlierPurchases(flow, type, unfinished);
      if (earlierOutcome) {
        return earlierOutcome;
      }
    }
    if (type !== Commerce.ProductType.Consumable && this.isProductOwned(productId)) {
      return this.outcome("alreadyOwned", this.getPurchase(productId));
    }

    // Set up before launching: the result can arrive before launchPurchaseFlow resolves.
    flow.completed = null;
    flow.knownTokens = new Set(this.purchasesOf(productId).map((purchase) => purchase.token));
    flow.checkout = new Deferred<CheckoutResult>();
    flow.checkoutSettled = false;
    if (this.deps.startTimer) {
      flow.cancelTimer = this.deps.startTimer(
        () =>
          this.settleCheckout(flow, {
            code: Commerce.ResponseCode.Error,
            debugMessage: "",
            purchases: [],
            timedOut: true,
          }),
        CHECKOUT_TIMEOUT_MS
      );
    }
    const launch = await this.request(
      (client) => client.launchPurchaseFlow(productId, launchOfferId),
      `Starting the purchase of "${productId}"`,
      false
    );
    this.log(`Checkout for "${productId}" started: ${responseCodeName(launch.responseCode)}`);
    if (launch.responseCode !== Commerce.ResponseCode.Success) {
      this.stopCheckout(flow);
      return this.completeCheckout(flow, type, {
        code: launch.responseCode,
        debugMessage: launch.debugMessage,
        purchases: [],
        timedOut: false,
      });
    }
    return this.completeCheckout(flow, type, await flow.checkout.promise);
  }

  // Finishes purchases of the product that were paid but never finalized, instead of charging again.
  // Returns null when a new checkout should follow because the earlier purchases had already been
  // delivered or are gone.
  private async finishEarlierPurchases(
    flow: PurchaseFlow,
    type: Commerce.ProductType,
    unfinished: Commerce.Purchase[]
  ): Promise<PurchaseOutcome | null> {
    const productId = flow.productId;
    this.log(`Finalizing an earlier purchase of "${productId}" before any new checkout`);
    const deliveredEarlier = new Set(
      unfinished.filter((purchase) => this.delivered().has(purchase.token)).map((purchase) => purchase.token)
    );
    await this.finalizeAll(unfinished);
    if (this.unfinalizedPurchases(productId).length > 0) {
      // An acknowledgement can be applied even when its response is lost; a sync shows the real state.
      await this.syncQuietly();
      await this.finalizeAll(this.unfinalizedPurchases(productId));
    }
    this.publishPurchases();
    const remaining = this.unfinalizedPurchases(productId);
    if (remaining.length > 0) {
      return this.outcome("pending", remaining[0]);
    }
    if (type !== Commerce.ProductType.Consumable) {
      return this.isProductOwned(productId) ? this.outcome("purchased", this.getPurchase(productId)) : null;
    }
    const deliveredNow = unfinished.find(
      (purchase) => this.finalizedTokens.has(purchase.token) && !deliveredEarlier.has(purchase.token)
    );
    return deliveredNow ? this.outcome("purchased", this.snapshot(deliveredNow)) : null;
  }

  private async completeCheckout(
    flow: PurchaseFlow,
    type: Commerce.ProductType,
    result: CheckoutResult
  ): Promise<PurchaseOutcome> {
    const productId = flow.productId;
    const code = result.code;
    this.log(
      result.timedOut
        ? `No checkout result for "${productId}" arrived in time; checking the inventory`
        : `Checkout for "${productId}" finished: ${responseCodeName(code)}`
    );
    if (!result.timedOut) {
      if (code === Commerce.ResponseCode.UserCanceled) {
        this.syncInBackground();
        return this.outcome("cancelled", null);
      }
      if (code !== Commerce.ResponseCode.Success && code !== Commerce.ResponseCode.ItemAlreadyOwned) {
        this.syncInBackground();
        const detail = result.debugMessage ? `: ${result.debugMessage}` : "";
        throw new CommerceKitError(
          code,
          `Purchase of "${productId}" failed (${responseCodeName(code)})${detail}.`,
          result.debugMessage
        );
      }
    }

    const isNewPurchase = (purchase: Commerce.Purchase) =>
      !!purchase &&
      purchase.productId === productId &&
      this.needsFinalizing(purchase) &&
      !flow.knownTokens.has(purchase.token);
    const received = result.purchases.filter(isNewPurchase).map((purchase) => this.snapshot(purchase));
    // Recorded locally so a sync requested before the checkout ended cannot drop them.
    received.forEach((purchase) => this.upsertCachedPurchase(purchase));
    await this.finalizeAll(received);
    // The update may only name the product, and a failed attempt is retried once with fresh state.
    await this.syncQuietly();
    await this.finalizeAll(this.purchasesOf(productId).filter(isNewPurchase));
    // This product's purchase is not retried a third time; it stays pending for the next sync.
    this.finalizePendingInBackground(productId);
    this.publishPurchases();

    if (flow.completed) {
      const current = type !== Commerce.ProductType.Consumable ? this.getPurchase(productId) : null;
      return this.outcome("purchased", current || flow.completed);
    }
    if (!result.timedOut && type !== Commerce.ProductType.Consumable && this.isProductOwned(productId)) {
      const status = code === Commerce.ResponseCode.Success ? "purchased" : "alreadyOwned";
      return this.outcome(status, this.getPurchase(productId));
    }
    const waiting = this.purchasesOf(productId).filter(isNewPurchase);
    if (waiting.length > 0 || (!result.timedOut && code === Commerce.ResponseCode.Success)) {
      return this.outcome("pending", waiting[0] || null);
    }
    if (result.timedOut) {
      throw new CommerceKitError(
        Commerce.ResponseCode.Error,
        `No checkout result for "${productId}" was received. ` +
          "If the purchase completes later, CommerceKit finalizes it automatically."
      );
    }
    throw new CommerceKitError(
      code,
      `Purchase of "${productId}" failed (${responseCodeName(code)}).`,
      result.debugMessage
    );
  }

  private settleCheckout(flow: PurchaseFlow, result: CheckoutResult): void {
    if (!flow.checkout || flow.checkoutSettled) {
      return;
    }
    this.stopCheckout(flow);
    flow.checkout.resolve(result);
  }

  private stopCheckout(flow: PurchaseFlow): void {
    flow.checkoutSettled = true;
    if (flow.cancelTimer) {
      flow.cancelTimer();
      flow.cancelTimer = null;
    }
  }

  private onPurchasesUpdated(result: Commerce.PurchaseResult, purchases: Commerce.Purchase[]): void {
    try {
      const code = result ? result.responseCode : Commerce.ResponseCode.Error;
      const debugMessage = result && result.debugMessage ? result.debugMessage : "";
      const records = (purchases || []).filter((purchase) => !!purchase);
      const productIds = this.cleanIds(records.map((purchase) => purchase.productId));
      const update: CheckoutResult = { code, debugMessage, purchases: records, timedOut: false };
      const waiting = Array.from(this.flows.values()).filter((flow) => flow.checkout && !flow.checkoutSettled);
      let matched = false;
      for (const flow of waiting) {
        // A record without a token names the product of a cancelled or failed checkout; otherwise only a
        // token unknown when the checkout opened belongs to this checkout.
        const belongs = records.some(
          (purchase) =>
            purchase.productId === flow.productId && (!purchase.token || !flow.knownTokens.has(purchase.token))
        );
        if (belongs) {
          this.settleCheckout(flow, update);
          matched = true;
        }
      }
      if (!matched && productIds.length === 0 && waiting.length === 1) {
        this.settleCheckout(waiting[0], update);
        matched = true;
      }
      if (!matched) {
        this.syncInBackground();
      }
    } catch (error) {
      this.warn(`Handling a purchase update failed: ${errorMessage(error)}`);
    }
  }

  private requestSync(): Promise<void> {
    if (this.queuedSync) {
      return this.queuedSync;
    }
    const sync = this.syncChain
      .catch(() => undefined)
      .then(() => {
        this.queuedSync = null;
        return this.runSync();
      });
    this.queuedSync = sync;
    this.syncChain = sync;
    return sync;
  }

  private async syncQuietly(): Promise<void> {
    try {
      await this.requestSync();
    } catch (error) {
      this.warn(`Syncing purchases failed: ${errorMessage(error)}`);
    }
  }

  private syncInBackground(): void {
    this.requestSync().then(
      () => this.finalizePendingInBackground(),
      (error: unknown) => this.warn(`Syncing purchases failed: ${errorMessage(error)}`)
    );
  }

  // Only reads the inventory. Finalizing runs outside the sync chain so a delivery handler that calls
  // back into CommerceKit, or never finishes, cannot block syncs.
  private async runSync(): Promise<void> {
    const requestedAt = ++this.clock;
    const types = [
      Commerce.ProductType.NonConsumable,
      Commerce.ProductType.Consumable,
      Commerce.ProductType.Subscription,
    ];
    // Querying by type also tells which purchases are consumables, without a product-details request.
    const results = await this.request(
      (client) => Promise.all(types.map((type) => client.queryPurchase(type))),
      "Restoring purchases"
    );
    const next = new Map<string, Commerce.Purchase[]>();
    const consumableTokens = new Set<string>();
    results.forEach((records, index) => {
      const type = types[index];
      for (const record of records || []) {
        if (!record || !record.productId) {
          continue;
        }
        this.productTypes.set(record.productId, type);
        if (type === Commerce.ProductType.Consumable) {
          consumableTokens.add(record.token);
          if (this.finalizedTokens.has(record.token) || record.isAcknowledged) {
            continue;
          }
        }
        const list = next.get(record.productId) || [];
        list.push(this.snapshot(record));
        next.set(record.productId, list);
      }
    });
    this.localChanges.forEach((change, token) => {
      if (change.at < requestedAt) {
        this.localChanges.delete(token);
        return;
      }
      const list = (next.get(change.record.productId) || []).filter((record) => record.token !== token);
      list.push(change.record);
      next.set(change.record.productId, list);
    });
    this.purchases = next;
    this.settleDelivered(consumableTokens, requestedAt);
    this.publishPurchases();
    this.resolveCheckoutsFromInventory();
  }

  // A purchase can complete without its checkout update reaching the Lens (for example when the commerce
  // service restarts). A new pending purchase of the product in the inventory settles the checkout.
  private resolveCheckoutsFromInventory(): void {
    this.flows.forEach((flow) => {
      if (!flow.checkout || flow.checkoutSettled) {
        return;
      }
      const fresh = this.purchasesOf(flow.productId).filter(
        (purchase) => this.needsFinalizing(purchase) && !flow.knownTokens.has(purchase.token)
      );
      if (fresh.length > 0) {
        this.settleCheckout(flow, {
          code: Commerce.ResponseCode.Success,
          debugMessage: "",
          purchases: fresh,
          timedOut: false,
        });
      }
    });
  }

  private snapshot(purchase: Commerce.Purchase): Commerce.Purchase {
    const finalized = this.finalizedTokens.has(purchase.token);
    // Only a pending record is settled locally; refunds and expiry reported by the service always win.
    const settled =
      purchase.purchaseState === Commerce.PurchaseState.Pending && (finalized || !!purchase.isAcknowledged);
    return {
      token: purchase.token,
      productId: purchase.productId,
      purchaseTime: purchase.purchaseTime,
      purchaseState: settled ? Commerce.PurchaseState.Purchased : purchase.purchaseState,
      isAcknowledged: !!purchase.isAcknowledged || finalized,
      isAutoRenewing: !!purchase.isAutoRenewing,
      expiryTime: purchase.expiryTime === undefined ? null : purchase.expiryTime,
    } as unknown as Commerce.Purchase;
  }

  private effectiveState(purchase: Commerce.Purchase): Commerce.PurchaseState {
    if (
      purchase.purchaseState === Commerce.PurchaseState.Purchased &&
      purchase.expiryTime !== null &&
      purchase.expiryTime !== undefined &&
      !purchase.isAutoRenewing &&
      purchase.expiryTime <= this.deps.now()
    ) {
      // A cancelled subscription whose paid period ended; the next sync reports it as Expired.
      return Commerce.PurchaseState.Expired;
    }
    return purchase.purchaseState;
  }

  private needsFinalizing(purchase: Commerce.Purchase): boolean {
    return (
      !!purchase.token &&
      purchase.purchaseState === Commerce.PurchaseState.Pending &&
      !purchase.isAcknowledged &&
      !this.finalizedTokens.has(purchase.token)
    );
  }

  private purchasesOf(productId: string): Commerce.Purchase[] {
    return this.purchases.get(productId) || [];
  }

  private unfinalizedPurchases(productId: string): Commerce.Purchase[] {
    return this.purchasesOf(productId).filter((purchase) => this.needsFinalizing(purchase));
  }

  // Waits for non-consumables and subscriptions to be acknowledged; consumables are delivered in the
  // background because their handlers may call back into CommerceKit.
  private finalizePending(exceptProductId: string | null = null): Promise<void> {
    const acknowledgements: Promise<boolean>[] = [];
    this.purchases.forEach((list) =>
      list.forEach((purchase) => {
        if (!this.needsFinalizing(purchase) || purchase.productId === exceptProductId) {
          return;
        }
        const work = this.finalize(purchase);
        if (this.productTypes.get(purchase.productId) !== Commerce.ProductType.Consumable) {
          acknowledgements.push(work);
        }
      })
    );
    return Promise.all(acknowledgements).then(() => undefined);
  }

  private finalizePendingInBackground(exceptProductId: string | null = null): void {
    this.finalizePending(exceptProductId);
  }

  private async finalizeAll(purchases: Commerce.Purchase[]): Promise<void> {
    for (const purchase of purchases) {
      await this.finalize(purchase);
    }
  }

  // Single-flight per token, so duplicate updates, syncs and retries never deliver or acknowledge twice.
  // Never rejects.
  private finalize(purchase: Commerce.Purchase): Promise<boolean> {
    const token = purchase.token;
    if (!token) {
      return Promise.resolve(false);
    }
    if (this.finalizedTokens.has(token)) {
      return Promise.resolve(true);
    }
    const running = this.finalizing.get(token);
    if (running) {
      return running;
    }
    // Starts on a later tick so the attempt is registered before a handler can re-enter CommerceKit.
    const work = Promise.resolve()
      .then(() => this.runFinalize(purchase))
      .catch((error: unknown) => {
        this.warn(`Finalizing "${purchase.productId}" failed: ${errorMessage(error)}`);
        return false;
      })
      .finally(() => this.finalizing.delete(token));
    this.finalizing.set(token, work);
    return work;
  }

  private async runFinalize(purchase: Commerce.Purchase): Promise<boolean> {
    const { token, productId } = purchase;
    const type = this.productTypes.get(productId);
    if (!isSellableType(type)) {
      // Acknowledging an unclassified purchase could consume an undelivered consumable; wait for a sync.
      return false;
    }
    const isConsumable = type === Commerce.ProductType.Consumable;
    if (isConsumable && !this.delivered().has(token)) {
      const deliver = this.consumableHandlers.get(productId);
      if (!deliver) {
        this.warnMissingHandler(productId);
        return false;
      }
      this.log(`Passing "${productId}" to its registerConsumable handler; it is acknowledged once the handler completes`);
      let processed: boolean | void;
      try {
        processed = await deliver(purchase);
      } catch (error) {
        this.warn(
          `The handler of "${productId}" failed; the purchase stays pending, unacknowledged, and is offered again: ` +
            errorMessage(error)
        );
        return false;
      }
      if (processed === false) {
        this.log(`The handler left "${productId}" for next time; it stays pending, unacknowledged`);
        return false;
      }
      this.rememberDelivered(token);
      this.log(`The handler processed "${productId}"; acknowledging it`);
    }

    let result: Commerce.PurchaseResult;
    try {
      result = await this.request((client) => client.acknowledgePurchase(token), `Acknowledging "${productId}"`);
    } catch (error) {
      this.warn(`${errorMessage(error)}. It will be retried.`);
      return false;
    }
    if (result.responseCode !== Commerce.ResponseCode.Success) {
      this.warn(`Acknowledging "${productId}" failed (${responseCodeName(result.responseCode)}). It will be retried.`);
      return false;
    }

    this.finalizedTokens.add(token);
    this.forgetDelivered(token);
    const completed = this.snapshot(purchase);
    if (isConsumable) {
      this.removeCachedPurchase(token);
      this.localChanges.delete(token);
    } else {
      this.upsertCachedPurchase(completed);
    }
    const flow = this.flows.get(productId);
    if (flow && !flow.completed && !flow.knownTokens.has(token)) {
      flow.completed = completed;
    }
    this.log(isConsumable ? `Acknowledged "${productId}": consumed` : `Acknowledged "${productId}"`);
    this.publishPurchases();
    return true;
  }

  private warnMissingHandler(productId: string): void {
    if (this.warnedMissingHandlers.has(productId)) {
      return;
    }
    this.warnedMissingHandlers.add(productId);
    this.warn(
      `A purchase of consumable "${productId}" is waiting for its delivery handler. ` +
        `It is delivered once registerConsumable("${productId}", handler) is called.`
    );
  }

  private upsertCachedPurchase(purchase: Commerce.Purchase): void {
    const list = this.purchasesOf(purchase.productId).filter((record) => record.token !== purchase.token);
    list.push(purchase);
    this.purchases.set(purchase.productId, list);
    this.localChanges.set(purchase.token, { record: purchase, at: ++this.clock });
  }

  private removeCachedPurchase(token: string): void {
    this.purchases.forEach((list, productId) => {
      const remaining = list.filter((purchase) => purchase.token !== token);
      if (remaining.length > 0) {
        this.purchases.set(productId, remaining);
      } else {
        this.purchases.delete(productId);
      }
    });
  }

  private publishPurchases(): void {
    const parts: string[] = [];
    this.purchases.forEach((list) =>
      list.forEach((purchase) =>
        parts.push(
          [
            purchase.productId,
            purchase.token,
            this.effectiveState(purchase),
            purchase.isAutoRenewing,
            purchase.expiryTime,
          ].join("|")
        )
      )
    );
    const signature = parts.sort().join(";");
    if (signature === this.purchasesSignature) {
      return;
    }
    this.purchasesSignature = signature;
    this.purchasesChangedEvent.invoke();
  }

  private delivered(): Map<string, number> {
    if (!this.deliveredTokens) {
      let tokens: string[] = [];
      try {
        tokens = this.deps.tokenStore ? this.deps.tokenStore.load() : [];
      } catch (error) {
        this.warn(`Reading delivered consumables failed: ${errorMessage(error)}`);
      }
      // Deliveries from earlier sessions predate every inventory of this one.
      this.deliveredTokens = new Map(tokens.map((token) => [token, 0]));
    }
    return this.deliveredTokens;
  }

  private rememberDelivered(token: string): void {
    this.delivered().set(token, ++this.clock);
    this.saveDelivered();
  }

  private forgetDelivered(token: string): void {
    if (this.delivered().delete(token)) {
      this.saveDelivered();
    }
  }

  // A delivered consumable missing from an inventory requested after its delivery was consumed (its
  // acknowledgement went through even if the response was lost) or refunded. Either way it must not be
  // delivered again. Inventories requested before the delivery prove nothing and are ignored.
  private settleDelivered(consumableTokens: Set<string>, requestedAt: number): void {
    const delivered = this.delivered();
    let changed = false;
    delivered.forEach((deliveredAt, token) => {
      if (deliveredAt < requestedAt && !consumableTokens.has(token) && !this.finalizing.has(token)) {
        delivered.delete(token);
        this.finalizedTokens.add(token);
        changed = true;
      }
    });
    if (changed) {
      this.saveDelivered();
    }
  }

  private saveDelivered(): void {
    if (!this.deps.tokenStore) {
      return;
    }
    try {
      this.deps.tokenStore.save(Array.from(this.delivered().keys()));
    } catch (error) {
      this.warn(`Saving delivered consumables failed: ${errorMessage(error)}`);
    }
  }

  private outcome(status: PurchaseStatus, purchase: Commerce.Purchase | null): PurchaseOutcome {
    return {
      status,
      success: status === "purchased" || status === "alreadyOwned",
      cancelled: status === "cancelled",
      purchase,
    };
  }

  private log(message: string): void {
    print(`[CommerceKit] ${message}`);
  }

  private warn(message: string): void {
    print(`[CommerceKit] WARNING: ${message}`);
  }
}
