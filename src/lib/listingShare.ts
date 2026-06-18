import { Linking, Platform, Share } from 'react-native';
import { API_BASE_URL } from '@env';

const DEFAULT_SHARE_BASE = 'https://freshasever.com';

export function resolveListingWebBaseUrl(): string {
  const fromEnv = (API_BASE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`;
  }
  return DEFAULT_SHARE_BASE;
}

export function formatListingLkr(amount: number): string {
  return `LKR ${Math.round(amount).toLocaleString('en-LK')}`;
}

export function formatListingPickupLine(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso || !endIso) return 'Pickup time TBC';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Pickup time TBC';
  }
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const startTime = start.toLocaleTimeString(undefined, tf);
  const endTime = end.toLocaleTimeString(undefined, tf);
  const today = new Date();
  const day =
    start.toDateString() === today.toDateString()
      ? 'Today'
      : start.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
  return `Pickup ${day}, ${startTime} – ${endTime}`;
}

export function buildBagDeepLink(bagId: string): string {
  return `freshasever://bags/${encodeURIComponent(bagId)}`;
}

export function buildBagWebLink(bagId: string, baseUrl?: string): string {
  const base = (baseUrl ?? DEFAULT_SHARE_BASE).replace(/\/$/, '');
  return `${base}/bags/${encodeURIComponent(bagId)}`;
}

export function buildShelfDeepLink(shelfId: string): string {
  return `freshasever://shelves/${encodeURIComponent(shelfId)}`;
}

export function buildShelfWebLink(shelfId: string, baseUrl?: string): string {
  const base = (baseUrl ?? DEFAULT_SHARE_BASE).replace(/\/$/, '');
  return `${base}/shelves/${encodeURIComponent(shelfId)}`;
}

export function buildBagWhatsAppMessage(args: {
  bagId: string;
  title: string;
  outletName: string;
  rescuePrice: number;
  pickupStart?: string | null;
  pickupEnd?: string | null;
  webBaseUrl?: string;
}): string {
  const link = buildBagWebLink(args.bagId, args.webBaseUrl);
  const deep = buildBagDeepLink(args.bagId);
  const price = formatListingLkr(args.rescuePrice);
  const pickup = formatListingPickupLine(args.pickupStart, args.pickupEnd);
  const title = args.title.trim() || 'Rescue bag';
  return `Rescue bag: ${title} at ${args.outletName}\n${price} · ${pickup}\n${link}\n\nOpen in app: ${deep}`;
}

export function buildShelfWhatsAppMessage(args: {
  shelfId: string;
  outletName: string;
  itemCount?: number;
  rescuePriceFrom?: number | null;
  pickupStart?: string | null;
  pickupEnd?: string | null;
  webBaseUrl?: string;
}): string {
  const link = buildShelfWebLink(args.shelfId, args.webBaseUrl);
  const deep = buildShelfDeepLink(args.shelfId);
  const count =
    typeof args.itemCount === 'number' && args.itemCount > 0
      ? `${args.itemCount} clearance item${args.itemCount === 1 ? '' : 's'}`
      : 'clearance items';
  const priceLine =
    typeof args.rescuePriceFrom === 'number' && args.rescuePriceFrom > 0
      ? `From ${formatListingLkr(args.rescuePriceFrom)}`
      : null;
  const pickup = formatListingPickupLine(args.pickupStart, args.pickupEnd);
  const detail = [priceLine, pickup].filter(Boolean).join(' · ');
  return `Check out ${count} at ${args.outletName} on Fresh As Ever!\n${detail}\n${link}\n\nOpen in app: ${deep}`;
}

export function buildWhatsAppShareUrl(message: string, phone?: string): string {
  const text = encodeURIComponent(message);
  if (phone) {
    const num = phone.replace(/\D/g, '');
    return `https://wa.me/${num}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

export type OpenWhatsAppShareResult = 'whatsapp' | 'web' | 'share_sheet' | 'dismissed';

export async function openWhatsAppShare(
  message: string,
  options?: { title?: string; phone?: string },
): Promise<OpenWhatsAppShareResult> {
  const title = options?.title ?? 'Share on WhatsApp';
  const encoded = encodeURIComponent(message);
  const nativeUrl = options?.phone
    ? `whatsapp://send?phone=${options.phone.replace(/\D/g, '')}&text=${encoded}`
    : `whatsapp://send?text=${encoded}`;

  try {
    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    if (canOpenNative) {
      await Linking.openURL(nativeUrl);
      return 'whatsapp';
    }
  } catch {
    /* try web fallback */
  }

  const webUrl = buildWhatsAppShareUrl(message, options?.phone);
  try {
    await Linking.openURL(webUrl);
    return 'web';
  } catch {
    /* fall through to share sheet */
  }

  try {
    const payload =
      Platform.OS === 'ios'
        ? { message, url: webUrl }
        : { title, message: `${message}\n\n${webUrl}` };
    const result = await Share.share(payload, { dialogTitle: title, subject: title });
    if (result.action === Share.dismissedAction) return 'dismissed';
    return 'share_sheet';
  } catch {
    return 'dismissed';
  }
}
