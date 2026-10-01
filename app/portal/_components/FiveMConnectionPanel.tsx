"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PairingStatus = {
  connected: boolean;
  link?: {
    citizenId?: string | null;
    linkedAt?: string | null;
    lastSeenAt?: string | null;
    lastSeenGrade?: number | null;
  } | null;
};

type FiveMConnectionPanelProps = {
  continueHref?: string;
  allowSkip?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return "Not yet verified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatGrade(value?: number | null) {
  return Number.isInteger(value) ? `Grade ${value}` : "Awaiting verification";
}

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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [clock, setClock] = useState(Date.now());

  const secondsRemaining = useMemo(() => {
    if (!expiresAt) return null;
    return Math.max(0, Math.ceil((Date.parse(expiresAt) - clock) / 1000));
  }, [expiresAt, clock]);

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
      if (!silent) setError("");
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
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!code || status?.connected || secondsRemaining === 0) return;
    const timer = window.setInterval(() => {
      void loadStatus(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [code, status?.connected, secondsRemaining]);

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
      setClock(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A pairing code could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function disconnect() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/portal/fivem-pairing", { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Could not disconnect this character.");
      }
      setConfirmDisconnect(false);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disconnect this character.");
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
      <section className="fivem-connect-card fivem-connect-card--loading" aria-live="polite">
        <span className="fivem-connect-spinner" aria-hidden="true" />
        <div>
          <strong>Checking your FiveM connection</strong>
          <p>Verifying the character linked to this personnel account.</p>
        </div>
      </section>
    );
  }

  if (status?.connected) {
    return (
      <section className="fivem-connect-card">
        <div className="fivem-connect-heading">
          <div>
            <span className="fivem-connect-kicker">FiveM setup</span>
            <h2>Character connected</h2>
            <p>
              This personnel account is linked to your FiveM identity and can be used by LSCSO in-game services, including AEGIS.
            </p>
          </div>
          <span className="fivem-connect-badge fivem-connect-badge--connected">
            <span aria-hidden="true" /> Connected
          </span>
        </div>

        <div className="fivem-connect-summary" aria-label="FiveM connection details">
          <div>
            <span>Character ID</span>
            <strong>{status.link?.citizenId || "Linked"}</strong>
          </div>
          <div>
            <span>Framework rank</span>
            <strong>{formatGrade(status.link?.lastSeenGrade)}</strong>
          </div>
          <div>
            <span>Last verified in game</span>
            <strong>{formatDate(status.link?.lastSeenAt)}</strong>
          </div>
          <div>
            <span>Connected to portal</span>
            <strong>{formatDate(status.link?.linkedAt)}</strong>
          </div>
        </div>

        <div className="fivem-connect-ready">
          <span className="fivem-connect-ready__mark" aria-hidden="true">✓</span>
          <div>
            <strong>AEGIS identity ready</strong>
            <p>
              AEGIS can verify this character against your active LSCSO personnel record without asking for your portal password in game.
            </p>
          </div>
        </div>

        {error ? <div className="portal-form-error" role="alert">{error}</div> : null}

        {confirmDisconnect ? (
          <div className="fivem-disconnect-confirm">
            <div>
              <strong>Disconnect this character?</strong>
              <p>In-game access that depends on this link will stop until a character is paired again.</p>
            </div>
            <div className="fivem-connect-actions">
              <button className="portal-button portal-button--primary" disabled={creating} onClick={disconnect} type="button">
                {creating ? "Disconnecting…" : "Confirm disconnect"}
              </button>
              <button className="portal-button portal-button--secondary" disabled={creating} onClick={() => setConfirmDisconnect(false)} type="button">
                Keep connection
              </button>
            </div>
          </div>
        ) : (
          <div className="fivem-connect-actions fivem-connect-actions--split">
            <button className="portal-button portal-button--secondary" onClick={() => setConfirmDisconnect(true)} type="button">
              Disconnect character
            </button>
            <button className="portal-button portal-button--secondary" onClick={() => void loadStatus()} type="button">
              Refresh status
            </button>
          </div>
        )}

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
          <span className="fivem-connect-kicker">FiveM setup</span>
          <h2>Connect your LSCSO character</h2>
          <p>
            Pair the FiveM character you use for LSCSO with this personnel account. This link is what AEGIS and other approved in-game services use to identify you.
          </p>
        </div>
        <span className="fivem-connect-badge">Not connected</span>
      </div>

      <div className="fivem-setup-steps">
        <div className={code ? "is-complete" : "is-current"}>
          <span className="fivem-step-number">1</span>
          <div>
            <strong>Generate a pairing code</strong>
            <p>Create a temporary six-digit code from this page. Codes expire after 10 minutes.</p>
          </div>
        </div>
        <div className={code ? "is-current" : undefined}>
          <span className="fivem-step-number">2</span>
          <div>
            <strong>Enter it in FiveM</strong>
            <p>On your LSCSO character, open the LSCSO app in LB Phone or use the command shown below.</p>
          </div>
        </div>
        <div>
          <span className="fivem-step-number">3</span>
          <div>
            <strong>Connection confirms automatically</strong>
            <p>Keep this page open. Once the character is paired, the status above updates on its own.</p>
          </div>
        </div>
      </div>

      {code ? (
        <div className="fivem-pairing-code-wrap" aria-live="polite">
          <span>One-time pairing code</span>
          <button className="fivem-pairing-code" type="button" onClick={copyCode} title="Copy pairing code">
            {code}
          </button>
          <p className="fivem-pairing-command">
            In FiveM: <code>/fivemlink {code}</code>
          </p>
          <div className="fivem-pairing-code-footer">
            <small>{copied ? "Copied to clipboard" : "Click the code to copy it"}</small>
            <small className={secondsRemaining === 0 ? "is-expired" : undefined}>
              {secondsRemaining === 0 ? "Code expired" : `Expires in ${secondsRemaining ?? "—"}s`}
            </small>
          </div>
        </div>
      ) : (
        <div className="fivem-connect-note">
          <strong>No portal password is sent to FiveM.</strong>
          <span>The pairing code only links your active LSCSO character to this personnel account.</span>
        </div>
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
