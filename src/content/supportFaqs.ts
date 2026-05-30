export type SupportFaqCategory = 'order' | 'payment' | 'merchant' | 'general';

export type SupportFaq = {
  id: string;
  category: SupportFaqCategory;
  question: string;
  answer: string;
};

/**
 * Customer help copy — informal, FAE-specific (rescue bags, pickup windows, PayHere, Colombo).
 */
export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: 'reserve',
    category: 'order',
    question: 'How do I grab a rescue bag?',
    answer:
      'Find a bag on Discover, hit Reserve Now, and pay with card (PayHere) or cash at pickup when you are eligible. Your order gets a 6-digit code and a QR — show either at the counter.',
  },
  {
    id: 'pickup-window',
    category: 'order',
    question: 'When should I show up?',
    answer:
      'Every bag has a pickup window on the listing and on your order. Please arrive inside that window — outlets prep around those times, not all day.',
  },
  {
    id: 'verification',
    category: 'order',
    question: 'What do I show staff?',
    answer:
      'Orders → your active pickup. Flash the QR or read the 6-character code so they can authorize the handover in the merchant app.',
  },
  {
    id: 'cancel',
    category: 'order',
    question: 'Can I cancel if plans change?',
    answer:
      'While the order is still reserved or paid and before the pickup window ends, open Order detail and tap Cancel. Refunds follow your payment method (card refunds go back via PayHere).',
  },
  {
    id: 'sold-out',
    category: 'order',
    question: 'Why did a bag vanish?',
    answer:
      'Stock is live. If someone else grabs the last unit, the bag can sell out or drop off Discover until the merchant lists again.',
  },
  {
    id: 'missing-items',
    category: 'order',
    question: 'Something was missing from my bag',
    answer:
      'Note what was missing and your order reference (#FAE-…). Email support with photos if you can — we loop the merchant in and track it as a complaint.',
  },
  {
    id: 'clearance-shelf',
    category: 'order',
    question: 'How do clearance shelves work?',
    answer:
      "At participating supermarkets you browse today's shelf, add discounted items to your basket, and checkout. Pick up inside the window and show your code — staff confirm each line item.",
  },
  {
    id: 'clearance-missing-item',
    category: 'order',
    question: 'A shelf item was missing at pickup',
    answer:
      'Open Report a problem on the order and choose the missing-item option. List what was not handed over and we will follow up with the store.',
  },
  {
    id: 'payhere',
    category: 'payment',
    question: 'Card payment (PayHere)',
    answer:
      'Checkout opens a secure PayHere sheet. When payment succeeds you land back in the app and the order moves to paid/ready. If it fails, nothing is charged — try again or pick another method.',
  },
  {
    id: 'cash',
    category: 'payment',
    question: 'Paying cash at pickup',
    answer:
      'Cash unlocks after you have collected at least one order before. Choose it at checkout when the option appears, and pay the outlet during pickup.',
  },
  {
    id: 'refund',
    category: 'payment',
    question: 'Refunds and failed charges',
    answer:
      'Failed card attempts should not debit you. Approved refunds for cancelled or disputed orders are processed back to the original card where possible — timing depends on your bank.',
  },
  {
    id: 'merchant-pickup-rules',
    category: 'merchant',
    question: 'Pickup rules at outlets',
    answer:
      'Each merchant sets their own pickup window on the bag. Be on time, bring your code, and respect outlet staff instructions. No-shows may affect your account standing.',
  },
  {
    id: 'merchant-cancel',
    category: 'merchant',
    question: 'If a merchant cancels',
    answer:
      'Rare, but it happens when stock runs out unexpectedly. You should get a notification and any paid amount refunded per platform policy.',
  },
  {
    id: 'halal-allergen',
    category: 'merchant',
    question: 'Halal and allergen info',
    answer:
      'Bags can show halal and allergen tags when merchants declare them. Outlet-wide halal badges mean the whole shop is certified; otherwise check each bag. When in doubt, ask the counter before eating.',
  },
  {
    id: 'location',
    category: 'general',
    question: 'Changing the area I browse',
    answer:
      'On Discover, tap Current location → Search place, or move the map and use Search this area. Your rescue feed and map stay tied to that area.',
  },
  {
    id: 'favourites',
    category: 'general',
    question: 'Favourites',
    answer:
      'Heart an outlet from bag or outlet detail. Profile → Favourites lists saved spots so you can jump back when they post new bags.',
  },
  {
    id: 'notifications',
    category: 'general',
    question: 'Alerts (push, email, SMS prefs)',
    answer:
      'Profile → Notifications saves your preferences to your account. SMS toggles need a phone number on your profile. Transactional SMS for every order is rolling out separately.',
  },
  {
    id: 'arrival-signal',
    category: 'order',
    question: "I'm at the outlet — what does that do?",
    answer:
      'On Order detail during your pickup window, tap I\'m at the outlet. Staff see you on Live monitor so they can prep your handover. You still need your 6-character code or QR at the counter.',
  },
  {
    id: 'late-pickup-customer',
    category: 'order',
    question: 'I am running late for pickup',
    answer:
      'Contact the outlet if you can. Your code stays valid while the merchant window allows handover. After the window, staff may report a no-show — check Order detail for status.',
  },
  {
    id: 'merchant-verify-code',
    category: 'merchant',
    question: 'How do I verify a pickup?',
    answer:
      'Orders → enter the customer\'s 6-character code and Authorize Handover, or use Scan QR. Never mark collected without the code or QR — it keeps payouts accurate.',
  },
  {
    id: 'merchant-late-tab',
    category: 'merchant',
    question: 'Late pickups tab',
    answer:
      'Shows orders past pickup_end. You can still Verify or Scan QR if payment is complete. Report no-show only after 30 minutes past the window (grace period).',
  },
  {
    id: 'merchant-live-monitor',
    category: 'merchant',
    question: 'Live monitor vs Orders tabs',
    answer:
      'Live monitor lists pickups ending in the next 2 hours. Orders → Live monitor view uses the same time filter. Verification tab is for handovers inside the current pickup window only.',
  },
  {
    id: 'merchant-staff',
    category: 'merchant',
    question: 'Staff accounts',
    answer:
      'Settings → Staff accounts: invite by email, activate when they sign in, or revoke access. Invited users cannot operate until status is active.',
  },
  {
    id: 'merchant-first-bag',
    category: 'merchant',
    question: 'First bag during onboarding',
    answer:
      'Onboarding step 3 matches the Bags create form: title, rescue price, quantity, and a 2-hour default pickup window when you publish.',
  },
  {
    id: 'support-email',
    category: 'general',
    question: 'How do I reach support?',
    answer:
      'Profile → Help & support: email hello@freshasever.com or use in-app FAQs. Include your order code (#FAE-…) for faster help.',
  },
  {
    id: 'account-phone',
    category: 'general',
    question: 'Phone number on profile',
    answer:
      'Merchants may call you from Orders if your profile has a phone. Add it under Profile → Details so outlets can reach you about late pickups.',
  },
  {
    id: 'discover-keyboard',
    category: 'general',
    question: 'Search place keyboard',
    answer:
      'Discover → Current location → Search place: the sheet scrolls above the keyboard on iOS and Android so you can pick suggestions comfortably.',
  },
  {
    id: 'payment-pending',
    category: 'payment',
    question: 'Payment shows pending',
    answer:
      'Card payments via PayHere usually confirm within seconds. If Order detail still says reserved with paid payment, pull to refresh — we poll until the status updates.',
  },
  {
    id: 'no-show-merchant',
    category: 'merchant',
    question: 'When can I report no-show?',
    answer:
      'Late pickups → Report no-show unlocks 30 minutes after pickup_end. It marks the order no_show for operations — not the same as cancel.',
  },
  {
    id: 'qr-vs-code',
    category: 'order',
    question: 'QR or code — which is better?',
    answer:
      'Either works. The QR encodes your reservation; the 6-character code is the same value for staff typing. Brightness up helps scanners.',
  },
  {
    id: 'impact-stats',
    category: 'general',
    question: 'Impact and savings',
    answer:
      'Profile → Impact summarises meals rescued and CO₂ estimates from your collected orders. Stats update after handover completes.',
  },
];

export const SUPPORT_CATEGORY_FAQ_MAP: Record<
  'Order Issues' | 'Payments' | 'Merchant Policies',
  SupportFaqCategory
> = {
  'Order Issues': 'order',
  'Payments': 'payment',
  'Merchant Policies': 'merchant',
};
