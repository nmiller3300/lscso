do $migration$
declare
  v_def text;
  v_old text := $needle$v_tier not in ('Executive', 'Command')$needle$;
begin
  select pg_get_functiondef('public.get_recruitment_tracking_token(uuid)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then raise exception 'get_recruitment_tracking_token gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');
end
$migration$;
