"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "./client";

export type SheriffCredentialActivity = {
  profile_id: string;
  personnel_id: string;
  display_name: string;
  username: string | null;
  call_sign: string | null;
  rank: string;
  status: string;
  credentials_assigned: boolean;
  last_sign_in_at: string | null;
  last_credential_event: string | null;
  last_credential_at: string | null;
};

type SheriffAccountTestResponse = {
  success?: boolean;
  error?: string;
  action_link?: string;
  accounts?: SheriffCredentialActivity[];
  target?: {
    profile_id: string;
    personnel_id: string;
    display_name: string;
    username: string;
    call_sign: string | null;
    rank: string;
  };
};

async function readFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as { error?: unknown; message?: unknown };
      const detail = payload.error ?? payload.message;
      if (typeof detail === "string" && detail.trim()) return detail;
    } catch {
      // Fall through to SDK error text.
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return "The Sheriff account testing service could not complete this request.";
}

export async function invokeSheriffAccountTest(body: Record<string, unknown>) {
  const supabase = createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Your Sheriff session has expired. Sign in again and retry.");
  }

  async function invoke(accessToken: string) {
    return supabase.functions.invoke<SheriffAccountTestResponse>("sheriff-account-test", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  let result = await invoke(sessionData.session.access_token);
  if (result.error instanceof FunctionsHttpError && result.error.context.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error("Your Sheriff session has expired. Sign out, sign back in, and retry.");
    }
    result = await invoke(refreshed.session.access_token);
  }

  if (result.error) throw new Error(await readFunctionError(result.error));
  if (result.data?.error) throw new Error(result.data.error);
  return result.data ?? {};
}
