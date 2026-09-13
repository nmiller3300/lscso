# LSCSO Cross-Platform Release Standard

Cross-platform behavior is a release requirement for the entire LSCSO website and Personnel Portal. It is not a device-specific enhancement.

## Required viewport coverage

Every UI release must be reviewed at representative widths for:

- Small phone: 320–374 CSS px
- Standard / large phone: 375–480 CSS px
- Tablet portrait: 600–900 CSS px
- Tablet landscape / small laptop: 901–1180 CSS px
- Desktop: 1181 CSS px and wider

Portrait and landscape behavior must both remain usable where orientation materially changes layout.

## Required interaction coverage

Interactive functionality must work with:

- Coarse pointer / touch
- Fine pointer / mouse or trackpad
- Keyboard navigation and visible focus
- Pointer Events for drag gestures; do not create mouse-only or touch-only logic
- Tap/click fallback where a decorative drag gesture is not essential to the workflow

Touch targets for primary controls should be approximately 44 CSS px or larger even when the visible artwork is intentionally smaller.

## Browser / platform expectations

Layouts and interactions must avoid assumptions specific to one engine. Pay particular attention to:

- Safari / WebKit on iPhone and iPad
- Chromium-based desktop and Android browsers
- Dynamic viewport units (`dvh` / `svh`) for full-screen mobile surfaces
- Safe-area insets on notched / home-indicator devices
- `-webkit-backdrop-filter` fallback where glass treatment is important
- Scroll locking, fixed overlays, pointer capture, and form controls on WebKit

Do not use user-agent or physical-screen-size detection to choose a device layout.

## Responsive behavior rules

- Core functionality may not disappear solely because the viewport is narrower.
- Complex visuals may simplify on smaller screens, but the interaction and information must remain available.
- Do not rely on hover to reveal required controls or content.
- Tables and dense operational data must reflow or scroll intentionally rather than clipping the page.
- Dialogs, drawers, menus, and notification surfaces must remain inside the visual viewport and respect safe areas.
- Images, text, buttons, inputs, and long identifiers must not force unintended horizontal page scrolling.
- Reduced-motion preferences must keep the workflow usable without animation.

## Release verification

Before production promotion, verify at minimum:

1. Public header/navigation and footer.
2. Home and representative public content pages.
3. Public forms, tracking, and Open Records surfaces.
4. Personnel Portal login and authenticated shell.
5. Portal navigation, forms, dialogs, tables, filters, toggles, upload controls, and notifications.
6. Historical Archives entrance, lamp interaction, stack navigation, collection/folder navigation, and record reading.
7. 404, maintenance, loading, and error states.

A successful compile is necessary but is not evidence that a UI works cross-platform.
