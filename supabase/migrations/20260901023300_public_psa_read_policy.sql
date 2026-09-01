grant select on table public.site_psa to anon, authenticated;

drop policy if exists "Public can read homepage PSA" on public.site_psa;
create policy "Public can read homepage PSA"
on public.site_psa
for select
to anon, authenticated
using (id = 'homepage');
