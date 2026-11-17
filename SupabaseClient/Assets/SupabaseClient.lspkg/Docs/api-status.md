# SupabaseClient API status

[← Agent usage index](../README.md)

## Use when

Read to distinguish shipped declarations from verified Lens behavior.

Bundle commit 5a6c9c2 (`version.json`; the package version is in `package.native`). Bundle transport header says supabase-snapcloud/0.0.10; upstream realtime SDK string2.81.0 appears in JS. These identifiers describe different layers.

| Status | Surface | Evidence / limits |
|---|---|---|
| Current | createClient, SupabaseClient, auth/query/storage/functions/realtime types and error helpers | Actual JS exports plus installed .d.ts. The client bundle has no Inspector components (`SnapCloudRequirements` is a separate component, see [components](components.md)). |
| Current | signInWithSnapchat():Promise<AuthTokenResponse> | Factory assigns helper calling signInWithIdToken({provider:'snapchat',token:'n/a'}); declaration merges GoTrueClient. |
| Current | setTimeout/clearTimeout/setInterval/clearInterval main exports | Scene DelayedCallbackEvent implementation; token objects, milliseconds. |
| Current, transport-limited | fetch, Request, Headers, FormData, WebSocket globals | Partial browser adaptation; see polyfills. |
| Deprecated | getClaims options.keys | Source @deprecated says use options.jwks. Additional upstream deprecation tags are in declarations; no broad package removal inferred. |
| Experimental/unverified on Lens | Browser OAuth/Web3/WebAuthn/MFA/admin/vector/analytics/streaming types | SDK declares them; no platform/deployment support claim is made. Admin secrets should remain backend-side. |
| Removed | None established | Historical tutorial incomplete code is preserved, not an API removal record. |

Original tutorial claims complete browser compatibility, secure persistent sessions across launches, automatic multipart/resumable upload and general streaming response support; source does not establish these Lens guarantees. JS auth storage uses supplied storage, localStorage if supported, else memory. HEAD may become GET/range0–0. Request adapter does not forward signal/cache/credentials/integrity/keepalive/mode into native options. No external calls were performed. Current runnable examples type-check; this does not prove transport/backend support.
