const DEFAULT_SHARE_BASE = 'https://freshasever.com';

export function buildShelfDeepLink(shelfId: string): string {
  return `freshasever://shelves/${encodeURIComponent(shelfId)}`;
}

export function buildShelfWebLink(shelfId: string, baseUrl?: string): string {
  const base = (baseUrl ?? DEFAULT_SHARE_BASE).replace(/\/$/, '');
  return `${base}/shelves/${encodeURIComponent(shelfId)}`;
}

export function buildShelfWhatsAppMessage(args: {
  shelfId: string;
  outletName: string;
  itemCount?: number;
  webBaseUrl?: string;
}): string {
  const link = buildShelfWebLink(args.shelfId, args.webBaseUrl);
  const deep = buildShelfDeepLink(args.shelfId);
  const count =
    typeof args.itemCount === 'number' && args.itemCount > 0
      ? `${args.itemCount} clearance item${args.itemCount === 1 ? '' : 's'}`
      : 'clearance items';
  return `Check out ${count} at ${args.outletName} on Fresh As Ever!\n${link}\n\nOpen in app: ${deep}`;
}

export function buildWhatsAppShareUrl(message: string, phone?: string): string {
  const text = encodeURIComponent(message);
  if (phone) {
    const num = phone.replace(/\D/g, '');
    return `https://wa.me/${num}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}
