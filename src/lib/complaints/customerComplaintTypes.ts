/** DB `complaints.type` values allowed by `complaints_type_check`. */

export type CustomerComplaintType =
  | 'quality'
  | 'no_show_merchant'
  | 'other';

export const CUSTOMER_COMPLAINT_TYPE_OPTIONS: {
  value: CustomerComplaintType;
  label: string;
}[] = [
  { value: 'quality', label: 'Quality or missing items' },
  { value: 'no_show_merchant', label: "Couldn't collect / outlet issue" },
  { value: 'other', label: 'Something else' },
];

/** Shelf orders surface a dedicated missing-item label (stored as `quality`). */
export function customerComplaintTypeOptions(isShelfOrder?: boolean) {
  if (!isShelfOrder) return CUSTOMER_COMPLAINT_TYPE_OPTIONS;
  return [
    { value: 'quality' as const, label: 'Missing shelf item(s)' },
    { value: 'quality' as const, label: 'Quality issue' },
    { value: 'no_show_merchant' as const, label: "Couldn't collect / outlet issue" },
    { value: 'other' as const, label: 'Something else' },
  ];
}
