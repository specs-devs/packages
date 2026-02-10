![SnapCloudExamples](../AssetImage/SnapCloudExamples.png)

# SnapCloudExamples

SnapCloudExamples is a comprehensive collection of example implementations demonstrating Supabase integration on Spectacles. It showcases authentication, database operations, real-time synchronization, cloud storage, edge functions, and media streaming capabilities, providing developers with ready-to-use patterns for building cloud-connected Spectacles experiences.

## Features

- **Snapchat Authentication**: Sign in users with Snapchat OAuth via Supabase Auth
- **Database Operations**: CRUD operations with Supabase tables and real-time subscriptions
- **Real-Time Sync**: Multi-user cursor tracking and data broadcasting
- **Cloud Storage**: Upload and download images, videos, and audio files
- **Edge Functions**: Serverless image processing and custom backend logic
- **Media Streaming**: Real-time audio and video streaming to cloud storage
- **Composite Camera**: Multi-camera capture with custom rendering pipelines
- **Production Ready**: Complete examples with UI, error handling, and best practices

## Quick Start

Basic Supabase authentication:

```typescript
import { createClient, SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud";

@component
export class MySupabaseApp extends BaseScriptComponent {
  @input supabaseProject: SupabaseProject;

  private client: SupabaseClient;

  async onStart() {
    // Initialize Supabase client
    this.client = createClient(
      this.supabaseProject.url,
      this.supabaseProject.publicToken,
      {
        realtime: {
          heartbeatIntervalMs: 2500 // Required for alpha
        }
      }
    );

    // Sign in with Snapchat
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: "snapchat",
      token: ""
    });

    if (error) {
      print("Sign in failed: " + JSON.stringify(error));
      return;
    }

    if (data && data.user) {
      print("Signed in as: " + data.user.id);
      print("Session active: " + (data.session ? "YES" : "NO"));
    }
  }

  onDestroy() {
    if (this.client) {
      this.client.removeAllChannels();
    }
  }
}
```

## Script Highlights

- **BasicAuth.ts**: Simple Snapchat authentication example using Supabase Auth. Demonstrates client initialization with project URL and public token, sign-in with Snapchat ID token (provider-based OAuth), session management with access tokens, and user data extraction. Shows proper cleanup with removeAllChannels on destroy.

- **TableConnector.ts**: Database operations example with CRUD and real-time subscriptions. Demonstrates inserting rows with user ID associations, querying data with filters and ordering, updating existing rows, deleting rows, and subscribing to real-time changes (INSERT, UPDATE, DELETE events). Includes comprehensive error handling and status logging.

- **RealtimeCursor.ts**: Multi-user real-time cursor synchronization example. Shows broadcasting cursor positions via Supabase Realtime channels, receiving and rendering remote cursor movements, coordinate space mapping between devices, broadcast/follow mode toggling, and smooth interpolation for remote cursor movement. Demonstrates presence tracking and multi-client scenarios.

- **StorageLoader.ts**: Cloud storage operations for media files. Demonstrates uploading files to Supabase Storage buckets with public/private access control, downloading files as textures for rendering, listing bucket contents, generating public URLs for media, and handling large file uploads. Shows proper bucket and path management.

- **EdgeFunctionImgProcessing.ts**: Edge function invocation for serverless processing. Demonstrates calling Supabase Edge Functions with image data, sending binary/base64 image payloads, receiving processed results, error handling for function failures, and displaying processed images. Shows how to integrate custom backend logic.

- **AudioCaptureUploader.ts**: Audio recording and cloud upload example. Captures audio from microphone using AudioCaptureModule, encodes audio as WAV format, uploads to Supabase Storage, generates playback URLs, and manages recording state (start/stop). Includes progress indicators and error handling.

- **VideoCaptureUploader.ts**: Video recording and upload example. Captures video from camera using VideoCaptureModule, manages recording duration and file size, uploads to cloud storage with progress tracking, generates preview thumbnails, and provides playback URLs. Shows proper resource cleanup.

- **CompositeStreamingController.ts**: Real-time composite camera streaming. Streams multi-camera composites to cloud storage in real-time, manages streaming sessions with start/stop controls, handles network interruptions gracefully, provides visual feedback during streaming, and demonstrates advanced media capture scenarios.

## Example Categories

### Example 1: Authentication & Tables

Basic Supabase setup with auth and database operations:

```typescript
// BasicAuth.ts - Authenticate users
async signInUser() {
  const { data, error } = await this.client.auth.signInWithIdToken({
    provider: "snapchat",
    token: ""
  });

  if (error) {
    print("Sign in FAILED: " + JSON.stringify(error));
    return;
  }

  if (data && data.user) {
    const userId = data.user.id;
    print("User ID: " + userId);

    if (data.session) {
      print("Session Active: YES");
      print("Access Token: " + data.session.access_token.substring(0, 20) + "...");
      print("Expires At: " + new Date(data.session.expires_at * 1000).toISOString());
    }
  }
}

// TableConnector.ts - Database operations
async insertData(message: string) {
  const { data, error } = await this.client
    .from("messages")
    .insert({
      user_id: this.userId,
      message: message,
      created_at: new Date().toISOString()
    })
    .select();

  if (error) {
    print("Insert failed: " + error.message);
  } else {
    print("Inserted: " + JSON.stringify(data));
  }
}

async queryData() {
  const { data, error } = await this.client
    .from("messages")
    .select("*")
    .eq("user_id", this.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    print("Query failed: " + error.message);
  } else {
    print(`Found ${data.length} messages`);
  }
}
```

### Example 2: Real-Time Synchronization

Multi-user cursor tracking with broadcasts:

```typescript
@component
export class RealtimeCursor extends BaseScriptComponent {
  @input snapCloudRequirements: SnapCloudRequirements;
  @input channelName: string = "cursor-sync";
  @input cursorObject: SceneObject;

  private client: SupabaseClient;
  private channel: RealtimeChannel;
  private mode: "broadcast" | "follow" = "broadcast";

  async setupRealtimeChannel() {
    this.channel = this.client.channel(this.channelName);

    // Subscribe to broadcasts
    this.channel.on("broadcast", { event: "cursor_move" }, (payload) => {
      this.handleRemoteCursorMove(payload);
    });

    await this.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        print("Channel subscribed successfully");
        this.startBroadcastLoop();
      }
    });
  }

  private startBroadcastLoop() {
    if (this.mode !== "broadcast") return;

    this.createEvent("UpdateEvent").bind(() => {
      const pos = this.cursorObject.getTransform().getWorldPosition();

      // Broadcast position
      this.channel.send({
        type: "broadcast",
        event: "cursor_move",
        payload: {
          x: pos.x / this.coordinateScale,
          y: pos.y / this.coordinateScale,
          timestamp: Date.now()
        }
      });
    });
  }

  private handleRemoteCursorMove(payload: any) {
    if (this.mode !== "follow") return;

    const data = payload.payload;
    const targetX = data.x * this.movementScale;
    const targetY = data.y * this.movementScale;

    // Smooth interpolation
    const currentPos = this.cursorObject.getTransform().getWorldPosition();
    const newPos = new vec3(
      MathUtils.lerp(currentPos.x, targetX, this.movementSpeed),
      MathUtils.lerp(currentPos.y, targetY + this.heightOffset, this.movementSpeed),
      this.cursorZPosition
    );

    this.cursorObject.getTransform().setWorldPosition(newPos);
  }
}
```

### Example 3: Cloud Storage

Upload and download media files:

```typescript
@component
export class StorageLoader extends BaseScriptComponent {
  @input snapCloudRequirements: SnapCloudRequirements;
  @input bucketName: string = "images";
  @input targetImage: Image;

  private client: SupabaseClient;

  async uploadImage(imageData: Uint8Array, filename: string) {
    const { data, error } = await this.client
      .storage
      .from(this.bucketName)
      .upload(filename, imageData, {
        contentType: "image/png",
        upsert: true
      });

    if (error) {
      print("Upload failed: " + error.message);
      return null;
    }

    print("Uploaded: " + data.path);

    // Get public URL
    const { data: urlData } = this.client
      .storage
      .from(this.bucketName)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  async downloadImage(path: string) {
    const { data, error } = await this.client
      .storage
      .from(this.bucketName)
      .download(path);

    if (error) {
      print("Download failed: " + error.message);
      return;
    }

    // Convert to texture
    const arrayBuffer = await data.arrayBuffer();
    const texture = this.createTextureFromData(new Uint8Array(arrayBuffer));

    if (texture && this.targetImage) {
      this.targetImage.mainPass.baseTex = texture;
      print("Image loaded successfully");
    }
  }

  private createTextureFromData(data: Uint8Array): Texture {
    // Implementation depends on image format
    // Use ProceduralTextureProvider or similar
    return null;
  }
}
```

### Example 4: Edge Functions

Serverless image processing:

```typescript
@component
export class EdgeFunctionImgProcessing extends BaseScriptComponent {
  @input snapCloudRequirements: SnapCloudRequirements;
  @input functionName: string = "process-image";
  @input sourceImage: Texture;
  @input resultImage: Image;

  private client: SupabaseClient;

  async processImage() {
    // Get image data
    const imageData = this.getTextureData(this.sourceImage);

    // Call edge function
    const { data, error } = await this.client.functions.invoke(this.functionName, {
      body: {
        image: this.arrayBufferToBase64(imageData),
        operation: "grayscale"
      }
    });

    if (error) {
      print("Function failed: " + error.message);
      return;
    }

    // Display result
    print("Processing complete");
    const resultData = this.base64ToArrayBuffer(data.processedImage);
    const resultTexture = this.createTextureFromData(resultData);

    if (resultTexture && this.resultImage) {
      this.resultImage.mainPass.baseTex = resultTexture;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
```

### Example 5: Media Capture & Streaming

Record and upload audio/video:

```typescript
@component
export class AudioCaptureUploader extends BaseScriptComponent {
  @input snapCloudRequirements: SnapCloudRequirements;
  @input bucketName: string = "audio";

  private audioCapture: AudioCaptureModule;
  private isRecording: boolean = false;

  onAwake() {
    this.audioCapture = require("LensStudio:AudioCaptureModule") as AudioCaptureModule;
  }

  async startRecording() {
    if (this.isRecording) return;

    this.isRecording = true;
    print("Recording started");

    this.audioCapture.startRecording();
  }

  async stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    print("Recording stopped");

    const audioData = this.audioCapture.stopRecording();

    // Upload to cloud
    await this.uploadAudio(audioData);
  }

  private async uploadAudio(audioData: Uint8Array) {
    const filename = `recording_${Date.now()}.wav`;

    const { data, error } = await this.client
      .storage
      .from(this.bucketName)
      .upload(filename, audioData, {
        contentType: "audio/wav"
      });

    if (error) {
      print("Upload failed: " + error.message);
      return;
    }

    print("Audio uploaded: " + data.path);

    // Get playback URL
    const { data: urlData } = this.client
      .storage
      .from(this.bucketName)
      .getPublicUrl(data.path);

    print("Playback URL: " + urlData.publicUrl);
  }
}
```

## Database Schema

Example table structure for messages:

```sql
create table messages (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  message text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable real-time
alter publication supabase_realtime add table messages;
```

## Storage Buckets

Configure storage buckets for media:

```sql
-- Create bucket
insert into storage.buckets (id, name, public)
values ('images', 'images', true);

-- Set policies
create policy "Public access"
on storage.objects for select
using ( bucket_id = 'images' );

create policy "Authenticated users can upload"
on storage.objects for insert
with check (
  bucket_id = 'images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Edge Function Example

Serverless image processing function:

```typescript
// functions/process-image/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { image, operation } = await req.json()

  // Decode base64 image
  const imageData = Uint8Array.from(atob(image), c => c.charCodeAt(0))

  // Process image (grayscale example)
  const processedData = applyGrayscale(imageData)

  // Encode result
  const processed64 = btoa(String.fromCharCode(...processedData))

  return new Response(
    JSON.stringify({ processedImage: processed64 }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

## Configuration Requirements

### SnapCloudRequirements Component

Centralized Supabase configuration:

```typescript
@component
export class SnapCloudRequirements extends BaseScriptComponent {
  @input supabaseProject: SupabaseProject;

  public getClient(): SupabaseClient {
    return createClient(
      this.supabaseProject.url,
      this.supabaseProject.publicToken,
      {
        realtime: {
          heartbeatIntervalMs: 2500
        }
      }
    );
  }
}
```

## Best Practices

1. **Error Handling**: Always check for errors in Supabase responses
2. **Session Management**: Call `removeAllChannels()` in `onDestroy()`
3. **Heartbeat Interval**: Set `heartbeatIntervalMs: 2500` for real-time (alpha requirement)
4. **Resource Cleanup**: Clean up subscriptions, channels, and capture modules
5. **User ID Storage**: Store user ID after authentication for database operations
6. **File Naming**: Use timestamps or UUIDs for unique filenames
7. **Bucket Organization**: Organize files by user ID in folder structure

## Performance Considerations

- **Real-Time Broadcasts**: Limit broadcast frequency (0.1-1 second intervals)
- **Media Uploads**: Show progress indicators for large files
- **Database Queries**: Use pagination for large result sets
- **Storage Downloads**: Cache textures to avoid repeated downloads
- **Channel Subscriptions**: Unsubscribe when not in use

## Limitations

- **Alpha Requirements**: Heartbeat interval workaround required
- **Authentication**: Currently supports Snapchat OAuth only
- **File Size**: Storage uploads limited by network and timeout constraints
- **Real-Time**: Channel presence limited to subscription status
- **Editor Testing**: Many features require device deployment

---

Built with 👻 by the Spectacles team

