import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = "BEAt_Q-eKw8MMnCkl-I8X2ikUm_lCAOrWGpab1jzY3nrfJEOkvnkjPEepDcVfOIvsEEUhTImb3AYtQosUJL8xc4";
const VAPID_SUBJECT = "https://lscsogov.vercel.app";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Push service unavailable" }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: secretRows, error: secretError } = await supabase.rpc("browser_push_delivery_secrets");
  const secrets = Array.isArray(secretRows) ? secretRows[0] : secretRows;
  if (secretError || !secrets?.vapid_private_key || !secrets?.webhook_secret) {
    return json({ error: "Push delivery configuration unavailable" }, 503);
  }

  const suppliedSecret = req.headers.get("x-lscso-push-secret");
  if (!suppliedSecret || suppliedSecret !== secrets.webhook_secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let notificationId = "";
  try {
    const body = await req.json();
    notificationId = typeof body?.notification_id === "string" ? body.notification_id : "";
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!notificationId) return json({ error: "notification_id is required" }, 400);

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .select("id,recipient_profile_id,notification_type,title,message,href,created_at")
    .eq("id", notificationId)
    .maybeSingle();

  if (notificationError || !notification) return json({ error: "Notification not found" }, 404);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("browser_push_subscriptions")
    .select("id,endpoint,p256dh,auth,failure_count")
    .eq("profile_id", notification.recipient_profile_id)
    .eq("enabled", true);

  if (subscriptionsError) return json({ error: "Subscriptions unavailable" }, 500);
  if (!subscriptions?.length) return json({ delivered: 0, stale: 0, failed: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, secrets.vapid_private_key);

  const payload = JSON.stringify({
    title: notification.title || "LSCSO Notification",
    body: notification.message || "A new LSCSO portal notification is available.",
    url: notification.href || "/portal/notifications",
    tag: `lscso-${notification.id}`,
    notificationType: notification.notification_type,
  });

  let delivered = 0;
  let stale = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { TTL: 3600, urgency: "high" },
      );

      delivered += 1;
      await supabase.from("browser_push_subscriptions").update({
        last_success_at: new Date().toISOString(),
        failure_count: 0,
        updated_at: new Date().toISOString(),
      }).eq("id", subscription.id);
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        stale += 1;
        await supabase.from("browser_push_subscriptions").delete().eq("id", subscription.id);
      } else {
        failed += 1;
        const nextFailures = Number(subscription.failure_count ?? 0) + 1;
        await supabase.from("browser_push_subscriptions").update({
          last_failure_at: new Date().toISOString(),
          failure_count: nextFailures,
          enabled: nextFailures < 5,
          updated_at: new Date().toISOString(),
        }).eq("id", subscription.id);
      }
    }
  }

  return json({ delivered, stale, failed });
});
