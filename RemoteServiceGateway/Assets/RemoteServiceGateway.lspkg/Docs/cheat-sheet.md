# RemoteServiceGateway cheat sheet

[← Agent usage index](../README.md)

## Use when

Read before importing the package or connecting a provider. These rules apply to the source revision shipped here.

1. **Use the installed import prefix.** `RemoteServiceGateway.lspkg/HostedExternal/OpenAI` is a consumer path; `./RemoteServiceGateway.lspkg/...` is not. → [Modules](components.md#modules-and-import-paths)
2. **Configure the right gateway token.** Snap serves Snap3D, OpenAI serves OpenAI, Google serves Gemini/Imagen/Lyria. These are the gateway's tokens, described by the credentials component's setup link. → [Setup](setup.md#1-get-the-tokens)
3. **Set credentials after the component's awake.** `RemoteServiceGatewayCredentials.onAwake` overwrites all three static tokens with its inputs. Runtime setters work for every provider in this revision. Never print or commit real tokens. → [Credentials](setup.md#2-put-the-tokens-in-the-lens)
4. **Preserve service asset paths.** Modules load their `.remoteServiceModule` assets with `requireAsset` at import time. Moving a module or its asset can break the import before a request runs. → [Service assets](setup.md#4-remote-service-module-assets)
5. **Use the shipped request types.** `OpenAITypes` and `GoogleGenAITypes` describe this gateway surface; generic provider SDK snippets can have incompatible shapes. → [API status](api-status.md)
6. **Handle failures and validate optional output.** Calls reject on service errors; providers may return no candidate, choice, image or artifact. The supplied examples show the response guards. → [Examples](examples.md)
7. **Own realtime cleanup.** WebSocket wrappers expose `close()`, and the microphone component exposes `stopRecording()`. A hidden UI alone does not release a session or microphone. → [Realtime and helpers](components.md#helpers)
8. **The demo runs by itself.** Each carousel step starts its calls when shown and stops them when left; the log panel above it shows every request, response and error. The examples have no tap or pinch trigger. → [Auto-run demo](examples.md#auto-run-demo)
9. **Do not infer live service success from an offline preview.** My Lenses sign-in and valid tokens are required for Preview calls. The log panel shows the realtime sockets' real open / error / close events. → [Preview setup](setup.md#3-lens-studio-preview)
