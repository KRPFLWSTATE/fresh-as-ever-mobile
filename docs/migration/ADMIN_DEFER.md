# Admin RN parity — **active program**

The Stitch parity epic **supersedes** the old MVP deferral: admin is **in scope** for React Native.

- Implementation lives under **`AdminShell`** ([`src/navigation/AdminNavigator.tsx`](../../src/navigation/AdminNavigator.tsx)) with nested stack screens matching Stitch (`admin_dashboard_*`, `settlements_management_*`, `platform_orders_*`, etc.).
- **`SCREEN_INVENTORY.md`** maps Next admin routes to RN admin stack routes; update when adding screens.
- Deep links: `/admin/*` — see [`src/navigation/linking.ts`](../../src/navigation/linking.ts) and [`normalizeIncomingLinkPath.ts`](../../src/navigation/normalizeIncomingLinkPath.ts).

Legacy note: `AdminPlaceholder` was removed once `AdminShell` shipped.
