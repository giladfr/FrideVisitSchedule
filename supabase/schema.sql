create extension if not exists pgcrypto;

create table if not exists public.visit_app_config (
  id integer primary key default 1 check (id = 1),
  admin_password_hash text not null
);

insert into public.visit_app_config (id, admin_password_hash)
values (1, 'b982366ca565020785d939084eb317f7573fad9b1207e572403dd75b5802302c')
on conflict (id) do update
set admin_password_hash = excluded.admin_password_hash;

create table if not exists public.visit_events (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  event_date date not null,
  segment text not null check (segment in ('morning', 'noon', 'evening', 'night')),
  attendees text[] not null default '{}',
  location text not null,
  notes text null,
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  created_by_role text not null default 'admin' check (created_by_role in ('admin', 'guest')),
  suggested_by_name text null,
  suggested_by_person text null check (
    suggested_by_person is null or suggested_by_person in ('gilad', 'yaara', 'kids')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.request_headers()
returns jsonb
language sql
stable
as $$
  select coalesce(current_setting('request.headers', true), '{}')::jsonb;
$$;

create or replace function public.request_header(name text)
returns text
language sql
stable
as $$
  select coalesce(public.request_headers() ->> lower(name), '');
$$;

create or replace function public.is_admin_request()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.visit_app_config
    where admin_password_hash = encode(
      digest('fride-visit:' || public.request_header('x-admin-password'), 'sha256'),
      'hex'
    )
  );
$$;

create or replace function public.handle_visit_event_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists visit_events_set_updated_at on public.visit_events;
create trigger visit_events_set_updated_at
before update on public.visit_events
for each row
execute function public.handle_visit_event_updated_at();

alter table public.visit_events enable row level security;
alter table public.visit_app_config enable row level security;

drop policy if exists "visit events public read" on public.visit_events;
create policy "visit events public read"
on public.visit_events
for select
using (
  status = 'approved'
  or public.is_admin_request()
  or (
    status = 'pending'
    and lower(coalesce(suggested_by_name, '')) = lower(public.request_header('x-suggester-name'))
  )
);

drop policy if exists "visit events public suggestion insert" on public.visit_events;
create policy "visit events public suggestion insert"
on public.visit_events
for insert
with check (
  (
    status = 'pending'
    and created_by_role = 'guest'
    and coalesce(suggested_by_name, '') <> ''
    and suggested_by_person in ('gilad', 'yaara', 'kids')
  )
  or public.is_admin_request()
);

drop policy if exists "visit events admin update" on public.visit_events;
create policy "visit events admin update"
on public.visit_events
for update
using (public.is_admin_request())
with check (public.is_admin_request());

drop policy if exists "visit events admin delete" on public.visit_events;
create policy "visit events admin delete"
on public.visit_events
for delete
using (public.is_admin_request());

drop policy if exists "visit config admin read" on public.visit_app_config;
create policy "visit config admin read"
on public.visit_app_config
for select
using (public.is_admin_request());
