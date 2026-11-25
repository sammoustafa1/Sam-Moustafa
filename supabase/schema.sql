create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  location text not null,
  status text not null check (status in ('available', 'under_contract', 'closed')),
  image_url text not null,
  description text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "Admins can verify their own access" on public.admin_users;
create policy "Admins can verify their own access"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

alter table public.properties enable row level security;
revoke all on table public.properties from anon, authenticated;
grant select on table public.properties to anon, authenticated;
grant insert, update, delete on table public.properties to authenticated;

drop policy if exists "Anyone can read published properties" on public.properties;
create policy "Anyone can read published properties"
  on public.properties for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Admins can read all properties" on public.properties;
create policy "Admins can read all properties"
  on public.properties for select
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can add properties" on public.properties;
create policy "Admins can add properties"
  on public.properties for insert
  to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can edit properties" on public.properties;
create policy "Admins can edit properties"
  on public.properties for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
  on public.properties for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

insert into public.properties (slug, title, location, status, image_url, description)
values
  ('4902-cherry-st', '4902 Cherry St', 'Forsyth, NC 27105', 'under_contract', 'imeges/WhatsApp Image 2026-10-12 at 11.42.48 AM.jpeg', 'Home shown under contract in the supplied marketing photo.'),
  ('3401-argyle-lane', '3401 Argyle Lane', 'Greensboro, NC 27406', 'under_contract', 'imeges/WhatsApp Image 2026-10-12 at 11.42.49 AM.jpeg', 'Home shown under contract in the supplied marketing photo.'),
  ('271-curry-rd', '271 Curry Rd', 'High Point, NC', 'closed', 'imeges/WhatsApp Image 2026-10-12 at 11.55.20 AM.jpeg', 'Buyer representation shown as closed in the supplied marketing photo.')
on conflict (slug) do nothing;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  email text not null check (
    char_length(email) <= 254
    and email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$'
  ),
  phone text check (phone is null or char_length(phone) <= 30),
  interest text check (interest is null or interest in ('buy', 'sell', 'other')),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.leads add column if not exists is_read boolean not null default false;

revoke all on table public.leads from anon, authenticated;
grant insert on table public.leads to anon;
grant insert, select, update, delete on table public.leads to authenticated;

drop policy if exists "Visitors can submit contact requests" on public.leads;
create policy "Visitors can submit contact requests"
  on public.leads for insert
  to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 100
    and char_length(email) <= 254
    and email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$'
    and (phone is null or char_length(phone) <= 30)
    and (interest is null or interest in ('buy', 'sell', 'other'))
    and (message is null or char_length(message) <= 2000)
  );

drop policy if exists "Admins can read leads" on public.leads;
create policy "Admins can read leads"
  on public.leads for select
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can update leads" on public.leads;
create policy "Admins can update leads"
  on public.leads for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can delete leads" on public.leads;
create policy "Admins can delete leads"
  on public.leads for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Admins can view property images" on storage.objects;
create policy "Admins can view property images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );

drop policy if exists "Admins can upload property images" on storage.objects;
create policy "Admins can upload property images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );

drop policy if exists "Admins can update property images" on storage.objects;
create policy "Admins can update property images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  )
  with check (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );

drop policy if exists "Admins can delete property images" on storage.objects;
create policy "Admins can delete property images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = auth.uid())
  );
