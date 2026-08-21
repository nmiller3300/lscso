import type { Tables } from "./database.types";

export type PortalProfile = Pick<
  Tables<"personnel_profiles">,
  | "id"
  | "auth_user_id"
  | "personnel_id"
  | "username"
  | "display_name"
  | "greeting_name"
  | "rank"
  | "access_tier"
  | "call_sign"
  | "division"
  | "supervisor_label"
  | "status"
  | "is_test_account"
  | "credentials_assigned"
>;
