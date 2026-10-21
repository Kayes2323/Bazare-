const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Lowercases, converts Bangla digits to ASCII, strips thousands separators and collapses whitespace. */
export function normalizeText(input: string): string {
  let s = input.normalize('NFKC').toLowerCase();
  s = s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  s = s.replace(/(\d),(?=\d{3}\b)/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

/** "FX-991 ES" → "fx991es". Used to compare model numbers regardless of spacing/dashes/case. */
export function modelKey(input: string): string {
  return normalizeText(input).replace(/[^a-z0-9ঀ-৿]/g, '');
}

export function wordTokens(input: string): string[] {
  return normalizeText(input).split(/[^a-z0-9ঀ-৿]+/).filter(Boolean);
}

export function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
