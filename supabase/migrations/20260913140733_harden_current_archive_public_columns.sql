revoke select on table public.current_administration_archive from anon;
grant select (id, administration, record_owner, folder, document_code, title, date_label, release_status, status, stamp, summary, public_body, published_at, created_at, updated_at) on table public.current_administration_archive to anon;
grant select, insert, update, delete on table public.current_administration_archive to authenticated;
