# SupabaseClient

A complete Supabase integration for Spectacles that brings backend-as-a-service capabilities to AR experiences. This package provides full access to Supabase's authentication, database, storage, and edge functions through a polyfilled JavaScript client optimized for Lens Studio. With SupabaseClient, developers can build cloud-connected AR applications with user authentication, real-time data synchronization, file storage, and serverless functions without managing backend infrastructure.

## Features

- **Snapchat Authentication** - Seamless OAuth integration with Snapchat accounts
- **Database Operations** - Full PostgreSQL access with type-safe queries (select, insert, update, delete)
- **Storage API** - Upload and download files with support for images, videos, and binary data
- **Edge Functions** - Call serverless TypeScript functions hosted on Supabase
- **Real-time Subscriptions** - WebSocket-based live data updates
- **Type Safety** - Full TypeScript support with auto-generated database types
- **Polyfills** - Complete browser API compatibility for Lens Studio environment
- **Automatic Authentication** - Session management and token refresh handled automatically

## Quick Start

```typescript
import { createClient, type SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud';
import { Database } from 'DatabaseTypes';

@component
export class SupabaseExample extends BaseScriptComponent {
    @input
    supabaseProject: SupabaseProject;

    private supabase: SupabaseClient<Database>;

    async onAwake() {
        // Initialize client
        this.supabase = createClient<Database>(
            this.supabaseProject.url,
            this.supabaseProject.publicToken
        );

        // Authenticate with Snapchat
        const { data, error } = await this.supabase.auth.signInWithSnapchat();
        if (error) {
            print("Auth error: " + error);
            return;
        }

        print("Authenticated as: " + data.user.email);

        // Database operations
        await this.queryDatabase();
        await this.insertData();

        // Storage operations
        await this.uploadFile();

        // Call edge function
        await this.callFunction();
    }

    async queryDatabase() {
        const { data, error } = await this.supabase
            .from('messages')
            .select('id, content, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            print("Query error: " + error);
            return;
        }

        print("Retrieved " + data.length + " messages");
        data.forEach(msg => print(msg.content));
    }

    async insertData() {
        const { data, error } = await this.supabase
            .from('messages')
            .insert({ content: 'Hello from Spectacles!' });

        if (error) {
            print("Insert error: " + error);
        } else {
            print("Message inserted successfully");
        }
    }

    async uploadFile() {
        // Upload texture as image
        const imageData = this.textureToBlob(myTexture);

        const { data, error } = await this.supabase.storage
            .from('images')
            .upload('spectacles-photo.jpg', imageData, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            print("Upload error: " + error);
        } else {
            print("File uploaded: " + data.path);
        }
    }

    async callFunction() {
        const { data, error } = await this.supabase.functions.invoke('my-function', {
            body: { name: 'Spectacles User' }
        });

        if (error) {
            print("Function error: " + error);
        } else {
            print("Function result: " + JSON.stringify(data));
        }
    }

    private textureToBlob(texture: Texture): Uint8Array {
        // Implementation for texture conversion
        return new Uint8Array();
    }
}
```

## Script Highlights

### Authentication System

The authentication module provides seamless integration with Snapchat's OAuth system through the signInWithSnapchat method which handles the complete OAuth flow automatically. Once authenticated, the session is maintained across app launches with automatic token refresh. The getUser method retrieves the current user's profile including email and Snapchat-specific metadata. Authentication state can be monitored through event listeners for sign-in and sign-out events. All API requests automatically include the user's authentication token, and the session persists in secure storage managed by Lens Studio.

### Database Operations

The database client provides a type-safe query builder for PostgreSQL operations with full TypeScript intellisense based on your database schema. The from() method creates a query for a specific table, and chainable methods like select(), insert(), update(), delete(), eq(), gt(), lt(), order(), and limit() build complex queries with compile-time type checking. Queries return promises with data and error properties following Supabase conventions. The client supports joins, aggregations, full-text search, and stored procedure calls. Row-level security policies defined in Supabase are automatically enforced based on the authenticated user.

### Storage API

The storage module enables file uploads and downloads with support for any binary data including images, videos, and 3D models. The from() method selects a storage bucket, and upload() accepts Uint8Array, Blob, or File objects with configurable content types and upsert behavior. The download() method retrieves files as binary data, while getPublicUrl() generates shareable URLs for public buckets. List() retrieves file metadata, and remove() deletes files. The API handles multipart uploads for large files automatically and supports resumable uploads for reliability.

### Edge Functions

Edge functions provide serverless compute capabilities executed on Supabase's global infrastructure. The invoke() method calls a deployed function by name with optional body, headers, and query parameters. Functions receive the authenticated user context automatically and can access the database with admin privileges. Response data is automatically parsed as JSON, and streaming responses are supported for real-time generation use cases. Functions can be used for custom business logic, AI integrations, payment processing, or any server-side operations.

### Polyfill System

The package includes comprehensive polyfills that bridge browser APIs with Lens Studio's environment including fetch(), WebSocket, Headers, FormData, URL, URLSearchParams, TextDecoder, and timer functions. These polyfills enable the standard Supabase JavaScript client to run unmodified in Lens Studio, maintaining full compatibility with Supabase's API surface. The polyfills are optimized for Spectacles' runtime and handle platform-specific quirks transparently. Developers can use standard web APIs in their code, and the polyfills translate to Lens Studio equivalents automatically.

## Core API Methods

### Authentication

```typescript
// Sign in with Snapchat OAuth
supabase.auth.signInWithSnapchat(): Promise<{data, error}>;

// Get current user
supabase.auth.getUser(): Promise<{data: User, error}>;

// Sign out
supabase.auth.signOut(): Promise<{error}>;

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => void);
```

### Database

```typescript
// Query builder
supabase.from('table_name')
    .select('column1, column2')
    .eq('column', value)
    .gt('column', value)
    .lt('column', value)
    .order('column', { ascending: true })
    .limit(10)
    .single(); // Returns single row

// Insert
supabase.from('table_name').insert({ col: 'value' });
supabase.from('table_name').insert([{ col: 'val1' }, { col: 'val2' }]);

// Update
supabase.from('table_name').update({ col: 'new_value' }).eq('id', 1);

// Delete
supabase.from('table_name').delete().eq('id', 1);

// Upsert
supabase.from('table_name').upsert({ id: 1, col: 'value' });
```

### Storage

```typescript
// Upload file
supabase.storage.from('bucket_name').upload('path/file.jpg', fileData, {
    contentType: 'image/jpeg',
    upsert: true
});

// Download file
supabase.storage.from('bucket_name').download('path/file.jpg');

// Get public URL
supabase.storage.from('bucket_name').getPublicUrl('path/file.jpg');

// List files
supabase.storage.from('bucket_name').list('folder');

// Delete file
supabase.storage.from('bucket_name').remove(['path/file.jpg']);
```

### Edge Functions

```typescript
// Invoke function
supabase.functions.invoke('function-name', {
    body: { key: 'value' },
    headers: { 'Custom-Header': 'value' }
});
```

## Advanced Usage

### Example 1: Real-time Leaderboard

```typescript
import { createClient } from 'SupabaseClient.lspkg/supabase-snapcloud';

@component
export class RealtimeLeaderboard extends BaseScriptComponent {
    @input supabaseProject: SupabaseProject;
    @input leaderboardText: Text;

    private supabase: any;
    private subscription: any;

    async onAwake() {
        this.supabase = createClient(
            this.supabaseProject.url,
            this.supabaseProject.publicToken
        );

        await this.supabase.auth.signInWithSnapchat();

        // Load initial data
        await this.loadLeaderboard();

        // Subscribe to real-time updates
        this.subscription = this.supabase
            .channel('leaderboard_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'scores'
            }, (payload) => {
                print('Change detected:', payload);
                this.loadLeaderboard();
            })
            .subscribe();
    }

    async loadLeaderboard() {
        const { data, error } = await this.supabase
            .from('scores')
            .select('username, score')
            .order('score', { ascending: false })
            .limit(10);

        if (!error && data) {
            let text = 'TOP 10 SCORES\n\n';
            data.forEach((entry, index) => {
                text += `${index + 1}. ${entry.username}: ${entry.score}\n`;
            });
            this.leaderboardText.text = text;
        }
    }

    async submitScore(score: number) {
        const { data: userData } = await this.supabase.auth.getUser();

        await this.supabase.from('scores').insert({
            user_id: userData.user.id,
            username: userData.user.email.split('@')[0],
            score: score
        });
    }

    onDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
```

### Example 2: User Profile Management

```typescript
@component
export class UserProfile extends BaseScriptComponent {
    @input supabaseProject: SupabaseProject;
    @input profileImage: Texture;

    private supabase: any;
    private userId: string;

    async onAwake() {
        this.supabase = createClient(
            this.supabaseProject.url,
            this.supabaseProject.publicToken
        );

        const { data } = await this.supabase.auth.signInWithSnapchat();
        this.userId = data.user.id;

        await this.loadProfile();
    }

    async loadProfile() {
        const { data, error } = await this.supabase
            .from('profiles')
            .select('username, avatar_url, bio')
            .eq('user_id', this.userId)
            .single();

        if (data) {
            print(`Username: ${data.username}`);
            print(`Bio: ${data.bio}`);

            if (data.avatar_url) {
                await this.loadAvatar(data.avatar_url);
            }
        }
    }

    async updateProfile(username: string, bio: string) {
        const { error } = await this.supabase
            .from('profiles')
            .upsert({
                user_id: this.userId,
                username: username,
                bio: bio,
                updated_at: new Date().toISOString()
            });

        if (!error) {
            print('Profile updated successfully');
        }
    }

    async uploadAvatar(imageData: Uint8Array) {
        const fileName = `${this.userId}/avatar.jpg`;

        const { data, error } = await this.supabase.storage
            .from('avatars')
            .upload(fileName, imageData, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (!error) {
            const { data: urlData } = this.supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            await this.updateProfile(null, null);
        }
    }

    async loadAvatar(url: string) {
        const { data, error } = await this.supabase.storage
            .from('avatars')
            .download(url);

        if (!error && data) {
            // Convert blob to texture
            // Implementation specific to texture loading
        }
    }
}
```

Built with 👻 by the Spectacles team


