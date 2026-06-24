/**
 * Specs Inc. 2026
 * Global default tween group singleton for automatic tween management. Provides shared group
 * instance used by LSTween wrapper methods, enabling immediate tween playback without explicit
 * group creation while maintaining centralized update loop integration.
 */
import Group from './Group'

export const mainGroup = new Group()
