/**
 * Specs Inc. 2026
 * Assertion utilities for runtime validation and type guarding. Provides assert() for
 * condition validation with TypeScript type assertions, and verify() for non-null value
 * verification with automatic type narrowing to NonNullable.
 */

/** Asserts that the given condition is true, otherwise throws an error with the given message. */
export function assert(
  condition: unknown,
  message?: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** Verifies that the given value is not `undefined` or `null`, otherwise throws an error with the given message. */
export function verify<T>(value: T, message?: string): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}
