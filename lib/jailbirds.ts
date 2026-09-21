import { createAdminClient } from "./supabase/admin";

export const JAILBIRDS_BUCKET = "jailbirds";
export const JAILBIRDS_RETENTION_HOURS = 72;

export type JailbirdRecord = {
  id: string;
  full_name: string;
  booking_number: string | null;
  charges: string | null;
  arrested_at: string;
  image_path: string;
  created_at: string;
  expires_at: string;
};

async function signJailbirdImage(imagePath: string) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.storage
    .from(JAILBIRDS_BUCKET)
    .createSignedUrl(imagePath, 60 * 60);

  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function getActiveJailbirds(limit = 60) {
  const admin = createAdminClient() as any;
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("jailbirds")
    .select("id,full_name,booking_number,charges,arrested_at,image_path,created_at,expires_at")
    .gt("expires_at", now)
    .order("arrested_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const records = (data ?? []) as JailbirdRecord[];
  if (!records.length) return [];

  const { data: signed, error: signedError } = await admin.storage
    .from(JAILBIRDS_BUCKET)
    .createSignedUrls(records.map((record) => record.image_path), 60 * 60);

  if (signedError) throw signedError;

  return records.map((record, index) => ({
    ...record,
    imageUrl: signed?.[index]?.signedUrl ?? null,
  }));
}

export async function getActiveJailbirdById(id: string) {
  const admin = createAdminClient() as any;
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("jailbirds")
    .select("id,full_name,booking_number,charges,arrested_at,image_path,created_at,expires_at")
    .eq("id", id)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const record = data as JailbirdRecord;
  return {
    ...record,
    imageUrl: await signJailbirdImage(record.image_path),
  };
}

export async function purgeExpiredJailbirds() {
  const admin = createAdminClient() as any;
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("jailbirds")
    .select("id,image_path")
    .lte("expires_at", now)
    .limit(500);

  if (error) throw error;

  const expired = (data ?? []) as Array<{ id: string; image_path: string }>;
  if (!expired.length) return { deleted: 0 };

  const paths = expired.map((row) => row.image_path);
  const ids = expired.map((row) => row.id);

  const { error: storageError } = await admin.storage
    .from(JAILBIRDS_BUCKET)
    .remove(paths);

  if (storageError) throw storageError;

  const { error: deleteError } = await admin
    .from("jailbirds")
    .delete()
    .in("id", ids);

  if (deleteError) throw deleteError;

  return { deleted: expired.length };
}
