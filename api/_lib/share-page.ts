/** Renders the crawler-friendly share page for a product (Open Graph tags) that sends humans on to the app page. */
const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const httpsUrl = (u: unknown): string => {
  try {
    const x = new URL(String(u));
    return x.protocol === 'https:' ? x.href : '';
  } catch {
    return '';
  }
};

export interface ShareProduct { id: string; name: string; price: number; description?: string; imageUrl?: string; sellerName?: string; stock?: number }

export function renderProductSharePage(origin: string, p: ShareProduct): string {
  const title = `${p.name} — ৳${p.price.toLocaleString('en-US')} | Bazare`;
  const desc = (p.description || `${p.sellerName ?? 'Bazare'} এর পণ্য`).replace(/\s+/g, ' ').slice(0, 160);
  const target = `${origin}/product.html?id=${encodeURIComponent(p.id)}`;
  const image = httpsUrl(p.imageUrl);
  return `<!doctype html>
<html lang="bn"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${escapeHtml(origin)}/p/${escapeHtml(encodeURIComponent(p.id))}">
<meta property="og:type" content="product"><meta property="og:site_name" content="Bazare">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(desc)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="BDT">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
</head><body><p><a href="${escapeHtml(target)}">${escapeHtml(p.name)} — Bazare এ দেখুন</a></p></body></html>`;
}
