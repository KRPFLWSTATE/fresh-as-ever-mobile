import type { AppEnv } from '@/config/env';
import { isOpenComplaintStatus } from '@/lib/adminComplaints';
import { getSupabase } from '@/lib/supabase';
import type { CustomerComplaintType } from './customerComplaintTypes';

export type ExistingOrderComplaint = {
  id: string;
  status: string;
  created_at: string | null;
};

export async function fetchCustomerComplaintForOrder(
  env: AppEnv,
  orderId: string,
  reporterId: string,
): Promise<ExistingOrderComplaint | null> {
  const sb = getSupabase(env);
  const { data, error } = await sb
    .from('complaints')
    .select('id, status, created_at')
    .eq('order_id', orderId)
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    status: String(data.status ?? 'open'),
    created_at:
      typeof data.created_at === 'string' ? data.created_at : null,
  };
}

export function customerCanReportProblem(
  orderStatus: string,
  existing: ExistingOrderComplaint | null,
): boolean {
  const st = orderStatus.trim().toLowerCase();
  if (!['collected', 'disputed'].includes(st)) return false;
  if (!existing) return true;
  return !isOpenComplaintStatus(existing.status);
}

export async function submitCustomerComplaint(args: {
  env: AppEnv;
  orderId: string;
  reporterId: string;
  type: CustomerComplaintType;
  description: string;
  photoUrls?: string[];
}): Promise<{ ok: true; complaintId: string } | { ok: false; message: string }> {
  const description = args.description.trim();
  if (description.length < 10) {
    return {
      ok: false,
      message: 'Please describe the problem in at least 10 characters.',
    };
  }

  const sb = getSupabase(args.env);
  const { data, error } = await sb
    .from('complaints')
    .insert({
      order_id: args.orderId,
      reporter_id: args.reporterId,
      type: args.type,
      status: 'open',
      description,
      photos:
        args.photoUrls && args.photoUrls.length > 0
          ? args.photoUrls
          : null,
    })
    .select('id')
    .single();

  if (error) {
    return {
      ok: false,
      message: error.message || 'Could not submit your report.',
    };
  }

  return { ok: true, complaintId: String(data.id) };
}
