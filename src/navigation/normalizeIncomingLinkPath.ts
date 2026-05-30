/**
 * Mirrors `fresh-as-ever/src/middleware.js` direct + regex redirects so cold deep
 * links that match web legacy paths resolve to RN `linking.ts` canonical paths.
 */

export function normalizeIncomingLinkPath(path: string): string {
  const noHash = path.split('#')[0] ?? path;
  const trimmedInput = noHash.replace(/^\/+/, '');
  const [rawPath, query = ''] = trimmedInput.split('?', 2);

  const attachQuery =
    query.length > 0
      ? (p: string) => (p.includes('?') ? `${p}&${query}` : `${p}?${query}`)
      : (p: string) => p;

  let p = rawPath.replace(/\/+$/, '');

  if (p === 'merchant') {
    return attachQuery('merchant/dashboard');
  }
  if (p === 'admin') {
    return attachQuery('admin/dashboard');
  }
  if (p === 'auth/login') {
    return attachQuery('login');
  }
  if (p === 'support') {
    return attachQuery('profile/support');
  }
  if (p === 'profile/edit') {
    return attachQuery('profile/details');
  }

  const bagLegacy = /^bag\/([^/?#]+)$/.exec(p);
  if (bagLegacy) {
    return attachQuery(`bags/${bagLegacy[1]}`);
  }

  const shelfLegacy = /^shelf\/([^/?#]+)$/.exec(p);
  if (shelfLegacy) {
    return attachQuery(`shelves/${shelfLegacy[1]}`);
  }

  const shelfAllergens = /^shelves\/([^/?#]+)\/allergens$/.exec(p);
  if (shelfAllergens) {
    return attachQuery(`shelves/${shelfAllergens[1]}/allergens`);
  }

  const payoutLegacy =
    /^merchant\/finance\/payout\/([^/?#]+)$/.exec(p);
  if (payoutLegacy) {
    return attachQuery(`merchant/payouts/${payoutLegacy[1]}`);
  }

  const checkoutDraft = /^checkout\/([^/?#]+)$/.exec(p);
  if (checkoutDraft) {
    const draftQs = `draft=${encodeURIComponent(checkoutDraft[1])}`;
    return query.length > 0
      ? `checkout?${draftQs}&${query}`
      : `checkout?${draftQs}`;
  }

  const discoverForced =
    /^discover\/(empty-search|no-results|no-bags-nearby|no-listings-nearby|no-shelves-yet|sold-out)$/.exec(
      p.toLowerCase(),
    );
  if (discoverForced) {
    const st = encodeURIComponent(discoverForced[1].toLowerCase());
    const stateQs = `state=${st}`;
    return query.length > 0
      ? `discover?${stateQs}&${query}`
      : `discover?${stateQs}`;
  }

  const resOk = /^reservation\/success\/([^/?#]+)$/.exec(p);
  const rescueOk = /^rescue\/confirmed\/([^/?#]+)$/.exec(p);
  if (resOk) {
    const id = encodeURIComponent(resOk[1]);
    return `order-celebration?orderId=${id}&variant=reservation`;
  }
  if (rescueOk) {
    const id = encodeURIComponent(rescueOk[1]);
    return `order-celebration?orderId=${id}&variant=rescue`;
  }

  const merchantOnbStep =
    /^merchant\/onboarding\/step-(1|2|3|4)$/.exec(p);
  if (merchantOnbStep) {
    const q = merchantOnbStep[1];
    return query.length > 0
      ? `merchant/onboarding?step=${q}&${query}`
      : `merchant/onboarding?step=${q}`;
  }

  const onbStep = /^onboarding\/step-(1|2|3|4)$/.exec(p);
  if (onbStep) {
    return query.length > 0
      ? `onboarding?step=${onbStep[1]}&${query}`
      : `onboarding?step=${onbStep[1]}`;
  }

  // Admin per-day order drill-down. Canonical path is `admin/orders?day=YYYY-MM-DD`;
  // we accept the cleaner `admin/orders/day/:day` URL too (matches the prior worker's brief).
  const adminOrdersDay = /^admin\/orders\/day\/(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (adminOrdersDay) {
    const dayQs = `day=${adminOrdersDay[1]}`;
    return query.length > 0
      ? `admin/orders?${dayQs}&${query}`
      : `admin/orders?${dayQs}`;
  }

  return query.length > 0 ? `${p}?${query}` : p;
}
