/**
 * Specs Inc. 2026
 * Validation and assertion utilities for input checking, null safety, and error handling.
 * Provides consistent validation patterns across the codebase with clear error messages.
 */

/**
 * Utility class for validation and assertion operations
 */
export class ValidationUtils {
  /**
   * Assert value is not null, throw error with message if it is
   * @param value - Value to check
   * @param message - Error message to throw
   * @returns Value if not null
   * @throws Error if value is null or undefined
   */
  static assertNotNull<T>(value: T | null | undefined, message: string): T {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
    return value;
  }

  /**
   * Assert condition is true, throw error with message if false
   * @param condition - Condition to check
   * @param message - Error message to throw
   * @throws Error if condition is false
   */
  static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Execute callback only if value is not null
   * @param value - Value to check
   * @param callback - Callback to execute if not null
   * @returns Callback result or null
   */
  static ifNotNull<T, R>(
    value: T | null,
    callback: (v: T) => R
  ): R | null {
    if (value !== null && value !== undefined) {
      return callback(value);
    }
    return null;
  }

  /**
   * Execute callback only if reference exists (not null/undefined)
   * @param ref - Reference to check
   * @param callback - Callback to execute if exists
   * @returns Callback result or undefined
   */
  static ifExists<T extends object, R>(
    ref: T | null | undefined,
    callback: (ref: T) => R
  ): R | undefined {
    if (ref !== null && ref !== undefined) {
      return callback(ref);
    }
    return undefined;
  }

  /**
   * Validate required inputs are provided
   * @param inputs - Object of input values
   * @param requiredKeys - Array of required key names
   * @throws Error if any required input is missing or null
   */
  static validateInputs(
    inputs: {[key: string]: any},
    requiredKeys: string[]
  ): void {
    for (const key of requiredKeys) {
      if (!(key in inputs) || inputs[key] === null || inputs[key] === undefined) {
        throw new Error(`Required input '${key}' is missing or null`);
      }
    }
  }

  /**
   * Check if value is null or undefined
   * @param value - Value to check
   * @returns True if value is null or undefined
   */
  static isNull(value: any): boolean {
    return value === null || value === undefined;
  }

  /**
   * Check if value is not null and not undefined
   * @param value - Value to check
   * @returns True if value is not null and not undefined
   */
  static isNotNull(value: any): boolean {
    return value !== null && value !== undefined;
  }
}
