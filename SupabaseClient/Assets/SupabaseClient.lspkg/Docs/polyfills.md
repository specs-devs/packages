# SupabaseClient Lens polyfills and transport

[← Agent usage index](../README.md)

## Use when

Read before assuming DOM/Fetch/WebSocket/timer parity.

## Main bundle import effects

Installs globals Headers/Request/FormData/WebSocket/URL/btoa/atob and text decoder/object helpers; some fetch/URLSearchParams/timers only installed when absent. Creates SceneObject TimerSceneManager with ScriptComponent at module load. No scene component/prefab is required, but import must run in Lens runtime rather than Node. Native require LensStudio:SupabaseModule provides performSupabaseRequest and createRealtimeConnection. Do not replace these transports with generic HTTP unless intentionally implementing another backend integration.

## Request/fetch

Captures original native global Request before replacement. Converts method+headers+supported body+nondefault redirect to native request. HEAD unsupported by native enum becomes GET and Range0–0 unless a Range header already exists. String and Uint8Array pass; ArrayBuffer is text-decoded, other unsupported objects stringified. signal/cache/credentials/integrity/keepalive/mode are stored but not forwarded in native options. FormData handling specially extracts a Blob under empty key (Supabase upload convention), calls bytes and sets MIME; arbitrary multipart fields are not serialized. No general ReadableStream compatibility or response streaming guarantee.

## WebSocket

SupabaseModule connection with 5s timeout. send while CONNECTING queues original values; queued send uses values directly, open send TextEncoder-encodes (these paths differ). addEventListener stores one handler/event, so another replaces it; close invokes native close without forwarding code/reason. No binary fidelity/standard event dispatch guarantee. Realtime SDK normally uses text JSON; inspect error and status callbacks.

## Timers

Main exports setTimeout/clearTimeout/setInterval/clearInterval accept callbacks and timeMs (milliseconds). Return opaque cancellation tokens, not numeric IDs; interval recursively creates DelayedCallbackEvents. Clear sets token.cancelled, suppressing callback/next scheduling; it does not destroy delayed event/TimerSceneManager. No global cleanup API; retain/clear own handles. Events require the imported runtime scene/script.

## FormData / headers / URL

FormData stores string or blob-like entries, filename ignored; general multipart parsing is unsupported. Request body readers consume once and reject afterward; formData only returns existing FormData body. Headers lowercases/validates names/values and converts to native object. URL comes from whatwg-url; URLSearchParams polyfill preserves repeated values. Declarations below record public signatures/types/default optionality, but their loose module paths contain declarations only.

## FormData.d declaration

Source [`FormData.d.ts`](../polyfills/FormData.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

type FormDataEntryValue = string | Blob;
export declare class FormData {
    private _entries;
    constructor(form?: any);
    private initializeFromForm;
    append(name: string, value: FormDataEntryValue, filename?: string): void;
    delete(name: string): void;
    get(name: string): FormDataEntryValue | null;
    getAll(name: string): FormDataEntryValue[];
    has(name: string): boolean;
    set(name: string, value: FormDataEntryValue, filename?: string): void;
    entries(): IterableIterator<[string, FormDataEntryValue]>;
    forEach(callback: (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg?: any): void;
    keys(): IterableIterator<string>;
    values(): IterableIterator<FormDataEntryValue>;
    [Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]>;
    private validateName;
}
export {};

```

## Headers.d declaration

Source [`Headers.d.ts`](../polyfills/Headers.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

export type HeadersInit = [string, string][] | Record<string, string> | Headers;
export declare class Headers {
    private headersMap;
    constructor(init?: HeadersInit);
    append(name: string, value: string): void;
    delete(name: string): void;
    entries(): IterableIterator<[string, string]>;
    forEach(callback: (value: string, key: string, parent: Headers) => void, thisArg?: any): void;
    get(name: string): string | null;
    has(name: string): boolean;
    keys(): IterableIterator<string>;
    set(name: string, value: string): void;
    values(): IterableIterator<string>;
    [Symbol.iterator](): IterableIterator<[string, string]>;
    toLensStudioHeaders(): Record<string, string>;
    static fromLensStudioHeaders(lsHeaders: any): Headers;
    private normalizeName;
    private validateHeaderName;
    private validateHeaderValue;
}

```

## Request.d declaration

Source [`Request.d.ts`](../polyfills/Request.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

import { Headers, HeadersInit } from './Headers';
import { URLSearchParams } from './urlsearchparams';
type AbortSignal = any;
type FormData = any;
interface ReadableStream<R = any> {
}
export declare class Request {
    private _url;
    private _method;
    private _headers;
    private _body;
    private _bodyUsed;
    private _cache;
    private _credentials;
    private _destination;
    private _integrity;
    private _keepalive;
    private _mode;
    private _redirect;
    private _referrer;
    private _referrerPolicy;
    private _signal;
    constructor(input: RequestInfo, init?: RequestInit);
    get url(): string;
    get method(): string;
    get headers(): Headers;
    get body(): ReadableStream | null;
    get bodyUsed(): boolean;
    get cache(): RequestCache;
    get credentials(): RequestCredentials;
    get destination(): RequestDestination;
    get integrity(): string;
    get keepalive(): boolean;
    get mode(): RequestMode;
    get redirect(): RequestRedirect;
    get referrer(): string;
    get referrerPolicy(): ReferrerPolicy;
    get signal(): AbortSignal | null;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    bytes(): Promise<Uint8Array>;
    formData(): Promise<FormData>;
    json(): Promise<any>;
    text(): Promise<string>;
    clone(): Request;
    toLensStudioRequest(): any;
    static fromLensStudioRequest(lsRequest: any): Request;
}
export type RequestInfo = Request | string;
export type RequestCache = "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload";
export type RequestCredentials = "omit" | "same-origin" | "include";
export type RequestDestination = "" | "audio" | "audioworklet" | "document" | "embed" | "font" | "frame" | "iframe" | "image" | "manifest" | "object" | "paintworklet" | "report" | "script" | "sharedworker" | "style" | "track" | "video" | "worker" | "xslt";
export type RequestMode = "cors" | "no-cors" | "same-origin" | "navigate";
export type RequestRedirect = "follow" | "error" | "manual";
export type ReferrerPolicy = "" | "no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url";
export type BodyInit = ReadableStream | XMLHttpRequestBodyInit;
export type XMLHttpRequestBodyInit = Blob | BufferSource | FormData | URLSearchParams | string | Uint8Array;
export type BufferSource = ArrayBufferView | ArrayBuffer;
export interface RequestInit {
    body?: BodyInit | null;
    cache?: RequestCache;
    credentials?: RequestCredentials;
    headers?: HeadersInit;
    integrity?: string;
    keepalive?: boolean;
    method?: string;
    mode?: RequestMode;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    signal?: AbortSignal | null;
    window?: null;
}
export {};

```

## btoa.d declaration

Source [`btoa.d.ts`](../polyfills/btoa.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

export declare function btoaPolyfill(str: string): string;
export declare function atobPolyfill(str: string): string;
export {};

```

## fetch.d declaration

Source [`fetch.d.ts`](../polyfills/fetch.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

import { Request, RequestInit } from './Request';
type URL = any;
export declare function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
export {};

```

## timers.d declaration

Source [`timers.d.ts`](../polyfills/timers.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

interface TimeoutToken {
    cancelled: boolean;
}
interface IntervalToken {
    cancelled: boolean;
    delayedEvent: DelayedCallbackEvent | null;
}
export declare function setTimeout(callback: () => void, timeMs: number): TimeoutToken;
export declare function clearTimeout(timerId: TimeoutToken | undefined | null): void;
export declare function setInterval(callback: () => void, timeMs: number): IntervalToken;
export declare function clearInterval(intervalId: IntervalToken | undefined | null): void;
export {};

```

## WebSocket.d, object.d, textdecoder.d and url.d declarations

Sources [`WebSocket.d.ts`](../polyfills/WebSocket.d.ts), [`object.d.ts`](../polyfills/object.d.ts), [`textdecoder.d.ts`](../polyfills/textdecoder.d.ts) and [`url.d.ts`](../polyfills/url.d.ts). Each file contains only `export {};`: they declare no types. The WebSocket, object helper, text decoder and URL polyfills are installed as globals by the main bundle (see [Main bundle import effects](#main-bundle-import-effects), [WebSocket](#websocket) and [FormData / headers / URL](#formdata--headers--url)). No standalone JS module ships at these paths; do not import them directly at runtime.

## urlsearchparams.d declaration

Source [`urlsearchparams.d.ts`](../polyfills/urlsearchparams.d.ts). No standalone JS module ships at this path; do not import it directly at runtime.


```text

export declare class URLSearchParams {
    private _params;
    constructor(init?: string | string[][] | Record<string, string> | URLSearchParams);
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
    set(name: string, value: string): void;
    toString(): string;
    forEach(callback: (value: string, key: string, parent: URLSearchParams) => void, thisArg?: any): void;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    entries(): IterableIterator<[string, string]>;
}

```
