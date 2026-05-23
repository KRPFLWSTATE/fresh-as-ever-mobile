/**
 * POST /api/orders/refund via hosted Next.js API.
 */
export async function postOrderRefund(
  apiBaseUrl: string,
  accessToken: string,
  payload: { order_id: string; complaint_id?: string; reason: string },
): Promise<{ ok?: boolean; error?: string; alreadyRefunded?: boolean }> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/orders/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    success?: boolean;
    alreadyRefunded?: boolean;
  };
  if (!res.ok) {
    return { error: json.error || 'Refund failed' };
  }
  return { ok: true, alreadyRefunded: json.alreadyRefunded };
}
