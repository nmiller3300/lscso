drop trigger if exists current_administration_archive_audit on public.current_administration_archive;
create trigger current_administration_archive_audit
after insert or update or delete on public.current_administration_archive
for each row execute function app_private.write_audit_log();
