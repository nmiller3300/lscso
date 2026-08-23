"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UnitOption = {
  id: string;
  name: string;
  unitType: string;
};

type DelegationItem = {
  id: string;
  delegationType: string;
  unitId: string | null;
  unitName: string | null;
  expiresAt: string | null;
  reason: string | null;
};

type Props = {
  profileId: string;
  displayName: string;
  canGrantTemporaryCommand: boolean;
  units: UnitOption[];
  delegations: DelegationItem[];
};

const baseDelegations = [
  "Personnel Administration",
  "Training Administration",
  "Division Administration",
] as const;

const delegationDescriptions: Record<string, string> = {
  "Personnel Administration": "Manage normal personnel records and organizational assignments without receiving protected account-deactivation authority.",
  "Training Administration": "Manage FTO qualifications, trainee assignments, training progress, and department certifications.",
  "Division Administration": "Manage personnel assignments inside one selected organizational area without receiving department-wide authority.",
  "Temporary Command Authority": "Time-limited executive delegation for assignments, training, certifications, and personnel changes for 1st Lieutenant and below. It does not grant account deactivation authority.",
};

export function PersonnelDelegationManager({
  profileId,
  displayName,
  canGrantTemporaryCommand,
  units,
  delegations,
}: Props) {
  const router = useRouter();
  const [delegationType, setDelegationType] = useState<string>(baseDelegations[0]);
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const delegationOptions = canGrantTemporaryCommand
    ? [...baseDelegations, "Temporary Command Authority"]
    : [...baseDelegations];

  async function grant() {
    if (pending) return;
    if (reason.trim().length < 4) {
      setError("Enter a short reason for the delegation.");
      return;
    }
    if (delegationType === "Division Administration" && !unitId) {
      setError("Choose the organizational area this delegation applies to.");
      return;
    }
    if (delegationType === "Temporary Command Authority" && !expiresAt) {
      setError("Temporary Command Authority requires an expiration.");
      return;
    }

    setPending("grant");
    setError("");
    setNotice("");
    const { error: rpcError } = await (createClient() as any).rpc("grant_personnel_delegation", {
      p_profile_id: profileId,
      p_delegation_type: delegationType,
      p_organizational_unit_id: delegationType === "Division Administration" ? unitId : null,
      p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      p_reason: reason.trim(),
    });
    setPending("");

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setReason("");
    setExpiresAt("");
    setNotice(`${delegationType} assigned to ${displayName}. Roster access updates automatically.`);
    router.refresh();
  }

  async function revoke(delegationId: string, delegationName: string) {
    if (pending) return;
    setPending(delegationId);
    setError("");
    setNotice("");
    const { error: rpcError } = await (createClient() as any).rpc("revoke_personnel_delegation", {
      p_delegation_id: delegationId,
      p_reason: "Revoked from Command Portal personnel administration",
    });
    setPending("");

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(`${delegationName} revoked from ${displayName}.`);
    router.refresh();
  }

  return (
    <section className="portal-panel">
      <div className="portal-panel-heading">
        <div>
          <p>Delegated authority</p>
          <h2>Administrative responsibility</h2>
        </div>
        <span>{delegations.length} active</span>
      </div>

      <p className="command-v2-compact-copy">
        Pick the responsibility they are being trusted to handle. The system applies the underlying permissions automatically.
      </p>

      <div className="portal-inline-form-grid">
        <label>
          <span>Responsibility</span>
          <select value={delegationType} onChange={(event) => setDelegationType(event.target.value)}>
            {delegationOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <p className="command-v2-compact-copy" style={{ alignSelf: "end", margin: 0 }}>
          {delegationDescriptions[delegationType]}
        </p>

        {delegationType === "Division Administration" ? (
          <label>
            <span>Organizational area</span>
            <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unitType}</option>)}
            </select>
          </label>
        ) : null}

        <label>
          <span>Expiration {delegationType === "Temporary Command Authority" ? "(required)" : "(optional)"}</span>
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>

        <label>
          <span>Why are they being delegated this?</span>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Oversee recruitment this month" />
        </label>
      </div>

      <div className="portal-inline-actions">
        <button className="portal-button portal-button--primary" disabled={pending === "grant"} onClick={() => void grant()} type="button">
          {pending === "grant" ? "Assigning…" : "Assign responsibility"}
        </button>
      </div>

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}

      <div className="command-v2-mini-list" style={{ marginTop: 16 }}>
        {delegations.length ? delegations.map((item) => (
          <div key={item.id}>
            <div>
              <strong>{item.delegationType}</strong>
              <span>
                {item.unitName ? `${item.unitName} · ` : ""}
                {item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : "No expiration"}
              </span>
              {item.reason ? <small>{item.reason}</small> : null}
            </div>
            <button className="portal-text-button" disabled={pending === item.id} onClick={() => void revoke(item.id, item.delegationType)} type="button">
              {pending === item.id ? "Revoking…" : "Revoke"}
            </button>
          </div>
        )) : <p className="command-v2-compact-copy">No delegated authority is currently active.</p>}
      </div>
    </section>
  );
}
