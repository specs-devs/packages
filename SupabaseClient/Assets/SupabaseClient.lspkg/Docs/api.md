# SupabaseClient client, auth and query API

[← Agent usage index](../README.md)

## Use when

Read when constructing a client or using auth/table/RPC methods.

## Factory and options

Import `createClient` and `type SupabaseClient` from `SupabaseClient.lspkg/supabase-snapcloud`. createClient takes URL, public key and optional SupabaseClientOptions<SchemaName>, returning a generic SupabaseClient. Use factory rather than constructor: JS factory appends Snapchat helper to auth. No backend project/credentials/database types are generated here.

Default db.schema='public'; auth.autoRefreshToken=true, persistSession=true, detectSessionInUrl=true, flowType='implicit'; realtime options empty. Application may supply options.auth.storage/userStorage/storageKey/lock/debug/throwOnError, options.realtime (including heartbeatIntervalMs), options.global.headers/fetch, options.accessToken. Source SnapCloudExamples uses heartbeatIntervalMs2500 as a workaround; it is not this factory's default. Constructor checks URL/key, SDK may schedule auth initialization/token refresh after client creation.

Auth response shape for token sign-in: data.user/session can be null when error; getSession returns data.session and getUser returns data.user. onAuthStateChange returns data.subscription with unsubscribe(), not a bare callback remover. Admin/MFA/OAuth members mirror upstream declarations and are not certified native flows. getSession cached data is not server identity verification; getUser contacts auth service.

Database from()/schema()/rpc() create thenable query builders. select defaults '*'; mutations return null data until .select(); update/delete need intentional filters; eq/neq/gt/gte/lt/lte/like/ilike/in/is/contains/range/textSearch/etc chain query conditions. single requires one row; maybeSingle allows zero/one. order/range/limit/count/head and abortSignal/throwOnError control request/response; Lens transport can limit signal/head behavior. Generic schema shapes remain in canonical declarations.

All fragments below are signatures, not standalone runnable TS. Canonical generic/type definitions: [`supabase-snapcloud.d.ts`](../supabase-snapcloud.d.ts). Private/protected and underscore-prefixed internals are omitted; no internal state should be mutated. Public SDK methods may need browser capabilities absent on Lens.

## PostgrestBuilder


### constructor

```text
constructor(builder: { method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE'; url: URL; headers: HeadersInit; schema?: string; body?: unknown; shouldThrowOnError?: boolean; signal?: AbortSignal; fetch?: Fetch$5; isMaybeSingle?: boolean; });
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### throwOnError

```text
throwOnError(): this & PostgrestBuilder<ClientOptions, Result, true>;
```
If there's an error with the query, throwOnError will reject the promise by throwing the error instead of returning it as part of a successful response. https: github.com supabase supabase-js issues 92

### setHeader

```text
setHeader(name: string, value: string): this;
```
Set an HTTP header for the request.

### then

```text
then<TResult1 = ThrowOnError extends true ? PostgrestResponseSuccess<Result> : PostgrestSingleResponse<Result>, TResult2 = never>(onfulfilled?: ((value: ThrowOnError extends true ? PostgrestResponseSuccess<Result> : PostgrestSingleResponse<Result>) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### returns

```text
returns<NewResult>(): PostgrestBuilder<ClientOptions, CheckMatchingArrayTypes<Result, NewResult>, ThrowOnError>;
```
Override the type of the returned `data`. @typeParam NewResult - The new result type to override with @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead

### overrideTypes

```text
overrideTypes<NewResult, Options extends { merge?: boolean; } = { merge: true; }>(): PostgrestBuilder<ClientOptions, IsValidResultOverride<Result, NewResult, false, false> extends true ? ContainsNull<Result> extends true ? MergePartialResult<NewResult, NonNullable<Result>, Options> | null : MergePartialResult<NewResult, Result, Options> : CheckMatchingArrayTypes<Result, NewResult>, ThrowOnError>;
```
Override the type of the returned `data` field in the response. @typeParam NewResult - The new type to cast the response data to @typeParam Options - Optional type configuration (defaults to { merge: true }) @typeParam Options.merge - When true, merges the new type with existing return type. When false, replaces the existing types entirely (defaults to true) 

## PostgrestTransformBuilder


### select

```text
select<Query extends string = '*', NewResultOne = GetResult<Schema, Row, RelationName, Relationships, Query, ClientOptions>>(columns?: Query): PostgrestFilterBuilder<ClientOptions, Schema, Row, Method extends 'RPC' ? Result extends unknown[] ? NewResultOne[] : NewResultOne : NewResultOne[], RelationName, Relationships, Method>;
```
Perform a SELECT on the query result. By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not return modified rows. By calling this method, modified rows are returned in `data`. 

### order

```text
order<ColumnName extends string & keyof Row>(column: ColumnName, options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: undefined; }): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### order

```text
order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string; }): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### order

```text
order<ColumnName extends string & keyof Row>(column: ColumnName, options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: undefined; }): this;
```
@deprecated Use `options.referencedTable` instead of `options.foreignTable`

### order

```text
order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; }): this;
```
@deprecated Use `options.referencedTable` instead of `options.foreignTable`

### limit

```text
limit(count: number, { foreignTable, referencedTable, }?: { foreignTable?: string; referencedTable?: string; }): this;
```
Limit the query result by `count`. 

### range

```text
range(from: number, to: number, { foreignTable, referencedTable, }?: { foreignTable?: string; referencedTable?: string; }): this;
```
Limit the query result by starting at an offset `from` and ending at the offset `to`. Only records within this range are returned. This respects the query order and if there is no order clause the range could behave unexpectedly. The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third and fourth rows of the query. 

### abortSignal

```text
abortSignal(signal: AbortSignal): this;
```
Set the AbortSignal for the fetch request. 

### single

```text
single<ResultOne = Result extends (infer ResultOne)[] ? ResultOne : never>(): PostgrestBuilder<ClientOptions, ResultOne>;
```
Return `data` as a single object instead of an array of objects. Query result must be one row (e.g. using `.limit(1)`), otherwise this returns an error.

### maybeSingle

```text
maybeSingle<ResultOne = Result extends (infer ResultOne)[] ? ResultOne : never>(): PostgrestBuilder<ClientOptions, ResultOne | null>;
```
Return `data` as a single object instead of an array of objects. Query result must be zero or one row (e.g. using `.limit(1)`), otherwise this returns an error.

### csv

```text
csv(): PostgrestBuilder<ClientOptions, string>;
```
Return `data` as a string in CSV format.

### geojson

```text
geojson(): PostgrestBuilder<ClientOptions, Record<string, unknown>>;
```
Return `data` as an object in [GeoJSON](https: geojson.org) format.

### explain

```text
explain({ analyze, verbose, settings, buffers, wal, format, }?: { analyze?: boolean; verbose?: boolean; settings?: boolean; buffers?: boolean; wal?: boolean; format?: 'json' | 'text'; }): PostgrestBuilder<ClientOptions, string, false> | PostgrestBuilder<ClientOptions, Record<string, unknown>[], false>;
```
Return `data` as the EXPLAIN plan for the query. You need to enable the [db_plan_enabled](https: supabase.com docs guides database debugging-performance#enabling-explain) setting before using this method. 

### rollback

```text
rollback(): this;
```
Rollback the query. `data` will still be returned, but the query is not committed.

### returns

```text
returns<NewResult>(): PostgrestTransformBuilder<ClientOptions, Schema, Row, CheckMatchingArrayTypes<Result, NewResult>, RelationName, Relationships, Method>;
```
Override the type of the returned `data`. @typeParam NewResult - The new result type to override with @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead

### maxAffected

```text
maxAffected(value: number): MaxAffectedEnabled<ClientOptions['PostgrestVersion']> extends true ? Method extends 'PATCH' | 'DELETE' | 'RPC' ? this : InvalidMethodError<'maxAffected method only available on update or delete'> : InvalidMethodError<'maxAffected method only available on postgrest 13+'>;
```
Set the maximum number of rows that can be affected by the query. Only available in PostgREST v13+ and only works with PATCH and DELETE methods. 

## PostgrestFilterBuilder


### eq

```text
eq<ColumnName extends string>(column: ColumnName, value: ResolveFilterValue<Schema, Row, ColumnName> extends never ? NonNullable<unknown> : ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue ? NonNullable<ResolvedFilterValue> : never): this;
```
Match only rows where `column` is equal to `value`. To check if the value of `column` is NULL, you should use `.is()` instead. 

### neq

```text
neq<ColumnName extends string>(column: ColumnName, value: ResolveFilterValue<Schema, Row, ColumnName> extends never ? unknown : ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue ? ResolvedFilterValue : never): this;
```
Match only rows where `column` is not equal to `value`. 

### gt

```text
gt<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### gt

```text
gt(column: string, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### gte

```text
gte<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### gte

```text
gte(column: string, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### lt

```text
lt<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### lt

```text
lt(column: string, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### lte

```text
lte<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### lte

```text
lte(column: string, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### like

```text
like<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### like

```text
like(column: string, pattern: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### likeAllOf

```text
likeAllOf<ColumnName extends string & keyof Row>(column: ColumnName, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### likeAllOf

```text
likeAllOf(column: string, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### likeAnyOf

```text
likeAnyOf<ColumnName extends string & keyof Row>(column: ColumnName, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### likeAnyOf

```text
likeAnyOf(column: string, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ilike

```text
ilike<ColumnName extends string & keyof Row>(column: ColumnName, pattern: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ilike

```text
ilike(column: string, pattern: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ilikeAllOf

```text
ilikeAllOf<ColumnName extends string & keyof Row>(column: ColumnName, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ilikeAllOf

```text
ilikeAllOf(column: string, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ilikeAnyOf

```text
ilikeAnyOf<ColumnName extends string & keyof Row>(column: ColumnName, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### ilikeAnyOf

```text
ilikeAnyOf(column: string, patterns: readonly string[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### is

```text
is<ColumnName extends string & keyof Row>(column: ColumnName, value: Row[ColumnName] & (boolean | null)): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### is

```text
is(column: string, value: boolean | null): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### in

```text
in<ColumnName extends string>(column: ColumnName, values: ReadonlyArray<ResolveFilterValue<Schema, Row, ColumnName> extends never ? unknown : ResolveFilterValue<Schema, Row, ColumnName> extends infer ResolvedFilterValue ? ResolvedFilterValue : never>): this;
```
Match only rows where `column` is included in the `values` array. 

### contains

```text
contains<ColumnName extends string & keyof Row>(column: ColumnName, value: string | ReadonlyArray<Row[ColumnName]> | Record<string, unknown>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### contains

```text
contains(column: string, value: string | readonly unknown[] | Record<string, unknown>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### containedBy

```text
containedBy<ColumnName extends string & keyof Row>(column: ColumnName, value: string | ReadonlyArray<Row[ColumnName]> | Record<string, unknown>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### containedBy

```text
containedBy(column: string, value: string | readonly unknown[] | Record<string, unknown>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeGt

```text
rangeGt<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeGt

```text
rangeGt(column: string, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeGte

```text
rangeGte<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeGte

```text
rangeGte(column: string, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeLt

```text
rangeLt<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeLt

```text
rangeLt(column: string, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeLte

```text
rangeLte<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeLte

```text
rangeLte(column: string, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeAdjacent

```text
rangeAdjacent<ColumnName extends string & keyof Row>(column: ColumnName, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### rangeAdjacent

```text
rangeAdjacent(column: string, range: string): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### overlaps

```text
overlaps<ColumnName extends string & keyof Row>(column: ColumnName, value: string | ReadonlyArray<Row[ColumnName]>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### overlaps

```text
overlaps(column: string, value: string | readonly unknown[]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### textSearch

```text
textSearch<ColumnName extends string & keyof Row>(column: ColumnName, query: string, options?: { config?: string; type?: 'plain' | 'phrase' | 'websearch'; }): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### textSearch

```text
textSearch(column: string, query: string, options?: { config?: string; type?: 'plain' | 'phrase' | 'websearch'; }): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### match

```text
match<ColumnName extends string & keyof Row>(query: Record<ColumnName, Row[ColumnName]>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### match

```text
match(query: Record<string, unknown>): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### not

```text
not<ColumnName extends string & keyof Row>(column: ColumnName, operator: FilterOperator, value: Row[ColumnName]): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### not

```text
not(column: string, operator: string, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### or

```text
or(filters: string, { foreignTable, referencedTable, }?: { foreignTable?: string; referencedTable?: string; }): this;
```
Match only rows which satisfy at least one of the filters. Unlike most filters, `filters` is used as-is and needs to follow [PostgREST syntax](https: postgrest.org en stable api.html#operators). You also need to make sure it's properly sanitized. It's currently not possible to do an `.or()` filter across multiple tables. 

### filter

```text
filter<ColumnName extends string & keyof Row>(column: ColumnName, operator: `${'' | 'not.'}${FilterOperator}`, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### filter

```text
filter(column: string, operator: string, value: unknown): this;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## PostgrestQueryBuilder


### url

```text
url: URL;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### headers

```text
headers: Headers;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### schema

```text
schema?: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### signal

```text
signal?: AbortSignal;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### fetch

```text
fetch?: Fetch$5;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor(url: URL, { headers, schema, fetch, }: { headers?: HeadersInit; schema?: string; fetch?: Fetch$5; });
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### select

```text
select<Query extends string = '*', ResultOne = GetResult<Schema, Relation['Row'], RelationName, Relationships, Query, ClientOptions>>(columns?: Query, options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], ResultOne[], RelationName, Relationships, 'GET'>;
```
Perform a SELECT query on the table or view. 

### insert

```text
insert<Row extends Relation extends { Insert: unknown; } ? Relation['Insert'] : never>(values: Row, options?: { count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### insert

```text
insert<Row extends Relation extends { Insert: unknown; } ? Relation['Insert'] : never>(values: Row[], options?: { count?: 'exact' | 'planned' | 'estimated'; defaultToNull?: boolean; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### upsert

```text
upsert<Row extends Relation extends { Insert: unknown; } ? Relation['Insert'] : never>(values: Row, options?: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### upsert

```text
upsert<Row extends Relation extends { Insert: unknown; } ? Relation['Insert'] : never>(values: Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' | 'planned' | 'estimated'; defaultToNull?: boolean; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### update

```text
update<Row extends Relation extends { Update: unknown; } ? Relation['Update'] : never>(values: Row, { count, }?: { count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'PATCH'>;
```
Perform an UPDATE on the table or view. By default, updated rows are not returned. To return it, chain the call with `.select()` after filters. 

### delete

```text
delete({ count, }?: { count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'DELETE'>;
```
Perform a DELETE on the table or view. By default, deleted rows are not returned. To return it, chain the call with `.select()` after filters. 

## PostgrestClient

PostgREST client.

### url

```text
url: string;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### headers

```text
headers: Headers;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### schemaName

```text
schemaName?: SchemaName;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### fetch

```text
fetch?: Fetch$5;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor(url: string, { headers, schema, fetch, }?: { headers?: HeadersInit; schema?: SchemaName; fetch?: Fetch$5; });
```
Creates a PostgREST client. 

### from

```text
from<TableName extends string & keyof Schema['Tables'], Table extends Schema['Tables'][TableName]>(relation: TableName): PostgrestQueryBuilder<ClientOptions, Schema, Table, TableName>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### from

```text
from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(relation: ViewName): PostgrestQueryBuilder<ClientOptions, Schema, View, ViewName>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### schema

```text
schema<DynamicSchema extends string & keyof Omit<Database, '__InternalSupabase'>>(schema: DynamicSchema): PostgrestClient<Database, ClientOptions, DynamicSchema, Database[DynamicSchema] extends GenericSchema$1 ? Database[DynamicSchema] : any>;
```
Select a schema to query or perform an function (rpc) call. The schema needs to be on the list of exposed schemas inside Supabase. 

### rpc

```text
rpc<FnName extends string & keyof Schema['Functions'], Args extends Schema['Functions'][FnName]['Args'] = never, FilterBuilder extends GetRpcFunctionFilterBuilderByArgs$1<Schema, FnName, Args> = GetRpcFunctionFilterBuilderByArgs$1<Schema, FnName, Args>>(fn: FnName, args?: Args, { head, get, count, }?: { head?: boolean; get?: boolean; count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, FilterBuilder['Row'], FilterBuilder['Result'], FilterBuilder['RelationName'], FilterBuilder['Relationships'], 'RPC'>;
```
Perform a function call. 

## GoTrueClient


### admin

```text
admin: GoTrueAdminApi;
```
Namespace for the GoTrue admin methods. These methods should only be used in a trusted server-side environment.

### mfa

```text
mfa: GoTrueMFAApi;
```
Namespace for the MFA methods.

### oauth

```text
oauth: AuthOAuthServerApi;
```
Namespace for the OAuth 2.1 authorization server methods. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. Used to implement the authorization code flow on the consent page.

### constructor

```text
constructor(options: GoTrueClientOptions);
```
Create a new client for use in the browser.

### isThrowOnErrorEnabled

```text
isThrowOnErrorEnabled(): boolean;
```
Returns whether error throwing mode is enabled for this client.

### initialize

```text
initialize(): Promise<InitializeResult>;
```
Initializes the client session either from the url or from storage. This method is automatically called when instantiating the client, but should also be called manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).

### signInAnonymously

```text
signInAnonymously(credentials?: SignInAnonymouslyCredentials): Promise<AuthResponse>;
```
Creates a new anonymous user. @returns A session where the is_anonymous claim in the access token JWT set to true

### signUp

```text
signUp(credentials: SignUpWithPasswordCredentials): Promise<AuthResponse>;
```
Creates a new user. Be aware that if a user account exists in the system you may get back an error message that attempts to hide this information from the user. This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled. @returns A logged-in session if the server has "autoconfirm" ON @returns A user if the server has "autoconfirm" OFF

### signInWithPassword

```text
signInWithPassword(credentials: SignInWithPasswordCredentials): Promise<AuthTokenResponsePassword>;
```
Log in an existing user with an email and password or phone and password. Be aware that you may get back an error message that will not distinguish between the cases where the account does not exist or that the email phone and password combination is wrong or that the account can only be accessed via social login.

### signInWithOAuth

```text
signInWithOAuth(credentials: SignInWithOAuthCredentials): Promise<OAuthResponse>;
```
Log in an existing user via a third-party provider. This method supports the PKCE flow.

### exchangeCodeForSession

```text
exchangeCodeForSession(authCode: string): Promise<AuthTokenResponse>;
```
Log in an existing user by exchanging an Auth Code issued during the PKCE flow.

### signInWithWeb3

```text
signInWithWeb3(credentials: Web3Credentials): Promise<{ data: { session: Session; user: User; }; error: null; } | { data: { session: null; user: null; }; error: AuthError; }>;
```
Signs in a user by verifying a message signed by the user's private key. Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards, both of which derive from the EIP-4361 standard With slight variation on Solana's side. @reference https: eips.ethereum.org EIPS eip-4361

### signInWithIdToken

```text
signInWithIdToken(credentials: SignInWithIdTokenCredentials): Promise<AuthTokenResponse>;
```
Allows signing in with an OIDC ID token. The authentication provider used should be enabled and configured.

### signInWithOtp

```text
signInWithOtp(credentials: SignInWithPasswordlessCredentials): Promise<AuthOtpResponse>;
```
Log in a user using magiclink or a one-time password (OTP). If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent. If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent. If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins. Be aware that you may get back an error message that will not distinguish between the cases where the account does not exist or, that the account can only be accessed via social login. Do note that you will need to configure a Whatsapp sender on Twilio if you are using phone sign in with the 'whatsapp' channel. The whatsapp channel is not supported on other providers at this time. This method supports PKCE when an email is passed.

### verifyOtp

```text
verifyOtp(params: VerifyOtpParams): Promise<AuthResponse>;
```
Log in a user given a User supplied OTP or TokenHash received through mobile or email.

### signInWithSSO

```text
signInWithSSO(params: SignInWithSSO): Promise<SSOResponse>;
```
Attempts a single-sign on using an enterprise Identity Provider. A successful SSO attempt will redirect the current page to the identity provider authorization page. The redirect URL is implementation and SSO protocol specific. You can use it by providing a SSO domain. Typically you can extract this domain by asking users for their email address. If this domain is registered on the Auth instance the redirect will use that organization's currently active SSO Identity Provider for the login. If you have built an organization-specific login page, you can use the organization's SSO Identity Provider UUID directly instead.

### reauthenticate

```text
reauthenticate(): Promise<AuthResponse>;
```
Sends a reauthentication OTP to the user's email or phone number. Requires the user to be signed-in.

### resend

```text
resend(credentials: ResendParams): Promise<AuthOtpResponse>;
```
Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.

### getSession

```text
getSession(): Promise<{ data: { session: Session; }; error: null; } | { data: { session: null; }; error: AuthError; } | { data: { session: null; }; error: null; }>;
```
Returns the session, refreshing it if necessary. The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out. IMPORTANT: This method loads values directly from the storage attached to the client. If that storage is based on request cookies for example, the values in it may not be authentic and therefore it's strongly advised against using this method and its results in such circumstances. A warning will be emitted if this is detected. Use #getUser() instead.

### getUser

```text
getUser(jwt?: string): Promise<UserResponse>;
```
Gets the current user details if there is an existing session. This method performs a network request to the Supabase Auth server, so the returned value is authentic and can be used to base authorization rules on. 

### updateUser

```text
updateUser(attributes: UserAttributes, options?: { emailRedirectTo?: string | undefined; }): Promise<UserResponse>;
```
Updates user data for a logged in user.

### setSession

```text
setSession(currentSession: { access_token: string; refresh_token: string; }): Promise<AuthResponse>;
```
Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session. If the refresh token or access token in the current session is invalid, an error will be thrown. 

### refreshSession

```text
refreshSession(currentSession?: { refresh_token: string; }): Promise<AuthResponse>;
```
Returns a new session, regardless of expiry status. Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession(). If the current session's refresh token is invalid, an error will be thrown. 

### signOut

```text
signOut(options?: SignOut): Promise<{ error: AuthError | null; }>;
```
Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event. For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`. There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason. If using `others` scope, no `SIGNED_OUT` event is fired!

### onAuthStateChange

```text
onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): { data: { subscription: Subscription; }; };
```
Receive a notification every time an auth event happens. Safe to use without an async function as callback. 

### onAuthStateChange

```text
onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => Promise<void>): { data: { subscription: Subscription; }; };
```
Avoid using an async function inside `onAuthStateChange` as you might end up with a deadlock. The callback function runs inside an exclusive lock, so calling other Supabase Client APIs that also try to acquire the exclusive lock, might cause a deadlock. This behavior is observable across tabs. In the next major library version, this behavior will not be supported. Receive a notification every time an auth event happens. 

### resetPasswordForEmail

```text
resetPasswordForEmail(email: string, options?: { redirectTo?: string; captchaToken?: string; }): Promise<{ data: {}; error: null; } | { data: null; error: AuthError; }>;
```
Sends a password reset request to an email address. This method supports the PKCE flow. 

### getUserIdentities

```text
getUserIdentities(): Promise<{ data: { identities: UserIdentity[]; }; error: null; } | { data: null; error: AuthError; }>;
```
Gets all the identities linked to a user.

### linkIdentity

```text
linkIdentity(credentials: SignInWithOAuthCredentials): Promise<OAuthResponse>;
```
Links an oauth identity to an existing user. This method supports the PKCE flow.

### linkIdentity

```text
linkIdentity(credentials: SignInWithIdTokenCredentials): Promise<AuthTokenResponse>;
```
Links an OIDC identity to an existing user.

### unlinkIdentity

```text
unlinkIdentity(identity: UserIdentity): Promise<{ data: {}; error: null; } | { data: null; error: AuthError; }>;
```
Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.

### startAutoRefresh

```text
startAutoRefresh(): Promise<void>;
```
Starts an auto-refresh process in the background. The session is checked every few seconds. Close to the time of expiration a process is started to refresh the session. If refreshing fails it will be retried for as long as necessary. If you set the GoTrueClientOptions#autoRefreshToken you don't need to call this function, it will be called for you. On browsers the refresh process works only when the tab window is in the foreground to conserve resources as well as prevent race conditions and flooding auth with requests. If you call this method any managed visibility change callback will be removed and you must manage visibility changes on your own. On non-browser platforms the refresh process works continuously in the background, which may not be desirable. You should hook into your platform's foreground indication mechanism and call these methods appropriately to conserve resources. {@see #stopAutoRefresh}

### stopAutoRefresh

```text
stopAutoRefresh(): Promise<void>;
```
Stops an active auto refresh process running in the background (if any). If you call this method any managed visibility change callback will be removed and you must manage visibility changes on your own. See #startAutoRefresh for more details.

### getClaims

```text
getClaims(jwt?: string, options?: { keys?: JWK[]; allowExpired?: boolean; jwks?: { keys: JWK[]; }; }): Promise<{ data: { claims: JwtPayload; header: JwtHeader; signature: Uint8Array; }; error: null; } | { data: null; error: AuthError; } | { data: null; error: null; }>;
```
Extracts the JWT claims present in the access token by first verifying the JWT against the server's JSON Web Key Set endpoint ` .well-known jwks.json` which is often cached, resulting in significantly faster responses. Prefer this method over #getUser which always sends a request to the Auth server for each JWT. If the project is not using an asymmetric JWT signing key (like ECC or RSA) it always sends a request to the Auth server (similar to #getUser) to verify the JWT. 

## WebAuthnApi

WebAuthn API wrapper for Supabase Auth. Provides methods for enrolling, challenging, verifying, authenticating, and registering WebAuthn credentials.

### enroll

```text
enroll: typeof WebAuthnApi.prototype._enroll;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### challenge

```text
challenge: typeof WebAuthnApi.prototype._challenge;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### verify

```text
verify: typeof WebAuthnApi.prototype._verify;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### authenticate

```text
authenticate: typeof WebAuthnApi.prototype._authenticate;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### register

```text
register: typeof WebAuthnApi.prototype._register;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### constructor

```text
constructor(client: GoTrueClient);
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## GoTrueMFAApi

Contains the full multi-factor authentication API.

### enroll

```text
enroll(params: MFAEnrollTOTPParams): Promise<AuthMFAEnrollTOTPResponse>;
```
Starts the enrollment process for a new Multi-Factor Authentication (MFA) factor. This method creates a new `unverified` factor. To verify a factor, present the QR code or secret to the user and ask them to add it to their authenticator app. The user has to enter the code from their authenticator app to verify it. Upon verifying a factor, all other sessions are logged out and the current session's authenticator level is promoted to `aal2`.

### enroll

```text
enroll(params: MFAEnrollPhoneParams): Promise<AuthMFAEnrollPhoneResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### enroll

```text
enroll(params: MFAEnrollWebauthnParams): Promise<AuthMFAEnrollWebauthnResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### enroll

```text
enroll(params: MFAEnrollParams): Promise<AuthMFAEnrollResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### challenge

```text
challenge(params: MFAChallengeTOTPParams): Promise<Prettify<AuthMFAChallengeTOTPResponse>>;
```
Prepares a challenge used to verify that a user has access to a MFA factor.

### challenge

```text
challenge(params: MFAChallengePhoneParams): Promise<Prettify<AuthMFAChallengePhoneResponse>>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### challenge

```text
challenge(params: MFAChallengeWebauthnParams): Promise<Prettify<AuthMFAChallengeWebauthnResponse>>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### challenge

```text
challenge(params: MFAChallengeParams): Promise<AuthMFAChallengeResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### verify

```text
verify(params: MFAVerifyTOTPParams): Promise<AuthMFAVerifyResponse>;
```
Verifies a code against a challenge. The verification code is provided by the user by entering a code seen in their authenticator app.

### verify

```text
verify(params: MFAVerifyPhoneParams): Promise<AuthMFAVerifyResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### verify

```text
verify(params: MFAVerifyWebauthnParams): Promise<AuthMFAVerifyResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### verify

```text
verify(params: MFAVerifyParams): Promise<AuthMFAVerifyResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### unenroll

```text
unenroll(params: MFAUnenrollParams): Promise<AuthMFAUnenrollResponse>;
```
Unenroll removes a MFA factor. A user has to have an `aal2` authenticator level in order to unenroll a `verified` factor.

### challengeAndVerify

```text
challengeAndVerify(params: MFAChallengeAndVerifyParams): Promise<AuthMFAVerifyResponse>;
```
Helper method which creates a challenge and immediately uses the given code to verify against it thereafter. The verification code is provided by the user by entering a code seen in their authenticator app.

### listFactors

```text
listFactors(): Promise<AuthMFAListFactorsResponse>;
```
Returns the list of MFA factors enabled for this user. @see GoTrueMFAApi#enroll @see GoTrueMFAApi#getAuthenticatorAssuranceLevel @see GoTrueClient#getUser

### getAuthenticatorAssuranceLevel

```text
getAuthenticatorAssuranceLevel(): Promise<AuthMFAGetAuthenticatorAssuranceLevelResponse>;
```
Returns the Authenticator Assurance Level (AAL) for the active session. - `aal1` (or `null`) means that the user's identity has been verified only with a conventional login (email+password, OTP, magic link, social login, etc.). - `aal2` means that the user's identity has been verified both with a conventional login and at least one MFA factor. Although this method returns a promise, it's fairly quick (microseconds) and rarely uses the network. You can use this to check whether the current user needs to be shown a screen to verify their MFA factors.

### webauthn

```text
webauthn: WebAuthnApi;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## GoTrueAdminMFAApi

Contains the full multi-factor authentication administration API.

### listFactors

```text
listFactors(params: AuthMFAAdminListFactorsParams): Promise<AuthMFAAdminListFactorsResponse>;
```
Lists all factors associated to a user.

### deleteFactor

```text
deleteFactor(params: AuthMFAAdminDeleteFactorParams): Promise<AuthMFAAdminDeleteFactorResponse>;
```
Deletes a factor on a user. This will log the user out of all active sessions if the deleted factor was verified. @see GoTrueMFAApi#unenroll @expermental

## GoTrueAdminOAuthApi

Contains all OAuth client administration methods. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.

### listClients

```text
listClients(params?: PageParams): Promise<OAuthClientListResponse>;
```
Lists all OAuth clients with optional pagination. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This function should only be called on a server. Never expose your `service_role` key in the browser.

### createClient

```text
createClient(params: CreateOAuthClientParams): Promise<OAuthClientResponse>;
```
Creates a new OAuth client. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This function should only be called on a server. Never expose your `service_role` key in the browser.

### getClient

```text
getClient(clientId: string): Promise<OAuthClientResponse>;
```
Gets details of a specific OAuth client. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This function should only be called on a server. Never expose your `service_role` key in the browser.

### updateClient

```text
updateClient(clientId: string, params: UpdateOAuthClientParams): Promise<OAuthClientResponse>;
```
Updates an existing OAuth client. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This function should only be called on a server. Never expose your `service_role` key in the browser.

### deleteClient

```text
deleteClient(clientId: string): Promise<{ data: null; error: AuthError | null; }>;
```
Deletes an OAuth client. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This function should only be called on a server. Never expose your `service_role` key in the browser.

### regenerateClientSecret

```text
regenerateClientSecret(clientId: string): Promise<OAuthClientResponse>;
```
Regenerates the secret for an OAuth client. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This function should only be called on a server. Never expose your `service_role` key in the browser.

## AuthOAuthServerApi

Contains all OAuth 2.1 authorization server user-facing methods. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. These methods are used to implement the consent page.

### getAuthorizationDetails

```text
getAuthorizationDetails(authorizationId: string): Promise<AuthOAuthAuthorizationDetailsResponse>;
```
Retrieves details about an OAuth authorization request. Used to display consent information to the user. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. This method returns authorization details including client info, scopes, and user information. If the response includes a redirect_uri, it means consent was already given - the caller should handle the redirect manually if needed. 

### approveAuthorization

```text
approveAuthorization(authorizationId: string, options?: { skipBrowserRedirect?: boolean; }): Promise<AuthOAuthConsentResponse>;
```
Approves an OAuth authorization request. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. 

### denyAuthorization

```text
denyAuthorization(authorizationId: string, options?: { skipBrowserRedirect?: boolean; }): Promise<AuthOAuthConsentResponse>;
```
Denies an OAuth authorization request. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth. 

## GoTrueAdminApi


### mfa

```text
mfa: GoTrueAdminMFAApi;
```
Contains all MFA administration methods.

### oauth

```text
oauth: GoTrueAdminOAuthApi;
```
Contains all OAuth client administration methods. Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.

### constructor

```text
constructor({ url, headers, fetch, }: { url: string; headers?: { [key: string]: string; }; fetch?: Fetch$1; });
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### signOut

```text
signOut(jwt: string, scope?: SignOutScope): Promise<{ data: null; error: AuthError | null; }>;
```
Removes a logged-in session. 

### inviteUserByEmail

```text
inviteUserByEmail(email: string, options?: { data?: object; redirectTo?: string; }): Promise<UserResponse>;
```
Sends an invite link to an email address. 

### generateLink

```text
generateLink(params: GenerateLinkParams): Promise<GenerateLinkResponse>;
```
Generates email links and OTPs to be sent via a custom email provider. 

### createUser

```text
createUser(attributes: AdminUserAttributes): Promise<UserResponse>;
```
Creates a new user. This function should only be called on a server. Never expose your `service_role` key in the browser.

### listUsers

```text
listUsers(params?: PageParams): Promise<{ data: { users: User[]; aud: string; } & Pagination; error: null; } | { data: { users: []; }; error: AuthError; }>;
```
Get a list of users. This function should only be called on a server. Never expose your `service_role` key in the browser. 

### getUserById

```text
getUserById(uid: string): Promise<UserResponse>;
```
Get user by id. 

### updateUserById

```text
updateUserById(uid: string, attributes: AdminUserAttributes): Promise<UserResponse>;
```
Updates the user data. 

### deleteUser

```text
deleteUser(id: string, shouldSoftDelete?: boolean): Promise<UserResponse>;
```
Delete a user. Requires a `service_role` key. 

## SupabaseClient

Supabase Client. An isomorphic Javascript client for interacting with Postgres.

### auth

```text
auth: SupabaseAuthClient;
```
Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.

### realtime

```text
realtime: RealtimeClient;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### storage

```text
storage: StorageClient;
```
Supabase Storage allows you to manage user-generated content, such as photos or videos.

### constructor

```text
constructor(supabaseUrl: string, supabaseKey: string, options?: SupabaseClientOptions<SchemaName>);
```
Create a new client for use in the browser. 

### functions

```text
get functions(): FunctionsClient;
```
Supabase Functions allows you to deploy and invoke edge functions.

### from

```text
from<TableName extends string & keyof Schema['Tables'], Table extends Schema['Tables'][TableName]>(relation: TableName): PostgrestQueryBuilder<ClientOptions, Schema, Table, TableName>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### from

```text
from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(relation: ViewName): PostgrestQueryBuilder<ClientOptions, Schema, View, ViewName>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

### schema

```text
schema<DynamicSchema extends string & keyof Omit<Database, '__InternalSupabase'>>(schema: DynamicSchema): PostgrestClient<Database, ClientOptions, DynamicSchema, Database[DynamicSchema] extends GenericSchema ? Database[DynamicSchema] : any>;
```
Select a schema to query or perform an function (rpc) call. The schema needs to be on the list of exposed schemas inside Supabase. 

### rpc

```text
rpc<FnName extends string & keyof Schema['Functions'], Args extends Schema['Functions'][FnName]['Args'] = never, FilterBuilder extends GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args> = GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args>>(fn: FnName, args?: Args, options?: { head?: boolean; get?: boolean; count?: 'exact' | 'planned' | 'estimated'; }): PostgrestFilterBuilder<ClientOptions, Schema, FilterBuilder['Row'], FilterBuilder['Result'], FilterBuilder['RelationName'], FilterBuilder['Relationships'], 'RPC'>;
```
Perform a function call. 

### channel

```text
channel(name: string, opts?: RealtimeChannelOptions): RealtimeChannel;
```
Creates a Realtime channel with Broadcast, Presence, and Postgres Changes. 

### getChannels

```text
getChannels(): RealtimeChannel[];
```
Returns all Realtime channels.

### removeChannel

```text
removeChannel(channel: RealtimeChannel): Promise<'ok' | 'timed out' | 'error'>;
```
Unsubscribes and removes Realtime channel from Realtime client. 

### removeAllChannels

```text
removeAllChannels(): Promise<('ok' | 'timed out' | 'error')[]>;
```
Unsubscribes and removes all Realtime channels from Realtime client.

## GoTrueClient


### signInWithSnapchat

```text
signInWithSnapchat(): Promise<AuthTokenResponse>;
```
Declared public surface; use the signature and selected operation contract. For engine/deployment-dependent behavior see API status and troubleshooting.

## Exported names and types

Main module export inventory (type shapes, aliases/enums and generic constraints are defined in the linked canonical declarations). This is not a list of Lens-verified flows:

`AuthAdminApi`, `AuthApiError`, `AuthClient`, `AuthError`, `AuthImplicitGrantRedirectError`, `AuthInvalidCredentialsError`, `AuthInvalidJwtError`, `AuthInvalidTokenResponseError`, `AuthPKCEGrantCodeExchangeError`, `AuthRetryableFetchError`, `AuthSessionMissingError`, `AuthUnknownError`, `AuthWeakPasswordError`, `CustomAuthError`, `FunctionRegion`, `FunctionsError`, `FunctionsFetchError`, `FunctionsHttpError`, `FunctionsRelayError`, `GoTrueAdminApi`, `GoTrueClient`, `NavigatorLockAcquireTimeoutError`, `PostgrestError`, `REALTIME_CHANNEL_STATES`, `REALTIME_LISTEN_TYPES`, `REALTIME_POSTGRES_CHANGES_LISTEN_EVENT`, `REALTIME_PRESENCE_LISTEN_EVENTS`, `REALTIME_SUBSCRIBE_STATES`, `RealtimeChannel`, `RealtimeClient`, `RealtimePresence`, `SIGN_OUT_SCOPES`, `SupabaseClient`, `WeakPasswordReasons`, `WebSocketFactory`, `createClient`, `isAuthApiError`, `isAuthError`, `isAuthImplicitGrantRedirectError`, `isAuthRetryableFetchError`, `isAuthSessionMissingError`, `isAuthWeakPasswordError`, `internals as lockInternals`, `navigatorLock`, `processLock`, `AMREntry`, `AMRMethod`, `AdminUserAttributes`, `AuthChangeEvent`, `AuthChangeEventMFA`, `AuthFlowType`, `AuthMFAAdminDeleteFactorParams`, `AuthMFAAdminDeleteFactorResponse`, `AuthMFAAdminListFactorsParams`, `AuthMFAAdminListFactorsResponse`, `AuthMFAChallengePhoneResponse`, `AuthMFAChallengeResponse`, `AuthMFAChallengeTOTPResponse`, `AuthMFAChallengeWebauthnResponse`, `AuthMFAChallengeWebauthnResponseDataJSON`, `AuthMFAChallengeWebauthnServerResponse`, `AuthMFAEnrollPhoneResponse`, `AuthMFAEnrollResponse`, `AuthMFAEnrollTOTPResponse`, `AuthMFAEnrollWebauthnResponse`, `AuthMFAGetAuthenticatorAssuranceLevelResponse`, `AuthMFAListFactorsResponse`, `AuthMFAUnenrollResponse`, `AuthMFAVerifyResponse`, `AuthMFAVerifyResponseData`, `AuthOAuthAuthorizationDetailsResponse`, `AuthOAuthConsentResponse`, `AuthOAuthServerApi`, `AuthOtpResponse`, `AuthResponse`, `AuthResponsePassword`, `Session as AuthSession`, `AuthTokenResponse`, `AuthTokenResponsePassword`, `User as AuthUser`, `AuthenticatorAssuranceLevels`, `CallRefreshTokenResult`, `CreateOAuthClientParams`, `EmailOtpType`, `EthereumWallet`, `EthereumWeb3Credentials`, `Factor`, `FactorType`, `FunctionInvokeOptions`, `GenerateEmailChangeLinkParams`, `GenerateInviteOrMagiclinkParams`, `GenerateLinkOptions`, `GenerateLinkParams`, `GenerateLinkProperties`, `GenerateLinkResponse`, `GenerateLinkType`, `GenerateRecoveryLinkParams`, `GenerateSignupLinkParams`, `GoTrueAdminMFAApi`, `GoTrueAdminOAuthApi`, `GoTrueClientOptions`, `GoTrueMFAApi`, `InitializeResult`, `JWK`, `JwtHeader`, `JwtPayload`, `LockFunc`, `MFAChallengeAndVerifyParams`, `MFAChallengeParams`, `MFAChallengePhoneParams`, `MFAChallengeTOTPParams`, `MFAChallengeWebauthnParams`, `MFAEnrollParams`, `MFAEnrollPhoneParams`, `MFAEnrollTOTPParams`, `MFAEnrollWebauthnParams`, `MFATOTPChannel`, `MFAUnenrollParams`, `MFAVerifyParams`, `MFAVerifyPhoneParams`, `MFAVerifyTOTPParams`, `MFAVerifyWebauthnParamFields`, `MFAVerifyWebauthnParams`, `MobileOtpType`, `OAuthAuthorizationClient`, `OAuthAuthorizationDetails`, `OAuthClient`, `OAuthClientGrantType`, `OAuthClientListResponse`, `OAuthClientRegistrationType`, `OAuthClientResponse`, `OAuthClientResponseType`, `OAuthClientType`, `OAuthResponse`, `PageParams`, `Pagination`, `PostgrestMaybeSingleResponse`, `PostgrestResponse`, `PostgrestSingleResponse`, `Prettify`, `Provider`, `QueryData`, `QueryError`, `QueryResult`, `RealtimeChannelOptions`, `RealtimeChannelSendResponse`, `RealtimeClientOptions`, `RealtimeMessage`, `RealtimePostgresChangesFilter`, `RealtimePostgresChangesPayload`, `RealtimePostgresDeletePayload`, `RealtimePostgresInsertPayload`, `RealtimePostgresUpdatePayload`, `RealtimePresenceJoinPayload`, `RealtimePresenceLeavePayload`, `RealtimePresenceState`, `RealtimeRemoveChannelResponse`, `RequestResult`, `RequestResultSafeDestructure`, `RequiredClaims`, `ResendParams`, `SSOResponse`, `Session`, `SignInAnonymouslyCredentials`, `SignInWithIdTokenCredentials`, `SignInWithOAuthCredentials`, `SignInWithPasswordCredentials`, `SignInWithPasswordlessCredentials`, `SignInWithSSO`, `SignOut`, `SignOutScope`, `SignUpWithPasswordCredentials`, `SolanaWallet`, `SolanaWeb3Credentials`, `StrictOmit`, `Subscription`, `SupabaseClientOptions`, `SupportedStorage`, `UpdateOAuthClientParams`, `User`, `UserAppMetadata`, `UserAttributes`, `UserIdentity`, `UserMetadata`, `UserResponse`, `VerifyEmailOtpParams`, `VerifyMobileOtpParams`, `VerifyOtpParams`, `VerifyTokenHashParams`, `WeakPassword`, `Web3Credentials`, `WebSocketLike`, `WebSocketLikeConstructor`

Error constructors/guards carry the SDK error category/message/status/code/context; use guards exported from the same module instead of assuming every error is a string. navigatorLock/processLock/lockInternals are upstream concurrency facilities, not required Lens setup APIs.
