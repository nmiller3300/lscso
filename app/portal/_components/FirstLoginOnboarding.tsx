"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isStrongPassword, PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy";
import { invokePersonnelAdmin } from "@/lib/supabase/personnel-admin";
import { FiveMConnectionPanel } from "./FiveMConnectionPanel";

type FirstLoginOnboardingProps = {
  displayName: string;
  homeHref: string;
  passwordRequired: boolean;
};

export function FirstLoginOnboarding({
  displayName,
  homeHref,
  passwordRequired,
}: FirstLoginOnboardingProps) {
  const [passwordComplete, setPasswordComplete] = useState(!passwordRequired);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isStrongPassword(nextPassword)) {
      setError(PASSWORD_REQUIREMENT);
      return;
    }
    if (nextPassword !== confirmation) {
      setError("The new-password confirmation does not match.");
      return;
    }
    if (nextPassword === currentPassword) {
      setError("The new password must be different from the temporary password.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) {
        throw new Error("Your secure session could not be verified. Sign in again and retry.");
      }

      await invokePersonnelAdmin({
        operation: "change_own_password",
        current_password: currentPassword,
        password: nextPassword,
      });

      const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: nextPassword,
      });

      if (reauthenticationError) {
        window.location.href = "/portal";
        return;
      }

      setCurrentPassword("");
      setNextPassword("");
      setConfirmation("");
      setPasswordComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your password could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <span>LSCSO Personnel Operations</span>
          <h1>Welcome, {displayName}</h1>
          <p>Finish your account setup before continuing.</p>
        </div>

        {!passwordComplete ? (
          <section className="onboarding-step">
            <div className="onboarding-step-heading">
              <span>Required · Step 1</span>
              <h2>Change your temporary password</h2>
              <p>Your FiveM connection comes next and can be skipped until you are ready.</p>
            </div>
            <form className="portal-dialog-form" onSubmit={changePassword}>
              <label>
                Temporary password
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </label>
              <label>
                New password
                <input
                  autoComplete="new-password"
                  onChange={(event) => setNextPassword(event.target.value)}
                  required
                  type="password"
                  value={nextPassword}
                />
              </label>
              <label>
                Confirm new password
                <input
                  autoComplete="new-password"
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </label>
              <small className="portal-field-help">{PASSWORD_REQUIREMENT}</small>
              {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
              <button
                className="portal-button portal-button--primary"
                disabled={pending}
                type="submit"
              >
                {pending ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        ) : (
          <div className="onboarding-step">
            <div className="onboarding-step-heading">
              <span>Optional · Step 2</span>
              <h2>Connect your FiveM account</h2>
              <p>You can do this now or come back later from your portal account menu.</p>
            </div>
            <FiveMConnectionPanel allowSkip continueHref={homeHref} />
          </div>
        )}
      </div>
    </div>
  );
}
