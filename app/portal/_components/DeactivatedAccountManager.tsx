"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy";
import { invokePersonnelAdmin } from "@/lib/supabase/personnel-admin";
import { createClient } from "@/lib/supabase/client";

type DeactivatedMember = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  username: string | null;
  credentialsAssigned: boolean;
};

export function DeactivatedAccountManager({ members }: { members: DeactivatedMember[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(members[0]?.profileId ?? "");
  const selected = members.find((member) => member.profileId === selectedId) ?? members[0];
  const [username, setUsername] = useState(selected?.username ?? "");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setUsername(selected?.username ?? "");
    setPassword("");
    setReason("");
    setError("");
    setNotice("");
  }, [selected?.profileId, selected?.username]);

  if (!members.length || !selected) return null;

  async function reactivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (reason.trim().length < 4) {
      setError("Enter a short Executive reason for reactivation.");
      return;
    }

    if (!selected.credentialsAssigned) {
      const normalizedUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername)) {
        setError("Assign a valid username before reactivating this account.");
        return;
      }
      if (!isStrongPassword(password)) {
        setError(PASSWORD_REQUIREMENT);
        return;
      }
    }

    setPending(true);
    try {
      if (!selected.credentialsAssigned) {
        await invokePersonnelAdmin({
          operation: "assign_credentials",
          profile_id: selected.profileId,
          username: username.trim().toLowerCase(),
          password,
        });
      }

      const supabase = createClient() as any;
      const { error: reactivateError } = await supabase.rpc("executive_reactivate_profile", {
        p_profile_id: selected.profileId,
        p_reason: reason.trim(),
      });
      if (reactivateError) throw reactivateError;

      setNotice("Account reactivated. Assign a call sign and review organizational assignments before returning the member to duty.");
      setPassword("");
      setReason("");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The account could not be reactivated.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="portal-panel" style={{ marginBottom: 16 }}>
      <div className="portal-panel-heading">
        <div><p>Executive account control</p><h2>Deactivated personnel</h2></div>
        <span>{members.length}</span>
      </div>
      <p className="command-v2-compact-copy">Reactivation restores account access only. Prior call signs, assignments, delegations, and training authority are not restored automatically.</p>
      <form onSubmit={reactivate} className="portal-form-grid" style={{ marginTop: 16 }}>
        <label>
          Personnel
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {members.map((member) => <option key={member.profileId} value={member.profileId}>{member.personnelId} · {member.rank} {member.displayName}</option>)}
          </select>
        </label>
        <label>
          Username
          <input autoComplete="off" disabled={selected.credentialsAssigned} onChange={(event) => setUsername(event.target.value)} required value={username} />
        </label>
        {!selected.credentialsAssigned ? (
          <label>
            New temporary password
            <input autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            <small className="portal-field-help">{PASSWORD_REQUIREMENT}</small>
          </label>
        ) : null}
        <label>
          Executive reason
          <input onChange={(event) => setReason(event.target.value)} placeholder="Return to department, deactivated in error..." required value={reason} />
        </label>
        {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
        {notice ? <div className="portal-form-protection"><strong>Reactivation complete</strong><span>{notice}</span></div> : null}
        <div className="portal-modal-actions">
          <button className="portal-button portal-button--primary" disabled={pending || reason.trim().length < 4} type="submit">{pending ? "Reactivating…" : "Reactivate account"}</button>
        </div>
      </form>
    </section>
  );
}
