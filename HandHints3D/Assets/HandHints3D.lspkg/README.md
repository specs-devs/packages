<p align="center">
  <img src="Docs/media/HandHints3D.png" width="250px" alt="HandHints3D"/>
</p>

# 3D Hints

An animated 3D hand hint system for SPECS that teaches users hand gestures by showing them. Each hint is a `HandHint` object (an `InteractionHintController` plus an animated left and right hand rig) with 31 looping gesture clips (pinch, tap, swipe, rotate, grab and the system taps), an outline shader that fades each hint in and out, fingertip glow while a pinch is closed, and a cursor for the far pinch. Hints play from the Inspector (auto-play) or from your own script, one at a time or as a sequence, with a completion event.

## Features

- **31 gesture clips** - 20 one-handed gestures (playable with either hand) and 10 two-handed and system gestures, exposed as `HandAnimationsLibrary.Left / Right / Both`
- **Left / Right / Both hands** - `HandMode` picks which hand mesh is shown
- **Animated hand models** - skinned hand meshes with an outline shader and fingertip glow
- **Cursor feedback** - a cursor that triggers and squishes during the far pinch
- **Sequences** - chain gestures with positions, with a fade between steps
- **Looping and speed** - loop count and playback speed per hint
- **Completion event** - `animationEndEvent` fires when the loops are done
- **Auto-play** - optional Inspector-configured playback at start

## Usage

This section ships with the package and describes the exact installed revision. Read it, then follow the links into `Docs/` for the topic you need. It is written for both people and coding agents; generic Lens scripting, scene construction and SPECS spatial design are out of scope here.

### Package identity

- Package descriptor: `HandHints3D.lspkg/package.native`
- Consumer import prefix: `HandHints3D.lspkg/Scripts/`, e.g. `import {InteractionHintController, HandMode, HandAnimationsLibrary, HandAnimationClipInfo} from "HandHints3D.lspkg/Scripts/InteractionHintController"`. The package's own scripts import each other with relative paths (`./InteractionHintController`, `./NativeTween`).
- Prefab: `HandHints3D.lspkg/HandHints3D__PLACE_IN_SCENE.prefab`. It is self-contained: dropping it into an empty SPECS scene gives the full demo, with the onboarding `Guide`, the `ExampleCarousel` and six example groups (Finger Tap Near, Pinch Near, Pinch Far, Two Hands Pinch Scale, System Tap Settings, Gesture Sequence). Each group holds one `HandHint` object, which is the controller plus the hand rig. The prefab (or a `HandHint` copied out of it) is the only supported way to get the rig: the controller resolves its parts by name under its own SceneObject, so don't rebuild it ([components](Docs/components.md#prefab-structure)).
- Demo scaffolding: the guide and carousel scripts ship in `HandHints3D.lspkg/Example/` (`ExampleCarousel/`, `GuideDismissPanel/`). They aren't part of the package API. When you build your own Lens, delete `Guide`, `ExampleCarousel` and the example groups you don't need from your instance, and keep or copy the `HandHint` objects you want ([components](Docs/components.md#demo-scaffolding-example)).
- Required companion packages (`package_dependencies.json`): `Utilities` (Logger) and `SnapDecorators` are imported by the scripts in `Scripts/`. `InteractionKit` and `UIKit` are imported only by the `Example/` demo scaffolding (guide and carousel). `Motion` and `Icons` are declared as well but no script imports them.

### Version and API status

This README and `Docs/` ship in the package archive and describe that exact installed revision. Read [API status](Docs/api-status.md) before reusing an older example: it lists the Current, Experimental, Removed and Internal surfaces, and the known gaps of this revision.

### Applicability

Use HandHints3D to *show* a gesture: onboarding, tutorials, "do this next" hints, or a reminder while an interaction is waiting for input. It does not read the user's real hands and fires no interaction events. For real hand input use InteractionKit and drive the hint from your own state, for example hide the hint once the user has performed the gesture.

### Package Docs (ship in `Docs/`)

Lens Studio installs packages packed, but on import it extracts the files into the project's Cache, so an agent can read these `Docs/` there or from the package source. Treat only documented public members as supported API; never guess a clip name or an import path.

- [cheat sheet](Docs/cheat-sheet.md) - the rules that most often break a hint; read first
- [components](Docs/components.md) - prefab structure, `InteractionHintController` inputs, methods and events, the gesture library, NativeTween
- [API status](Docs/api-status.md) - Current / Experimental / Removed / Internal surfaces and the gaps of this revision
- [minimal examples](Docs/examples.md) - Inspector auto-play, one hint from script, a sequence, tutorial chaining, positioning
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes, including what the QA pass found

### Verification

1. Compile the Lens and resolve every TypeScript error without `as any`.
2. Preview: the guide shows first; "Ok, I understood" dismisses it and the carousel shows example 1 / 6, a left hand looping `finger_tap_near` in front of the user. Previous / Next step through the six examples, and the minimize button collapses the panel.
3. A `pinch_*` hint glows at the fingertips while the fingers are together; `pinch_far` also shows the ring cursor.
4. `animationEndEvent` fires once per completed hint or sequence; bind it before the hint ends.
5. A Left + Right sequence alternates hands with a 200 ms fade between clips (both hands visible in turn, never none).

## Built with 👽 by the SPECS team
