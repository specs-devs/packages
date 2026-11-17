# Supabase Client

## What it is
A package that bundles the Supabase JavaScript SDK for Lens Studio, with Lens transport polyfills and a Snapchat
sign-in helper, so a Lens can talk to a Snap Cloud project. It provides the client library, the
`SnapCloudRequirements` credentials component and a demo test prefab; it does not provide UI, a backend project or a
database deployment. It is for developers building connected Lenses that need auth, tables, storage, edge functions or
realtime.

## What it does
- `createClient(url, publicToken)` from `SupabaseClient.lspkg/supabase-snapcloud` returns a Supabase client and adds
  `auth.signInWithSnapchat()`, which signs in through the `LensStudio:SupabaseModule` transport.
- Importing the bundle installs Lens-side globals (`fetch`, `Request`, `Headers`, `FormData`, `WebSocket`, URL and
  timer helpers) and creates a `TimerSceneManager` object, so the upstream SDK runs in the Lens runtime.
- The client covers table and RPC queries, Storage upload / download and URLs, edge function invocation, and realtime
  channels (broadcast, presence and Postgres changes).
- `SnapCloudRequirements` holds the `SupabaseProject` asset in one place and reports whether it is configured.
- The demo prefab runs `Client Tests` (sign-in, table, Storage, functions) and `Realtime Test` (subscribe and
  broadcast) one at a time from the example carousel and prints PASS / FAIL to the Logger.

## Highlights
- Upstream SDK API with full TypeScript declarations in `supabase-snapcloud.d.ts`.
- Snapchat sign-in in one call; only available on clients made through the exported `createClient` factory.
- Polyfills adapted to Lens networking, with documented limits (no general multipart, no stream guarantees, one
  WebSocket listener per event type, abort signals not forwarded).
- A red `CredentialsWarning` panel shows before the guide until a Snap Cloud project is assigned; no Remote Service
  Gateway tokens are used.
- Typed demo database schema in `Example/DatabaseTypes.ts`.

## Core scripts
| Script | What it does |
|---|---|
| `supabase-snapcloud.js` | The bundled Supabase SDK with Lens polyfills and the Snapchat sign-in helper. |
| `supabase-snapcloud.d.ts` | Type declarations for the client, auth, query, storage, functions and realtime APIs. |
| `SnapCloudRequirements.ts` | Central `SupabaseProject` holder with configuration checks and setup warnings. |
| `Example/ts__test.ts` | Demo client tests: sign-in, table queries, Storage and functions. |
| `Example/ts_test_realtime.ts` | Demo realtime test: channel subscribe, broadcast and cleanup. |
| `Example/DatabaseTypes.ts` | Typed schema for the demo `test_table`. |
| `Example/CredentialsWarning/CredentialsWarning.ts` | Demo panel that lists missing credentials before the guide. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons, Utilities, SnapDecorators (the client bundle imports none of
  them). Needs your own Snap Cloud project imported as a `SupabaseProject` asset, with the backend and its access
  policies configured; never put an admin secret in a Lens. The bundle needs the Lens runtime. Backend, auth and
  realtime behaviour should be verified against your project and on Specs.
- **Get started:** drop `SupabaseClient__PLACE_IN_SCENE.prefab` into a Specs scene and assign your project on its
  `SnapCloudRequirements` object, or import `createClient` in your own component and guard the project input first.
- **More docs:**
  - [setup.md](setup.md) – Snap Cloud project, credentials warning and backend expectations
  - [cheat-sheet.md](cheat-sheet.md) – factory, result handling and transport limits, read first
  - [api-status.md](api-status.md) – Lens adaptation compared with upstream declarations
  - [api.md](api.md) – client factory, options, auth and query API
  - [storage-functions.md](storage-functions.md) – bucket and file operations, function invocation
  - [realtime.md](realtime.md) – channels, presence, broadcast and cleanup
  - [polyfills.md](polyfills.md) – exact Lens transport behaviour
  - [components.md](components.md) – the demo prefab's scripts and inputs
  - [examples.md](examples.md) – guarded, compile-checked functions
  - [troubleshooting.md](troubleshooting.md) – source limits and pending validation
  - [tutorial.md](tutorial.md) – preserved original tutorial
