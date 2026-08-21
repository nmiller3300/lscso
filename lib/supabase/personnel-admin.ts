"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "./client";

type PersonnelAdminResponse = Record<string, unknown> & {
  error?: string;
  success?: boolean;
};

async function readFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as { error?: unknown; message?: unknown };
      const detail = payload.error ?? payload.message;
      if (typeof detail === "string" && detail.trim()) return detail;
    } catch {
      // Fall through to the SDK message when the response is not JSON.
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return "The secure personnel service could not complete this request.";
}

export async function invokePersonnelAdmin(body: Record<string, unknown>) {
  const supabase = createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Your secure session has expired. Sign in again and retry.");
  }

  async function invoke(accessToken: string) {
    return supabase.functions.invoke<PersonnelAdminResponse>("personnel-admin", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  let result = await invoke(sessionData.session.access_token);

  if (result.error instanceof FunctionsHttpError && result.error.context.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error("Your secure session has expired. Sign out, sign back in, and retry.");
    }
    result = await invoke(refreshed.session.access_token);
  }

  if (result.error) throw new Error(await readFunctionError(result.error));
  if (result.data?.error) throw new Error(String(result.data.error));
  return result.data ?? {};
}
