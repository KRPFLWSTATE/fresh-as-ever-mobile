/**
 * Customer onboarding copy + hero imagery (single source).
 * Bundled heroes live under `src/assets/onboarding/`; remote URIs are fallback only.
 */

import type { ImageSourcePropType } from 'react-native';

export type OnboardingStepLayout =
  | 'hero-copy-dots'
  | 'hero-dots-copy'
  | 'dots-hero-copy';

export type OnboardingStep = {
  step: number;
  title: string;
  body: string;
  layout: OnboardingStepLayout;
  heroUri: string;
  heroAlt: string;
  heroAspect: number;
  heroBorderRadius: number;
};

const HERO_STEP_1_REMOTE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCOWYCZvQLKy8whSUNsd2rPYN-YUVUTaEMqTXRlvNs03BZIwIVhhWNIQkaXhBWqQJZnmRIong6XtgmExK9wpLEnayX1W9EHcnH4ezmrawTU5CLdVDGxSCsSe2-rsu66FW8UMdzIObGxE7xjomkI_KF57Mh8ryB-bBKW5ynlstnPN25oPG-xsQnP3dCYr_eew0REjmDrM4S_AwIG5EEo_epdyMgtvCYCvaSTjW69fylpxG50Ztr0ynmHvb1zL-z-cVcOBAcKnwqGdC0';
const HERO_STEP_2_REMOTE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDg_c5734kppJSZ4skic_mS08X57Jt-1DCYQL8dkXmyWn7IiHvIrccvnhR1pgnTabJi5EjN_qR4kZBJIjsdKY2nnuuJYzFAQAatVRdxSTch9tMqsiWNm1RNKaRXjp2ilIYM0o0a4La6peq1VvGJ4Q0ETvfXiFfdNUHsf4pDXN0KG80tHyeG6HoAPs-JrGYYqIjSDCIMTghPpyYNxTT8W83HVnjk4ktb8qziccxBzS0kIgRwz69umTD_rNe9DrXL2PIBrHc2i4MYikg';
const HERO_STEP_3_REMOTE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDMP2akqcAJvi1CRyxawUxd_O9TRrqrY3UC9ECKCgl6Oyyv6pfv2foEw63lGyxBej9cRQ2LHC3Mb3ZRFp5dKLds43IQzOfL0IG3pcJCbBZYoN4cQmsL0coakp-dbxA-MMX7x13hM7IQa4UZIazu2ti4HKQZuJ4pHSYGHpiEOizfzl48VvsK0CM-9cTZB0H5qe0d9dgbDb5YpN0p8s767te5R8-LhcjkPUvWphByIvcEbCW9iGIAUkQ-YeKF1Ndxc6keaS2ou1UVG38';

/** Bundled Stitch hero exports (steps 1–3; step 4 reuses step 2 art). */
export const ONBOARDING_HERO_LOCAL: Record<1 | 2 | 3, ImageSourcePropType> = {
  1: require('@/assets/onboarding/hero-1.jpg'),
  2: require('@/assets/onboarding/hero-2.jpg'),
  3: require('@/assets/onboarding/hero-3.jpg'),
};

export const ONBOARDING_TOTAL_STEPS = 4;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: 'Discover Nearby Deals',
    body: 'Find rescue bags from bakeries and cafés, or browse clearance shelves at supermarkets — pick the items you want before they close.',
    layout: 'hero-copy-dots',
    heroUri: HERO_STEP_1_REMOTE,
    heroAlt: 'Customer rescuing food illustration',
    heroAspect: 4 / 5,
    heroBorderRadius: 24,
  },
  {
    step: 2,
    title: 'Reserve with Ease',
    body: 'Reserve a surprise rescue bag in one tap, or build your own basket from a clearance shelf. Fast checkout, real savings.',
    layout: 'hero-dots-copy',
    heroUri: HERO_STEP_2_REMOTE,
    heroAlt: 'Browsing nearby rescue bags illustration',
    heroAspect: 4 / 5,
    heroBorderRadius: 12,
  },
  {
    step: 3,
    title: 'Quick Pickup',
    body: 'Show your 6-digit code at the counter for rescue bags or shelf pickups — staff confirm your line items at handover.',
    layout: 'dots-hero-copy',
    heroUri: HERO_STEP_3_REMOTE,
    heroAlt: 'Pickup and impact illustration',
    heroAspect: 1,
    heroBorderRadius: 12,
  },
  {
    step: 4,
    title: "You're set to rescue.",
    body: 'Enable notifications so we can nudge you when new bags and clearance shelves go live near you.',
    layout: 'hero-dots-copy',
    heroUri: HERO_STEP_2_REMOTE,
    heroAlt: 'Get started with Fresh As Ever',
    heroAspect: 4 / 5,
    heroBorderRadius: 12,
  },
];

export function getOnboardingStep(step: number): OnboardingStep {
  return ONBOARDING_STEPS.find((s) => s.step === step) ?? ONBOARDING_STEPS[0]!;
}

/** Prefer bundled asset; fall back to remote URI from content module only. */
export function getOnboardingHeroSource(step: number): ImageSourcePropType {
  const heroKey = step === 4 ? 2 : (step as 1 | 2 | 3);
  const local = ONBOARDING_HERO_LOCAL[heroKey];
  if (local) return local;
  const meta = getOnboardingStep(step);
  return { uri: meta.heroUri };
}
