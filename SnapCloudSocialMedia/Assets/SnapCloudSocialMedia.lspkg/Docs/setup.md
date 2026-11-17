# SnapCloudSocialMedia setup

[← Agent usage index](../README.md)

## Use when

Read this when you take the Lens out of demo mode. It covers the editor configuration panel,
`social.config.json`, the publishing proxy in `Proxy/`, the Snap Cloud migration, which
credential goes where, platform behavior, and testing/export. Every value below is a
**placeholder**: never commit or ship real keys or tokens.

## The three configurations

They're deliberately separate:

| File | Holds | Ships in the Lens? |
|---|---|---|
| `SnapCloudSocialMedia.lspkg/social.config.json` (template: `social.config.example.json` at the project root) | Capture, captions, destination switches/formats, `proxyUrl`, Snap Cloud URL and **publishable** key | **Yes**, public |
| `Proxy/proxy.config.json` (from `proxy.config.example.json`) or `Proxy/.env` (from `.env.example`) | Snap Cloud service-role key, token encryption key, each provider's developer-app client id/secret | No, server only |
| `Proxy/connections.private.json` (from `connections.private.example.json`) | Existing user access tokens to import instead of browser OAuth | No, server operator only |

Never put the server files inside `Assets/` or in an exported Lens. The Lens rejects secret-like
keys in its config ([components](components.md#config-schema-socialconfig-schemaversion-1)).

## 1. Snap Cloud project

1. Use a development Snap Cloud project. From its dashboard you need the **project URL**
   (`https://YOUR_PROJECT.snapcloud.dev`), the **publishable key** (for the Lens and the editor
   panel) and the **service-role key** (for the proxy only).
2. Apply `supabase/migrations/20261001000000_social_media.sql` (source project) with the SQL
   editor or your migration workflow. It creates:
   - `social_connections`: one encrypted credential per user and provider
   - `social_oauth_states`
   - `social_media`
   - `social_jobs`: status `queued`, `processing`, `complete`, `partial`, `failed` or
     `unknown`, with a unique `(user_id, request_key)`
   - the private Storage bucket `social-media`, writable/readable/deletable only under
     `<auth.uid()>/…`
3. Sign-in uses Snap identity. The Lens calls `signInWithIdToken({provider: 'snapchat'})`, and
   the editor panel exchanges the Lens Studio id token at `/auth/v1/token?grant_type=id_token`.
   The editor account and the Specs wearer must resolve to the **same project user** to share
   connections.

## 2. Publishing proxy (`Proxy/`)

You need Node 22+, with `ffmpeg` and `ffprobe` on the host. The proxy encodes the uploaded
frames into one MP4 (H.264 + AAC; portrait 720×1280, landscape 1280×720, square 960×960;
resampled to 24 FPS) and runs the publish worker.

```bash
cd Proxy
cp .env.example .env
# PUBLIC_ORIGIN=https://YOUR_PROXY  SNAP_CLOUD_URL=https://YOUR_PROJECT.snapcloud.dev
# SNAP_CLOUD_SERVICE_ROLE_KEY=<from the Snap Cloud dashboard>
# TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32, generated once, kept stable>
# <PROVIDER>_CLIENT_ID / <PROVIDER>_CLIENT_SECRET for each developer app you use
cp proxy.config.example.json proxy.config.json   # optional: JSON that references $ENV_VARS
SOCIAL_PROXY_CONFIG=proxy.config.json npm start  # or just: npm start (reads .env)
```

- `proxy.config.json` keys map to the variables `publicOrigin` → `PUBLIC_ORIGIN`, `port` →
  `PORT` (default 8787), `snapCloudUrl` → `SNAP_CLOUD_URL`, `serviceRoleKey` →
  `SNAP_CLOUD_SERVICE_ROLE_KEY`, `tokenEncryptionKey` → `TOKEN_ENCRYPTION_KEY`, and
  `apps.<provider>.clientId | clientSecret | scopes` → `<PROVIDER>_CLIENT_ID | _CLIENT_SECRET |
  _SCOPES`. A value starting with `$` is read from that environment variable.
- Optional: `LINKEDIN_VERSION` (default `202609`) and `INSTAGRAM_VERSION` (default `v23.0`).
- Register this redirect URI in every provider app: `https://YOUR_PROXY/oauth/<provider>/callback`
  (for example `…/oauth/youtube/callback`).
- Run it behind HTTPS. The Lens requires `https://` for `proxyUrl`. The editor panel also
  accepts `http://localhost` / `127.0.0.1` for desktop development. The glasses must be able to
  reach the proxy.
- Tokens are stored AES-256-GCM encrypted. Changing `TOKEN_ENCRYPTION_KEY` makes stored
  connections unreadable.

### Proxy routes

Except `/health`, `/v1/providers` and the OAuth callback, every route needs `Authorization:
Bearer <Snap Cloud session token>`, and they're limited to 120 requests per user per minute.

| Route | Purpose |
|---|---|
| `GET /health` | `{ok: true, version: "0.1.0"}` |
| `GET /v1/providers` | Provider catalog (formats, notes) |
| `GET /v1/connections` | This user's connection state per provider |
| `POST /v1/connections/<id>/oauth` | Start OAuth; returns the browser URL |
| `POST /v1/connections/<id>/token` | Import a user access token (`{access_token}`), verified by the provider |
| `DELETE /v1/connections/<id>` | Delete the stored credential |
| `GET /v1/connections/tiktok/creator` | TikTok creator info and privacy options (Direct Post) |
| `POST /v1/media/finalize` | Encode the uploaded frames/photo; returns the media record |
| `POST /v1/jobs` | Queue a share job (`mediaId`, `targets`, UUID `requestKey`) |
| `GET /v1/jobs/<uuid>` | Job status and per-provider results |
| `GET /oauth/<provider>/callback` | OAuth redirect target |

## 3. Editor configuration panel (`Plugins/SnapCloudSocialMedia/`)

Open **Window → Snap Cloud Social Media**. If project plugins don't load, install the ZIP built
by `Editor/build-artifacts.py` (`Dist/SnapCloudSocialMediaPlugin.zip`). The project target must
be SPECS.

- **Connections** tab:
  1. Enter the publishing proxy URL, the Snap Cloud project URL and the publishable key.
  2. Sign in for SPECS in the Lens Studio profile menu, then press **Sign in with Lens Studio
     account**. The session stays in memory only.
  3. For each provider: **Connect <Provider> · Sign in** (finish OAuth in the browser, then
     **Refresh account connections**), or paste an existing user access token and press
     **Connect with token**. The field clears right away. **Disconnect** deletes the proxy's
     stored credential; revoke the grant in the provider's account settings too, if you want.
- **Capture & captions** tab: demo mode, recording aspect, microphone, capture FPS (1–12),
  maximum clip length (1–15 s), default caption, video title, and per provider: enabled,
  format, caption override, YouTube privacy, TikTok delivery (`inbox` | `direct`).
- **Config JSON** tab: paste a complete public config and press **Apply pasted JSON to
  controls**, or press **Show controls as JSON** or **Reload saved config**.
- **Save public config to Lens** writes `Assets/SnapCloudSocialMedia.lspkg/social.config.json`
  (validated by the same `parseConfig`). Restart the Preview afterwards.
- **Add prefab to scene** instantiates the prefab. In a consumer project the panel first
  unpacks the imported package so the JSON can be edited.

## 4. Configure the Lens

Set `demoMode` to `false`, then fill in `proxyUrl` (https), `cloud.url` (https) and
`cloud.publishableKey`. Enable only destinations that are connected for your user. Example
destination:

```json
"instagram": {"enabled": true, "format": "reel", "caption": "A moment through my Specs ✨"}
```

An empty caption uses `composer.caption`. YouTube uses `composer.title` and uploads `private`
unless you change `privacy`.

### Importing existing tokens (instead of OAuth)

```bash
cd Proxy
cp connections.private.example.json connections.private.json
# reference env vars: SNAP_CLOUD_ACCESS_TOKEN=<project session of the account owner>,
# <PROVIDER>_USER_ACCESS_TOKEN / _USER_REFRESH_TOKEN=<user-authorized tokens>
node connect-config.mjs connections.private.json
```

These are user-authorized access tokens, not developer API keys. Each is verified by the
provider before it's linked to the signed-in owner.

## Platform behavior

| Provider | Formats | What a share submits / needs |
|---|---|---|
| Snapchat | story, spotlight | Public Profile API. Needs a Business Manager app allowlisted by Snap. Story 5–60 s, Spotlight 6–60 s, caption ≤ 160. Story captions are omitted. |
| X | video, photo | v2 media upload + post. Needs `tweet.write`, `media.write`; paid API access may be required. Caption ≤ 280. |
| YouTube | video, short | Resumable upload with title (≤ 100) and privacy. Needs `youtube.upload` and `youtube.readonly`. YouTube decides whether it's a Short. |
| LinkedIn | video, photo | Member media upload + post. Needs `w_member_social`. Caption ≤ 3000. |
| Instagram | reel, story, photo | Professional account, publishing permissions, app review. Caption ≤ 2200. Story captions aren't drawn into the media. |
| Threads | video, photo | Needs `threads_basic`, `threads_content_publish`. Caption ≤ 500. |
| TikTok | video | Inbox upload by default (finish in TikTok). For Direct Post, set `TIKTOK_SCOPES=user.info.basic,video.upload,video.publish` (or `apps.tiktok.scopes`), restart, reconnect, choose `direct`; the privacy level is picked in the Lens. |

Reels, Stories, Shorts and Spotlight need portrait media.

## Failure handling

A job fans out to every target and saves a receipt per destination. Per-provider states are
`published`, `processing`, `draft`, `failed` and `unknown`. The job status is `complete`,
`partial`, `failed` or `unknown`. The `requestKey` deduplicates repeat submissions, and a failed
destination never resends successful posts. Timeouts and ambiguous responses become `unknown`
and are **never retried automatically**. The proxy also marks jobs stuck in `processing` for
10 minutes as `unknown`. Inspect the account before posting again. Source frames are deleted
after encoding; the encoded media and receipts stay in your project.

## Test and export

```bash
cd Proxy && npm test             # provider HTTP mocked; no real posts
cd .. && python3 Editor/verify-assets.py
python3 Editor/build-artifacts.py   # Dist/SnapCloudSocialMediaPlugin.zip, Dist/SnapCloudSocialMediaSource.zip
```

Create the native `.lspkg` by running `Editor/export-package.js` by absolute path through CLAD's
ExecuteEditorCode, then reimport it in a clean consumer project. A filesystem ZIP is not a
substitute for the native export.
