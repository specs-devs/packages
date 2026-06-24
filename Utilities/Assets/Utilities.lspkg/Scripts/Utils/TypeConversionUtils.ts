/**
 * Specs Inc. 2026
 * Type conversion utilities for string parsing, number conversions, and safe type handling.
 * Provides functions for converting strings to numbers with locale awareness and default values.
 */

/**
 * Utility class for type conversion operations
 */
export class TypeConversionUtils {
  /**
   * Convert string to number (handles comma decimal separators)
   * Useful for parsing user input that may use commas instead of dots
   * @param s - String to convert
   * @returns Parsed number
   * @throws Error if invalid number format
   */
  static convertToNumber(s: string): number {
    // Replace comma with dot for international number parsing
    s = s.replace(",", ".");
    const result = parseFloat(s);

    if (isNaN(result)) {
      throw new Error(`Invalid number format: ${s}`);
    }

    return result;
  }

  /**
   * Safely parse number with default value
   * @param str - String to parse
   * @param defaultValue - Default value if parsing fails (default: 0)
   * @returns Parsed number or default
   */
  static safeParseNumber(str: string, defaultValue: number = 0): number {
    try {
      return TypeConversionUtils.convertToNumber(str);
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Safely parse integer with default value
   * @param str - String to parse
   * @param defaultValue - Default value if parsing fails (default: 0)
   * @returns Parsed integer or default
   */
  static safeParseInt(str: string, defaultValue: number = 0): number {
    try {
      const num = TypeConversionUtils.convertToNumber(str);
      return Math.floor(num);
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Convert value to boolean
   * Handles string representations like "true", "false", "1", "0"
   * @param value - Value to convert
   * @returns Boolean representation
   */
  static toBoolean(value: any): boolean {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      return lower === "true" || lower === "1" || lower === "yes";
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    return Boolean(value);
  }

  /**
   * Convert value to string safely
   * @param value - Value to convert
   * @param defaultValue - Default value if conversion fails
   * @returns String representation
   */
  static toString(value: any, defaultValue: string = ""): string {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    return String(value);
  }
}
