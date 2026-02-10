# RemoteServiceGateway

A unified gateway for integrating external AI and cloud services into Spectacles experiences. This package provides seamless access to OpenAI, Google Gemini, Google Imagen, Google Lyria, DeepSeek, and Snap3D APIs through a consistent interface. RemoteServiceGateway handles authentication, API requests, WebSocket connections, and response parsing, enabling developers to build AI-powered AR experiences with text generation, image creation, audio synthesis, real-time conversations, and 3D model generation without managing complex API integrations.

## Features

- **OpenAI Integration** - Chat completions (GPT-4, GPT-3.5), image generation (DALL-E), image editing, speech synthesis, and real-time API
- **Google Gemini** - Synchronous content generation and live WebSocket streaming for real-time conversations
- **Google Imagen** - AI-powered image generation from text prompts
- **Google Lyria** - Music and audio generation
- **DeepSeek Integration** - Snap-hosted DeepSeek AI model access
- **Snap3D** - 3D model generation from prompts or images
- **Unified Credentials** - Centralized API key management with type-safe access
- **WebSocket Support** - Real-time streaming for conversational AI experiences
- **Helper Utilities** - Audio processing, microphone recording, video control, and dynamic audio output

## Quick Start

```typescript
import { OpenAI } from "./RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { Gemini } from "./RemoteServiceGateway.lspkg/HostedExternal/Gemini";
import { RemoteServiceGatewayCredentials, AvaliableApiTypes } from "./RemoteServiceGateway.lspkg/RemoteServiceGatewayCredentials";

@component
export class AIExample extends BaseScriptComponent {
    onAwake() {
        // Set API credentials
        RemoteServiceGatewayCredentials.setApiToken(AvaliableApiTypes.OpenAI, "your-openai-api-key");
        RemoteServiceGatewayCredentials.setApiToken(AvaliableApiTypes.Google, "your-google-api-key");

        this.textGeneration();
        this.imageGeneration();
        this.realTimeConversation();
    }

    async textGeneration() {
        // OpenAI chat completion
        const response = await OpenAI.chatCompletions({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are a helpful AR assistant." },
                { role: "user", content: "Explain quantum computing in one sentence." }
            ],
            max_tokens: 100
        });

        print("AI Response: " + response.choices[0].message.content);
    }

    async imageGeneration() {
        // Generate an image with DALL-E
        const imageResponse = await OpenAI.imagesGenerate({
            model: "dall-e-3",
            prompt: "A futuristic AR glasses user interface",
            n: 1,
            size: "1024x1024"
        });

        print("Image URL: " + imageResponse.data[0].url);
    }

    realTimeConversation() {
        // Gemini live streaming
        const geminiLive = Gemini.liveConnect();

        geminiLive.onOpen.add(() => {
            print("Connected to Gemini Live");

            // Send initial setup
            geminiLive.send({
                setup: {
                    model: "models/gemini-2.0-flash-exp"
                }
            });
        });

        geminiLive.onMessage.add((message) => {
            print("Gemini response: " + JSON.stringify(message));

            if (message.serverContent) {
                // Handle text or audio response
                print("Content received from Gemini");
            }
        });

        // Send a user message
        setTimeout(() => {
            geminiLive.send({
                clientContent: {
                    turns: [{
                        role: "user",
                        parts: [{ text: "Hello, how are you?" }]
                    }],
                    turnComplete: true
                }
            });
        }, 1000);
    }
}
```

## Script Highlights

### OpenAI Integration

The OpenAI module provides comprehensive access to OpenAI's API suite through static methods that return promises for async/await syntax. The chatCompletions method handles chat-based text generation with full support for system prompts, conversation history, and parameter configuration like temperature and max tokens. Image generation uses the imagesGenerate method for DALL-E, while imagesEdit supports inpainting and outpainting with mask support. The speech method converts text to audio using OpenAI's TTS models. All methods handle API authentication automatically, format requests properly, parse responses, and provide TypeScript types for request and response objects. Error handling returns rejected promises with detailed status information.

### Google Gemini Integration

The Gemini module supports both synchronous and real-time streaming modes through separate APIs. The models method performs synchronous content generation with support for text, images, and multimodal inputs. The liveConnect method creates a WebSocket connection for real-time conversational AI, returning a GeminiLiveWebsocket instance with event handlers for connection lifecycle and message handling. The WebSocket implementation automatically manages JSON serialization, connection state, and provides type-safe message objects. Developers can send text, audio, or function calling requests and receive streaming responses with server-side turn management. The system supports bi-directional real-time communication for natural conversations.

### Image Generation with Imagen

The Imagen module provides access to Google's image generation models through a simple API interface. Developers can generate high-quality images from text prompts with configurable parameters like aspect ratio, number of images, and safety filters. The module handles multipart form data encoding for complex requests and parses binary image responses. Imagen supports various output formats and resolutions optimized for different use cases. The API integrates with the same credential system as other Google services for unified authentication management.

### Credential Management

The RemoteServiceGatewayCredentials module centralizes API key management across all supported services. The setApiToken method stores credentials for specific service types using the AvaliableApiTypes enum (OpenAI, Google, Snap, etc.). The getApiToken method retrieves stored credentials for API requests. This centralized system prevents credential duplication and makes it easy to manage multiple service integrations. Credentials are stored in memory for the session duration and should be set during initialization. The type-safe enum ensures compile-time validation of service types.

### Helper Utilities

The package includes several helper modules for common AI integration patterns. AudioProcessor handles audio format conversion and processing for speech-to-text and text-to-speech workflows. MicrophoneRecorder provides easy microphone access for voice input in conversational AI. DynamicAudioOutput manages audio playback with real-time streaming support. VideoController handles video texture manipulation for image-based AI inputs. These utilities abstract platform-specific details and provide consistent APIs across different Spectacles hardware versions.

## Core API Methods

### OpenAI

```typescript
// Chat completions (GPT models)
OpenAI.chatCompletions(request: ChatCompletions.Request): Promise<ChatCompletions.Response>;

// Image generation (DALL-E)
OpenAI.imagesGenerate(request: ImageGenerate.Request): Promise<ImageGenerate.Response>;

// Image editing with masks
OpenAI.imagesEdit(request: ImageEdits.Request): Promise<ImageGenerate.Response>;

// Text-to-speech
OpenAI.speech(request: Speech.Request): Promise<Speech.Response>;

// Real-time API (streaming)
OpenAI.realtimeConnect(): OpenAIRealtimeWebsocket;
```

### Google Gemini

```typescript
// Synchronous content generation
Gemini.models(request: GenerateContentRequest): Promise<GenerateContentResponse>;

// Real-time streaming
Gemini.liveConnect(): GeminiLiveWebsocket;

// GeminiLiveWebsocket methods
websocket.send(message: ClientMessage): void;
websocket.close(): void;
websocket.isConnected(): boolean;

// GeminiLiveWebsocket events
websocket.onOpen: Event<WebSocketEvent>;
websocket.onMessage: Event<ServerMessage>;
websocket.onError: Event<WebSocketEvent>;
websocket.onClose: Event<WebSocketCloseEvent>;
```

### Credentials

```typescript
RemoteServiceGatewayCredentials.setApiToken(type: AvaliableApiTypes, token: string): void;
RemoteServiceGatewayCredentials.getApiToken(type: AvaliableApiTypes): string;

// Available types
enum AvaliableApiTypes {
    OpenAI,
    Google,
    Snap,
    // ... others
}
```

### DeepSeek (Snap-hosted)

```typescript
Deepseek.chatCompletions(request: ChatCompletions.Request): Promise<ChatCompletions.Response>;
```

### Snap3D

```typescript
Snap3D.generate(request: Generate3DRequest): Promise<Generate3DResponse>;
```

## Advanced Usage

### Example 1: Conversational AI with Context

Build a multi-turn conversation with GPT-4 maintaining context:

```typescript
import { OpenAI } from "./RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { OpenAITypes } from "./RemoteServiceGateway.lspkg/HostedExternal/OpenAITypes";

@component
export class ConversationalAI extends BaseScriptComponent {
    private conversationHistory: OpenAITypes.ChatCompletions.Message[] = [];

    @input
    systemPrompt: string = "You are a friendly AR tour guide.";

    onAwake() {
        // Initialize conversation with system prompt
        this.conversationHistory.push({
            role: "system",
            content: this.systemPrompt
        });
    }

    async askQuestion(userMessage: string): Promise<string> {
        // Add user message to history
        this.conversationHistory.push({
            role: "user",
            content: userMessage
        });

        try {
            // Send entire conversation history
            const response = await OpenAI.chatCompletions({
                model: "gpt-4",
                messages: this.conversationHistory,
                max_tokens: 150,
                temperature: 0.7
            });

            const assistantMessage = response.choices[0].message.content;

            // Add assistant response to history
            this.conversationHistory.push({
                role: "assistant",
                content: assistantMessage
            });

            // Trim history if it gets too long
            if (this.conversationHistory.length > 20) {
                // Keep system prompt and last 18 messages
                this.conversationHistory = [
                    this.conversationHistory[0], // system prompt
                    ...this.conversationHistory.slice(-18)
                ];
            }

            print(`User: ${userMessage}`);
            print(`AI: ${assistantMessage}`);

            return assistantMessage;

        } catch (error) {
            print("Error in conversation: " + error);
            return "I'm sorry, I couldn't process that request.";
        }
    }

    // Reset conversation
    resetConversation() {
        this.conversationHistory = [{
            role: "system",
            content: this.systemPrompt
        }];
        print("Conversation reset");
    }

    // Get conversation summary
    getConversationLength(): number {
        return this.conversationHistory.length - 1; // Exclude system prompt
    }
}
```

**Key Points:**
- Maintains full conversation context across multiple turns
- System prompt persists throughout conversation
- History trimming prevents token limit issues
- Error handling with fallback responses

### Example 2: Image Generation with Dynamic Prompts

Generate images based on user interactions and environment:

```typescript
import { OpenAI } from "./RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { RemoteMediaModule } from "LensStudio:RemoteMediaModule";

@component
export class DynamicImageGenerator extends BaseScriptComponent {
    @input
    targetTexture: Texture;

    @input
    loadingIndicator: SceneObject;

    private currentImageUrl: string = "";

    async generateImage(basePrompt: string, style: string, quality: string) {
        this.loadingIndicator.enabled = true;

        try {
            const enhancedPrompt = `${basePrompt}, ${style} style, high quality, detailed`;

            print(`Generating image: ${enhancedPrompt}`);

            const response = await OpenAI.imagesGenerate({
                model: "dall-e-3",
                prompt: enhancedPrompt,
                n: 1,
                size: "1024x1024",
                quality: quality as "standard" | "hd"
            });

            this.currentImageUrl = response.data[0].url;
            print("Image generated: " + this.currentImageUrl);

            // Download and apply image to texture
            await this.downloadAndApplyImage(this.currentImageUrl);

        } catch (error) {
            print("Image generation error: " + error);
        } finally {
            this.loadingIndicator.enabled = false;
        }
    }

    private async downloadAndApplyImage(url: string) {
        const RMM = require("LensStudio:RemoteMediaModule") as RemoteMediaModule;

        return new Promise((resolve, reject) => {
            RMM.loadResourceFromURL(url, (remoteResource) => {
                if (remoteResource) {
                    const textureProvider = remoteResource.asTexture();
                    if (textureProvider && textureProvider.texture) {
                        // Apply texture to target
                        this.targetTexture.control.inputTexture = textureProvider.texture;
                        print("Texture applied successfully");
                        resolve(true);
                    } else {
                        reject("Failed to convert resource to texture");
                    }
                } else {
                    reject("Failed to load remote resource");
                }
            });
        });
    }

    // Generate variations of current image
    async generateVariation() {
        if (!this.currentImageUrl) {
            print("No current image to vary");
            return;
        }

        this.loadingIndicator.enabled = true;

        try {
            // Use the revised_prompt from the previous generation
            const response = await OpenAI.imagesGenerate({
                model: "dall-e-3",
                prompt: "A variation of the previous image",
                n: 1,
                size: "1024x1024"
            });

            await this.downloadAndApplyImage(response.data[0].url);

        } catch (error) {
            print("Variation generation error: " + error);
        } finally {
            this.loadingIndicator.enabled = false;
        }
    }
}
```

**Key Points:**
- Dynamic prompt construction from multiple parameters
- Texture loading and application to materials
- Loading states for user feedback
- Error handling for network requests

### Example 3: Real-Time Voice Assistant with Gemini Live

Create a voice-controlled AI assistant using Gemini's WebSocket API:

```typescript
import { Gemini, GeminiLiveWebsocket } from "./RemoteServiceGateway.lspkg/HostedExternal/Gemini";
import { GoogleGenAITypes } from "./RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";
import { MicrophoneRecorder } from "./RemoteServiceGateway.lspkg/Helpers/MicrophoneRecorder";
import { DynamicAudioOutput } from "./RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput";

@component
export class VoiceAssistant extends BaseScriptComponent {
    @input
    statusText: Text;

    @input
    listeningIndicator: SceneObject;

    private geminiLive: GeminiLiveWebsocket;
    private micRecorder: MicrophoneRecorder;
    private audioOutput: DynamicAudioOutput;
    private isListening: boolean = false;

    onAwake() {
        this.setupGeminiConnection();
        this.setupAudioComponents();
    }

    setupGeminiConnection() {
        this.geminiLive = Gemini.liveConnect();

        this.geminiLive.onOpen.add(() => {
            print("Connected to Gemini Live");
            this.statusText.text = "Connected";

            // Configure the session
            this.geminiLive.send({
                setup: {
                    model: "models/gemini-2.0-flash-exp",
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: "Puck"
                                }
                            }
                        }
                    }
                }
            });
        });

        this.geminiLive.onMessage.add((message: GoogleGenAITypes.Gemini.Live.ServerMessage) => {
            this.handleGeminiMessage(message);
        });

        this.geminiLive.onError.add((event) => {
            print("Gemini error: " + event);
            this.statusText.text = "Error";
        });

        this.geminiLive.onClose.add((event) => {
            print("Gemini connection closed");
            this.statusText.text = "Disconnected";
        });
    }

    setupAudioComponents() {
        // Initialize microphone and audio output helpers
        this.micRecorder = this.sceneObject.createComponent(MicrophoneRecorder.getTypeName()) as MicrophoneRecorder;
        this.audioOutput = this.sceneObject.createComponent(DynamicAudioOutput.getTypeName()) as DynamicAudioOutput;
    }

    handleGeminiMessage(message: GoogleGenAITypes.Gemini.Live.ServerMessage) {
        if (message.setupComplete) {
            print("Gemini setup complete");
            this.statusText.text = "Ready";
        }

        if (message.serverContent) {
            print("Received content from Gemini");

            if (message.serverContent.modelTurn) {
                const parts = message.serverContent.modelTurn.parts;

                for (const part of parts) {
                    if (part.text) {
                        print("Text response: " + part.text);
                        this.statusText.text = part.text;
                    }

                    if (part.inlineData && part.inlineData.mimeType === "audio/pcm") {
                        // Play audio response
                        this.audioOutput.playAudioData(part.inlineData.data);
                    }
                }
            }

            if (message.serverContent.turnComplete) {
                print("Turn complete");
                this.isListening = false;
                this.listeningIndicator.enabled = false;
            }
        }
    }

    startListening() {
        if (!this.geminiLive.isConnected()) {
            print("Not connected to Gemini");
            return;
        }

        this.isListening = true;
        this.listeningIndicator.enabled = true;
        this.statusText.text = "Listening...";

        // Start recording
        this.micRecorder.startRecording((audioData: string) => {
            // Send audio data to Gemini
            this.geminiLive.send({
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: "audio/pcm",
                        data: audioData
                    }]
                }
            });
        });
    }

    stopListening() {
        if (!this.isListening) return;

        this.micRecorder.stopRecording();
        this.isListening = false;
        this.listeningIndicator.enabled = false;

        // Signal turn complete
        this.geminiLive.send({
            clientContent: {
                turnComplete: true
            }
        });

        this.statusText.text = "Processing...";
    }

    // Send text message instead of audio
    sendTextMessage(text: string) {
        if (!this.geminiLive.isConnected()) {
            print("Not connected");
            return;
        }

        this.geminiLive.send({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: text }]
                }],
                turnComplete: true
            }
        });

        this.statusText.text = "Sent: " + text;
    }

    onDestroy() {
        if (this.geminiLive) {
            this.geminiLive.close();
        }
    }
}
```

**Key Points:**
- WebSocket lifecycle management
- Bi-directional audio streaming
- Turn-based conversation flow
- Dynamic response handling (text and audio)
- Microphone and audio output integration

### Example 4: Image Editing with Masks

Use OpenAI's image editing to modify specific regions:

```typescript
import { OpenAI } from "./RemoteServiceGateway.lspkg/HostedExternal/OpenAI";

@component
export class ImageEditor extends BaseScriptComponent {
    @input
    originalImageTexture: Texture;

    @input
    maskTexture: Texture;

    @input
    resultTexture: Texture;

    async editImage(prompt: string) {
        try {
            // Convert textures to base64 or binary data
            const imageData = this.textureToBase64(this.originalImageTexture);
            const maskData = this.textureToBase64(this.maskTexture);

            const response = await OpenAI.imagesEdit({
                image: imageData,
                mask: maskData,
                prompt: prompt,
                n: 1,
                size: "1024x1024"
            });

            print("Image edited successfully");

            // Load result
            const RMM = require("LensStudio:RemoteMediaModule") as RemoteMediaModule;
            RMM.loadResourceFromURL(response.data[0].url, (resource) => {
                if (resource) {
                    const textureProvider = resource.asTexture();
                    if (textureProvider && textureProvider.texture) {
                        this.resultTexture.control.inputTexture = textureProvider.texture;
                    }
                }
            });

        } catch (error) {
            print("Edit error: " + error);
        }
    }

    private textureToBase64(texture: Texture): string {
        // Implementation depends on texture type
        // This is a placeholder showing the expected interface
        // Actual implementation would use ProceduralTextureProvider
        // or similar to access pixel data
        return ""; // Return base64 encoded image data
    }

    // Preset editing functions
    async removeBackground() {
        await this.editImage("Remove the background, transparent PNG");
    }

    async changeStyle(style: string) {
        await this.editImage(`Apply ${style} artistic style`);
    }

    async addObject(objectDescription: string) {
        await this.editImage(`Add ${objectDescription} to the scene`);
    }
}
```

**Key Points:**
- Mask-based editing for precise control
- Preset editing functions for common tasks
- Texture format conversion
- Result loading and display

### Example 5: Multi-Model Comparison

Compare responses from different AI models:

```typescript
import { OpenAI } from "./RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { Gemini } from "./RemoteServiceGateway.lspkg/HostedExternal/Gemini";
import { Deepseek } from "./RemoteServiceGateway.lspkg/HostedSnap/Deepseek";

@component
export class ModelComparison extends BaseScriptComponent {
    @input
    gpt4Text: Text;

    @input
    geminiText: Text;

    @input
    deepseekText: Text;

    async compareModels(prompt: string) {
        print("Comparing models with prompt: " + prompt);

        // Run all three in parallel
        const results = await Promise.allSettled([
            this.askGPT4(prompt),
            this.askGemini(prompt),
            this.askDeepSeek(prompt)
        ]);

        // Display results
        if (results[0].status === "fulfilled") {
            this.gpt4Text.text = "GPT-4: " + results[0].value;
        } else {
            this.gpt4Text.text = "GPT-4 Error";
        }

        if (results[1].status === "fulfilled") {
            this.geminiText.text = "Gemini: " + results[1].value;
        } else {
            this.geminiText.text = "Gemini Error";
        }

        if (results[2].status === "fulfilled") {
            this.deepseekText.text = "DeepSeek: " + results[2].value;
        } else {
            this.deepseekText.text = "DeepSeek Error";
        }
    }

    private async askGPT4(prompt: string): Promise<string> {
        const response = await OpenAI.chatCompletions({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100
        });
        return response.choices[0].message.content;
    }

    private async askGemini(prompt: string): Promise<string> {
        const response = await Gemini.models({
            model: "gemini-2.0-flash-exp",
            type: "generateContent",
            body: {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            }
        });
        return response.candidates[0].content.parts[0].text;
    }

    private async askDeepSeek(prompt: string): Promise<string> {
        const response = await Deepseek.chatCompletions({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100
        });
        return response.choices[0].message.content;
    }
}
```

**Key Points:**
- Parallel API requests with Promise.allSettled
- Consistent interface across different services
- Error handling per model
- Side-by-side comparison display

Built with 👻 by the Spectacles team

