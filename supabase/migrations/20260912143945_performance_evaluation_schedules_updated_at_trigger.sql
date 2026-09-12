create trigger performance_evaluation_schedules_updated_at before update on public.performance_evaluation_schedules for each row execute function app_private.set_updated_at();
