function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

export type PayHereFormFields = Record<string, string>;

/** Auto-submit sandbox checkout POST (PayHERE hosted page). */
export function buildSandboxPayHereCheckoutHtml(fields: PayHereFormFields): string {
  const keys = Object.keys(fields);
  const inputs = keys
    .map(
      (k) =>
        `<input type="hidden" name="${esc(k)}" value="${esc(fields[k] ?? '')}" />`,
    )
    .join('\n');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head>
<body><form id="ph" method="post" action="https://sandbox.payhere.lk/pay/checkout">${inputs}</form>
<script>document.getElementById('ph').submit();</script></body></html>`;
}
