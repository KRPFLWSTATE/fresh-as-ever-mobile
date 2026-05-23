export type CelebrationVariant = 'reservation' | 'rescue';

export type CelebrationCopy = {
  headline: string;
  subcopy: string;
  codeLabel: string;
  primaryCta: string;
  secondaryCta: string;
  filledCheck: boolean;
};

export const CELEBRATION_COPY: Record<CelebrationVariant, CelebrationCopy> = {
  reservation: {
    headline: "You're in.",
    subcopy: "Your rescue bag is secured. Save your pickup code — you'll need it at the counter.",
    codeLabel: 'Pickup code',
    primaryCta: 'View order & QR',
    secondaryCta: 'Discover more bags',
    filledCheck: false,
  },
  rescue: {
    headline: 'Rescue confirmed.',
    subcopy: 'Thank you for making a difference — your bag is waiting at pickup.',
    codeLabel: 'Order number',
    primaryCta: 'View order detail',
    secondaryCta: 'Back to home',
    filledCheck: true,
  },
};

export function getCelebrationCopy(variant: CelebrationVariant): CelebrationCopy {
  return CELEBRATION_COPY[variant];
}
