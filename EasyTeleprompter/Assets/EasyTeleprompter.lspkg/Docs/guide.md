# EasyTeleprompter historical setup guide

[← Agent usage index](../README.md)

## Use when

Read the original human tutorial, images, Google OAuth walkthrough, and interaction-design notes. The original external-hosting walkthrough and its complete-sync claims have been removed because they did not match the shipped source. Use [components](components.md), [API status](api-status.md), and [current remote setup](setup.md) as the authority for this package. Code fences below are fragments, not standalone runnable TypeScript. No deployment or external-service validation was performed in this documentation pass.

---

<p align="center">
  <img src="media/EasyTeleprompter.png" width="250px" alt="EasyTeleprompter"/>
</p>

# EasyTeleprompter (originally "Public Speaker")

[![SIK](https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview?) [![Audio](https://img.shields.io/badge/Audio-Light%20Gray?color=D3D3D3)](https://developers.snap.com/lens-studio/features/audio/playing-audio?) [![Gesture Module](https://img.shields.io/badge/Gesture%20Module-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module?) [![Motion Controller](https://img.shields.io/badge/Motion%20Controller-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/apis/motion-controller?)

<img src="../README-ref/sample-list-public-speaker-rounded-edges.gif" alt="public-speaker" width="500" />

> **NOTE:**
> Voice commands use the Lens Studio ASR module (`LensStudio:AsrModule`, HighAccuracy mode). Earlier versions of this tutorial described VoiceML; the shipped scripts do not use it.

## Overview
This project is a fun teleprompter lens integrated into SPECS designed for both rehearsal and live public speaking. It displays speech text directly within the speaker’s field of view, enabling easy reference without breaking engagement with the audience. The system supports real-time adjustments, allowing the slides to update at a variable pace controlled by intuitive gestures, pinch actions, voice commands, or using the SPECS mobile app. And yes, we used this lens at GDC 2025 :)! 

<img src="../README-ref/gdc-pres.png" alt="gdc-pres" width="500" />

## Design Guidelines

Designing Lenses for SPECS offers all-new possibilities to rethink user interaction with digital spaces and the physical world.
[View Design Guidelines](https://docs.snap.com/spectacles)

## Prerequisites

- **Lens Studio**: the Studio version recorded in `package.native`
- **SPECS OS Version**: v7.0+
- **SPECS App iOS**: v1.7+
- **SPECS App Android**: v1.7+

To update your SPECS device and mobile app, please refer to this [guide](https://support.spectacles.com/hc/en-us/articles/30214953982740-Updating).

You can download the latest version of Lens Studio from [here](https://ar.snap.com/download?lang=en-US).

The camera feature requires you to use Experimental APIs. Please see Experimental APIs for more details [here](https://developers.snap.com/spectacles/about-spectacles-features/apis/experimental-apis).

Extended Permissions mode on device must be enabled for enabling some of the SPECS APIs. Please see Extended Permissions for more details [here](https://developers.snap.com/spectacles/permission-privacy/extended-permissions).

## Getting Started

To obtain the project folder, clone the repository.

> **IMPORTANT:**
> This project uses Git Large Files Support (LFS). Downloading a zip file using the green button on GitHub **will not work**. You must clone the project with a version of git that has LFS.
> You can download Git LFS [here](https://git-lfs.github.com/).

## Google Slides Integration

This project includes optional components that load a Google Slides presentation into the Lens (`GoogleSlideBridge`) and send next/previous commands to a WebSocket relay (`WebSocketController`). Local slides need none of this; see [setup](setup.md).

<img src="../README-ref/web-slide-viewer.png" alt="web-slide-viewer" width="500" />

The integration consists of three parts:

1. **WebSocket relay**: the sample `ExampleSyncGooglePresentationOnWeb/server.js` relays `{"type":"command","command":"next"|"previous"}` messages between clients.
2. **Web slide viewer**: `ExampleSyncGooglePresentationOnWeb/direct-controller.html`, a browser page that loads a presentation and sends/receives commands.
3. **SPECS scripts**: `GoogleSlideBridge` (Google Slides API) and `WebSocketController` (relay client).

### Hosting the relay

`server.js` is a demo: its auth handler accepts any attempt, it does not serve `direct-controller.html`, and the folder ships no `package.json` (see [setup](setup.md#bundled-web-example-inventory)). Any backend you run for this sample, including the relay and the viewer page, must run on Snap-approved infrastructure. Do not deploy it to external hosting services. If you are unsure which infrastructure to use, contact the security team before deploying.

### Setting Up Google OAuth

#### Step 2: Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Slides API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Slides API" and enable it

<img src="../README-ref/oauth-1.png" alt="oauth-1" width="500" />

4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application" as the application type
   - Add authorized redirect URIs (including `https://developers.google.com/oauthplayground`)
   - Click "Create" and note your Client ID and Client Secret

<img src="../README-ref/oauth-2.png" alt="oauth-2" width="500" />

5. Get a refresh token using OAuth Playground:
   - Go to [OAuth Playground](https://developers.google.com/oauthplayground/)
   - Click the gear icon in the top right and check "Use your own OAuth credentials"
   - Enter your Client ID and Client Secret
   - Select "Google Slides API v1" from the list of APIs
   - Select the scopes: `https://www.googleapis.com/auth/presentations` and `https://www.googleapis.com/auth/drive.readonly`
   - Click "Authorize APIs" and complete the OAuth flow
   - Click "Exchange authorization code for tokens"
   - Note the Access Token (you'll need to refresh this periodically) and Refresh Token

<img src="../README-ref/oauth-3.png" alt="oauth-3" width="500" />

### Connecting Everything Together

1. Update the `GoogleSlideBridge.ts` script with your Google Slides presentation ID and access token:
   ```text
   @input
   @hint("Your presentation id - find it in the google slide link")
   presentationId: string = "your-presentation-id";

   @input
   @hint("Your refreshed access token, find it in the https://developers.google.com/oauthplayground")
   private accessToken: string = "";
   ```
   Both inputs default to empty in source. The bridge's requests disagree on whether the token carries a `Bearer ` prefix; read the [header gap](setup.md#google-inputs-and-services) before setting it.

2. Set `WebSocketController.serverUrl` to the `wss://` URL of your relay. The prefab ships it as the placeholder `YOUR-SERVER-URL`, and the component is disabled until you enable it.

3. Open `direct-controller.html` from wherever you serve it, enter the presentation ID, access token and relay URL, then connect and load the presentation.

The Lens does not navigate when the relay receives a command: `WebSocketController` only stores the last command. Add a receiver such as the [receipt example](examples.md#consume-websocket-receipts-explicitly) if you want browser-to-Lens navigation. Polling detects slide-count changes only and does not follow another presenter's current slide ([API status](api-status.md)).

## Input Modalities 

This project include different ways to change slides.

- Target with the cursor the "Next" and "Previous" buttons. 
- Toggle the audio input to use voice commands: "Next", "Previous", "Go Back".
- Use the soft buttons on the side with your hands.
- Use the Spectacle companion app as a "Clicker". 

## Key Scripts

- `PresentationSwitcher.ts` allows you to go next or go previous on the slides using [SIK](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/get-started).

<img src="../README-ref/mobile-divided.png" alt="mobile-divided" width="500" />

- `MobileController.ts` allows you to go next or go previous on the slides using the [Motion Controller Module](https://developers.snap.com/spectacles/about-spectacles-features/apis/motion-controller). Open the SPECS app, pair it with your SPECS, and use the controller panel. The left half of the window will call "Previous", the right half of the window will call "Next".

<img src="../README-ref/soft-press-diagram.png" alt="soft-press-diagram" width="500" />

- `SoftPressController.ts` allows you to go next or go previous on the slides using a custom soft press button and [The Gesture Module](https://developers.snap.com/spectacles/about-spectacles-features/apis/gesture-module).

- `VoiceController.ts` (class `SpeechToText`) allows you to go next or go previous on the slides with voice commands, using the Lens Studio ASR module (`LensStudio:AsrModule`).

## Modify the sample

Change the Orientation of the soft button that includes `SoftPressController.ts` and the distance from the Container UI based on your preference. 

<img src="../README-ref/orientation.png" alt="orientation" width="500" />

Change the voice commands in `VoiceController.ts`. 

```text
        if (this.isListening) { 
          if (this.lastTranscription === "next" 
              || this.lastTranscription === "next.") {
            this.presentationSwitcher.next();
            log.d("Going to next slide");
          } else if (this.lastTranscription === "previous" 
              || this.lastTranscription === "go back"||
              this.lastTranscription === "previous." 
              || this.lastTranscription === "go back.") {
            this.presentationSwitcher.previous();
            log.d("Going to previous slide");
          }
```
Update the slides with your images and text. 

<img src="../README-ref/slides-hierarchy.png" alt="slides-hierarchy" width="500" />

## Testing the Lens

### In Lens Studio Editor

1. Open the Preview panel in Lens Studio.
2. Explore the key script described above.
3. Modify the sample.  

### On SPECS Device

1. Build and deploy the project to your SPECS device.
2. Follow the [SPECS guide](https://developers.snap.com/spectacles/get-started/start-building/preview-panel) for device testing.
3. Rehearse your presentation or delivery it using SPECS. 

## Support

If you have any questions or need assistance, please don't hesitate to reach out. Our community is here to help, and you can connect with us and ask for support [here](https://www.reddit.com/r/Spectacles/). We look forward to hearing from you and are excited to assist you on your journey!

## Contributing

Feel free to provide improvements or suggestions or directly contributing via merge request. By sharing insights, you help everyone else build better Lenses.
