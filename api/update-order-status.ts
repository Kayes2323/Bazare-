import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, verifiedUid, errorResponse } from './_lib/http';
import { updateOrderStatus } from './_lib/orders-service';
import type { OrderStatus } from '../packages/domain/src';

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const uid = await verifiedUid(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: 'Please log in' });
  const { orderId, status } = (req.body ?? {}) as { orderId?: string; status?: OrderStatus };
  if (!orderId || !status || !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid request' });
  try {
    return res.status(200).json({ status: await updateOrderStatus(adminDb(), uid, orderId, status) });
  } catch (e) {
    const { status: code, body } = errorResponse(e);
    return res.status(code).json(body);
  }
}
