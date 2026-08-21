import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() =>
  Response.json(
    { error: "LSCSO bootstrap is permanently closed." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  )
);
