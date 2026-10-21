import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, errorResponse } from './_lib/http';
import { productAvailability } from './_lib/search-service';
import { callerKey, consume } from './_lib/limits';

// POST /api/availability { ids: string[] } → fresh public price/stock status (never a reservation)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const db = adminDb();
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
    if (!(await consume(db, `avail_${callerKey(null, ip)}`, 30, 60_000, Date.now()))) return res.status(429).json({ error: 'Too many requests', code: 'rate_limited' });
    return res.status(200).json({ items: await productAvailability(db, (req.body ?? {}).ids, Date.now()) });
  } catch (e) {
    const { status, body } = errorResponse(e);
    return res.status(status).json(body);
  }
}
