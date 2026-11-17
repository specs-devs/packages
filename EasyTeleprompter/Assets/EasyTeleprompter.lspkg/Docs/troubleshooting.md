# EasyTeleprompter troubleshooting

[← Agent usage index](../README.md)

## Use when

A slide does not change, a modality appears disconnected, or an optional remote feature is incomplete.

## Local slide deck is empty or hides controls

PresentationSwitcher collects direct child objects once on onAwake and treats every one as a slide. Wire parentObject to a slide-only parent; unassigned falls back to the switcher's object. Controls accidentally under it will be disabled as slides. Empty children logs “No children found to use as slides.” Runtime-added children are not automatically recollected.

## Wrong slide source changes

Each SpeechToText, MobileController, and SoftPressController has its own useGoogleSlide boolean. False selects the local switcher; true selects the Google bridge. Wire the corresponding component references and set every intended modality consistently. No global mode-switch manager exists in these scripts.

## Voice text appears but no command fires

VoiceController.ts exports SpeechToText and requires AsrModule. It must be toggled on, receive a final transcription matching next, previous or go back (case normalized, optional period), and see the same text after commandDelay. Intermediate/changed text or another phrase can cancel a pending command. Wire required text; mic image/texture inputs are guarded. Do not run the separate SimpleAsrTest and SpeechToText as competing ASR owners. SpeechToText has no onDestroy stop hook, so define ownership/cleanup in your project.

## Wrist press never fires or fires in the wrong direction

SoftPressController searches for a HandVisual whose object's name contains the selected hand. It uses an instantiated wrist interactor, a Physics.ColliderComponent on colliderObject, and all eight vertex references. Entry must come from above with dot > 0.5; threshold is default 0.7. Check non-degenerate top/bottom spacing and positive resetDuration. next=true advances and false goes back, despite its ambiguous Inspector hint. After triggering, depth must reset to zero before another press.

## Companion phone does nothing

MobileController registers motionController.onTouchEvent on OnStart and ignores phases other than Ended. Left normalized x < 0.5 calls previous; right half calls next. Use the intended paired companion-phone runtime to verify this path; it is not an editor mouse event.

## Google requests fail despite a configured token

The initial onAwake title request uses the token string verbatim, while other calls prepend Bearer. See [the header gap](setup.md#google-inputs-and-services); do not solve one request by unknowingly breaking the other. Empty credentials return before normal initialization events. Wire speakerNotes and required socket reference too; validation and content loading are asynchronous. This pass makes no authenticated-service success claim.

## Remote slides do not wrap or follow a presenter

The local switcher wraps; Google next/previous stop at the ends. Polling detects slide-count changes only. There is no Google current-slide endpoint used here, and a local-to-Google callback is TODO. A presentation-mode URL GET does not prove another browser view changes. Verify the specific intended workflow instead of relying on tutorial promises.

## WebSocket connected but Lens slides stay unchanged

WebSocketController records receipts only; no other shipped script consumes them. Add an explicit project receiver adapter using getLastCommand or the timestamp helpers. Their timestamp is Date.now()/1000 epoch time, not getTime. The controller holds only the last command, not a queue. Sender confirmations also have type command, so avoid duplicate navigation from echoed commands.

## Disconnect unexpectedly retries

disconnect sets isReconnecting=false and closes the socket, but its onclose callback can start reconnection again. The component has no onDestroy disconnect hook. This is a source lifecycle gap requiring a separately authorized behavioral fix or deliberate application ownership, not a tested one-shot shutdown API guarantee.

## Bundled web URL returns 404

server.js does not serve direct-controller.html; several other routes reference files absent in the bundled folder. Serve the browser client yourself, from Snap-approved infrastructure. The historic deployment directory does not equal the shipped ExampleSyncGooglePresentationOnWeb folder. See [inventory](setup.md#bundled-web-example-inventory).

## Repositioning or stereo camera is wrong

CameraService initializes only Main; GlassesLeft/Right can return uninitialized fields. SmoothRepositioning's real source filename is SmoothRespositioning.ts. Distance OR horizontal angle triggers, despite a contradictory BOTH comment. Keep positive repositionSpeed and verify actual target placement because source uses camera Transform.forward directly. No preview placement correction was made in this source-only pass.

## Google example arrows do nothing

In `[GooglePresentationExample]` the round Previous / Next buttons call `GoogleSlideBridge.previous` / `next`, and its two wrist pads have `useGoogleSlide` on. (Earlier revisions wired all four to the hidden local deck.) Until the GoogleSlideBridge component is enabled with a valid presentationId and accessToken and the presentation has loaded, `next` / `previous` return without doing anything; with enableLogging on they warn `next() ignored: Google presentation not loaded yet`. Enable the component, set the credentials, then check that `Loaded presentation with N slides` appears before you test navigation. Its mic button calls `SpeechToText.toggleListening`.

## Wrist pads trigger while reaching for the round buttons

The wrist pads' press volumes sit about 33–45 cm in front of you, 4–14 cm below eye level and 4–17 cm either side of center (see [components](components.md#prefabs)). The round Previous / Next buttons are 80 cm away, so you pinch them with a ray from a hand that is resting in roughly that volume. Preview cannot simulate the wrist interactor, so check on device that aiming at the round buttons does not also fire a wrist press. Device check.

## Some letters are missing from the notes text

Seen in Lens Studio Preview after paging through most of the 16 text-heavy slides: later slides drew their notes with many glyphs missing. The same slide rendered correctly right after a Preview reset, so this is the Preview's text cache, not slide data. Reset the Preview; confirm on device before changing fonts or splitting notes.

## Panels below the deck cannot be pinched

The soft-press pads' colliders sit about 40 cm in front of you, just below eye level. A ray from the head to anything placed under the teleprompter frame passes through them, so SIK targets the pad instead. Place extra UI (menus, guidance panels) above the frame or beside it, not below.

## Slides 3, 4 and 16 repeat earlier content

`Slide 2` and `Slide 3` reuse the cover image, and `Slide 15` repeats the "Slide 2. Why" notes. This is the authored sample deck, not a switcher bug. Replace the slide children with your own content.

## Voice works on device but not in the Preview

Turning the mic on in the Preview logs `Login to My Lenses is required for testing of the VoiceML API in the Preview panel` and an ASR token 401. Log in to My Lenses in Lens Studio, or test voice on device.

## One tap moves two slides in the Preview

The Preview's simulated hand can poke the neighbouring round button on its way in or out (Next then Previous, 4 cm apart). A short pinch steps exactly one slide. Check on device before changing button spacing.

## Verification status

Lens Studio Preview, 2026-10-01: compile and startup clean (only the macOS Depth24 fallback warning), all 16 local slides rendered, round Next / Previous step and wrap both ways, mic button starts ASR. Wrist soft press, companion phone, ASR transcription, Google service, relay messages and device behavior remain unverified.

Fix round, 2026-10-02: with the Google example temporarily in the carousel, its round Next / Previous reached GoogleSlideBridge, returned without errors (no credentials) and left the local deck on slide 1; the static example still steps 1 → 2 → 1. A successful Google navigation needs credentials and a device check.
