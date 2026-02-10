import { CommercePrice } from "./CommercePrice";

/**
 * Represents a complete product definition for commerce catalogs.
 * Contains all necessary information to display and process product purchases.
 */
@typedef
export class CommerceProduct {
  /**
   * Unique identifier for the product.
   * This ID will be used to reference the product in commerce operations.
   */
  @input("string")
  @label("ID")
  @hint("Unique product identifier. This ID is used in commerce operations.")
  id: string;

  /**
   * The type of product (e.g., consumable, non-consumable).
   * Determines how the product behaves after purchase.
   */
  @input("string")
  @label("Type")
  @hint(
    "Type of product (e.g., consumable, non-consumable). Determines how the product behaves after purchase."
  )
  @widget(
    new ComboBoxWidget([new ComboBoxItem("Non Consumable", "NonConsumable")])
  )
  type: string = "NonConsumable";

  /**
   * The human-readable name displayed to users.
   */
  @input("string")
  @label("Display Name")
  @hint("Human-readable name for the product.")
  displayName: string;

  /**
   * Category description of the product for users.
   */
  @input("string")
  @label("Category")
  @hint("Category description of the product for users.")
  description: string;

  /**
   * Pricing information for this product.
   */
  @input
  @label("Price")
  @hint("Pricing information for this product.")
  price: CommercePrice;

  /**
   * URI pointing to the product's icon image.
   */
  @input("string")
  @label("Icon URI [Optional]")
  @hint("URI pointing to the product's icon image.")
  iconUri: string;

  /**
   * Additional metadata or configuration for the product in JSON format.
   */
  @input("string")
  @label("Extras [Optional]")
  @hint("Additional metadata or configuration for the product in JSON format.")
  extras: string;
}
