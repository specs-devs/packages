/**
 * SPECS Inc. 2027
 * Details of a product, as returned by CommerceKit.getProductInfo(). Products are defined on the Specs
 * developer portal (https://developers.specs.com/lenses). The fields keep their CommerceKit 3.x
 * meaning; everything the Lens API provides, such as the formatted price and subscription offers, is
 * in {@link CommerceProduct.nativeProduct}.
 */
import { CommercePrice } from "./CommercePrice";

export class CommerceProduct {
  /**
   * Product ID from the developer portal.
   */
  id: string = "";

  /**
   * "NonConsumable", "Consumable", "Subscription" or "Unknown". The enum is `nativeProduct.type`.
   */
  type: string = "Unknown";

  /**
   * Name shown to users.
   */
  displayName: string = "";

  /**
   * Description shown to users.
   */
  description: string = "";

  /**
   * Price as a decimal amount. For subscriptions, the price of the base plan.
   */
  price: CommercePrice = new CommercePrice();

  /**
   * URI of the product's icon, or an empty string.
   */
  iconUri: string = "";

  /**
   * Custom metadata configured for the product (usually JSON), or an empty string.
   */
  extras: string = "";

  /**
   * The product as returned by the Lens API, with everything it provides: `price.displayPrice` (the
   * price formatted for the user), `price.price` in the smallest currency unit, `type` as a
   * {@link Commerce.ProductType}, and `subscriptionOfferDetails` for subscriptions. Set on every
   * product CommerceKit returns; in Lens Studio Preview it is a simulated object with the same fields.
   */
  nativeProduct!: Commerce.Product;
}
