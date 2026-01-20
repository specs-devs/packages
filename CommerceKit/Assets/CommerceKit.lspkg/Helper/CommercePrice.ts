/**
 * Represents a price structure for commerce products.
 * Handles pricing information including amount and currency with automatic formatting capabilities.
 */
@typedef
export class CommercePrice {
  @input("float")
  @label("Price ($1.99 - $99.99)")
  @hint("Set the price for the product.")
  @widget(new SpinBoxWidget(1.99, 99.99, 0.01))
  price: number = 1.99;

  /**
   * The currency code for this price.
   * Currently supports USD with automatic formatting.
   */
  @input("string")
  @label("Currency")
  @hint("Currency code for this price. Currently supports USD.")
  @widget(new ComboBoxWidget([new ComboBoxItem("USD", "USD")]))
  currency: string = "USD";
}
