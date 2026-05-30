import type { AppEnv } from '@/config/env';
import { getSupabase } from '@/lib/supabase';

/** Re-seeds demo bags/shelves for the outlet's current listing mode after category changes. */
export async function ensureOutletDemoListings(
  env: AppEnv,
  outletId: string,
): Promise<{ error?: string }> {
  const id = String(outletId ?? '').trim();
  if (!id) return { error: 'Missing outlet id' };

  const sb = getSupabase(env);
  const { error } = await sb.rpc('ensure_outlet_demo_listings', { p_outlet_id: id });
  if (error) return { error: error.message };
  return {};
}
