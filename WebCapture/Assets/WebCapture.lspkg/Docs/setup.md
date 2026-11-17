# WebCapture setup

[← Agent usage index](../README.md)

## Use when

Read when installing the package in a project for the first time, or when the portal doesn't open
or the Lens doesn't connect. It covers unpacking the portal, Local mode (the Lens Studio plugin)
and Snap Cloud mode.

## 0. Dependencies

Installing the package from the Asset Library brings its dependencies, including **NDKCapture** (the native
camera module: `Scripts/NdkCamera.ts` imports `NDKCapture.lspkg`), UIKit and SIK (for the capture panel),
SupabaseClient, Utilities and SnapDecorators. The camera layer only runs on Specs; Lens Studio uses the
Device Camera Texture.

## 1. Unpack the portal (once per project)

The portal is a static web app (HTML, CSS, JavaScript, a vendored copy of three.js). There is
nothing to build or install.

1. Unzip `WebCapture.lspkg/ExtractAtProjectRoot/WebCapturePortal.zip` **at the project root**,
   next to `Assets/`, so that `<project>/WebCapturePortal/index.html` exists. Find the zip from the Asset Browser with
   *Show in Finder / Explorer* on the package, or in the project's `Assets/` folder after unpacking
   the package.
2. Optionally unzip `ExtractAtProjectRoot/supabase.zip` the same way if you use Snap Cloud.

Lens Studio doesn't import files outside `Assets/`, so neither folder affects the Lens.

## 2. Local mode (Lens Studio)

1. Enable **Project Settings → Experimental APIs**. A Lens may only open the plugin's
   `ws://127.0.0.1:47791` socket with it on. (A Lens with Experimental APIs can't be published:
   switch **Mode** to *Snap Cloud* or turn it off before publishing.)
2. The **WebCapture** plugin ships in the package and loads with the project. It starts the local
   server at `http://127.0.0.1:47790` (portal + API) and `ws://127.0.0.1:47791` (Lens socket).
   Check: **Window → WebCapture** says *Server running*, or open `http://127.0.0.1:47790/api/status`.
3. Drag `WebCapture__PLACE_IN_SCENE` into the scene. Leave **Mode** on *Auto* (local when the
   plugin answers, else Snap Cloud) or set *Local portal*. Add a `CapturePanel` component to an object and
   set its **Web Capture** input: it builds the Start / Stop Capture panel. (Until it is part of the
   prefab, add it yourself; the prefab's guide and demo stage are unchanged.)
4. Press Play (Preview) and dismiss the guide. **Window → WebCapture → Open Portal** (or open
   `http://127.0.0.1:47790` in any browser): the Live tab shows the demo shapes moving.
5. Press **Start Capture** in the panel (or set Record On Start). It saves after **Record Seconds**
   (default 30) or when you press **Stop Capture**; the recording lands in
   `<project>/WebCaptureRecordings/` and in the portal's **Recordings** tab. Only the Lens starts and stops
   captures.

Everything stays on `127.0.0.1`: other computers on the network can't reach the server.

### Running the portal without Lens Studio

The portal works from any static server, for example `cd WebCapturePortal && python3 -m http.server
8080` or `npx serve`. It still talks to the plugin at the address in **Settings** (default
`http://127.0.0.1:47790`; the plugin allows cross-origin requests), and it opens recordings from
files (drag a `.webcapture.json` onto the page) and from Snap Cloud without the plugin.

## 3. Snap Cloud mode (Specs, or Lens Studio without Experimental APIs)

1. In Lens Studio, open **Window → Supabase**, sign in, create or select a project and choose
   **Import Credentials**. A `SupabaseProject` asset appears in the Asset Browser.
2. Select the prefab's `SnapCloudRequirements` child and assign that asset to **Supabase Project**.
   Never copy the URL or key into a script or string input, and never use a service-role key.
3. In the project dashboard, open **SQL Editor** and run, in order, `supabase/setup.sql`, `storage.sql` (the
   Storage bucket for camera video and meshes, too big for a database row) and `fixed-code.sql` (a fixed
   capture code). All are safe to run again. CLI alternative: `supabase link --project-ref <ref>` then
   `supabase db push`.
4. If the Lens should sign in anonymously (Auth Mode *Anonymous only*, or the fallback when
   Snapchat sign-in isn't available), enable *Authentication → Anonymous Sign-Ins*.
5. Set **Mode** to *Snap Cloud* (or *Local and Snap Cloud*). Pick a long random **Capture Code** on
   the component so every run lands under the same code (it is the key to the recordings: don't share it
   casually). On start the status reads `Connected · Snap Cloud`.
6. In the portal, open **Settings** and enter the project URL, the **public** (anon) key and the code
   (stored in that browser only; or put them in a `config.json` next to `index.html`). The code's
   recordings appear in **Recordings**.

## 4. Your own Lens

Keep `WebCapture__PLACE_IN_SCENE` (or add the `WebCapture` component to any SceneObject), delete
the `Guide`, `ExampleCarousel` and `WebCaptureDemo` objects, and either add `WebCaptureTarget` to the
objects to capture, list them in **Tracked Objects**, or set **Capture Root**. Set **Capture Origin**
to the object your content is placed relative to. See [components](components.md).
