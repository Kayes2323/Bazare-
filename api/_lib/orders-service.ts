import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import {
  OrderError, actorFor, canTransition, parsePlaceOrderRequest, priceOrders,
  type OrderStatus, type OrderStatusEvent, type Role,
} from '../../packages/domain/src';

async function roleOf(db: Firestore, uid: string): Promise<Role> {
  const snap = await db.collection('users').doc(uid).get();
  const role = snap.exists ? snap.get('role') : 'buyer';
  return role === 'admin' || role === 'seller' ? role : 'buyer';
}

/**
 * Creates one order per seller in a single transaction: re-reads prices/stock from Firestore,
 * decrements stock, and is idempotent per (buyer, clientOrderKey, seller).
 */
export async function placeOrder(db: Firestore, uid: string, raw: unknown): Promise<{ orderIds: string[]; totals: number[] }> {
  const req = parsePlaceOrderRequest(raw);

  return db.runTransaction(async (tx) => {
    const orders = db.collection('orders');
    const productRefs = req.items.map((i) => db.collection('products').doc(i.productId));
    const productSnaps = await tx.getAll(...productRefs);
    const products = new Map(productSnaps.map((s) => [s.id, s.exists ? (s.data() as never) : undefined]));

    const sellerIds = [...new Set(productSnaps.filter((s) => s.exists).map((s) => s.get('sellerId') as string))];
    const sellerSnaps = sellerIds.length ? await tx.getAll(...sellerIds.map((id) => db.collection('sellers').doc(id))) : [];
    for (const s of sellerSnaps) {
      if (!s.exists || s.get('status') !== 'approved') throw new OrderError('unavailable', 'A seller in your cart is not available');
    }

    const priced = priceOrders(uid, req.items, products as never);

    // Idempotency: if these orders already exist for this key, return them unchanged.
    const orderRefs = priced.map((p) => orders.doc(`${uid}_${req.clientOrderKey}_${p.sellerId}`));
    const existing = await tx.getAll(...orderRefs);
    if (existing.every((s) => s.exists)) {
      return { orderIds: existing.map((s) => s.id), totals: existing.map((s) => s.get('total') as number) };
    }
    if (existing.some((s) => s.exists)) throw new OrderError('unavailable', 'Order key conflict; refresh and retry');

    const now = Timestamp.now();
    priced.forEach((p, idx) => {
      const event: OrderStatusEvent = { status: 'pending', atMs: now.toMillis(), by: uid, byRole: 'buyer' };
      tx.create(orderRefs[idx], {
        buyerId: uid,
        buyerName: req.name,
        buyerPhone: req.phone,
        sellerId: p.sellerId,
        items: p.items,
        productName: p.items.map((i) => i.name).join(', '),
        address: { full: req.address, district: req.district, upazila: req.upazila ?? '', note: req.note ?? '' },
        paymentMethod: req.paymentMethod,
        paymentPhone: req.paymentPhone ?? '',
        paymentStatus: 'unpaid',
        subtotal: p.subtotal,
        deliveryCharge: p.deliveryCharge,
        total: p.total,
        status: 'pending',
        statusHistory: [event],
        createdAt: FieldValue.serverTimestamp(),
      });
      for (const item of p.items) {
        tx.update(db.collection('products').doc(item.id), { stock: FieldValue.increment(-item.qty) });
      }
    });
    return { orderIds: orderRefs.map((r) => r.id), totals: priced.map((p) => p.total) };
  });
}

/** Applies an order status change after checking who the caller is and whether the transition is legal. */
export async function updateOrderStatus(db: Firestore, uid: string, orderId: string, next: OrderStatus): Promise<OrderStatus> {
  if (typeof orderId !== 'string' || !orderId || orderId.includes('/')) throw new OrderError('not_found', 'Order not found');
  const role = await roleOf(db, uid);

  return db.runTransaction(async (tx) => {
    const ref = db.collection('orders').doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OrderError('not_found', 'Order not found');
    const order = snap.data() as { buyerId: string; sellerId: string; status: OrderStatus; items: { id: string; qty: number }[]; statusHistory?: OrderStatusEvent[] };

    const actor = actorFor(uid, role, order);
    if (!actor) throw new OrderError('not_found', 'Order not found'); // do not reveal other users' orders
    if (!canTransition(order.status, next, actor)) throw new OrderError('bad_transition', `Cannot change order from ${order.status} to ${next}`);

    // All reads before writes (Firestore transaction rule).
    const productSnaps = next === 'cancelled' || next === 'delivered'
      ? await tx.getAll(...order.items.map((i) => db.collection('products').doc(i.id)))
      : [];

    const event: OrderStatusEvent = { status: next, atMs: Date.now(), by: uid, byRole: actor === 'admin' ? 'admin' : actor === 'seller' ? 'seller' : 'buyer' };
    tx.update(ref, { status: next, updatedAt: FieldValue.serverTimestamp(), statusHistory: [...(order.statusHistory ?? []), event] });

    order.items.forEach((item, i) => {
      if (!productSnaps[i]?.exists) return;
      if (next === 'cancelled') tx.update(productSnaps[i].ref, { stock: FieldValue.increment(item.qty) });
      if (next === 'delivered') tx.update(productSnaps[i].ref, { sold: FieldValue.increment(item.qty) });
    });
    return next;
  });
}
