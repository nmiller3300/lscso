create unique index if not exists fivem_identity_links_one_active_profile_idx
  on public.fivem_identity_links (personnel_profile_id)
  where active = true;
