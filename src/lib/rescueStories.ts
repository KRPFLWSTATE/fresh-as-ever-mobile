import type { AppEnv } from '@/config/env';
import { getSupabase } from '@/lib/supabase';

export type RescueStoryStatus = 'pending' | 'approved' | 'rejected';

export type RescueStoryRow = {
  id: string;
  order_id: string;
  customer_id: string;
  outlet_id: string;
  caption: string | null;
  photo_url: string | null;
  status: RescueStoryStatus;
  created_at: string;
};

const BUCKET = 'rescue-stories';

export async function uploadRescueStoryPhoto(
  env: AppEnv,
  customerId: string,
  localUri: string,
): Promise<string> {
  const sb = getSupabase(env);
  const ext = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const path = `${customerId}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createRescueStory(
  env: AppEnv,
  input: {
    orderId: string;
    customerId: string;
    outletId: string;
    caption: string;
    photoUrl: string;
  },
): Promise<RescueStoryRow> {
  const sb = getSupabase(env);
  const { data, error } = await sb
    .from('rescue_stories')
    .insert({
      order_id: input.orderId,
      customer_id: input.customerId,
      outlet_id: input.outletId,
      caption: input.caption.trim().slice(0, 280),
      photo_url: input.photoUrl,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as RescueStoryRow;
}
