# AutoFloorFinder guide

[← Agent usage index](../README.md)

## Use when

Understand why the estimator votes on hits or compare related placement packages.

## Why not a single raycast?

A single downward ray is noisy: it hits furniture, feet, and mesh artifacts, and it drifts as
tracking refines. Auto Floor Finder instead:

- Casts a **fan of rays** (configurable pitch angles) in batched attempts, several attempts per cycle.
- Accepts hits only inside a **plausibility band** of camera-to-floor distance (90–250 cm by
  default — a standing wearer; lower `minUserToFloorDistanceCm` for seated experiences).
- Requires **agreement**: minimum hits per attempt, minimum successful attempts per cycle, and a
  maximum height spread before anything is committed.
- Guards commits with **height-jump hysteresis** — a suspicious new floor level becomes a
  *candidate* first and must be corroborated before it replaces the committed floor.
- Runs a calibration lifecycle: **Acquiring → Tracking → Locked**. After enough consecutive
  stable cycles it locks and drops to a cheap revalidation cadence (default every 20 s), unlocking
  automatically if the wearer's height-over-floor shifts or revalidation disagrees.

## Related packages

- **SurfacePlacement** (this repository) is the *interactive* approach: the user points, hovers,
  adjusts, and confirms where content goes, with guidance UI (hand hints, instruction text,
  sliders). Choose it when placement is an intentional user act and the user should pick the spot.
- **Auto Floor Finder** (this package) is the *automatic* alternative: zero UI, zero interaction —
  content is on the floor before the user has done anything, and stays honest over time. Choose it
  when placement must not cost the user attention (avatars, boards, play spaces, ambient content),
  and accept that the component estimates rather than asks.
- **WorldQueryHit** demonstrates the raw WorldQuery hit-test API: point at a surface with SIK
  input and place an object on the hit — the minimal building block both of the above are built
  from.

## Roadmap — automatic counterparts under consideration (feedback wanted)

This revision deliberately tracks **only the floor plane**. These candidates would extend the same
zero-UI, zero-interaction approach to the rest of the SurfacePlacement feature space — tell us
which ones you actually need before we grow the API:

- **Floor anchor pose** — `getFloorAnchorPose(distanceCm)`: a point on the floor along the
  wearer's flattened forward plus a yaw-facing rotation, for one-call "spawn in front of me"
  placement (see examples.md for the do-it-yourself version today). Would not check
  occupancy (the anchor can land inside furniture).
- **Tabletop / raised-surface height** — the estimator already observes desk-height hits (it
  rejects them via the plausibility band); they could feed a second tracked plane. Open design
  question we want feedback on: which surface wins (nearest? at-launch? largest?), and how
  targets would opt into floor vs surface without bloating the Inspector.
- **Wall / vertical plane** — nearest wall along flat-forward (distance, normal, anchor), same
  voting/lock architecture on a horizontal ray fan.
- **Floor-lost signaling and confidence** — an `onFloorLost` event plus a quality getter
  (accepted-hit ratio, spread, lock state) so experiences can gate content when tracking degrades.
- **Per-target Y offset** — sit content a fixed height above the committed floor without a
  wrapper script.

