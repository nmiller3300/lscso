"use client";

import { useEffect, useState, type FormEvent } from "react";

type PsaState = {
  message: string;
  isActive: boolean;
  updatedAt: string | null;
  updatedBy: { displayName: string; rank: string } | null;
};

const initialState: PsaState = {
  message: "",
  isActive: false,
  updatedAt: null,
  updatedBy: null,
};

export function PublicPsaControl() {
  const [psa, setPsa] = useState<PsaState>(initialState);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/portal/psa", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load the current PSA.");
        return body as PsaState;
      })
      .then((body) => {
        if (active) setPsa(body);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load the current PSA.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const message = psa.message.trim();
    setError("");
    setNotice("");
    if (!message) return setError("Enter a PSA message before saving.");

    setPending(true);
    try {
      const response = await fetch("/api/portal/psa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, isActive: psa.isActive }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The public PSA could not be updated.");
      setPsa({
        message: body.message,
        isActive: body.isActive,
        updatedAt: body.updatedAt,
        updatedBy: body.updatedBy,
      });
      setNotice(body.isActive ? "The public PSA is live on the homepage." : "The public PSA is saved and currently turned off.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The public PSA could not be updated.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <section className="portal-panel"><div className="portal-empty-state"><strong>Loading public PSA controls…</strong></div></section>;
  }

  return (
    <form onSubmit={save}>
      <div className="command-v2-workspace-grid">
        <section className="portal-panel" style={{ gridColumn: "span 2" }}>
          <div className="portal-panel-heading">
            <div><p>Public website</p><h2>PSA banner</h2></div>
            <span>{psa.isActive ? "LIVE" : "OFF"}</span>
          </div>

          <div className="portal-form-protection" style={{ marginTop: 16 }}>
            <strong>{psa.isActive ? "Banner is currently visible" : "Banner is currently hidden"}</strong>
            <span>When enabled, the red Public Safety Notice banner appears directly beneath the public-site navigation on the homepage.</span>
          </div>

          <div className="portal-form-grid" style={{ marginTop: 18 }}>
            <label style={{ gridColumn: "1 / -1" }}>
              PSA message
              <textarea
                maxLength={240}
                onChange={(event) => setPsa((current) => ({ ...current, message: event.target.value }))}
                placeholder="Enter the public safety notice"
                rows={4}
                value={psa.message}
              />
              <small className="portal-field-help">{psa.message.length}/240 characters · The banner automatically displays the Public Safety Notice label.</small>
            </label>
          </div>

          <label className="portal-checkbox-row" style={{ marginTop: 14 }}>
            <input
              checked={psa.isActive}
              onChange={(event) => setPsa((current) => ({ ...current, isActive: event.target.checked }))}
              type="checkbox"
            />
            <span><strong>Show PSA on the public homepage</strong><small>Turn this off and save to immediately remove the banner without deleting the message.</small></span>
          </label>

          {error ? <div className="portal-form-error" role="alert" style={{ marginTop: 14 }}>{error}</div> : null}
          {notice ? <div className="portal-form-protection" role="status" style={{ marginTop: 14 }}><strong>PSA updated</strong><span>{notice}</span></div> : null}

          <div className="command-v2-action-row" style={{ marginTop: 16 }}>
            <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Saving…" : "Save PSA settings"}</button>
          </div>
        </section>

        <section className="portal-panel" style={{ gridColumn: "span 2" }}>
          <div className="portal-panel-heading">
            <div><p>Preview</p><h2>Public banner</h2></div>
            <span>{psa.isActive ? "Will display" : "Currently hidden"}</span>
          </div>
          <div style={{ marginTop: 16, overflow: "hidden", borderRadius: 4, border: "1px solid #650b10", background: "linear-gradient(180deg,#c0181e,#991116)", color: "white", boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
            <div style={{ display: "flex", alignItems: "center", minHeight: 54 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "stretch", padding: "0 20px", background: "#760b0f", whiteSpace: "nowrap" }}>
                <span style={{ display: "grid", width: 24, height: 24, placeItems: "center", borderRadius: 999, background: "white", color: "#9e1116", fontWeight: 900 }}>!</span>
                <strong style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>Public Safety Notice</strong>
              </div>
              <div style={{ minWidth: 0, padding: "0 22px", fontSize: 13, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {psa.message || "Your PSA message will appear here"}
              </div>
            </div>
          </div>
          <div className="portal-form-protection" style={{ marginTop: 14 }}>
            <strong>Last Command update</strong>
            <span>
              {psa.updatedAt ? new Date(psa.updatedAt).toLocaleString() : "No recorded update"}
              {psa.updatedBy ? ` · ${psa.updatedBy.rank} ${psa.updatedBy.displayName}` : ""}
            </span>
          </div>
        </section>
      </div>
    </form>
  );
}
