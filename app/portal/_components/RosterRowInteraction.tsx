"use client";

import { useEffect } from "react";

export function RosterRowInteraction() {
  useEffect(() => {
    const table = document.querySelector<HTMLTableElement>(".portal-roster-table");
    const body = table?.tBodies.item(0);
    if (!body) return;

    const style = document.createElement("style");
    style.dataset.rosterInteraction = "true";
    style.textContent = `
      .portal-roster-table tbody tr[data-clickable="true"] { cursor: pointer; }
      .portal-roster-table tbody tr[data-clickable="true"] td:first-child { cursor: pointer; }
      .portal-member-link { min-height: 52px; }
      .portal-roster-layout, .portal-roster-panel, .portal-member-card { min-width: 0; max-width: 100%; }
      .portal-member-card { overflow: hidden; }
      .portal-member-card-head > div, .portal-member-facts > div { min-width: 0; }
      .portal-member-card-head p, .portal-member-facts strong, .portal-member-protection span { overflow-wrap: anywhere; }
      @media (max-width: 1120px) {
        .portal-member-card { grid-template-columns: minmax(0, .85fr) minmax(0, 1.35fr) minmax(170px, .7fr); width: 100%; }
      }
      @media (max-width: 900px) {
        .portal-member-card { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); }
      }
      @media (max-width: 620px) {
        .portal-member-card { display: block; width: 100%; max-width: 100%; overflow: hidden; }
      }
    `;
    document.head.appendChild(style);

    function prepareRows() {
      for (const row of Array.from(body!.rows)) {
        row.dataset.clickable = "true";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        const name = row.querySelector(".portal-member-link strong")?.textContent?.trim();
        if (name) row.setAttribute("aria-label", `View ${name}`);
      }
    }

    function selectFromRow(row: HTMLTableRowElement) {
      const trigger = row.querySelector<HTMLButtonElement>(".portal-member-link");
      trigger?.click();
    }

    function onClick(event: Event) {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLTableRowElement>("tbody tr");
      if (!row || !body!.contains(row)) return;
      if (target.closest("a, input, select, textarea, label")) return;
      const button = target.closest("button");
      if (button && !button.classList.contains("portal-member-link") && !button.classList.contains("portal-row-arrow")) return;
      if (!button) selectFromRow(row);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLTableRowElement>("tbody tr");
      if (!row || !body!.contains(row)) return;
      event.preventDefault();
      selectFromRow(row);
    }

    prepareRows();
    const observer = new MutationObserver(prepareRows);
    observer.observe(body, { childList: true, subtree: true });
    body.addEventListener("click", onClick);
    body.addEventListener("keydown", onKeyDown);

    return () => {
      observer.disconnect();
      body.removeEventListener("click", onClick);
      body.removeEventListener("keydown", onKeyDown);
      style.remove();
    };
  }, []);

  return null;
}
