/**
 * Canonical route params for deep links & React Navigation (parity §AD).
 */
import { z } from 'zod';

export const orderIdParam = z.object({
  orderId: z.string().min(1),
});

export const customerBagDetailParams = z.object({
  id: z.string().min(1),
});

export const checkoutParams = z.object({
  draft: z.string().optional(),
  /** Comma-separated bag ids for group checkout (same outlet, max 5). */
  group: z.string().optional(),
  shelf: z.string().optional(),
  shelfItems: z.string().optional(),
});

export const discoverParams = z.object({
  state: z
    .enum(['empty-search', 'no-results', 'no-bags-nearby', 'sold-out'])
    .optional(),
});

export const onboardingParams = z.object({
  step: z.coerce.number().min(1).max(4).optional(),
});

export const bagAllergenParams = z.object({
  bagId: z.string().min(1),
});

/** `merchant/payouts/:payoutId` + middleware alias `merchant/finance/payout/:payoutId`. */
export const payoutIdParam = z.object({
  payoutId: z.string().min(1),
});
