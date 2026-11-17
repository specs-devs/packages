# How Agnostic3DButton works

[← Agent usage index](../README.md)

The idea comes from the Essentials soft-press example (`SoftPressController`): project the finger on
the button's press axis and turn the depth into a 0..1 value. That version needed a physics box
collider, eight vertex helper objects and one specific finger. This package keeps the feel and drops
the rest.

## The made-up volume

Everything happens in the button's local space (`getInvertedWorldTransform()` of its SceneObject):

```
 y = hoverHeight  ┌──────────────┐   hover band: the finger is above the button
                  │              │
 y = 0 (top face) ├──────────────┤   press band: depth = −y
                  │              │
 y = −travel      └──────────────┘   fully pressed (an engaged finger may go 1.5× deeper)
```

Laterally the volume is a box (|x| ≤ size.x / 2, |z| ≤ size.y / 2) or a cylinder
(x² + z² ≤ (size.x / 2)²). No colliders are created, so it costs a few multiplications per finger per
frame and works on moving, rotated or scaled buttons.

## Engaging a finger

A finger is "engaged" while it stays inside the volume. With `enterFromTopOnly`, it only becomes
engaged when it is first seen in the hover band (above the top face): a finger that slides in from
the side or comes up from below never presses. Leaving the volume disengages it.

## Press value

Each frame the deepest engaged finger gives the target depth `clamp(−y / travel, 0, 1)`.

- Deeper than now: the press value follows the finger in the same frame.
- Shallower: it springs back exponentially at `returnSpeed` (28/s by default), so the cap never snaps but never lags either.

## Staying down a little, never stuck

- While a pressing finger is below the top plane it stays engaged even if it drifts up to `holdMargin` outside the footprint, or deeper than `travel` (down to `travel` × 3).
- Just above the top (within `releaseHeight`) it still holds the press; once it lifts off, the value holds for `releaseDelay` (0.12 s) and then springs back.
- A finger that is lost (untracked, invalid) or slides out of the hold region releases at once, with no delay.
- Failsafe: if no finger has pushed for `maxHoldWithoutFinger` (0.5 s), the button springs back whatever else happens. The press value always converges to the finger's depth, and the hysteresis below still gives exactly one click per press.

## Thresholds and hysteresis

`onPressed` fires when the value crosses `pressThreshold` (0.7); the button stays pressed until the
value falls under `releaseThreshold` (0.4), which fires `onReleased` and `onClick`. The gap between
the two means a shaky finger around one threshold can't fire a burst of clicks. In `toggle` mode each
click flips `isOn` and fires `onToggle`.

## The visual

`Agnostic3DButtonVisual` never feeds back into the logic. It generates with MeshBuilder at start a
holed base (a bezel with an opening `clearance` wider than the cap, inner walls and a floor: a well
deep enough that the pressed cap never reaches the floor), the cap that rests a little above the bezel
and sinks below it at full press, and a glow ring on the bezel. Each LateUpdate it sets the cap height
from `pressValue × travel`, squashes it slightly near the bottom (never wider than the hole), eases
its colour between the theme's idle / hover / pressed / on colours, and drives the glow (additive)
from hover, press depth and a short flash on click.

The UIKit style draws a thin slab instead, with UIKit's corner radius, an inset border and a gradient
fill written into a small procedural texture, cross-fading between UIKit's state colours in ~0.2 s.

The finger shadow is a flat, crisp-edged disc on the cap top under the nearest finger (`closestFinger`), in a darker
shade of the cap's current colour (`shadowDarkness`). It is large at `shadowRange` and shrinks to `shadowMinRadius` at
contact, fades in only over the top quarter of the range, is slightly squashed while pressing, and is clipped to the
cap's flat top.