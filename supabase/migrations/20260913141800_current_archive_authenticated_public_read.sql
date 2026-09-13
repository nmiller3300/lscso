revoke select on public.current_administration_archive from authenticated;
grant select (id, record_owner, folder, document_code, title, date_label, release_status, status, stamp, summary, public_body, created_at, updated_at, published_at) on public.current_administration_archive to authenticated;

create policy "authenticated released archive read"
on public.current_administration_archive
for select
to authenticated
using (release_status in ('Public','Partially Released','Sealed'));