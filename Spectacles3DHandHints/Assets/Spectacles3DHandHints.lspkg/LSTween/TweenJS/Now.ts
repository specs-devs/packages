/**
 * Specs Inc. 2026
 * Time utility function for tween system providing millisecond-precision timestamps. Wraps Lens
 * Studio's getTime() function and converts seconds to milliseconds for consistent timing across
 * all animation calculations and frame updates.
 */
const now = (): number => getTime() * 1000;

export default now;
