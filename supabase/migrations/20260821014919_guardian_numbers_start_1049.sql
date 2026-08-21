select setval(pg_get_serial_sequence('public.guardian_records', 'guardian_number'), 1048, true);
