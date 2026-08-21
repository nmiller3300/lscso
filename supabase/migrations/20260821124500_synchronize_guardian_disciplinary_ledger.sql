create or replace function app_private.sync_guardian_disciplinary_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  qualifies boolean;
begin
  qualifies := new.record_type <> 'Commendation'
    and new.points_assessed > 0
    and new.status in ('Approved','Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed');

  if qualifies then
    insert into public.disciplinary_point_events(profile_id,event_type,delta,guardian_id,authorized_by,reason,effective_on)
    values(new.subject_profile_id,'Discipline',new.points_assessed,new.id,coalesce(new.approved_by,new.author_profile_id),'Guardian ' || new.record_type,coalesce(new.incident_at::date,new.created_at::date))
    on conflict (guardian_id) where guardian_id is not null
    do update set profile_id=excluded.profile_id,delta=excluded.delta,authorized_by=excluded.authorized_by,reason=excluded.reason,effective_on=excluded.effective_on;
  else
    delete from public.disciplinary_point_events where guardian_id = new.id and event_type='Discipline';
  end if;
  return new;
end; $$;

create unique index if not exists disciplinary_point_events_guardian_unique on public.disciplinary_point_events(guardian_id) where guardian_id is not null;

drop trigger if exists guardian_disciplinary_point_sync on public.guardian_records;
create trigger guardian_disciplinary_point_sync after insert or update of status,points_assessed,record_type,subject_profile_id on public.guardian_records for each row execute function app_private.sync_guardian_disciplinary_points();