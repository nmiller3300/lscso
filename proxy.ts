import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

type MaintenanceRow = {
  scope: "public_site" | "personnel_portal";
  effective_mode: "operational" | "scheduled" | "maintenance";
};

function maintenanceClient(request: NextRequest) {
  return createServerClient<any>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
}

async function maintenanceStates(request: NextRequest): Promise<MaintenanceRow[]> {
  try {
    const { data } = await maintenanceClient(request).rpc("get_public_maintenance_state");
    return data ?? [];
  } catch {
    return [];
  }
}

async function hasExecutiveBypass(request: NextRequest) {
  try {
    const supabase = maintenanceClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;
    const { data: profile } = await supabase
      .from("personnel_profiles")
      .select("access_tier,status")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    return profile?.access_tier === "Executive" &&
      ["Active", "Acting"].includes(profile.status);
  } catch {
    return false;
  }
}

async function mustChangePassword(request: NextRequest) {
  try {
    const supabase = maintenanceClient(request);
    const { data: userData } = await supabase.auth.getUser();
    return userData.user?.user_metadata?.must_change_password === true;
  } catch {
    return false;
  }
}

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const portal = pathname.startsWith("/portal");
  const maintenanceRoute =
    pathname === "/maintenance" ||
    pathname === "/portal/maintenance" ||
    pathname === "/portal/maintenance-access";

  const sessionResponse = portal
    ? await updateSession(request)
    : NextResponse.next({ request });

  if (maintenanceRoute) return sessionResponse;

  const states = await maintenanceStates(request);
  const scope = portal ? "personnel_portal" : "public_site";
  const maintenanceActive =
    states.find((item) => item.scope === scope)?.effective_mode === "maintenance";

  if (maintenanceActive) {
    if (portal && await hasExecutiveBypass(request)) return sessionResponse;
    const url = request.nextUrl.clone();
    url.pathname = portal ? "/portal/maintenance" : "/maintenance";
    url.search = "";
    return copyCookies(sessionResponse, NextResponse.redirect(url));
  }

  const onboardingRoute = pathname === "/portal/onboarding";
  const portalEntry = pathname === "/portal";
  if (
    portal &&
    !portalEntry &&
    !onboardingRoute &&
    await mustChangePassword(request)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/onboarding";
    url.search = "";
    return copyCookies(sessionResponse, NextResponse.redirect(url));
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|images|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
