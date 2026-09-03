"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PairingStatus = {
  connected: boolean;
  link?: {
    linkedAt?: string | null;
    lastSeenAt?: string | null;
    lastSeenGrade?: number | null;
  } | null;
};

type FiveMConnectionPanelProps = {
  continueHref?: string;
  allowSkip?: boolean;
};

export function FiveMConnectionPanel({
  continueHref,
  allowSkip = false,
}: FiveMConnectionPanelProps) {
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadStatus(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/portal/fivem-pairing", {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "FiveM connection status could not be loaded.");
      }
      setStatus({ connected: data.connected === true, link: data.link ?? null });
      if (data.connected === true) {
        setCode("");
        setExpiresAt("");
      }
    } catch (caught) {
      if (!silent) {
        setError(caught instanceof Error ? caught.message : "FiveM connection status could not be loaded.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (!code || status?.connected) return;
    const timer = window.setInterval(() => {
      void loadStatus(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [code, status?.connected]);

  async function createCode() {
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/portal/fivem-pairing", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "A pairing code could not be created.");
      }
      if (data.connected === true) {
        await loadStatus(true);
        return;
      }
      setCode(String(data.code ?? ""));
      setExpiresAt(String(data.expiresAt ?? ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A pairing code could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <section className="fivem-connect-card">
        <div className="fivem-connect-status fivem-connect-status--loading">
          Checking FiveM connection…
        </div>
      </section>
    );
  }

  if (status?.connected) {
    return (
      <section className="fivem-connect-card">
        <div className="fivem-connect-heading">
          <div>
            <span className="fivem-connect-kicker">FiveM account</span>
            <h2>Connected</h2>
            <p>Your LSCSO personnel account is linked to your FiveM character.</p>
          </div>
          <span className="fivem-connect-badge fivem-connect-badge--connected">Connected</span>
        </div>
        {status.link?.linkedAt ? (
          <small className="fivem-connect-meta">
            Linked {new Date(status.link.linkedAt).toLocaleString()}
          </small>
        ) : null}
        {continueHref ? (
          <div className="fivem-connect-actions">
            <Link className="portal-button portal-button--primary" href={continueHref}>
              Continue to portal
            </Link>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="fivem-connect-card">
      <div className="fivem-connect-heading">
        <div>
          <span className="fivem-connect-kicker">FiveM account</span>
          <h2>Connect FiveM</h2>
          <p>Link your in-game LSCSO character to this personnel account.</p>
        </div>
        <span className="fivem-connect-badge">Not connected</span>
      </div>

      {code ? (
        <div className="fivem-pairing-code-wrap">
          <span>Your pairing code</span>
          <button className="fivem-pairing-code" type="button" onClick={copyCode}>
            {code}
          </button>
          <p>
            Join the server on your LSCSO character and type{" "}
            <code>/linkfivem {code}</code>
          </p>
          {expiresAt ? (
            <small>Code expires at {new Date(expiresAt).toLocaleTimeString()}.</small>
          ) : null}
          <small>{copied ? "Code copied." : "This page will detect the connection automatically."}</small>
        </div>
      ) : (
        <p className="fivem-connect-note">
          Generate a one-time code when you are ready to connect. Nothing is required right now.
        </p>
      )}

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}

      <div className="fivem-connect-actions">
        <button
          className="portal-button portal-button--primary"
          disabled={creating}
          onClick={createCode}
          type="button"
        >
          {creating ? "Generating…" : code ? "Generate new code" : "Generate pairing code"}
        </button>
        {allowSkip && continueHref ? (
          <Link className="portal-button portal-button--secondary" href={continueHref}>
            Skip for now
          </Link>
        ) : null}
      </div>
    </section>
  );
}
