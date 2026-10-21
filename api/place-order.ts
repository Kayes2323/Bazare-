import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, verifiedUid, errorResponse } from './_lib/http';
import { placeOrder } from './_lib/orders-service';
import { consume } from './_lib/limits';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const uid = await verifiedUid(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: 'Please log in to place an order' });
  try {
    const db = adminDb();
    if (!(await consume(db, `order_u_${uid}`, 10, 60_000, Date.now()))) return res.status(429).json({ error: 'অনেক বেশি অনুরোধ, কিছুক্ষণ পর আবার চেষ্টা করুন', code: 'rate_limited' });
    const result = await placeOrder(db, uid, req.body);
    return res.status(200).json(result);
  } catch (e) {
    const { status, body } = errorResponse(e);
    return res.status(status).json(body);
  }
}
