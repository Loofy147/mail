-- Mailroom web backend bootstrap schema.
-- Apply once in a dedicated Supabase project after reviewing the schema.
-- Do not reuse a database already holding unrelated app data without review.

create table if not exists public.mailroom_sessions (
  session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
  provider text not null check (provider in ('google')),
  provider_user_id text not null,
  user_email text not null,
  encrypted_tokens text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mailroom_sessions_expires_at_idx
  on public.mailroom_sessions (expires_at);

create table if not exists public.mailroom_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 0)
);

create table if not exists public.mailroom_send_requests (
  session_hash text not null references public.mailroom_sessions(session_hash) on delete cascade,
  request_id uuid not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  gmail_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (session_hash, request_id)
);

create index if not exists mailroom_send_requests_created_at_idx
  on public.mailroom_send_requests (created_at);

alter table public.mailroom_sessions enable row level security;
alter table public.mailroom_rate_limits enable row level security;
alter table public.mailroom_send_requests enable row level security;

revoke all on table public.mailroom_sessions from anon, authenticated;
revoke all on table public.mailroom_rate_limits from anon, authenticated;
revoke all on table public.mailroom_send_requests from anon, authenticated;
grant all on table public.mailroom_sessions to service_role;
grant all on table public.mailroom_rate_limits to service_role;
grant all on table public.mailroom_send_requests to service_role;

create or replace function public.mailroom_consume_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_limit integer
) returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare allowed boolean;
begin
  if p_bucket_key !~ '^[a-f0-9]{64}$'
     or p_window_seconds < 1 or p_window_seconds > 86400
     or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.mailroom_rate_limits(bucket_key, window_started_at, hits)
  values (p_bucket_key, clock_timestamp(), 1)
  on conflict (bucket_key) do update
    set hits = case
      when public.mailroom_rate_limits.window_started_at <=
           clock_timestamp() - make_interval(secs => p_window_seconds)
      then 1 else public.mailroom_rate_limits.hits + 1 end,
    window_started_at = case
      when public.mailroom_rate_limits.window_started_at <=
           clock_timestamp() - make_interval(secs => p_window_seconds)
      then clock_timestamp() else public.mailroom_rate_limits.window_started_at end
  returning hits <= p_limit into allowed;

  delete from public.mailroom_rate_limits
  where window_started_at < clock_timestamp() - interval '2 days';

  return allowed;
end;
$$;

revoke all on function public.mailroom_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.mailroom_consume_rate_limit(text, integer, integer) to service_role;
