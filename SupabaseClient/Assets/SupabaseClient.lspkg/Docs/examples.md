# SupabaseClient examples

[← Agent usage index](../README.md)

## Use when

Read for minimal actual functions, with no automatic backend action.

Import has runtime side effects described in polyfills. Functions below perform network operations only when explicitly called with an existing client; none were executed in this pass. Use URL/publicToken from SupabaseProject and the main createClient factory in your own controller, then guard startup/configuration before calling them.

## Component: client from a SupabaseProject input

Compile-checked in the demo project (2026-10-01). Drag a Supabase Project asset from Snap Cloud onto `supabaseProject`; without one the component logs and stops instead of throwing.

```typescript
import {createClient, type SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud"

@component
export class SnapCloudStarter extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("Supabase Project asset from Snap Cloud")
  supabaseProject: SupabaseProject

  private client: SupabaseClient

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  private async start() {
    if (!this.supabaseProject) {
      print("SnapCloudStarter: no Supabase Project assigned")
      return
    }
    this.client = createClient(this.supabaseProject.url, this.supabaseProject.publicToken)
    const {data, error} = await this.client.auth.signInWithSnapchat()
    if (error) {
      print("Sign-in failed: " + error.message)
      return
    }
    print("Signed in as " + data.user.id)
  }

  onDestroy() {
    if (this.client) {
      this.client.removeAllChannels()
    }
  }
}
```

## Snapchat sign-in result handling

```typescript
import type {SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud";
export async function signInConfiguredClient(client: SupabaseClient): Promise<string | null> {
  const {data, error} = await client.auth.signInWithSnapchat();
  if (error || !data.user) return null;
  return data.user.id;
}
```

## Query a configured application table

The messages schema belongs to the application/backend; the package does not create it. Query errors are returned, not treated as success.

```typescript
import type {SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud";
export async function countRecentMessages(client: SupabaseClient): Promise<number> {
  const {data, error} = await client.from("messages").select("id").limit(10);
  if (error) throw new Error(error.message);
  return data ? data.length : 0;
}
```

## Existing binary bytes to storage

Input bytes must already be encoded in MIME indicated by the caller. This does not convert a Texture, resize or record media.

```typescript
import type {SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud";
export async function uploadExistingBytes(
  client: SupabaseClient, bucket: string, path: string, bytes: Uint8Array, contentType: string
): Promise<string> {
  const {data, error} = await client.storage.from(bucket).upload(path, bytes, {contentType, upsert: false});
  if (error) throw new Error(error.message);
  return data.path;
}
```

## Remove a retained channel

```typescript
import type {SupabaseClient, RealtimeChannel} from "SupabaseClient.lspkg/supabase-snapcloud";
export async function releaseChannel(client: SupabaseClient, channel: RealtimeChannel): Promise<string> {
  return await client.removeChannel(channel);
}
```

The four helper snippets compile against installed declarations; the component above compiled in the demo project. No createClient/sign-in/upload/request ran. For a drag-and-drop test harness, drop `SupabaseClient__PLACE_IN_SCENE.prefab` (its examples live in `Example/`, see [Components](components.md)); use SnapCloudExamples for fuller demo scenes. Static compile does not prove result shape or delivery against a real backend.
