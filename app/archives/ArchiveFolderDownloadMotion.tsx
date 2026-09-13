"use client";

import { useEffect } from "react";

const FOLDER_SELECTOR = ".archive-folder-directory > button:not(:disabled)";

export function ArchiveFolderDownloadMotion() {
  useEffect(() => {
    const timers = new Set<number>();

    const handleFolderClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>(FOLDER_SELECTOR);
      if (!button) return;

      window.requestAnimationFrame(() => {
        button.querySelectorAll(":scope > .archive-folder-download-sheet").forEach((node) => node.remove());
        button.classList.remove("archive-folder-download-pulse");

        // Force the decorative animation to restart even when the selected folder
        // is clicked again. This does not alter the folder's transform or z-index.
        void button.offsetWidth;

        const sheet = document.createElement("span");
        sheet.className = "archive-folder-download-sheet";
        sheet.setAttribute("aria-hidden", "true");
        button.appendChild(sheet);
        button.classList.add("archive-folder-download-pulse");

        const timer = window.setTimeout(() => {
          sheet.remove();
          button.classList.remove("archive-folder-download-pulse");
          timers.delete(timer);
        }, 1350);

        timers.add(timer);
      });
    };

    document.addEventListener("click", handleFolderClick);

    return () => {
      document.removeEventListener("click", handleFolderClick);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return null;
}
