<p align="center">
  <img src="./Assets/AssetImage/SnapCloudSocialMedia.png" width="250px" alt="Snap Cloud Social Media"/>
</p>

# Snap Cloud Social Media

An extracted, focused package based on `SnapCloudExamples/Example5-Media`: record
through Specs, edit a caption, enable destinations, choose a format and submit a
share job. It includes a drag-and-drop prefab, an example Lens, a native Lens Studio
setup panel, JSON examples, and a self-hosted publishing proxy using official APIs.
There is no Ayrshare dependency.

**Status: authored prototype, not editor-verified or live-platform-verified.** Local
tests cover the proxy contracts, authorization boundaries, encryption, deduplication,
and actual FFmpeg encoding. Lens Studio preview, on-device capture, native package
export, OAuth on registered apps, and live posting still need verification. No social
accounts were connected and no posts were sent while authoring this package.

## Open the example

Open `SnapCloudSocialMedia.esproj` in Lens Studio 5.25 or later, targeting SPECS.
The scene has the existing camera, interaction rig and a
`SnapCloudSocialMedia__PLACE_IN_SCENE` prefab instance holding the guide, the example carousel
and the `Snap Cloud Social Media` panel. The prefab is also at
`Assets/SnapCloudSocialMedia.lspkg/SnapCloudSocialMedia__PLACE_IN_SCENE.prefab`.
It builds its spatial UI using UIKit: colored social icons, destination
switches, caption editing, format selection, delivery settings and capture controls.

The example defaults to **demo mode**. Record a clip, select social destinations,
change the caption and format, then press **Simulate share**. Camera recording is
real; publishing is simulated and explicitly labelled. Network credentials are not
needed in this mode. Enable photo formats before sharing a photo.

Recording uses bounded JPEG frame capture and optional mono microphone WAV capture,
then server encoding to an H.264 MP4 with AAC audio. Defaults are 8 capture FPS,
12 seconds, microphone enabled and portrait 720×1280.
Limits are 12 FPS, 15 seconds and 32 MB of buffered frames. The MP4 is resampled to
24 FPS while preserving capture timing. Assign **Composite Texture** on the prefab
to record AR content as well as the camera image. Disable **Include microphone audio**
in the editor panel for silent clips.

## Set up using JSON

There are three deliberately separate configurations:

| File | Purpose | Included in the Lens? |
| --- | --- | --- |
| `social.config.example.json` | Capture, captions, destination switches/formats, proxy URL and public cloud credentials | Yes |
| `Proxy/proxy.config.example.json` | Your server's cloud access and provider developer-app credentials | No |
| `Proxy/connections.private.example.json` | Import existing user access tokens instead of OAuth | No |

Copy the public example to
`Assets/SnapCloudSocialMedia.lspkg/social.config.json` or paste it into the editor
panel's **Config JSON** tab and press **Apply**, then **Save public config to Lens**.
The prefab reads the same JSON asset. Restart Preview after changing it.
Set `demoMode` to `false`, provide an HTTPS proxy origin, Snap Cloud project URL
and **publishable** key. Enable only the destinations you have connected.

Example destination:

```json
"instagram": {"enabled": true, "format": "reel", "caption": "A moment through my Specs ✨"}
```

The complete example includes all seven providers. Empty caption overrides use
the default caption. YouTube uses `composer.title` and defaults to private uploads.
Lens caption/format/switch changes are session overrides; save reusable presets
through the editor panel. Provider tokens, client secrets and service-role keys are
rejected in public configuration.

## Set up through the editor panel

The plugin source is in `Plugins/SnapCloudSocialMedia/`. If the editor does not load
project plugins automatically, install the ZIP built by `Editor/build-artifacts.py`
through Lens Studio's plugin installation UI. Open **Window → Snap Cloud Social Media**.
The panel follows the native examples in
`internal-other/fiji/Public/Examples/PanelWidgets` and `internal-other/fiji/Public/Supabase`.

1. Enter the publishing proxy URL, Snap Cloud URL and publishable key.
2. Sign in for SPECS through the Lens Studio profile menu, then click
   **Sign in with Lens Studio account**. The panel exchanges that identity for a
   project-scoped Snap Cloud session; it keeps the session in memory.
3. Click **Connect … · Sign in** for the social accounts you want. Complete OAuth
   in your browser and refresh connections. Each provider uses your own developer app.
   An existing user access token can be submitted instead; it is verified by the
   provider, encrypted on the server and cleared from the input.
4. In **Capture & captions**, configure enabled destinations, clip shape/duration,
   formats, captions, video title, YouTube privacy and TikTok delivery mode.
5. Save the public config. Use **Add prefab to scene** in a consumer project.
   The panel unpacks the imported package when its JSON needs editing.

Connections are scoped to the Snap Cloud user. The editor account and Specs wearer
must resolve to the **same project user** to use the same connections. Connecting
the package author's accounts does not give other Lens users access to them.
Disconnecting deletes this proxy's stored credentials; revoke app permissions in
the provider account settings if you also want to revoke the provider's grant.

## Run your proxy

Use Node 22+ with `ffmpeg` and `ffprobe` installed. The server runs on your own host;
Snap Cloud stores private media, encrypted connection credentials and durable jobs.
Apply `supabase/migrations/20261001000000_social_media.sql` to your development
project with its SQL editor or normal migration workflow.

```bash
cd Proxy
cp .env.example .env
# Fill in project URL, service-role key, public proxy origin and encryption key.
# Generate the encryption key once: openssl rand -base64 32
cp proxy.config.example.json proxy.config.json
SOCIAL_PROXY_CONFIG=proxy.config.json npm start
```

You can put developer-app settings in the private JSON or reference environment
variables with `$VARIABLE_NAME`, as in the example. Each social platform needs its
own developer app. Register this exact redirect URI for each provider:

```text
https://YOUR_PROXY/oauth/PROVIDER/callback
```

For example, `https://YOUR_PROXY/oauth/youtube/callback`. Localhost HTTP is supported
for desktop proxy development; the device configuration requires HTTPS and a proxy
reachable from the glasses. Run behind your usual HTTPS reverse proxy. Do not put
private server config inside `Assets/` or include it in an exported Lens.

To configure existing access tokens using JSON instead of browser OAuth:

```bash
cp connections.private.example.json connections.private.json
# Set referenced environment variables for the account owner's project session
# and provider user access tokens; edit the provider list as needed.
node connect-config.mjs connections.private.json
```

These are **user-authorized access tokens**, not arbitrary developer API keys.
The service verifies each token before associating it with the signed-in owner.
It uses AES-256-GCM encryption; keep `TOKEN_ENCRYPTION_KEY` stable across restarts.

## Platform behavior

| Provider | Formats | What a share job submits |
| --- | --- | --- |
| Snapchat | Story, Spotlight | Public Profile API encrypted media upload. Stories publish to the profile; Spotlight is submitted for processing/moderation. Business Manager app allowlisting required. Story captions are omitted. |
| X | Video, photo | v2 media upload, processing check and Tweet creation. Requires media.write and tweet.write. |
| YouTube | Video, Short | Resumable upload with title, description and selected privacy. Uses youtube.upload and youtube.readonly to verify channel ownership. Reports uploaded/processing; YouTube decides Shorts classification. |
| LinkedIn | Video, photo | Member media upload, availability check and post creation. Requires w_member_social. |
| Instagram | Reel, Story, photo | Professional-account container creation, processing check and publish. Requires publishing permissions. Story captions are not drawn into the recording. |
| Threads | Video, photo | Container creation, processing check and publish. Requires threads_content_publish. |
| TikTok | Video | Inbox upload by default; finish posting in TikTok. Optional Direct Post requires video.publish, creator-supported privacy chosen in the Lens, and pressing Share to consent. Reports processing until separately confirmed. |

Snapchat video minimums are 5 seconds for Story and 6 seconds for Spotlight; the
Spotlight description limit is 160 characters. Portrait recording is required for
Reels, Stories, Shorts and Spotlight. Platform-specific permissions, review,
allowlisting, quotas and account eligibility cannot be replaced by a single API key.
Accounts can be connected while a provider still lacks publishing permission.

TikTok OAuth requests inbox permissions by default. For an approved Direct Post
app, set `TIKTOK_SCOPES=user.info.basic,video.upload,video.publish` (or `apps.tiktok.scopes`
in private proxy JSON), restart the proxy and reconnect the account. Then choose
Direct Post in the panel. Other provider scope overrides also use `apps.PROVIDER.scopes`.

The proxy adds per-user Snap Cloud ownership and encrypted persistence; it does not
use a localhost dashboard or a shared global token file.
Threads is added separately. OAuth and publishing code remains isolated in
`Proxy/src/oauth.mjs` and `Proxy/src/publishers.mjs`.

## Failure handling

The Lens uploads frames to its owner's private storage folder, the proxy encodes
one MP4, then a durable job fans out to selected providers. Every destination saves
its own receipt. Jobs distinguish `published`, `processing`, `draft`, `failed` and
`unknown`; "complete" means all submissions returned receipts, not that every
asynchronous video is already live.

Request keys deduplicate repeat submissions. A failed destination does not resend
successful posts. An interrupted or ambiguous publish is marked unknown and is
never automatically retried; inspect the account first to avoid duplicates.
Source frames are removed after successful encoding. Rendered media and receipts
remain in your project; choose a retention policy suitable for your use.

## Test and export

```bash
cd Proxy
npm test
cd ..
python3 Editor/verify-assets.py
python3 Editor/build-artifacts.py
```

The tests mock upstream social HTTP and run a real JPEG-to-MP4 FFmpeg pipeline.
They do not prove live provider permissions or an editor preview.

`Dist/SnapCloudSocialMediaPlugin.zip` installs the panel.
`Dist/SnapCloudSocialMediaSource.zip` contains the complete source project.
To create the native archive, load this project and execute `Editor/export-package.js`
by absolute path through **CLAD's ExecuteEditorCode**, then verify the exported
package in a clean consumer project. It uses the native exporter and includes
the plugin ZIP. A filesystem ZIP is not substituted for a native `.lspkg`.

To finish editor verification, open this project first and start a fresh Codex
session from its folder so Lens Studio's MCP server is registered. Follow the
[CLAD Codex setup guide](https://developers.specs.com/docs/clad/setup/setup-ai/codex-setup).
Check compilation, panel loading, record/stop, destination switches, caption edits,
format selection, export/reimport, and a short live smoke test on each approved app.

## Package artwork

`Assets/AssetImage/` contains the 4× PNG preview, matching SVG and transparent `SnapCloudSocialMedia-nb.svg`. The native package descriptor embeds the matching SVG.
