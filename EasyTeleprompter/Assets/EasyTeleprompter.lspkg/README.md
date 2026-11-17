<p align="center">
  <img src="Docs/media/EasyTeleprompter.png" width="250px" alt="EasyTeleprompter"/>
</p>

# EasyTeleprompter

EasyTeleprompter is a Specs teleprompter for rehearsal and public speaking. It includes a local slide deck and examples of button, wrist soft-press, ASR voice, and companion-phone navigation. Google Slides and a WebSocket relay are optional integration examples with [documented source limitations](Docs/api-status.md).

<img src="./README-ref/sample-list-public-speaker-rounded-edges.gif" alt="public-speaker" width="500" />

The original illustrated tutorial (first published as "Public Speaker"), GDC use story, design links, prerequisites, OAuth walkthrough, and contributor notes are preserved in [the human guide](Docs/guide.md). Voice commands use the Lens Studio ASR module (`LensStudio:AsrModule`), not VoiceML.

## Quick Start

1. Resolve the package's declared companions and add `EasyTeleprompter__PLACE_IN_SCENE.prefab` to a configured Specs scene.
2. Start with `[StaticPresentationExample]`; its PresentationSwitcher reads direct children of its configured slide parent and wraps in both directions.
3. Wire controller component inputs to the same local switcher, keeping each `useGoogleSlide` false for local slides.
4. Test Next/Previous and their wraparound before enabling voice, soft press, phone, or network input.
5. For remote slides, read [setup](Docs/setup.md) before enabling the Google bridge or WebSocket component. The prefab ships its Google example and those network components disabled.

## Usage

This section ships with the package and describes what it contains. EasyTeleprompter setup and limitations live here; generic Lens scripting, scene construction, and Specs spatial design are out of scope here.

### Package identity

- Descriptor: `EasyTeleprompter.lspkg/package.native`.
- Prefab: `EasyTeleprompter.lspkg/EasyTeleprompter__PLACE_IN_SCENE.prefab`. It's self-contained: it holds the guide panel ("Ok, I understood"), the example carousel, the controllers and both presentation examples. Dropping it into a Specs scene with Camera, lighting and SIK gives the full demo.
- Demo scaffolding: `EasyTeleprompter.lspkg/Example/` holds `ExampleCarousel` and `GuideDismissPanel`. The prefab uses them to present the demo; the teleprompter scripts don't depend on them.
- Consumer import prefix: `EasyTeleprompter.lspkg/Scripts/`. `VoiceController.ts` exports `SpeechToText`; the spelling `SmoothRespositioning.ts` is the actual file path for `SmoothRepositioning`.
- Declared companion packages: InteractionKit, UIKit, Utilities, SnapDecorators, Motion and Icons (see `package_dependencies.json`).

### API status

Read [API status](Docs/api-status.md) for local versus remote behavior, ASR migration, unimplemented sync, and native-camera limitations.

### Applicability

Use this package to present local slide objects and route several input modalities to the same navigation component. Add Google Slides only when remote API credentials, image loading, and the unfinished synchronization behavior fit your application. Any relay or web backend you run for it must be hosted on Snap-approved infrastructure; contact the security team if unsure. This is not a generic authenticated presentation server or a guarantee of control over another browser's Google Slides session.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md) — read first for slide collection and controller selection.
- [API status](Docs/api-status.md) — read before relying on network synchronization or legacy instructions.
- [Components](Docs/components.md) — read when importing scripts or wiring any input, method, or helper.
- [Examples](Docs/examples.md) — read for typed local navigation and explicit receipt consumption.
- [Setup](Docs/setup.md) — read for Google credential inputs and bundled relay/client limitations.
- [Troubleshooting](Docs/troubleshooting.md) — read for missed commands, stale slides, input conflicts, and remote failures.
- [Human guide](Docs/guide.md) — read the preserved illustrated tutorial with current-source corrections.

### Verification

- Compile imports against the installed package and its dependencies; wire every required reference without `as any`.
- Check that only one local slide is enabled, Next wraps to the first, and Previous wraps to the last.
- Verify exact final ASR phrases after the configured delay, both hand soft presses, and phone left/right navigation on the intended device.
- For remote slides, validate credentials, first thumbnail/notes loading, navigation bounds, and expected relay receipts separately.
- Prove any requested browser-to-Lens synchronization explicitly; receipt storage alone does not navigate the Lens.

---

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

