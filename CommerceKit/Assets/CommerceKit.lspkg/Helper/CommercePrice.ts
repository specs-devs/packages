/**
 * SPECS Inc. 2027
 * Price of a product returned by CommerceKit.getProductInfo(), with the CommerceKit 3.x fields. Prices
 * are defined on the Specs developer portal (https://developers.specs.com/lenses). To show a price, use
 * the formatted `nativeProduct.price.displayPrice` instead.
 */
export class CommercePrice {
  /**
   * Amount in major currency units, for example 1.99 (the Lens API price in the smallest currency unit,
   * divided by 100).
   */
  price: number = 0;

  /**
   * ISO 4217 currency code, for example "USD".
   */
  currency: string = "USD";
}
