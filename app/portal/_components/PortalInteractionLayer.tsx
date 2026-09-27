"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PortalInteractionLayer() {
  const pathname = usePathname();
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = anchorRef.current?.closest<HTMLElement>(".portal-app");
    if (!app) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    app.dataset.portalMotion = reducedMotion ? "reduced" : "full";
    app.dataset.portalPointer = coarsePointer ? "coarse" : "fine";

    let readyFrame = 0;
    let secondReadyFrame = 0;
    readyFrame = window.requestAnimationFrame(() => {
      secondReadyFrame = window.requestAnimationFrame(() => {
        app.dataset.portalReady = "true";
      });
    });

    let pointerFrame = 0;
    const updatePointer = (event: PointerEvent) => {
      if (coarsePointer || reducedMotion) return;
      window.cancelAnimationFrame(pointerFrame);
      pointerFrame = window.requestAnimationFrame(() => {
        app.style.setProperty("--portal-pointer-x", `${event.clientX}px`);
        app.style.setProperty("--portal-pointer-y", `${event.clientY}px`);
      });
    };

    const markNavigationPending = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;

      let destination: URL;
      try {
        destination = new URL(target.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin || !destination.pathname.startsWith("/portal")) return;
      if (destination.pathname === window.location.pathname) return;
      app.dataset.navigationPending = "true";
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    document.addEventListener("click", markNavigationPending, true);

    return () => {
      window.cancelAnimationFrame(readyFrame);
      window.cancelAnimationFrame(secondReadyFrame);
      window.cancelAnimationFrame(pointerFrame);
      window.removeEventListener("pointermove", updatePointer);
      document.removeEventListener("click", markNavigationPending, true);
    };
  }, []);

  useEffect(() => {
    const app = anchorRef.current?.closest<HTMLElement>(".portal-app");
    if (!app) return;
    delete app.dataset.navigationPending;
  }, [pathname]);

  return (
    <>
      <div className="portal-interaction-anchor" ref={anchorRef} aria-hidden="true" />
      <div className="portal-route-progress" aria-hidden="true"><span /></div>
    </>
  );
}
