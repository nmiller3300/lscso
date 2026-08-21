"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function PasswordChangeDialog() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!STRONG_PASSWORD.test(nextPassword)) {
      setError("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (nextPassword !== confirmation) {
      setError("The new-password confirmation does not match.");
      return;
    }
    if (nextPassword === currentPassword) {
      setError("The new password must be different from the current password.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) {
        setError("Your secure session could not be verified. Sign in again and retry.");
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setError("The current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: nextPassword,
        data: { ...userData.user.user_metadata, must_change_password: false },
      });
      if (updateError) {
        setError("The password could not be updated. Please try again.");
        return;
      }

      await supabase.auth.signOut({ scope: "others" });
      await supabase.rpc("record_session_event", {
        session_event_type: "Password Changed",
        session_user_agent: navigator.userAgent,
      });
      setCurrentPassword("");
      setNextPassword("");
      setConfirmation("");
      setMessage("Password changed. Other active sessions have been signed out.");
    } catch {
      setError("The secure account service could not be reached. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="portal-account-button" onClick={() => setOpen(true)} type="button">My account</button>
      {open ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="portal-modal portal-password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <div className="portal-modal-heading">
              <div><span>Secure account</span><h2 id="password-title">Change password</h2></div>
              <button onClick={() => setOpen(false)} type="button" aria-label="Close password dialog">×</button>
            </div>
            <form onSubmit={changePassword}>
              <label>Current password<input autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label>
              <label>New password<input autoComplete="new-password" onChange={(event) => setNextPassword(event.target.value)} required type="password" value={nextPassword} /></label>
              <label>Confirm new password<input autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
              <small className="portal-field-help">Minimum 12 characters with uppercase, lowercase, a number, and a symbol.</small>
              {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
              {message ? <div className="portal-form-success" role="status">{message}</div> : null}
              <div className="portal-modal-actions">
                <button className="portal-button portal-button--secondary" onClick={() => setOpen(false)} type="button">Close</button>
                <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Updating…" : "Change password"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
