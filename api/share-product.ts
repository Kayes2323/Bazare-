import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/http';
import { renderProductSharePage } from './_lib/share-page';

// GET /p/<productId> → rewritten here (see vercel.json). Only active products are exposed; drafts look like 404s.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? '');
  if (!id || id.includes('/')) return res.status(404).send('Not found');
  try {
    const snap = await adminDb().collection('products').doc(id).get();
    if (!snap.exists || snap.get('status') !== 'active') return res.status(404).send('Product not found');
    const proto = String(req.headers['x-forwarded-proto'] ?? 'https');
    const origin = `${proto}://${req.headers.host}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(renderProductSharePage(origin, { id: snap.id, ...(snap.data() as object) } as never));
  } catch (e) {
    console.error('share-product failed', e instanceof Error ? e.message : 'unknown');
    return res.status(500).send('Something went wrong');
  }
}
