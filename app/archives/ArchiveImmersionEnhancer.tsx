"use client";

import { useEffect } from "react";

function normalizeFolder(value: string) {
  const folder = value.trim().toLowerCase();
  if (folder === "photos & artifacts") return "artifacts";
  return folder.replaceAll(" ", "-").replaceAll("&", "and");
}

function deriveEra(meta: string) {
  if (meta.includes("1963–1978")) return "founding";
  if (meta.includes("1978–1994")) return "growth";
  if (meta.includes("1994–2009")) return "operational";
  if (meta.includes("2009–2021")) return "digital-transition";
  if (meta.includes("2021–2026")) return "standardization";
  if (meta.includes("2026–Present")) return "active";
  return "neutral";
}

function deriveArtifactKind(sheet: HTMLElement) {
  const text = sheet.textContent?.toUpperCase() ?? "";
  if (text.includes("PHOTOGRAPHIC HOLDING") || text.includes("PHOTOGRAPH") || text.includes("CONTACT SHEET")) return "photograph";
  if (text.includes("MAP HOLDING") || text.includes("PATROL MAP")) return "map";
  if (text.includes("EQUIPMENT HOLDING") || text.includes("RADIO") || text.includes("CONSOLE")) return "equipment";
  if (text.includes("UNIFORM HOLDING") || text.includes("INSIGNIA")) return "uniform";
  if (text.includes("DIGITAL MEDIA HOLDING") || text.includes("BACKUP") || text.includes("DIGITAL EVIDENCE")) return "digital-media";
  if (text.includes("BINDER") || text.includes("TRAINING HOLDING") || text.includes("EXECUTIVE HOLDING")) return "binder";
  if (text.includes("ACCESSION")) return "accession";
  return "object";
}

function applyArchiveContext() {
  const focus = document.querySelector<HTMLElement>(".archive-collection-focus");
  if (!focus) return;

  const meta = focus.querySelector<HTMLElement>(".archive-collection-meta small")?.textContent ?? "";
  focus.dataset.era = deriveEra(meta);

  const selectedFolder = focus.querySelector<HTMLElement>(".archive-folder-directory > button.is-selected span")?.textContent ?? "";
  if (selectedFolder) focus.dataset.folder = normalizeFolder(selectedFolder);
  else delete focus.dataset.folder;

  const sheet = focus.querySelector<HTMLElement>(".archive-record-sheet");
  if (sheet && focus.dataset.folder === "artifacts") {
    sheet.dataset.artifactKind = deriveArtifactKind(sheet);
    sheet.classList.add("archive-record-sheet--artifact");
  } else if (sheet) {
    delete sheet.dataset.artifactKind;
    sheet.classList.remove("archive-record-sheet--artifact");
  }
}

export function ArchiveImmersionEnhancer() {
  useEffect(() => {
    applyArchiveContext();

    const observer = new MutationObserver(() => applyArchiveContext());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const close = document.querySelector<HTMLButtonElement>(".archive-collection-close");
      if (close) close.click();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
