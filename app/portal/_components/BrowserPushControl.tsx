"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./BrowserPushControl.module.css";

const VAPID_PUBLIC_KEY = "BEAt_Q-eKw8MMnCkl-I8X2ikUm_lCAOrWGpab1jzY3nrfJEOkvnkjPEepDcVfOIvsEEUhTImb3AYtQosUJL8xc4";

type PushState = "checking" | "unsupported" | "blocked" | "disabled" | "enabled";

function applicationServerKey() {
  const padding = "=".repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
  const base64 = (VAPID_PUBLIC_KEY + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

async function getRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

export function BrowserPushControl() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }

      try {
        const registration = await getRegistration();
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          if (!cancelled) setState("disabled");
          return;
        }

        const supabase = createClient() as any;
        const { data } = await supabase
          .from("browser_push_subscriptions")
          .select("enabled")
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        if (!cancelled) setState(data?.enabled ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setState("disabled");
      }
    }

    void check();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setBusy(true);
    setNotice("");
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "disabled");
        setNotice("Permission not granted.");
        return;
      }

      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() });
      const serialized = subscription.toJSON();
      const p256dh = serialized.keys?.p256dh;
      const auth = serialized.keys?.auth;
      if (!p256dh || !auth) throw new Error("Push keys unavailable.");

      const supabase = createClient() as any;
      const { error } = await supabase.rpc("register_browser_push_subscription", {
        push_endpoint: subscription.endpoint,
        push_p256dh: p256dh,
        push_auth: auth,
        push_user_agent: navigator.userAgent,
      });
      if (error) throw error;

      setState("enabled");
      setNotice("Alerts enabled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not enable alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNotice("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const supabase = createClient() as any;
        const { error } = await supabase.rpc("unregister_browser_push_subscription", { push_endpoint: subscription.endpoint });
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setState("disabled");
      setNotice("Alerts disabled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not disable alerts.");
    } finally {
      setBusy(false);
    }
  }

  const isEnabled = state === "enabled";

  return (
    <section className={styles.panel} aria-label="Browser notification settings">
      <div className={styles.copy}>
        <small>Device alerts</small>
        <strong>Browser notifications</strong>
      </div>
      {state === "unsupported" ? <span className={styles.unsupported}>Not supported on this browser</span> : (
        <div className={styles.actions}>
          <span className={`${styles.status} ${isEnabled ? styles.statusOn : ""}`}>{state === "checking" ? "Checking" : state === "blocked" ? "Blocked" : isEnabled ? "Enabled" : "Off"}</span>
          {isEnabled ? (
            <button className={`${styles.button} ${styles.buttonOff}`} disabled={busy} onClick={() => void disable()} type="button">{busy ? "Updating…" : "Turn Off"}</button>
          ) : (
            <button className={styles.button} disabled={busy || state === "checking" || state === "blocked"} onClick={() => void enable()} type="button">{busy ? "Enabling…" : state === "blocked" ? "Blocked" : "Enable"}</button>
          )}
        </div>
      )}
      {state === "blocked" ? <p className={styles.notice}>Allow notifications in browser settings.</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </section>
  );
}
