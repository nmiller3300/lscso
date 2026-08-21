"use client";

import { useEffect } from "react";

export function RosterRowInteraction() {
  useEffect(() => {
    const table = document.querySelector<HTMLTableElement>(".portal-roster-table");
    const body = table?.tBodies.item(0);
    if (!body) return;

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
      if (target.closest("button, a, input, select, textarea, label")) return;
      const row = target.closest<HTMLTableRowElement>("tbody tr");
      if (row && body!.contains(row)) selectFromRow(row);
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
    };
  }, []);

  return null;
}
