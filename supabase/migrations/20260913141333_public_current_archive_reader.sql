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
    a.summary,
    a.public_body,
    a.published_at,
    a.created_at,
    a.updated_at
  from public.current_administration_archive a
  where a.release_status in ('Public', 'Partially Released', 'Sealed')
  order by coalesce(a.published_at, a.created_at) desc, a.created_at desc;
$$;

revoke all on function public.get_public_current_administration_archive() from public;
grant execute on function public.get_public_current_administration_archive() to anon, authenticated;
