-- Final release hardening for the public Miller–White archive.
-- Public visitors read through this RPC instead of selecting the archive table directly.

update public.current_administration_archive
set public_body = '{}'::text[]
where release_status = 'Sealed'
  and cardinality(public_body) > 0;

alter table public.current_administration_archive
  drop constraint if exists current_administration_archive_sealed_public_body_empty;

alter table public.current_administration_archive
  add constraint current_administration_archive_sealed_public_body_empty
  check (release_status <> 'Sealed' or cardinality(public_body) = 0);

create or replace function public.get_public_current_administration_archive()
returns table (
  id uuid,
  administration text,
  record_owner text,
  folder text,
  document_code text,
  title text,
  date_label text,
  release_status text,
  status text,
  stamp text,
  summary text,
  public_body text[],
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.administration,
    a.record_owner,
    a.folder,
    a.document_code,
    a.title,
    a.date_label,
    a.release_status,
    a.status,
    a.stamp,
    case
      when a.release_status = 'Sealed' then 'Record existence acknowledged. Contents remain sealed.'
      else a.summary
    end,
    case
      when a.release_status = 'Sealed' then array[]::text[]
      else a.public_body
    end,
    a.published_at,
    a.created_at,
    a.updated_at
  from public.current_administration_archive a
  where a.release_status in ('Public', 'Partially Released', 'Sealed')
  order by coalesce(a.published_at, a.created_at) desc, a.created_at desc;
$$;

revoke all on function public.get_public_current_administration_archive() from public;
grant execute on function public.get_public_current_administration_archive() to anon, authenticated;

-- Stop direct public reads of archive rows. Authenticated users retain only the
-- id visibility needed by scoped update/delete filters; executive editor reads
-- use the server-side admin client after a Sheriff/Undersheriff authority check.
revoke select on table public.current_administration_archive from anon, authenticated;
grant select (id) on table public.current_administration_archive to authenticated;
