/** Discover card subtitle: `{outlet_name} · {landmark}` when landmark browse is on. */
export function formatOutletLandmarkSubtitle(
  outletName: string | null | undefined,
  landmark: string | null | undefined,
): string {
  const name = String(outletName ?? '').trim() || 'Local partner';
  const area = String(landmark ?? '').trim();
  if (!area) return name;
  return `${name} · ${area}`;
}

/** Gate landmark segment behind Pass 26 `NEIGHBOURHOOD_BROWSE` flag. */
export function formatDiscoverCardSubtitle(
  outletName: string | null | undefined,
  landmark: string | null | undefined,
  neighbourhoodBrowseEnabled: boolean,
): string {
  const name = String(outletName ?? '').trim() || 'Local partner';
  if (!neighbourhoodBrowseEnabled) return name;
  return formatOutletLandmarkSubtitle(name, landmark);
}

/** Resolve landmark from RPC flat columns or nested outlet join. */
export function resolveFeedItemLandmark(
  item: Record<string, unknown>,
): string | null {
  const payload = item.payload as Record<string, unknown> | undefined;
  const direct =
    item.landmark ??
    item.outlet_landmark ??
    payload?.landmark ??
    payload?.outlet_landmark;
  if (direct != null && String(direct).trim()) {
    return String(direct).trim();
  }
  const outlet = (item.outlet ?? payload?.outlet) as
    | Record<string, unknown>
    | undefined;
  if (outlet?.landmark != null && String(outlet.landmark).trim()) {
    return String(outlet.landmark).trim();
  }
  return null;
}
