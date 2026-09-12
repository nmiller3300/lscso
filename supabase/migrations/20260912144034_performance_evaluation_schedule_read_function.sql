create function public.performance_evaluation_schedule_count() returns integer language sql stable as $$ select count(*)::integer from public.performance_evaluation_schedules $$;
