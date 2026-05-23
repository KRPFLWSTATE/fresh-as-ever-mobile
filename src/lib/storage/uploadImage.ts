import 'react-native-get-random-values';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';

/**
 * Shared helper for the three "dashed cover image" tiles in
 *   - `MerchantBagCreate`
 *   - `MerchantBagEdit`
 *   - `ProfileDetails`
 *
 * Responsibilities:
 *   1. Request photo-library permission via `expo-image-picker`.
 *   2. Launch the system image picker (images only, lightly edited, 0.8 quality).
 *   3. Read the picked URI as a blob and upload it to the right Supabase
 *      Storage bucket.
 *   4. Resolve to the public URL the caller should write into form state.
 *
 * `result` discriminates between three outcomes:
 *   - `cancelled` -- user dismissed the picker / denied permission.
 *   - `error`     -- something failed (caller surfaces an `Alert`).
 *   - `uploaded`  -- public URL is ready to write into form state.
 *
 * Storage RLS (see `docs/supabase/storage_buckets.sql`):
 *   - `bag-images/<merchant_id>/<uuid>.jpg` -- merchant-staff write/delete.
 *   - `avatars/<auth.uid()>/<filename>`    -- owner-only write/delete.
 */

export type UploadImageBucket = 'bag-images' | 'avatars' | 'complaint-images';

export type UploadImageResult =
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }
  | { kind: 'uploaded'; publicUrl: string; path: string };

/**
 * Lightweight UUID v4 generator (RFC 4122). Avoids pulling in `uuid`/`nanoid`
 * for a single call-site; relies on the already-installed
 * `react-native-get-random-values` polyfill so `crypto.getRandomValues` is
 * available on hermes.
 */
export function randomUuid(): string {
  const c = (
    globalThis as unknown as {
      crypto?: { getRandomValues: (a: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available');
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  // UUID v4 spec — these two bytes must encode the version (4) and the
  // variant (RFC 4122) bits, so bitwise math is the canonical implementation.
  // eslint-disable-next-line no-bitwise
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  // eslint-disable-next-line no-bitwise
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'));
  }
  return (
    `${hex.slice(0, 4).join('')}-` +
    `${hex.slice(4, 6).join('')}-` +
    `${hex.slice(6, 8).join('')}-` +
    `${hex.slice(8, 10).join('')}-` +
    `${hex.slice(10, 16).join('')}`
  );
}

type PickAndUploadArgs = {
  env: AppEnv;
  bucket: UploadImageBucket;
  /**
   * Storage object path **excluding** the bucket prefix. The RLS policies
   * scope writes by the first path segment, so callers MUST pass the right
   * scope:
   *   - `bag-images` -> `<merchant_id>/<filename>`
   *   - `avatars`          -> `<auth.uid()>/<filename>`
 *   - `complaint-images` -> `<auth.uid()>/<order_id>/<filename>`
   */
  path: string;
  /**
   * Defaults to `image/jpeg` (the picker returns JPEG-encoded data).
   */
  contentType?: string;
};

/**
 * Run the full pick + upload flow. Throws only for truly unexpected errors;
 * normal failures (denied permission, network error, bucket reject) are
 * surfaced via the `error` / `cancelled` result variants.
 */
async function loadImagePicker() {
  try {
    // Sync require avoids Metro async chunks that break HMRClient.setup() in dev.
    return Promise.resolve(require('expo-image-picker') as typeof import('expo-image-picker'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Image picker is not available (${msg}). Rebuild the app after installing Expo modules (pod install / clean build).`,
    );
  }
}

export async function pickAndUploadImage({
  env,
  bucket,
  path,
  contentType = 'image/jpeg',
}: PickAndUploadArgs): Promise<UploadImageResult> {
  let ImagePicker: Awaited<ReturnType<typeof loadImagePicker>>;
  try {
    ImagePicker = await loadImagePicker();
  } catch (e) {
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : 'Image picker unavailable.',
    };
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    return {
      kind: 'error',
      message:
        'Photo library permission is required to upload an image. ' +
        'Enable it in Settings to continue.',
    };
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    // String form (the post-v14 `MediaType` union); keeps the picker filtered
    // to still images only.
    mediaTypes: 'images',
    allowsEditing: true,
    quality: 0.8,
  });

  if (picked.canceled || !picked.assets || picked.assets.length === 0) {
    return { kind: 'cancelled' };
  }
  const asset = picked.assets[0];
  if (!asset || typeof asset.uri !== 'string' || !asset.uri) {
    return { kind: 'error', message: 'No image was returned by the picker.' };
  }

  try {
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const supabase = getSupabase(env);
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: true });

    if (uploadError) {
      return {
        kind: 'error',
        message: `Upload failed: ${uploadError.message}`,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) {
      return {
        kind: 'error',
        message: 'Could not resolve a public URL for the upload.',
      };
    }

    // Cache-bust: same path with `upsert: true` returns the same public URL,
    // so RN <Image> caches the previous bytes. A short query-string suffix
    // forces a refetch after re-upload.
    const cacheBusted = `${publicUrl}?t=${Date.now()}`;
    return { kind: 'uploaded', publicUrl: cacheBusted, path };
  } catch (e) {
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : 'Could not upload image.',
    };
  }
}

/**
 * Construct a per-merchant rescue-bag image path.
 *
 * Path scheme: `<merchant_id>/<uuid>.jpg` (relative to the `bag-images`
 * bucket). The first folder segment is enforced by storage RLS via
 * `public.is_merchant_staff_for(<merchant_id>)`.
 */
export function bagImagePath(merchantId: string): string {
  return `${merchantId}/${randomUuid()}.jpg`;
}

/**
 * Construct a per-user avatar path.
 *
 * Path scheme: `<auth.uid()>/avatar.jpg` (relative to the `avatars` bucket).
 * `upsert: true` keeps a single canonical avatar per user.
 */
export function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

/**
 * Complaint evidence photo path (complaint-images bucket).
 * Path: `<userId>/<orderId>/<uuid>.jpg`
 */
export function complaintImagePath(userId: string, orderId: string): string {
  return `${userId}/${orderId}/${randomUuid()}.jpg`;
}
