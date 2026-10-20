-- Emergency repair: personnel account creation via service_role previously failed
-- with "permission denied for schema app_private".
-- The rank access synchronization trigger called app_private.rank_access_tier()
-- as SECURITY INVOKER. Service role must not be granted general access to
-- the private schema; instead execute this deterministic trigger as its
-- trusted postgres owner with search_path restricted to ''.
alter function app_private.sync_personnel_access_tier_from_rank() security definer;
