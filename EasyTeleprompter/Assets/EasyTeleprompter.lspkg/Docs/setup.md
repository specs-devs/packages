# EasyTeleprompter remote setup

[← Agent usage index](../README.md)

## Use when

Evaluate the optional Google Slides, WebSocket relay, and browser example before enabling them.

## Local slides need no Google credentials

Start with PresentationSwitcher and useGoogleSlide=false on each chosen controller. GoogleSlideBridge and WebSocketController are serialized disabled in the exported prefab. Network setup is separate from local deck navigation.

## Google inputs and services

GoogleSlideBridge requires InternetModule and uses RemoteServiceModule/RemoteMediaModule for slide thumbnails. Inspector inputs presentationId and private accessToken both default to empty. With empty inputs, onAwake warns and returns before registering its normal start/poll events. Configure before startup; setting another controller's useGoogleSlide flag does not initialize a missing bridge.

Obtain a presentation ID from your Google Slides presentation and an access token from the Google OAuth flow configured for your application. The [preserved tutorial](guide.md#setting-up-google-oauth) walks through Google Cloud Console and OAuth Playground with placeholders. Keep actual credentials out of committed docs and source. No client ID, secret, token, or presentation identifier is provided by these docs.

**Current header gap:** validation, presentation, thumbnail and navigation requests construct `Authorization: Bearer ${accessToken}`, so they expect the raw token. The earlier title fetch in onAwake sends accessToken directly as Authorization. A raw token is wrong for that first call, while a Bearer-prefixed token is double-prefixed by the others. Reconcile this inconsistency in a separately authorized source fix before treating the integration as configured. This documentation pass does not change behavior or claim authentication succeeds.

Wire slideImage and speakerNotes. Wire webSocketController only if you want next/previous mirrored to the relay. It is optional and null-guarded. The notes fallback paths are not null-guarded. Remote index navigation is bounded, unlike the local switcher's wraparound. Async content and remote navigation can race; there is no public completion/ready event to rely on.

## What polling and synchronization actually do

pollForChanges defaults true with pollingInterval=5 seconds. Polling fetches the presentation and updates when its slide count changes. It does not follow a remote presenter's current slide or detect every same-count content edit. presentationChangeCallback is an unimplemented TODO and is not wired to the local switcher.

The bridge makes GET requests to a Google presentation-mode URL for navigation. That alone does not control an independently open browser session. WebSocket commands and the provided browser client are a separate path requiring an explicit receiving consumer and actual verification.

## Bundled web example inventory

Folder: `EasyTeleprompter.lspkg/ExampleSyncGooglePresentationOnWeb/`.

- `server.js` uses Node's built-in http/url/fs/path modules plus external `ws`. It listens on environment PORT or 8080. The folder does not include a package.json or the additional simple-control/test-client files referenced by some routes.
- `direct-controller.html` is the supplied browser viewer/controller. It accepts a Google presentation ID, token and socket URL; uses Google presentation/thumbnail requests and Bearer authorization; sends and receives type command messages.
- The server serves `/`, `/status`, `/simple-control.js`, `/simple-control`, and `/test-client` paths in its source, but referenced simple-control/test files are absent here. It does not provide a `/direct-controller.html` route. The original tutorial's external-hosting recipe has been removed from the guide; it did not match this folder.

To use this example, supply your own complete server packaging and a way to serve the browser page, and configure WebSocketController.serverUrl to the resulting wss endpoint. The prefab ships serverUrl as the placeholder `YOUR-SERVER-URL`; the script's source default is an external sample endpoint, so do not rely on it. Any backend you run (relay or viewer page) must be on Snap-approved infrastructure, not an external hosting service; contact the security team if unsure. No installation, deployment, server launch, or external messaging is performed by these docs.

## Relay contract and limits

```json
{"type":"command","command":"next"}
```

Use previous for the other direction. server.js broadcasts commands to other clients and confirms back to the sender with type command, status received and the same command. WebSocketController stores next/previous receipts without inspecting status. Avoid applying a sender confirmation twice.

The demo server's auth handler accepts any attempt, and command broadcasting does not require validated credentials. This is the exact source behavior, not a ready authenticated production server. Use an appropriate application protocol before deploying it beyond your intended demonstration.

No shipped Lens script consumes receipt state. See [explicit receiver example](examples.md#consume-websocket-receipts-explicitly) and [limits](api-status.md).
