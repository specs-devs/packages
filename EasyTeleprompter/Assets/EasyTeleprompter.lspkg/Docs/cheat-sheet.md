# EasyTeleprompter cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before choosing slide sources or wiring input modalities.

1. **Local slides are direct children in hierarchy order.** PresentationSwitcher collects them once on onAwake, starts at index zero, and wraps Next/Previous. Keep buttons and managers outside the selected slide parent. → [Local switcher](components.md#presentationswitcher)
2. **Wire component references, not SceneObjects, to controllers.** Each useGoogleSlide flag independently selects the local PresentationSwitcher or GoogleSlideBridge. Changing one flag does not change every controller. → [Inputs](components.md)
3. **VoiceController.ts exports SpeechToText and uses ASR.** Exact final normalized phrases are next, previous, or go back (optional period); they must remain unchanged through commandDelay, default 2 seconds. → [Voice](components.md#speechtotext)
4. **Soft press is wrist/collider geometry, not a generic pinch button.** Configure eight vertices, the selected HandVisual, collider and HandRef prefab; next=true advances, false goes back. The pads' colliders block rays to UI placed below the frame — put extra panels above it. → [Soft press](components.md#softpresscontroller)
5. **The local deck wraps; the Google bridge stops at bounds.** Google calls are asynchronous and export no ready event. Do not infer remote readiness from component existence. → [API status](api-status.md)
6. **A WebSocket receipt is stored, not executed.** No other shipped script consumes received commands. An explicit project consumer is needed for remote-to-Lens navigation, and relay confirmation echoes can duplicate commands. → [Receipt example](examples.md#consume-websocket-receipts-explicitly)
7. **Google headers and browser synchronization have known gaps.** Most API calls add Bearer, one sends the input verbatim; polling checks slide count only and a sync callback is TODO. → [Remote setup](setup.md)
8. **CameraService initializes only Main.** GlassesLeft/Right enum values do not produce initialized cameras; SmoothRespositioning is the real import filename. → [Camera helpers](components.md#cameraservice-and-cameratype)
9. **The original tutorial is retained, corrected for the shipped source.** It no longer covers external hosting; any relay must run on Snap-approved infrastructure. → [Human guide](guide.md)
