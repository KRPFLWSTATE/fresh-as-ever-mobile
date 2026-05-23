# Merchant inventory / bags — review notes (May 14, 2026)

## Surfaces

- `MerchantBagCreateScreen`: image picker + `pickAndUploadImage`, pickup window pickers, preview modal — errors should surface via `Alert` / inline copy (no silent failures).
- List / edit flows: confirm `rescue_bags` fields match Supabase schema after schema changes.

## Theme

- After `stitchColorsDark` container fixes, bag forms should use `StitchSurface` / theme tokens only — avoid raw `#fff` panels in dark mode.

## Follow-up (optional)

- Wire sold-out / quantity UX to live RPC if not already aligned with `nearby_bags` expectations.
