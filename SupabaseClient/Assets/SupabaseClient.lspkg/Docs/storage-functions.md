# SupabaseClient storage and functions API

[← Agent usage index](../README.md)

## Use when

Read for bucket/file operations, signed/public URLs and edge function invocation.

Use client.storage.from(bucket) for file operations; StorageClient inherits StorageBucketApi bucket methods. File upload/update accepts broad SDK FileBody, but Lens adapter can only forward supported payloads. Default storage contentType text/plain;charset=UTF-8, cacheControl3600, upsertfalse (source JS); supply accurate MIME for bytes. upload is a basic request, not automatic resumable transport. download is a BlobDownloadBuilder thenable, with .asStream available at SDK layer only (stream availability unverified). getPublicUrl constructs a URL synchronously; signed URLs require network and policy. delete/remove/move/update/emptyBucket/deleteBucket modify backend data.

functions.invoke takes functionName and FunctionInvokeOptions {headers?,method?,region?,body?,signal?,timeout?}. Defaults POST and region any; body object serializes JSON, other body types use selected content type. Returns {data,error,response?}; errors include fetch/relay/http variants. JSON/blob/text/multipart/event-stream handling follows response content type, but returned native Response capabilities constrain it. SDK timeout/AbortSignal is not guaranteed forwarded by native adapter.

Vector/analytics client methods are declared and included by upstream SDK; they require corresponding backend/service support and are not validated on Lens here.

All fragments below are signatures, not standalone runnable TS. Canonical generic/type definitions: [`supabase-snapcloud.d.ts`](../supabase-snapcloud.d.ts). Private/protected and underscore-prefixed internals are omitted; no internal state should be mutated. Public SDK methods may need browser capabilities absent on Lens.

## FunctionRegion


### Any

```text
Any = "any"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ApNortheast1

```text
ApNortheast1 = "ap-northeast-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ApNortheast2

```text
ApNortheast2 = "ap-northeast-2"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ApSouth1

```text
ApSouth1 = "ap-south-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ApSoutheast1

```text
ApSoutheast1 = "ap-southeast-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ApSoutheast2

```text
ApSoutheast2 = "ap-southeast-2"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### CaCentral1

```text
CaCentral1 = "ca-central-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### EuCentral1

```text
EuCentral1 = "eu-central-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### EuWest1

```text
EuWest1 = "eu-west-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### EuWest2

```text
EuWest2 = "eu-west-2"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### EuWest3

```text
EuWest3 = "eu-west-3"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### SaEast1

```text
SaEast1 = "sa-east-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### UsEast1

```text
UsEast1 = "us-east-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### UsWest1

```text
UsWest1 = "us-west-1"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### UsWest2

```text
UsWest2 = "us-west-2"
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## FunctionsClient


### constructor

```text
constructor(url: string, { headers, customFetch, region, }?: { headers?: Record<string, string>; customFetch?: Fetch$6; region?: FunctionRegion; });
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### setAuth

```text
setAuth(token: string): void;
```
Updates the authorization header 

### invoke

```text
invoke<T = any>(functionName: string, options?: FunctionInvokeOptions): Promise<FunctionsResponse<T>>;
```
Invokes a function 

## StreamDownloadBuilder


### constructor

```text
constructor(downloadFn: () => Promise<Response>, shouldThrowOnError: boolean);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### then

```text
then<TResult1 = DownloadResult<ReadableStream>, TResult2 = never>(onfulfilled?: ((value: DownloadResult<ReadableStream>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## BlobDownloadBuilder


### [Symbol.toStringTag]

```text
readonly [Symbol.toStringTag]: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor(downloadFn: () => Promise<Response>, shouldThrowOnError: boolean);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### asStream

```text
asStream(): StreamDownloadBuilder;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### then

```text
then<TResult1 = DownloadResult<Blob>, TResult2 = never>(onfulfilled?: ((value: DownloadResult<Blob>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### catch

```text
catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<DownloadResult<Blob> | TResult>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### finally

```text
finally(onfinally?: (() => void) | null): Promise<DownloadResult<Blob>>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## StorageFileApi


### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, bucketId?: string, fetch?: Fetch$3);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### throwOnError

```text
throwOnError(): this;
```
Enable throwing errors instead of returning them.

### upload

```text
upload(path: string, fileBody: FileBody, fileOptions?: FileOptions): Promise<{ data: { id: string; path: string; fullPath: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Uploads a file to an existing bucket. 

### uploadToSignedUrl

```text
uploadToSignedUrl(path: string, token: string, fileBody: FileBody, fileOptions?: FileOptions): Promise<{ data: { path: string; fullPath: any; }; error: null; } | { data: null; error: StorageError; }>;
```
Upload a file with a token generated from `createSignedUploadUrl`. 

### createSignedUploadUrl

```text
createSignedUploadUrl(path: string, options?: { upsert: boolean; }): Promise<{ data: { signedUrl: string; token: string; path: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Creates a signed upload URL. Signed upload URLs can be used to upload files to the bucket without further authentication. They are valid for 2 hours. 

### update

```text
update(path: string, fileBody: ArrayBuffer | ArrayBufferView | Blob | Buffer | File | FormData | NodeJS.ReadableStream | ReadableStream<Uint8Array> | URLSearchParams | string, fileOptions?: FileOptions): Promise<{ data: { id: string; path: string; fullPath: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Replaces an existing file at the specified path with a new one. 

### move

```text
move(fromPath: string, toPath: string, options?: DestinationOptions): Promise<{ data: { message: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Moves an existing file to a new path in the same bucket. 

### copy

```text
copy(fromPath: string, toPath: string, options?: DestinationOptions): Promise<{ data: { path: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Copies an existing file to a new path in the same bucket. 

### createSignedUrl

```text
createSignedUrl(path: string, expiresIn: number, options?: { download?: string | boolean; transform?: TransformOptions; }): Promise<{ data: { signedUrl: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Creates a signed URL. Use a signed URL to share a file for a fixed amount of time. 

### createSignedUrls

```text
createSignedUrls(paths: string[], expiresIn: number, options?: { download: string | boolean; }): Promise<{ data: { error: string | null; path: string | null; signedUrl: string; }[]; error: null; } | { data: null; error: StorageError; }>;
```
Creates multiple signed URLs. Use a signed URL to share a file for a fixed amount of time. 

### download

```text
download<Options extends { transform?: TransformOptions; }>(path: string, options?: Options): BlobDownloadBuilder;
```
Downloads a file from a private bucket. For public buckets, make a request to the URL returned from `getPublicUrl` instead. 

### info

```text
info(path: string): Promise<{ data: Camelize<FileObjectV2>; error: null; } | { data: null; error: StorageError; }>;
```
Retrieves the details of an existing file. 

### exists

```text
exists(path: string): Promise<{ data: boolean; error: null; } | { data: boolean; error: StorageError; }>;
```
Checks the existence of a file. 

### getPublicUrl

```text
getPublicUrl(path: string, options?: { download?: string | boolean; transform?: TransformOptions; }): { data: { publicUrl: string; }; };
```
A simple convenience function to get the URL for an asset in a public bucket. If you do not want to use this function, you can construct the public URL by concatenating the bucket URL with the path to the asset. This function does not verify if the bucket is public. If a public URL is created for a bucket which is not public, you will not be able to download the asset. 

### remove

```text
remove(paths: string[]): Promise<{ data: FileObject[]; error: null; } | { data: null; error: StorageError; }>;
```
Deletes files within the same bucket 

### list

```text
list(path?: string, options?: SearchOptions, parameters?: FetchParameters): Promise<{ data: FileObject[]; error: null; } | { data: null; error: StorageError; }>;
```
Get file metadata 

### listV2

```text
listV2(options?: SearchV2Options, parameters?: FetchParameters): Promise<{ data: SearchV2Result; error: null; } | { data: null; error: StorageError; }>;
```
@experimental this method signature might change in the future 

### toBase64

```text
toBase64(data: string): string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## StorageBucketApi


### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, fetch?: Fetch$3, opts?: StorageClientOptions);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### throwOnError

```text
throwOnError(): this;
```
Enable throwing errors instead of returning them.

### listBuckets

```text
listBuckets(options?: ListBucketOptions): Promise<{ data: Bucket[]; error: null; } | { data: null; error: StorageError; }>;
```
Retrieves the details of all Storage buckets within an existing project.

### getBucket

```text
getBucket(id: string): Promise<{ data: Bucket; error: null; } | { data: null; error: StorageError; }>;
```
Retrieves the details of an existing Storage bucket. 

### createBucket

```text
createBucket(id: string, options?: { public: boolean; fileSizeLimit?: number | string | null; allowedMimeTypes?: string[] | null; type?: BucketType; }): Promise<{ data: Pick<Bucket, 'name'>; error: null; } | { data: null; error: StorageError; }>;
```
Creates a new Storage bucket 

### updateBucket

```text
updateBucket(id: string, options: { public: boolean; fileSizeLimit?: number | string | null; allowedMimeTypes?: string[] | null; }): Promise<{ data: { message: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Updates a Storage bucket 

### emptyBucket

```text
emptyBucket(id: string): Promise<{ data: { message: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Removes all objects inside a single bucket. 

### deleteBucket

```text
deleteBucket(id: string): Promise<{ data: { message: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Deletes an existing bucket. A bucket can't be deleted with existing objects inside it. You must first `empty()` the bucket. 

## StorageAnalyticsApi

API class for managing Analytics Buckets using Iceberg tables Provides methods for creating, listing, and deleting analytics buckets

### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, fetch?: Fetch$3);
```
Creates a new StorageAnalyticsApi instance 

### throwOnError

```text
throwOnError(): this;
```
Enable throwing errors instead of returning them in the response When enabled, failed operations will throw instead of returning { data: null, error } @returns This instance for method chaining

### createBucket

```text
createBucket(name: string): Promise<{ data: AnalyticBucket; error: null; } | { data: null; error: StorageError; }>;
```
Creates a new analytics bucket using Iceberg tables Analytics buckets are optimized for analytical queries and data processing 

### listBuckets

```text
listBuckets(options?: { limit?: number; offset?: number; sortColumn?: 'id' | 'name' | 'created_at' | 'updated_at'; sortOrder?: 'asc' | 'desc'; search?: string; }): Promise<{ data: AnalyticBucket[]; error: null; } | { data: null; error: StorageError; }>;
```
Retrieves the details of all Analytics Storage buckets within an existing project Only returns buckets of type 'ANALYTICS' 

### deleteBucket

```text
deleteBucket(bucketId: string): Promise<{ data: { message: string; }; error: null; } | { data: null; error: StorageError; }>;
```
Deletes an existing analytics bucket A bucket can't be deleted with existing objects inside it You must first empty the bucket before deletion 

## StorageVectorsError

Base error class for all Storage Vectors errors

### constructor

```text
constructor(message: string);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## VectorIndexApi

API class for managing Vector Indexes within Vector Buckets Provides methods for creating, reading, listing, and deleting vector indexes

### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, fetch?: Fetch$2);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### throwOnError

```text
throwOnError(): this;
```
Enable throwing errors instead of returning them in the response When enabled, failed operations will throw instead of returning { data: null, error } @returns This instance for method chaining 

### createIndex

```text
createIndex(options: CreateIndexOptions): Promise<ApiResponse<undefined>>;
```
Creates a new vector index within a bucket Defines the schema for vectors including dimensionality, distance metric, and metadata config 

### getIndex

```text
getIndex(vectorBucketName: string, indexName: string): Promise<ApiResponse<{ index: VectorIndex; }>>;
```
Retrieves metadata for a specific vector index Returns index configuration including dimension, distance metric, and metadata settings 

### listIndexes

```text
listIndexes(options: ListIndexesOptions): Promise<ApiResponse<ListIndexesResponse>>;
```
Lists vector indexes within a bucket with optional filtering and pagination Supports prefix-based filtering and paginated results 

### deleteIndex

```text
deleteIndex(vectorBucketName: string, indexName: string): Promise<ApiResponse<undefined>>;
```
Deletes a vector index and all its data This operation removes the index schema and all vectors stored in the index 

## VectorDataApi

API class for managing Vector Data within Vector Indexes Provides methods for inserting, querying, listing, and deleting vector embeddings

### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, fetch?: Fetch$2);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### throwOnError

```text
throwOnError(): this;
```
Enable throwing errors instead of returning them in the response When enabled, failed operations will throw instead of returning { data: null, error } @returns This instance for method chaining 

### putVectors

```text
putVectors(options: PutVectorsOptions): Promise<ApiResponse<undefined>>;
```
Inserts or updates vectors in batch (upsert operation) Accepts 1-500 vectors per request. Larger batches should be split 

### getVectors

```text
getVectors(options: GetVectorsOptions): Promise<ApiResponse<GetVectorsResponse>>;
```
Retrieves vectors by their keys in batch Optionally includes vector data and or metadata in response Additional permissions required when returning data or metadata 

### listVectors

```text
listVectors(options: ListVectorsOptions): Promise<ApiResponse<ListVectorsResponse>>;
```
Lists scans vectors in an index with pagination Supports parallel scanning via segment configuration for high-throughput scenarios Additional permissions required when returning data or metadata 

### queryVectors

```text
queryVectors(options: QueryVectorsOptions): Promise<ApiResponse<QueryVectorsResponse>>;
```
Queries for similar vectors using approximate nearest neighbor (ANN) search Returns top-K most similar vectors based on the configured distance metric Supports optional metadata filtering (requires GetVectors permission) 

### deleteVectors

```text
deleteVectors(options: DeleteVectorsOptions): Promise<ApiResponse<undefined>>;
```
Deletes vectors by their keys in batch Accepts 1-500 keys per request 

## VectorBucketApi

API class for managing Vector Buckets Provides methods for creating, reading, listing, and deleting vector buckets

### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, fetch?: Fetch$2);
```
Creates a new VectorBucketApi instance 

### throwOnError

```text
throwOnError(): this;
```
Enable throwing errors instead of returning them in the response When enabled, failed operations will throw instead of returning { data: null, error } @returns This instance for method chaining 

### createBucket

```text
createBucket(vectorBucketName: string): Promise<ApiResponse<undefined>>;
```
Creates a new vector bucket Vector buckets are containers for vector indexes and their data 

### getBucket

```text
getBucket(vectorBucketName: string): Promise<ApiResponse<{ vectorBucket: VectorBucket; }>>;
```
Retrieves metadata for a specific vector bucket Returns bucket configuration including encryption settings and creation time 

### listBuckets

```text
listBuckets(options?: ListVectorBucketsOptions): Promise<ApiResponse<ListVectorBucketsResponse>>;
```
Lists vector buckets with optional filtering and pagination Supports prefix-based filtering and paginated results 

### deleteBucket

```text
deleteBucket(vectorBucketName: string): Promise<ApiResponse<undefined>>;
```
Deletes a vector bucket Bucket must be empty before deletion (all indexes must be removed first) 

## StorageVectorsClientOptions

Configuration options for the Storage Vectors client

### headers

```text
headers?: { [key: string]: string; };
```
Custom headers to include in all requests

### fetch

```text
fetch?: Fetch$2;
```
Custom fetch implementation (optional) Useful for testing or custom request handling

## StorageVectorsClient

Main client for interacting with S3 Vectors API Provides access to bucket, index, and vector data operations Usage Patterns: 1. Via StorageClient (recommended for most use cases): ```typescript import { StorageClient } from '

### constructor

```text
constructor(url: string, options?: StorageVectorsClientOptions);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### from

```text
from(vectorBucketName: string): VectorBucketScope;
```
Access operations for a specific vector bucket Returns a scoped client for index and vector operations within the bucket 

## VectorBucketScope

Scoped client for operations within a specific vector bucket Provides index management and access to vector operations

### constructor

```text
constructor(url: string, headers: { [key: string]: string; }, vectorBucketName: string, fetch?: Fetch$2);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### createIndex

```text
createIndex(options: Omit<CreateIndexOptions, 'vectorBucketName'>): Promise<ApiResponse<undefined>>;
```
Creates a new vector index in this bucket Convenience method that automatically includes the bucket name 

### listIndexes

```text
listIndexes(options?: Omit<ListIndexesOptions, 'vectorBucketName'>): Promise<ApiResponse<ListIndexesResponse>>;
```
Lists indexes in this bucket Convenience method that automatically includes the bucket name 

### getIndex

```text
getIndex(indexName: string): Promise<ApiResponse<{ index: VectorIndex; }>>;
```
Retrieves metadata for a specific index in this bucket Convenience method that automatically includes the bucket name 

### deleteIndex

```text
deleteIndex(indexName: string): Promise<ApiResponse<undefined>>;
```
Deletes an index from this bucket Convenience method that automatically includes the bucket name 

### index

```text
index(indexName: string): VectorIndexScope;
```
Access operations for a specific index within this bucket Returns a scoped client for vector data operations 

## VectorIndexScope

Scoped client for operations within a specific vector index Provides vector data operations (put, get, list, query, delete)

### constructor

```text
constructor(url: string, headers: { [key: string]: string; }, vectorBucketName: string, indexName: string, fetch?: Fetch$2);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### putVectors

```text
putVectors(options: Omit<PutVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<ApiResponse<undefined>>;
```
Inserts or updates vectors in this index Convenience method that automatically includes bucket and index names 

### getVectors

```text
getVectors(options: Omit<GetVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<ApiResponse<GetVectorsResponse>>;
```
Retrieves vectors by keys from this index Convenience method that automatically includes bucket and index names 

### listVectors

```text
listVectors(options?: Omit<ListVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<ApiResponse<ListVectorsResponse>>;
```
Lists vectors in this index with pagination Convenience method that automatically includes bucket and index names 

### queryVectors

```text
queryVectors(options: Omit<QueryVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<ApiResponse<QueryVectorsResponse>>;
```
Queries for similar vectors in this index Convenience method that automatically includes bucket and index names 

### deleteVectors

```text
deleteVectors(options: Omit<DeleteVectorsOptions, 'vectorBucketName' | 'indexName'>): Promise<ApiResponse<undefined>>;
```
Deletes vectors by keys from this index Convenience method that automatically includes bucket and index names 

## StorageClient


### constructor

```text
constructor(url: string, headers?: { [key: string]: string; }, fetch?: Fetch$3, opts?: StorageClientOptions);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### from

```text
from(id: string): StorageFileApi;
```
Perform file operation in a bucket. 

### vectors

```text
get vectors(): StorageVectorsClient;
```
Access vector storage operations. @returns A StorageVectorsClient instance configured with the current storage settings.

### analytics

```text
get analytics(): StorageAnalyticsApi;
```
Access analytics storage operations using Iceberg tables. @returns A StorageAnalyticsApi instance configured with the current storage settings.
