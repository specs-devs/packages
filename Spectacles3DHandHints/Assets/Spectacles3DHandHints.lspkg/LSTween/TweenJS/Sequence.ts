/**
 * Specs Inc. 2026
 * Unique identifier generator for tween instances. Provides sequential ID assignment for tracking
 * and managing individual tweens within groups, enabling efficient lookup, removal, and lifecycle
 * management across the animation system.
 */

/**
 * Utils
 */
export default class Sequence {
	private static _nextId = 0

	static nextId(): number {
		return Sequence._nextId++
	}
}
