"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./CaseNumberGenerator.module.css";

type CaseType = "arrest_warrant" | "traffic_stop" | "use_of_force";

type GeneratedCase = {
  id: string;
  case_number: string;
  case_type: CaseType;
  case_label: string;
  status: string;
  generated_at: string;
};

const caseTypes: Array<{
  key: CaseType;
  prefix: string;
  label: string;
  description: string;
}> = [
  {
    key: "arrest_warrant",
    prefix: "AW",
    label: "Arrest Warrant Application",
    description: "For a new arrest warrant application.",
  },
  {
    key: "traffic_stop",
    prefix: "TSR",
    label: "Traffic Stop Report",
    description: "For a traffic stop report requiring an LSCSO case number.",
  },
  {
    key: "use_of_force",
    prefix: "UOF",
    label: "Use of Force Incident",
    description: "For a report documenting a use-of-force incident.",
  },
];

export function CaseNumberGenerator() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CaseType | "">("");
  const [generated, setGenerated] = useState<GeneratedCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedCase = useMemo(
    () => caseTypes.find((item) => item.key === selected) ?? null,
    [selected],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  function openGenerator() {
    setOpen(true);
    setError("");
    setCopied(false);
  }

  function closeGenerator() {
    if (loading) return;
    setOpen(false);
  }

  async function generateNumber() {
    if (!selected || loading) return;
    setLoading(true);
    setError("");
    setCopied(false);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("generate_case_number", {
      p_case_type: selected,
    });

    if (rpcError) {
      setError(rpcError.message || "Unable to generate a case number.");
      setLoading(false);
      return;
    }

    const value = (Array.isArray(data) ? data[0] : data) as GeneratedCase | null;
    if (!value?.case_number) {
      setError("The case number was not returned. Please try again.");
      setLoading(false);
      return;
    }

    setGenerated(value);
    setLoading(false);
  }

  async function copyNumber() {
    if (!generated?.case_number) return;
    try {
      await navigator.clipboard.writeText(generated.case_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Copy failed. Select the case number and copy it manually.");
    }
  }

  function startAnother() {
    setGenerated(null);
    setSelected("");
    setError("");
    setCopied(false);
  }

  return (
    <>
      <button className={styles.trigger} type="button" onClick={openGenerator}>
        <span className={styles.triggerIcon} aria-hidden="true">#</span>
        <span>Generate Case #</span>
      </button>

      {open ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeGenerator();
        }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="case-number-title">
            <header className={styles.header}>
              <div>
                <span className={styles.eyebrow}>LSCSO REPORTING</span>
                <h2 id="case-number-title">Generate Case Number</h2>
                <p>Select the report type. The portal will issue the next official number automatically.</p>
              </div>
              <button className={styles.close} type="button" onClick={closeGenerator} aria-label="Close case number generator">×</button>
            </header>

            {!generated ? (
              <div className={styles.body}>
                <div className={styles.options}>
                  {caseTypes.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.option}${selected === item.key ? ` ${styles.optionSelected}` : ""}`}
                      onClick={() => {
                        setSelected(item.key);
                        setError("");
                      }}
                      aria-pressed={selected === item.key}
                    >
                      <span className={styles.prefix}>{item.prefix}</span>
                      <span className={styles.optionCopy}>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <span className={styles.radio} aria-hidden="true" />
                    </button>
                  ))}
                </div>

                <div className={styles.notice}>
                  <strong>Numbers are permanent.</strong>
                  <span>Once issued, a case number is logged and will not be recycled.</span>
                </div>

                {error ? <div className={styles.error} role="alert">{error}</div> : null}

                <div className={styles.actions}>
                  <button className={styles.secondary} type="button" onClick={closeGenerator}>Cancel</button>
                  <button className={styles.primary} type="button" onClick={() => void generateNumber()} disabled={!selected || loading}>
                    {loading ? "Generating…" : selectedCase ? `Generate ${selectedCase.prefix} Number` : "Generate Case Number"}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.resultBody}>
                <div className={styles.successMark} aria-hidden="true">✓</div>
                <span className={styles.resultLabel}>{generated.case_label}</span>
                <strong className={styles.caseNumber}>{generated.case_number}</strong>
                <p>This number is now officially issued and recorded to your personnel profile.</p>

                {error ? <div className={styles.error} role="alert">{error}</div> : null}

                <div className={styles.resultActions}>
                  <button className={styles.primary} type="button" onClick={() => void copyNumber()}>
                    {copied ? "Copied" : "Copy Case Number"}
                  </button>
                  <button className={styles.secondary} type="button" onClick={startAnother}>Generate Another</button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
