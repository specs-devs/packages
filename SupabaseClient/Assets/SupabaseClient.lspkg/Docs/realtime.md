# SupabaseClient realtime API

[← Agent usage index](../README.md)

## Use when

Read for subscribe states, callbacks, broadcast/presence and teardown.

client.channel(name,opts) returns RealtimeChannel; .on(...) registers event callback and .subscribe(statusCallback) starts joining. Wait for SUBSCRIBED before relying on delivery; CLOSED/CHANNEL_ERROR/TIMED_OUT require handling. on overloads cover broadcast event names, postgres_changes event/schema/table/filter and presence sync/join/leave. send({type:'broadcast',event,payload}) returns 'ok'/'timed out'/'error'; broadcast.self/ack/replay/private/presence options depend on SDK/backend permissions. track/untrack modify presence state. Cleanup with client.removeChannel/removeAllChannels or unsubscribe; those return promises/statuses. A channel is not persistent database state.

Lens WebSocket polyfill wraps SupabaseModule.createRealtimeConnection, has a 5s connection timeout and only one callback per addEventListener event type. ReadyState/queue behavior and close semantics differ from a browser; see polyfills. No network subscription was attempted in this pass.

All fragments below are signatures, not standalone runnable TS. Canonical generic/type definitions: [`supabase-snapcloud.d.ts`](../supabase-snapcloud.d.ts). Private/protected and underscore-prefixed internals are omitted; no internal state should be mutated. Public SDK methods may need browser capabilities absent on Lens.

## WebSocketLike


### CONNECTING

```text
readonly CONNECTING: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### OPEN

```text
readonly OPEN: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### CLOSING

```text
readonly CLOSING: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### CLOSED

```text
readonly CLOSED: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### readyState

```text
readonly readyState: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### url

```text
readonly url: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### protocol

```text
readonly protocol: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### close

```text
close(code?: number, reason?: string): void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### send

```text
send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### onopen

```text
onopen: ((this: any, ev: Event) => any) | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### onmessage

```text
onmessage: ((this: any, ev: MessageEvent) => any) | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### onclose

```text
onclose: ((this: any, ev: CloseEvent) => any) | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### onerror

```text
onerror: ((this: any, ev: Event) => any) | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### addEventListener

```text
addEventListener(type: string, listener: EventListener): void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### removeEventListener

```text
removeEventListener(type: string, listener: EventListener): void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### binaryType

```text
binaryType?: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### bufferedAmount

```text
bufferedAmount?: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### extensions

```text
extensions?: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### dispatchEvent

```text
dispatchEvent?: (event: Event) => boolean;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## WebSocketFactory


### getWebSocketConstructor

```text
static getWebSocketConstructor(): typeof WebSocket;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### createWebSocket

```text
static createWebSocket(url: string | URL, protocols?: string | string[]): WebSocketLike;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### isWebSocketSupported

```text
static isWebSocketSupported(): boolean;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## CHANNEL_STATES


### closed

```text
closed = "closed"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### errored

```text
errored = "errored"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### joined

```text
joined = "joined"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### joining

```text
joining = "joining"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### leaving

```text
leaving = "leaving"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## CONNECTION_STATE


### Connecting

```text
Connecting = "connecting"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### Open

```text
Open = "open"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### Closing

```text
Closing = "closing"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### Closed

```text
Closed = "closed"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## REALTIME_PRESENCE_LISTEN_EVENTS


### SYNC

```text
SYNC = "sync"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### JOIN

```text
JOIN = "join"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### LEAVE

```text
LEAVE = "leave"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## RealtimePresence


### channel

```text
channel: RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### state

```text
state: RealtimePresenceState;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### pendingDiffs

```text
pendingDiffs: RawPresenceDiff[];
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### joinRef

```text
joinRef: string | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### enabled

```text
enabled: boolean;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### caller

```text
caller: { onJoin: PresenceOnJoinCallback; onLeave: PresenceOnLeaveCallback; onSync: () => void; };
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor(channel: RealtimeChannel, opts?: PresenceOpts);
```
Initializes the Presence. 

## REALTIME_POSTGRES_CHANGES_LISTEN_EVENT


### ALL

```text
ALL = "*"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### INSERT

```text
INSERT = "INSERT"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### UPDATE

```text
UPDATE = "UPDATE"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### DELETE

```text
DELETE = "DELETE"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## REALTIME_LISTEN_TYPES


### BROADCAST

```text
BROADCAST = "broadcast"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### PRESENCE

```text
PRESENCE = "presence"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### POSTGRES_CHANGES

```text
POSTGRES_CHANGES = "postgres_changes"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### SYSTEM

```text
SYSTEM = "system"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## REALTIME_SUBSCRIBE_STATES


### SUBSCRIBED

```text
SUBSCRIBED = "SUBSCRIBED"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### TIMED_OUT

```text
TIMED_OUT = "TIMED_OUT"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### CLOSED

```text
CLOSED = "CLOSED"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### CHANNEL_ERROR

```text
CHANNEL_ERROR = "CHANNEL_ERROR"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## RealtimeChannel

A channel is the basic building block of Realtime and narrows the scope of data flow to subscribed clients. You can think of a channel as a chatroom where participants are able to see who's online and send and receive messages.

### topic

```text
topic: string;
```
Topic name can be any string.

### params

```text
params: RealtimeChannelOptions;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### socket

```text
socket: RealtimeClient;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### bindings

```text
bindings: { [key: string]: { type: string; filter: { [key: string]: any; }; callback: Function; id?: string; }[]; };
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### timeout

```text
timeout: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### state

```text
state: CHANNEL_STATES;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### joinedOnce

```text
joinedOnce: boolean;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### joinPush

```text
joinPush: Push;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rejoinTimer

```text
rejoinTimer: Timer;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### pushBuffer

```text
pushBuffer: Push[];
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### presence

```text
presence: RealtimePresence;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### broadcastEndpointURL

```text
broadcastEndpointURL: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### subTopic

```text
subTopic: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### private

```text
private: boolean;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor( topic: string, params: RealtimeChannelOptions | undefined, socket: RealtimeClient);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### subscribe

```text
subscribe(callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void, timeout?: number): RealtimeChannel;
```
Subscribe registers your client with the server

### presenceState

```text
presenceState<T extends { [key: string]: any; } = {}>(): RealtimePresenceState<T>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### track

```text
track(payload: { [key: string]: any; }, opts?: { [key: string]: any; }): Promise<RealtimeChannelSendResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### untrack

```text
untrack(opts?: { [key: string]: any; }): Promise<RealtimeChannelSendResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on(type: `${REALTIME_LISTEN_TYPES.PRESENCE}`, filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.SYNC}`; }, callback: () => void): RealtimeChannel;
```
Creates an event handler that listens to changes.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.PRESENCE}`, filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.JOIN}`; }, callback: (payload: RealtimePresenceJoinPayload<T>) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.PRESENCE}`, filter: { event: `${REALTIME_PRESENCE_LISTEN_EVENTS.LEAVE}`; }, callback: (payload: RealtimePresenceLeavePayload<T>) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`, filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL}`>, callback: (payload: RealtimePostgresChangesPayload<T>) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`, filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT}`>, callback: (payload: RealtimePostgresInsertPayload<T>) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`, filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE}`>, callback: (payload: RealtimePostgresUpdatePayload<T>) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`, filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE}`>, callback: (payload: RealtimePostgresDeletePayload<T>) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on(type: `${REALTIME_LISTEN_TYPES.BROADCAST}`, filter: { event: string; }, callback: (payload: { type: `${REALTIME_LISTEN_TYPES.BROADCAST}`; event: string; meta?: { replayed?: boolean; id: string; }; [key: string]: any; }) => void): RealtimeChannel;
```
The following is placed here to display on supabase.com docs reference javascript subscribe. 

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.BROADCAST}`, filter: { event: string; }, callback: (payload: { type: `${REALTIME_LISTEN_TYPES.BROADCAST}`; event: string; meta?: { replayed?: boolean; id: string; }; payload: T; }) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends Record<string, unknown>>(type: `${REALTIME_LISTEN_TYPES.BROADCAST}`, filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL; }, callback: (payload: { type: `${REALTIME_LISTEN_TYPES.BROADCAST}`; event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL; payload: RealtimeBroadcastPayload<T>; }) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.BROADCAST}`, filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT; }, callback: (payload: { type: `${REALTIME_LISTEN_TYPES.BROADCAST}`; event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT; payload: RealtimeBroadcastInsertPayload<T>; }) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.BROADCAST}`, filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE; }, callback: (payload: { type: `${REALTIME_LISTEN_TYPES.BROADCAST}`; event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE; payload: RealtimeBroadcastUpdatePayload<T>; }) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.BROADCAST}`, filter: { event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE; }, callback: (payload: { type: `${REALTIME_LISTEN_TYPES.BROADCAST}`; event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE; payload: RealtimeBroadcastDeletePayload<T>; }) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### on

```text
on<T extends { [key: string]: any; }>(type: `${REALTIME_LISTEN_TYPES.SYSTEM}`, filter: {}, callback: (payload: any) => void): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### httpSend

```text
httpSend(event: string, payload: any, opts?: { timeout?: number; }): Promise<{ success: true; } | { success: false; status: number; error: string; }>;
```
Sends a broadcast message explicitly via REST API. This method always uses the REST API endpoint regardless of WebSocket connection state. Useful when you want to guarantee REST delivery or when gradually migrating from implicit REST fallback. 

### send

```text
send(args: { type: 'broadcast' | 'presence' | 'postgres_changes'; event: string; payload?: any; [key: string]: any; }, opts?: { [key: string]: any; }): Promise<RealtimeChannelSendResponse>;
```
Sends a message into the channel. 

### updateJoinPayload

```text
updateJoinPayload(payload: { [key: string]: any; }): void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### unsubscribe

```text
unsubscribe(timeout?: number): Promise<'ok' | 'timed out' | 'error'>;
```
Leaves the channel. Unsubscribes from server events, and instructs channel to terminate on server. Triggers onClose() hooks. To receive leave acknowledgements, use the a `receive` hook to bind to the server ack, ie: channel.unsubscribe().receive("ok", () => alert("left!") )

### teardown

```text
teardown(): void;
```
Teardown the channel. Destroys and stops related timers.

## WebSocketLikeConstructor


### constructor

```text
new (address: string | URL, subprotocols?: string | string[] | undefined): WebSocketLike;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
[key: string]: any;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## RealtimeClient


### accessTokenValue

```text
accessTokenValue: string | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### apiKey

```text
apiKey: string | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### channels

```text
channels: RealtimeChannel[];
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### endPoint

```text
endPoint: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### httpEndpoint

```text
httpEndpoint: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### headers

```text
headers?: { [key: string]: string; };
```
@deprecated headers cannot be set on websocket connections

### params

```text
params?: { [key: string]: string; };
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### timeout

```text
timeout: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### transport

```text
transport: WebSocketLikeConstructor | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### heartbeatIntervalMs

```text
heartbeatIntervalMs: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### heartbeatTimer

```text
heartbeatTimer: ReturnType<typeof setInterval> | undefined;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### pendingHeartbeatRef

```text
pendingHeartbeatRef: string | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### heartbeatCallback

```text
heartbeatCallback: (status: HeartbeatStatus) => void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ref

```text
ref: number;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### reconnectTimer

```text
reconnectTimer: Timer | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### vsn

```text
vsn: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### logger

```text
logger: Function;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### logLevel

```text
logLevel?: LogLevel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### encode

```text
encode: Function;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### decode

```text
decode: Function;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### reconnectAfterMs

```text
reconnectAfterMs: Function;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### conn

```text
conn: WebSocketLike | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### sendBuffer

```text
sendBuffer: Function[];
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### serializer

```text
serializer: Serializer;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### stateChangeCallbacks

```text
stateChangeCallbacks: { open: Function[]; close: Function[]; error: Function[]; message: Function[]; };
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### fetch

```text
fetch: Fetch$4;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### accessToken

```text
accessToken: (() => Promise<string | null>) | null;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### worker

```text
worker?: boolean;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### workerUrl

```text
workerUrl?: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### workerRef

```text
workerRef?: Worker;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor(endPoint: string, options?: RealtimeClientOptions);
```
Initializes the Socket. 

### connect

```text
connect(): void;
```
Connects the socket, unless already connected.

### endpointURL

```text
endpointURL(): string;
```
Returns the URL of the websocket. @returns string The URL of the websocket.

### disconnect

```text
disconnect(code?: number, reason?: string): void;
```
Disconnects the socket. 

### getChannels

```text
getChannels(): RealtimeChannel[];
```
Returns all created channels

### removeChannel

```text
removeChannel(channel: RealtimeChannel): Promise<RealtimeRemoveChannelResponse>;
```
Unsubscribes and removes a single channel 

### removeAllChannels

```text
removeAllChannels(): Promise<RealtimeRemoveChannelResponse[]>;
```
Unsubscribes and removes all channels

### log

```text
log(kind: string, msg: string, data?: any): void;
```
Logs the message. For customized logging, `this.logger` can be overridden.

### connectionState

```text
connectionState(): CONNECTION_STATE;
```
Returns the current state of the socket.

### isConnected

```text
isConnected(): boolean;
```
Returns `true` is the connection is open.

### isConnecting

```text
isConnecting(): boolean;
```
Returns `true` if the connection is currently connecting.

### isDisconnecting

```text
isDisconnecting(): boolean;
```
Returns `true` if the connection is currently disconnecting.

### channel

```text
channel(topic: string, params?: RealtimeChannelOptions): RealtimeChannel;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### push

```text
push(data: RealtimeMessage): void;
```
Push out a message if the socket is connected. If the socket is not connected, the message gets enqueued within a local buffer, and sent out when a connection is next established.

### setAuth

```text
setAuth(token?: string | null): Promise<void>;
```
Sets the JWT access token used for channel subscription authorization and Realtime RLS. If param is null it will use the `accessToken` callback function or the token set on the client. On callback used, it will set the value of the token internal to the client. 

### sendHeartbeat

```text
sendHeartbeat(): Promise<void>;
```
Sends a heartbeat message if the socket is connected.

### onHeartbeat

```text
onHeartbeat(callback: (status: HeartbeatStatus) => void): void;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### flushSendBuffer

```text
flushSendBuffer(): void;
```
Flushes send buffer
