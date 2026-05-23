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
