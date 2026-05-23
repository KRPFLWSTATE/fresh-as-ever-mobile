/**
 * Isolated merchant demo fixtures for `isDemoMode()` builds only.
 * Never merge with live Supabase rows in the same list.
 */

export type DemoPayoutRow = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  status: 'processing' | 'paid';
};

export type DemoPayoutTxRow = {
  id: string;
  when: string;
  item: string;
  orderId: string;
  share: string;
};

export type DemoPayoutDetail = {
  periodTitle: string;
  settled: boolean;
  ref: string;
  net: string;
  bankTransferLine: string;
  gross: string;
  grossSub: string;
  commission: string;
  commissionSub: string;
  bankName: string;
  branch: string;
  acctMasked: string;
  txCount: number;
  transactions: DemoPayoutTxRow[];
};

export const DEMO_MERCHANT_PAYOUT_ROWS: DemoPayoutRow[] = [
  {
    id: 'payout-1',
    title: 'Payout · settled 02 May',
    subtitle: '48 orders · Rs 186,400 gross',
    amount: 'Rs 158,440.00',
    status: 'paid',
  },
  {
    id: 'payout-2',
    title: 'Payout · settled 18 Apr',
    subtitle: '36 orders · Rs 142,200 gross',
    amount: 'Rs 120,870.00',
    status: 'paid',
  },
  {
    id: 'payout-3',
    title: 'Payout · processing window',
    subtitle: '22 orders · Rs 88,900 gross',
    amount: 'Rs 75,565.00',
    status: 'processing',
  },
  {
    id: 'payout-4',
    title: 'Payout · settled 04 Mar',
    subtitle: '41 orders · Rs 165,000 gross',
    amount: 'Rs 140,250.00',
    status: 'paid',
  },
];

const DEMO_PAYOUT_DETAILS: Record<string, DemoPayoutDetail> = {
  'payout-1': {
    periodTitle: '01 May 2026 – 02 May 2026',
    settled: true,
    ref: 'Ref: PAYOUT01',
    net: 'Rs 158,440.00',
    bankTransferLine: 'Transferred to Commercial Bank ending in *4421',
    gross: 'Rs 186,400.00',
    grossSub: '48 settled orders',
    commission: 'Rs 27,960.00',
    commissionSub: '15% platform fee (deducted at source)',
    bankName: 'Commercial Bank',
    branch: 'Colombo Fort',
    acctMasked: '****4421',
    txCount: 4,
    transactions: [
      {
        id: 'demo-tx-1',
        when: '02 May, 09:20',
        item: 'Evening pastry surprise',
        orderId: '#FAE204',
        share: 'Rs 3,280.50',
      },
      {
        id: 'demo-tx-2',
        when: '02 May, 11:02',
        item: 'Family meal rescue',
        orderId: '#FAE211',
        share: 'Rs 5,610.00',
      },
      {
        id: 'demo-tx-3',
        when: '02 May, 14:45',
        item: 'Artisan bread bundle',
        orderId: '#FAE218',
        share: 'Rs 2,040.00',
      },
      {
        id: 'demo-tx-4',
        when: '02 May, 18:10',
        item: 'Groceries mix (veg)',
        orderId: '#FAE225',
        share: 'Rs 4,115.25',
      },
    ],
  },
  'payout-2': {
    periodTitle: '11 Apr 2026 – 18 Apr 2026',
    settled: true,
    ref: 'Ref: PAYOUT02',
    net: 'Rs 120,870.00',
    bankTransferLine: 'Transferred to Commercial Bank ending in *4421',
    gross: 'Rs 142,200.00',
    grossSub: '36 settled orders',
    commission: 'Rs 21,330.00',
    commissionSub: '15% platform fee (deducted at source)',
    bankName: 'Commercial Bank',
    branch: 'Colombo Fort',
    acctMasked: '****4421',
    txCount: 3,
    transactions: [
      {
        id: 'demo-tx-5',
        when: '17 Apr, 08:55',
        item: 'Breakfast rescue box',
        orderId: '#FAE188',
        share: 'Rs 1,980.00',
      },
      {
        id: 'demo-tx-6',
        when: '17 Apr, 12:30',
        item: 'Cafe closing mix',
        orderId: '#FAE190',
        share: 'Rs 2,755.50',
      },
      {
        id: 'demo-tx-7',
        when: '18 Apr, 16:05',
        item: 'Weekend family bag',
        orderId: '#FAE196',
        share: 'Rs 3,420.00',
      },
    ],
  },
  'payout-3': {
    periodTitle: 'Settlement window (in progress)',
    settled: false,
    ref: 'Ref: PAYOUT03',
    net: 'Rs 75,565.00',
    bankTransferLine: 'Will transfer to Commercial Bank ending in *4421',
    gross: 'Rs 88,900.00',
    grossSub: '22 settled orders',
    commission: 'Rs 13,335.00',
    commissionSub: '15% platform fee (deducted at source)',
    bankName: 'Commercial Bank',
    branch: 'Colombo Fort',
    acctMasked: '****4421',
    txCount: 2,
    transactions: [
      {
        id: 'demo-tx-8',
        when: 'Today, 10:12',
        item: 'Lunch combo rescue',
        orderId: '#FAE301',
        share: 'Rs 2,210.00',
      },
      {
        id: 'demo-tx-9',
        when: 'Today, 15:40',
        item: 'Bakery surplus',
        orderId: '#FAE305',
        share: 'Rs 1,890.75',
      },
    ],
  },
  'payout-4': {
    periodTitle: '25 Feb 2026 – 04 Mar 2026',
    settled: true,
    ref: 'Ref: PAYOUT04',
    net: 'Rs 140,250.00',
    bankTransferLine: 'Transferred to Commercial Bank ending in *4421',
    gross: 'Rs 165,000.00',
    grossSub: '41 settled orders',
    commission: 'Rs 24,750.00',
    commissionSub: '15% platform fee (deducted at source)',
    bankName: 'Commercial Bank',
    branch: 'Colombo Fort',
    acctMasked: '****4421',
    txCount: 2,
    transactions: [
      {
        id: 'demo-tx-10',
        when: '03 Mar, 09:00',
        item: 'Supermarket dairy rescue',
        orderId: '#FAE120',
        share: 'Rs 4,500.00',
      },
      {
        id: 'demo-tx-11',
        when: '04 Mar, 17:22',
        item: 'Mixed greens bag',
        orderId: '#FAE128',
        share: 'Rs 2,050.00',
      },
    ],
  },
};

export function getDemoPayoutDetail(payoutId: string): DemoPayoutDetail | null {
  return DEMO_PAYOUT_DETAILS[payoutId] ?? null;
}

/** “Customer arrived” hero on live monitor — design-only; shown when `isDemoMode()` is on. */
export const DEMO_LIVE_MONITOR_HANDOVER = {
  orderCode: 'Order #8492',
  customerName: 'Sarah Jenkins',
  bagLine: '2× Artisan Bread Rescue Bag',
} as const;

export type DemoTopSellingItem = {
  id: string;
  title: string;
  category: string;
  sold: string;
};

/** Top-selling list when live aggregation returns no rows (demo mode only). */
export const DEMO_MERCHANT_TOP_SELLING_ITEMS: DemoTopSellingItem[] = [
  { id: 'demo-top-1', title: 'Artisan Sourdough', category: 'Bakery', sold: '24 sold' },
  { id: 'demo-top-2', title: 'Butter Croissant', category: 'Pastry', sold: '18 sold' },
  { id: 'demo-top-3', title: 'Blueberry Muffin', category: 'Pastry', sold: '12 sold' },
];

/** Rich Stitch-style promo cards when Supabase returns none (demo mode only). */
export type DemoPromoCard = {
  id: string;
  tab: 'active' | 'scheduled' | 'expired';
  headline: string;
  discountChip: string;
  body?: string;
  usageCurrent?: number;
  usageCapLabel: string;
  expiresLabel: string;
  tone: 'primary' | 'accent';
  minOrderLabel?: string;
};

export const DEMO_PROMO_CARDS: DemoPromoCard[] = [
  {
    id: 'demo-promo-welcome',
    tab: 'active',
    headline: 'WELCOME15',
    discountChip: '15% OFF',
    body: 'First rescue at this outlet — capped uses for launch week.',
    usageCurrent: 128,
    usageCapLabel: '500',
    expiresLabel: '30 Jun 2026',
    tone: 'primary',
    minOrderLabel: 'Min Rs. 1,500',
  },
  {
    id: 'demo-promo-lunch',
    tab: 'active',
    headline: 'LUNCH20',
    discountChip: 'Rs 400 OFF',
    usageCurrent: 42,
    usageCapLabel: 'Unlimited',
    expiresLabel: 'No expiry',
    tone: 'accent',
    minOrderLabel: 'Min Rs. 2,000',
  },
  {
    id: 'demo-promo-weekend',
    tab: 'scheduled',
    headline: 'WEEKEND10',
    discountChip: '10% OFF',
    usageCurrent: 0,
    usageCapLabel: '200',
    expiresLabel: 'Starts 01 Jun 2026',
    tone: 'primary',
    minOrderLabel: undefined,
  },
  {
    id: 'demo-promo-jan',
    tab: 'expired',
    headline: 'JANFLASH',
    discountChip: '20% OFF',
    usageCurrent: 980,
    usageCapLabel: '1000',
    expiresLabel: 'Ended 31 Jan 2026',
    tone: 'accent',
    minOrderLabel: 'Min Rs. 1,000',
  },
];

export const DEMO_PROMO_STATS = {
  active: 2,
  uses: 1150,
  topCode: 'WELCOME15',
  topUses: '128',
};

export type DemoQueueRow = {
  id: string;
  bag: string;
  order: string;
  customer: string;
  eta: string;
  urgent: boolean;
  minutesUntilPickup: number;
};

/** Static approaching pickups when the live reserved-order query returns empty (demo only). */
export const DEMO_MERCHANT_QUEUE_ROWS: DemoQueueRow[] = [
  {
    id: 'demo-queue-1',
    bag: 'Artisan Bread Rescue Bag',
    order: 'Order #FAE882',
    customer: 'Sarah Jenkins',
    eta: '12 min',
    urgent: true,
    minutesUntilPickup: 12,
  },
  {
    id: 'demo-queue-2',
    bag: 'Family Meal Surprise',
    order: 'Order #FAE901',
    customer: 'Ravi Perera',
    eta: '34 min',
    urgent: false,
    minutesUntilPickup: 34,
  },
  {
    id: 'demo-queue-3',
    bag: 'Cafe Pastry Mix',
    order: 'Order #FAE905',
    customer: 'Amaya Silva',
    eta: '55 min',
    urgent: false,
    minutesUntilPickup: 55,
  },
];

export type DemoDisputeRow = {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAtLabel: string;
  orderLabel: string;
  reporterName: string;
};

export const DEMO_MERCHANT_DISPUTE_ROWS: DemoDisputeRow[] = [
  {
    id: 'demo-dispute-1',
    type: 'Quality',
    description:
      'Customer reports the rescue bag was missing one labelled pastry item. Photos attached in web console.',
    status: 'open',
    createdAtLabel: '12 May 2026, 09:14',
    orderLabel: 'Order #FAE442',
    reporterName: 'Nethmi Fernando',
  },
  {
    id: 'demo-dispute-2',
    type: 'Pickup',
    description:
      'Pickup window felt too tight — arrived at 18:02 but outlet had already handed the bag to another guest.',
    status: 'unresolved',
    createdAtLabel: '10 May 2026, 18:40',
    orderLabel: 'Order #FAE418',
    reporterName: 'Jon Lee',
  },
  {
    id: 'demo-dispute-3',
    type: 'Refund',
    description:
      'Duplicate charge on card — customer requests platform review and refund to original payment method.',
    status: 'escalated',
    createdAtLabel: '08 May 2026, 11:05',
    orderLabel: 'Order #FAE401',
    reporterName: 'Chathuri Jayawardena',
  },
  {
    id: 'demo-dispute-4',
    type: 'Quality',
    description:
      'Allergen label mismatch vs bag contents — resolved with store credit and updated allergen sheet.',
    status: 'resolved',
    createdAtLabel: '02 May 2026, 16:22',
    orderLabel: 'Order #FAE360',
    reporterName: 'Mark De Silva',
  },
];
