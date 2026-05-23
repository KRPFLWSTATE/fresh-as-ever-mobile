import type { AppEnv } from '@/config/env';
import { getSupabase } from '@/lib/supabase';

/**
 * Admin mark-collected — uses `admin_collect_order` RPC only.
 */
export async function adminCollectOrder(
  env: AppEnv,
  orderId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sb = getSupabase(env);
  const { error: rpcError } = await sb.rpc('admin_collect_order', {
    p_order_id: orderId,
  });
  if (!rpcError) {
    return { ok: true };
  }

  const rpcMissing =
    rpcError.code === 'PGRST202' ||
    /admin_collect_order/i.test(rpcError.message ?? '');
  if (rpcMissing) {
    return {
      ok: false,
      message:
        'admin_collect_order is not available. Apply the admin_collect_order migration on Supabase.',
    };
  }

  return { ok: false, message: rpcError.message };
}
