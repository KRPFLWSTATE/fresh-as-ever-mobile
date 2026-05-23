# Celebration and onboarding moments

Brand: Fresh As Ever — warm food rescue, teal `#01696f`, accent `#da7101`, background `#f7f6f2`.

## Moments

| ID | Screen | Headline tone | Motion | Art |
|----|--------|---------------|--------|-----|
| `onboarding-1` | Customer onboarding step 1 | Discover nearby | Dot progress | Hero food rescue |
| `onboarding-2` | Step 2 | Reserve ease | Overlap card | Hero bags |
| `onboarding-3` | Step 3 | Pickup code | Code mock UI | Square hero |
| `onboarding-4` | Step 4 | You're set | Standard | Hero notifications |
| `celebration-reservation` | Order celebration | You're in. | Soft pulse + stagger | Outlined check |
| `celebration-rescue` | Rescue confirmed | Food saved | Strong pulse + count-up | Filled check |

## Motion rules

- Respect `AccessibilityInfo.isReduceMotionEnabled()` (mobile) and `prefers-reduced-motion` (web).
- Use RN `Animated` with `useNativeDriver: true` where possible; no new Lottie in v1.
- Stagger: icon → title → body → cards → CTA (300–450ms, ease-out).
- Haptics: `impactLight` on celebration mount when motion allowed.

## Copy rules

- Celebration headlines from `celebrationMoments.ts` only.
- Pickup times via `formatPickupOpensAt` / `formatPickupLine` — never raw ISO in UI.
- Errors from `src/lib/messages/*` — human, hopeful, one next step.

## Asset manifest

See `src/content/onboardingMoments.ts` and `src/content/celebrationMoments.ts` for URIs and alt text. Web mirrors under `fresh-as-ever/src/content/`.
