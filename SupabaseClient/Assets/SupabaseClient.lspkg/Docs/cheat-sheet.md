# SupabaseClient cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before importing/creating a client.

1. Use exported createClient to install signInWithSnapchat on that client's auth; new SupabaseClient bypasses that assignment. → [API](api.md)
2. Main import installs globals and creates TimerSceneManager; this library has runtime side effects even before queries. → [Polyfills](polyfills.md)
3. Bind SupabaseProject URL/publicToken (input `@allowUndefined`, guard it before `createClient` — an empty input throws `Cannot read property 'url' of undefined` in onAwake) and configure backend/RLS. Never use an admin secret in a Lens. → [Examples](examples.md)
4. Await queries and inspect error before data; writes return no selected rows unless chained .select(). → [API](api.md)
5. Sign-in helper delegates provider snapchat/token n/a to LensStudio:SupabaseModule transport. Declarations for other auth flows do not prove Lens support. → [Status](api-status.md)
6. Use Uint8Array for known binary upload bytes; general browser multipart/stream assumptions are not supported by the adapter. → [Polyfills](polyfills.md)
7. getPublicUrl only constructs a URL; it does not make a bucket public or perform a request. → [Storage](storage-functions.md)
8. Retain auth subscription handles and remove channels/stop timers on component destruction; package provides no scene controller. → [Realtime](realtime.md)
9. Preview QA (2026-10-01) covered import, the empty-project guard and the demo carousel only; backend/auth/realtime/device behavior is not verified yet. → [Troubleshooting](troubleshooting.md)
