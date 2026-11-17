-- Apply to a development Snap Cloud project. Provider credentials are ciphertext
-- and are inaccessible to Lens clients, including their owners.
create table public.social_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('snapchat','x','youtube','linkedin','instagram','threads','tiktok')),
 credential text not null,
 account_id text not null,
 updated_at timestamptz not null default now(),
 unique(user_id,provider)
);
create table public.social_oauth_states (
 id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,
 verifier text not null,
 expires_at timestamptz not null,
 consumed boolean not null default false
);
create table public.social_media (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 object_key text not null,
 kind text not null check (kind in ('photo','video')),
 width integer not null, height integer not null,
 duration real not null default 0,
 created_at timestamptz not null default now()
);
create table public.social_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null,
 payload jsonb not null,
 status text not null default 'queued' check (status in ('queued','processing','complete','partial','failed','unknown')),
 results jsonb not null default '[]',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,request_key)
);
alter table public.social_connections enable row level security;
alter table public.social_oauth_states enable row level security;
alter table public.social_media enable row level security;
alter table public.social_jobs enable row level security;
-- Clients may inspect their media/jobs. All writes and all token access go through
-- the authenticated proxy. Service role bypasses RLS; never embed it in a Lens.
create policy own_media_read on public.social_media for select to authenticated using (auth.uid()=user_id);
create policy own_job_read on public.social_jobs for select to authenticated using (auth.uid()=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('social-media','social-media',false,52428800,array['image/jpeg','video/mp4','audio/wav'])
 on conflict(id) do nothing;
create policy social_upload on storage.objects for insert to authenticated
 with check (bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy social_read on storage.objects for select to authenticated
 using (bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy social_delete on storage.objects for delete to authenticated
 using (bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
-- CAS claim makes multiple workers safe. Processing jobs are deliberately NOT
-- retried after a crash: a social post may have succeeded before its receipt saved.
create function public.claim_social_job() returns setof public.social_jobs
 language sql security definer set search_path=public as $$
 update public.social_jobs set status='processing',updated_at=now()
 where id=(select id from public.social_jobs where status='queued'
 order by created_at for update skip locked limit 1) returning *;
$$;
revoke all on function public.claim_social_job() from public,anon,authenticated;
grant execute on function public.claim_social_job() to service_role;
