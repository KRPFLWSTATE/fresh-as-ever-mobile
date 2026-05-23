# Stitch Tailwind theme audit

**Date:** 2026-05-05  
**Canonical source:** [`stitch_fresh_as_ever_food_rescue-2/login_authentication/code.html`](../../stitch_fresh_as_ever_food_rescue-2/login_authentication/code.html) (`tailwind.config` in `<script id="tailwind-config">`).

## Result

- **95 / 95** `code.html` files include the same core token set (verified: grep `"primary": "#004f54"` matches all 95).
- **Spacing / radii / fontSize roles** are shared across screens; only layout markup differs.
- **Dark “discover”** uses additional inline `dark:` utility colors (e.g. `stone-950`, `#02b3be`); see dark overrides in [`src/theme/stitchTokens.ts`](../src/theme/stitchTokens.ts) (`stitchColorsDark`).

No conflicting alternate palettes were found that require a second token file.
