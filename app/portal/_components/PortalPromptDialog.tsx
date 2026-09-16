"use client";

import { useCallback, useRef, useState } from "react";
import { PortalDialog } from "./PortalDialog";

type PromptOptions = {
  eyebrow?: string;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  dangerous?: boolean;
  minLength?: number;
  maxLength?: number;
};

type ActivePrompt = PromptOptions & {
  resolve: (value: string | null) => void;
};

export function usePortalPrompt() {
  const [active, setActive] = useState<ActivePrompt | null>(null);
  const [value, setValue] = useState("");
  const activeRef = useRef<ActivePrompt | null>(null);

  const finish = useCallback((result: string | null) => {
    const prompt = activeRef.current;
    if (!prompt) return;
    activeRef.current = null;
    setActive(null);
    setValue("");
    prompt.resolve(result);
  }, []);

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    const next = { ...options, resolve };
    activeRef.current = next;
    setValue("");
    setActive(next);
  }), []);

  const minimum = active?.minLength ?? 1;
  const trimmed = value.trim();

  const dialog = active ? (
    <PortalDialog
      open
      onClose={() => finish(null)}
      eyebrow={active.eyebrow ?? "Confirmation required"}
      title={active.title}
      description={active.description}
      footer={(
        <>
          <button className="portal-button portal-button--secondary" onClick={() => finish(null)} type="button">Cancel</button>
          <button
            className={`portal-button ${active.dangerous ? "portal-button--danger" : "portal-button--primary"}`}
            disabled={trimmed.length < minimum}
            onClick={() => finish(trimmed)}
            type="button"
          >
            {active.confirmLabel ?? "Confirm"}
          </button>
        </>
      )}
    >
      <label className="portal-call-sign-field">
        {active.label ?? "Reason"}
        <textarea
          autoFocus
          maxLength={active.maxLength ?? 6000}
          onChange={(event) => setValue(event.target.value)}
          placeholder={active.placeholder}
          rows={4}
          value={value}
        />
      </label>
    </PortalDialog>
  ) : null;

  return { prompt, dialog };
}
