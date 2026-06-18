const KNOWN_AREAS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bcolombo\s*0?1\b/i, label: 'Colombo 01' },
  { pattern: /\bcolombo\s*0?2\b/i, label: 'Colombo 02' },
  { pattern: /\bcolombo\s*0?3\b/i, label: 'Colombo 03' },
  { pattern: /\bcolombo\s*0?4\b/i, label: 'Colombo 04' },
  { pattern: /\bcolombo\s*0?5\b/i, label: 'Colombo 05' },
  { pattern: /\bcolombo\s*0?6\b/i, label: 'Colombo 06' },
  { pattern: /\bcolombo\s*0?7\b/i, label: 'Colombo 07' },
  { pattern: /\bcolombo\s*0?8\b/i, label: 'Colombo 08' },
  { pattern: /\bcolombo\s*0?9\b/i, label: 'Colombo 09' },
  { pattern: /\bcolombo\s*10\b/i, label: 'Colombo 10' },
  { pattern: /\bcolombo\s*11\b/i, label: 'Colombo 11' },
  { pattern: /\bcolombo\s*12\b/i, label: 'Colombo 12' },
  { pattern: /\bcolombo\s*13\b/i, label: 'Colombo 13' },
  { pattern: /\bcolombo\s*14\b/i, label: 'Colombo 14' },
  { pattern: /\bcolombo\s*15\b/i, label: 'Colombo 15' },
  { pattern: /\bkollupitiya\b/i, label: 'Kollupitiya' },
  { pattern: /\brajagiriya\b/i, label: 'Rajagiriya' },
  { pattern: /\bwellawatte\b/i, label: 'Wellawatte' },
  { pattern: /\bnugegoda\b/i, label: 'Nugegoda' },
  { pattern: /\bdehiwala\b/i, label: 'Dehiwala' },
  { pattern: /\bfort\b/i, label: 'Fort' },
  { pattern: /\bbambalapitiya\b/i, label: 'Bambalapitiya' },
  { pattern: /\bpettah\b/i, label: 'Pettah' },
  { pattern: /\bgalle\s+face\b/i, label: 'Galle Face' },
];

/** Suggest a short neighbourhood label from a free-text address (merchant editor). */
export function suggestLandmarkFromAddress(address: string): string | null {
  const text = address.trim();
  if (!text) return null;
  for (const { pattern, label } of KNOWN_AREAS) {
    if (pattern.test(text)) return label;
  }
  return null;
}
