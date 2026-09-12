create index if not exists open_records_request_events_actor_idx
  on public.open_records_request_events (actor_profile_id)
  where actor_profile_id is not null;

create index if not exists open_records_request_files_uploaded_by_idx
  on public.open_records_request_files (uploaded_by)
  where uploaded_by is not null;

create index if not exists open_records_requests_fee_assessed_by_idx
  on public.open_records_requests (fee_assessed_by)
  where fee_assessed_by is not null;

create index if not exists open_records_requests_payment_confirmed_by_idx
  on public.open_records_requests (payment_confirmed_by)
  where payment_confirmed_by is not null;

create index if not exists open_records_requests_released_by_idx
  on public.open_records_requests (released_by)
  where released_by is not null;
