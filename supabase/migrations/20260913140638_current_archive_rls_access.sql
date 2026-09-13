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
