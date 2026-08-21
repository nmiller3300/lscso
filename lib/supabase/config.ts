export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ksumxsdoaporjadqlpze.supabase.co";

// Supabase publishable keys are intentionally safe for browser use. Row-level security
// remains the authority for every record; privileged keys never ship with this app.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_P1lUNw8ate2HQ_ExJla2Zw_nBNS_HO-";
