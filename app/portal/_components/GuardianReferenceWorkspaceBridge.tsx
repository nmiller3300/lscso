"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type GuardianReferenceRow = {
  guardian_number: number;
  reference_number: string;
};

export function GuardianReferenceWorkspaceBridge() {
  useEffect(() => {
    const supabase = createClient() as any;
    let cancelled = false;
    let refreshTimer: number | null = null;
    let referenceMap = new Map<number, string>();

    function relabelRelatedReference() {
      const headings = Array.from(document.querySelectorAll<HTMLElement>(".guardian-step-heading strong"));
      const memberHeading = headings.find((heading) => heading.textContent?.trim() === "Member and event");
      const section = memberHeading?.closest<HTMLElement>(".guardian-form-section");
      const grid = section?.querySelector<HTMLElement>(".portal-form-grid.portal-form-grid--three");
      if (!grid) return;

      const eventLabel = Array.from(grid.querySelectorAll<HTMLLabelElement>("label"))
        .find((label) => label.textContent?.includes("Event / reference number"));

      if (eventLabel && eventLabel.dataset.guardianReferenceRelabeled !== "true") {
        const textNode = Array.from(eventLabel.childNodes).find(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Event / reference number"),
        );
        if (textNode) textNode.textContent = "Related event / reference number";
        eventLabel.dataset.guardianReferenceRelabeled = "true";
      }

      if (!grid.querySelector("[data-guardian-system-reference]")) {
        const card = document.createElement("div");
        card.className = "guardian-author-identity";
        card.dataset.guardianSystemReference = "true";
        card.style.gridColumn = "1 / -1";

        const label = document.createElement("span");
        label.textContent = "Guardian reference number";
        const value = document.createElement("strong");
        value.textContent = "Assigned automatically when this Guardian is saved";
        const help = document.createElement("small");
        help.textContent = "Permanent format: LSCSO-GDN-YYYY-#### · System generated and immutable after creation.";

        card.append(label, value, help);
        const firstIdentityCard = grid.querySelector(".guardian-author-identity");
        if (firstIdentityCard) grid.insertBefore(card, firstIdentityCard);
        else grid.appendChild(card);
      }
    }

    function decorateVisibleRecords() {
      document.querySelectorAll<HTMLElement>(".guardian-queue article").forEach((article) => {
        const shortId = Array.from(article.querySelectorAll<HTMLElement>("strong"))
          .find((element) => /^G-\d+$/.test(element.textContent?.trim() ?? ""));
        if (!shortId) return;

        const match = shortId.textContent?.trim().match(/^G-(\d+)$/);
        if (!match) return;
        const reference = referenceMap.get(Number(match[1]));
        if (!reference) return;

        const host = shortId.parentElement;
        if (!host) return;
        let formal = host.querySelector<HTMLElement>("[data-guardian-formal-reference]");
        if (!formal) {
          formal = document.createElement("small");
          formal.dataset.guardianFormalReference = "true";
          formal.style.display = "block";
          formal.style.marginTop = "3px";
          formal.style.fontWeight = "700";
          formal.style.letterSpacing = ".03em";
          host.appendChild(formal);
        }
        formal.textContent = reference;
      });

      const modalState = document.querySelector<HTMLElement>(".portal-modal--guardian-review .portal-modal-heading span");
      if (modalState) {
        const match = modalState.textContent?.match(/G-(\d+)/);
        const reference = match ? referenceMap.get(Number(match[1])) : null;
        if (reference && !modalState.textContent?.includes(reference)) {
          modalState.textContent = `${modalState.textContent} · ${reference}`;
        }
      }
    }

    async function refreshReferenceMap() {
      const { data, error } = await supabase
        .from("guardian_records")
        .select("guardian_number,reference_number")
        .order("created_at", { ascending: false })
        .limit(250);
      if (cancelled || error) return;

      referenceMap = new Map(
        ((data ?? []) as GuardianReferenceRow[])
          .filter((row) => row.reference_number)
          .map((row) => [Number(row.guardian_number), row.reference_number]),
      );
      decorateVisibleRecords();
    }

    function scheduleRefresh() {
      relabelRelatedReference();
      decorateVisibleRecords();
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshReferenceMap();
      }, 180);
    }

    relabelRelatedReference();
    void refreshReferenceMap();

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, []);

  return null;
}
