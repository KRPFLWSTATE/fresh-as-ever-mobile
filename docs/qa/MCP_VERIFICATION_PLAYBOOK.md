# MCP verification playbook (Gate A / B / C)

Use when **Xcode MCP**, **Official Appium MCP**, or **Mobile-Next MCP** are enabled in Cursor.

## Rule

Read each server’s tool JSON descriptors under the Cursor MCP folder **before** the first tool call.

## Gate A (automation)

1. Run `npm run ci` (or project `tsc` + `eslint` + `jest`) from repo root.
2. If the iOS app fails to launch after native changes: use **Xcode MCP** for build logs / simulator state.
3. If JS bundle errors with clean `tsc`: use **Mobile-Next MCP** for Metro / runtime signals.

## Gate B (UI matrix)

- Prefer **Appium MCP** for tab switches, horizontal chip scroll, segmented controls, and scrolling to the merchant Settings footer.
- Keep **manual** sign-off for map pinch / flyover feel and `tel:` dialler (simulator limits).

## Gate C (handover)

- Automate only stable legs with **Appium** when test accounts exist.
- Always confirm **database** state (Supabase SQL or dashboard), not UI alone.

## Work-checker MCP log

Each slice PR notes: **Xcode / Appium / Mobile-Next: used | N/A (reason)** plus artifact links when applicable.
