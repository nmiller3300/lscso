create table if not exists public.current_administration_archive (
  id uuid primary key default gen_random_uuid(),
  administration text not null default 'miller-white' check (administration = 'miller-white'),
  record_owner text not null default 'Administration' check (record_owner in ('Administration','Sheriff','Undersheriff')),
  folder text not null check (folder in ('Leadership','Criminal Organizations','Operations','Cold Cases','Internal Affairs','Achievements','Correspondence','Photos & Artifacts')),
  document_code text not null unique,
  title text not null,
  date_label text not null,
  release_status text not null default 'Draft' check (release_status in ('Draft','Internal','Public','Partially Released','Sealed')),
  status text,
  stamp text,
  summary text not null default '',
  public_body text[] not null default '{}',
  internal_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.current_administration_archive enable row level security;
revoke all on public.current_administration_archive from anon, authenticated;

create index if not exists current_administration_archive_release_idx on public.current_administration_archive (release_status, created_at desc);
create index if not exists current_administration_archive_folder_idx on public.current_administration_archive (folder, created_at desc);

create or replace function public.can_manage_current_administration_archive()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.personnel_profiles p
    where p.auth_user_id = auth.uid()
      and p.rank in ('Sheriff','Undersheriff')
      and p.status in ('Active','Acting')
  );
$$;

revoke all on function public.can_manage_current_administration_archive() from public;
grant execute on function public.can_manage_current_administration_archive() to authenticated;

grant select (id, record_owner, folder, document_code, title, date_label, release_status, status, stamp, summary, public_body, published_at) on public.current_administration_archive to anon;
grant select, insert, update, delete on public.current_administration_archive to authenticated;

create policy "public released archive read"
on public.current_administration_archive
for select
to anon
using (release_status in ('Public','Partially Released','Sealed'));

create policy "executive archive read"
on public.current_administration_archive
for select
to authenticated
using (public.can_manage_current_administration_archive());

create policy "executive archive insert"
on public.current_administration_archive
for insert
to authenticated
with check (public.can_manage_current_administration_archive());

create policy "executive archive update"
on public.current_administration_archive
for update
to authenticated
using (public.can_manage_current_administration_archive())
with check (public.can_manage_current_administration_archive());

create policy "executive archive delete"
on public.current_administration_archive
for delete
to authenticated
using (public.can_manage_current_administration_archive());