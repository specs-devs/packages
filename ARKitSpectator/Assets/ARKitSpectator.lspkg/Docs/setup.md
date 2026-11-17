# ARKitSpectator setup

[← Agent usage index](../README.md)

## Use when

Read when installing the package in a project for the first time, or when a phone can't join or
a room isn't created. It covers Snap Cloud credentials, the backend, Storage models, and
unzipping and building the iOS app.

> **Requirement: Anonymous Sign-Ins.** The iPhone app signs in **anonymously**, so the Snap Cloud
> project must have *Authentication → Anonymous Sign-Ins* enabled. Without it, no phone can join.
> It hasn't been confirmed yet that every Snap Cloud project allows this setting.

## 1. Snap Cloud credentials (Lens)

1. In Lens Studio, open **Window → Supabase**, sign in, create or select a project and choose
   **Import Credentials**. A `SupabaseProject` asset appears in the Asset Browser.
2. Drag `ARKitSpectator__PLACE_IN_SCENE` into the scene, select its `SnapCloudRequirements` child
   and assign that asset to **Supabase Project**. `ARKitSpectator` reads the project from there
   (its own **Supabase Project** input is deprecated and only used when **Snap Cloud
   Requirements** isn't wired).

The shipped prefab never contains credentials. Until a project is assigned, a red-framed
**Credentials needed** panel (`CredentialsWarning`) shows before the guide and lists what's
missing. **Continue without credentials** closes it and the guide appears; once a project is
assigned the panel doesn't show. ARKitSpectator uses no Remote Service Gateway tokens.

The asset holds the project URL and its **public** token. Never copy them into a script or a
string input, and never use a service-role or secret key anywhere.

## 2. Backend (once per project)

1. Unzip `ExtractAtProjectRoot/supabase.zip` at the project root (a clone already has `supabase/`).
2. In the project dashboard, open **SQL Editor**, paste `supabase/setup.sql` and run it. It's safe
   to run again. CLI alternative: `supabase link --project-ref <your-project-ref>` then
   `supabase db push`.
3. Under **Authentication**, enable **Anonymous Sign-Ins** (required). The iPhone app always signs in
   anonymously; the Lens does too when Snapchat sign-in isn't available (`authMode`).

`supabase/config.toml` is only for local `supabase start`. It doesn't change a hosted project.

## 3. Models (optional)

Upload `.glb` / `.gltf` files to a **public** Storage bucket in the same project and set
`SpectatorEntity → Asset Url` to `<bucket>/<path>` (for example `models/robot.glb`). Any other
https URL also works, if the viewer adds its host in the app's Settings → *Extra model hosts*.
Files must be under 50 MB. The phone caches up to 250 MB.

## 4. iOS app

1. Unzip `ExtractAtProjectRoot/iOS.zip` **at the project root**, next to `Assets/`. This gives
   `iOS/ARKitSpectator.xcodeproj` (a clone already has `iOS/`).
2. Open it in Xcode 16 or later. Select the **ARKitSpectator** target → *Signing & Capabilities*,
   choose your team and change the bundle id `com.example.arkitspectator` to your own.
3. Run it on an iPhone or iPad with ARKit, iOS 17 or later. The Simulator builds and shows a
   virtual floor, but has no AR.
4. On first launch, **Settings** opens: enter the same project URL and **public**
   (publishable / anon) key. Alternatively, fill `iOS/ARKitSpectator/Resources/SpectatorConfig.plist`
   before building.
5. `project.yml` is the XcodeGen source: after editing it, run `xcodegen generate` inside `iOS/`.

## 5. Run

Start the Lens: the panel shows `Spectator code` and four digits. On the phone, enter the code →
**Join** → scan and tap a surface → drag / rotate / pinch → **Lock**. **Record screen** records
with ReplayKit.
