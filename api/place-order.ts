import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, verifiedUid, errorResponse } from './_lib/http';
import { placeOrder } from './_lib/orders-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const uid = await verifiedUid(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: 'Please log in to place an order' });
  try {
    const result = await placeOrder(adminDb(), uid, req.body);
    return res.status(200).json(result);
  } catch (e) {
    const { status, body } = errorResponse(e);
    return res.status(status).json(body);
  }
}
