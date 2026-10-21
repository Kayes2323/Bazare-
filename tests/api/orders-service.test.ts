import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { placeOrder, updateOrderStatus } from '../../api/_lib/orders-service';

// Runs against the Firestore emulator (FIRESTORE_EMULATOR_HOST is set by `firebase emulators:exec`).
let db: Firestore;
before(() => {
  if (!getApps().length) initializeApp({ projectId: 'demo-bazare' });
  db = getFirestore();
});

const req = (over: Record<string, unknown> = {}) => ({
  clientOrderKey: 'key-aaaaaaaa', items: [{ productId: 'p1', qty: 2 }], name: 'Rahim', phone: '01712345678',
  address: 'House 1, Road 2', district: 'Dhaka', paymentMethod: 'cod', ...over,
});

async function reset() {
  const cols = ['users', 'sellers', 'products', 'orders'];
  for (const c of cols) for (const d of (await db.collection(c).get()).docs) await d.ref.delete();
  await db.doc('users/admin1').set({ role: 'admin' });
  await db.doc('users/seller1').set({ role: 'seller' });
  await db.doc('users/seller2').set({ role: 'seller' });
  await db.doc('users/buyer1').set({ role: 'buyer' });
  await db.doc('users/buyer2').set({ role: 'buyer' });
  await db.doc('sellers/seller1').set({ status: 'approved' });
  await db.doc('sellers/seller2').set({ status: 'approved' });
  const p = { sellerId: 'seller1', name: 'Shirt', price: 400, stock: 5, status: 'active', sold: 0, imageUrl: '', emoji: '👕' };
  await db.doc('products/p1').set(p);
  await db.doc('products/p2').set({ ...p, sellerId: 'seller2', name: 'Bag', price: 1200, stock: 3 });
  await db.doc('products/draft').set({ ...p, status: 'draft' });
}
beforeEach(reset);

const stock = async (id: string) => (await db.doc(`products/${id}`).get()).get('stock') as number;

test('placeOrder prices from the database, splits by seller, deducts stock', async () => {
  const r = await placeOrder(db, 'buyer1', req({ items: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }], price: 1, total: 1 }));
  assert.equal(r.orderIds.length, 2);
  const o1 = (await db.doc(`orders/buyer1_key-aaaaaaaa_seller1`).get()).data()!;
  assert.equal(o1.subtotal, 800); assert.equal(o1.deliveryCharge, 60); assert.equal(o1.total, 860);
  assert.equal(o1.buyerId, 'buyer1'); assert.equal(o1.status, 'pending'); assert.equal(o1.paymentStatus, 'unpaid');
  assert.equal(o1.statusHistory.length, 1);
  assert.equal((await db.doc(`orders/buyer1_key-aaaaaaaa_seller2`).get()).get('total'), 1200);
  assert.equal(await stock('p1'), 3); assert.equal(await stock('p2'), 2);
});

test('placeOrder is idempotent: double submit creates one order and deducts stock once', async () => {
  const a = await placeOrder(db, 'buyer1', req());
  const b = await placeOrder(db, 'buyer1', req());
  assert.deepEqual(a.orderIds, b.orderIds);
  assert.equal((await db.collection('orders').get()).size, 1);
  assert.equal(await stock('p1'), 3);
});

test('placeOrder rejects unavailable, draft, own and unapproved-seller products with no side effects', async () => {
  await assert.rejects(placeOrder(db, 'buyer1', req({ items: [{ productId: 'p1', qty: 6 }] })), /only 5 left/);
  await assert.rejects(placeOrder(db, 'buyer1', req({ items: [{ productId: 'draft', qty: 1 }] })), /not available/);
  await assert.rejects(placeOrder(db, 'buyer1', req({ items: [{ productId: 'nope', qty: 1 }] })), /no longer exists/);
  await assert.rejects(placeOrder(db, 'seller1', req()), /own product/);
  await db.doc('sellers/seller1').update({ status: 'rejected' });
  await assert.rejects(placeOrder(db, 'buyer1', req()), /not available/);
  assert.equal((await db.collection('orders').get()).size, 0);
  assert.equal(await stock('p1'), 5);
});

test('a failing line rolls back the whole cart (no partial stock deduction)', async () => {
  await assert.rejects(placeOrder(db, 'buyer1', req({ items: [{ productId: 'p1', qty: 1 }, { productId: 'p2', qty: 99 }] })));
  assert.equal(await stock('p1'), 5);
  assert.equal((await db.collection('orders').get()).size, 0);
});

test('concurrent orders cannot oversell the last unit', async () => {
  await db.doc('products/p1').update({ stock: 1 });
  const results = await Promise.allSettled(
    ['buyer1', 'buyer2'].map((u, i) => placeOrder(db, u, req({ clientOrderKey: `key-concurrent-${i}`, items: [{ productId: 'p1', qty: 1 }] }))),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await stock('p1'), 0);
  assert.equal((await db.collection('orders').get()).size, 1);
});

async function newOrder() {
  const r = await placeOrder(db, 'buyer1', req());
  return r.orderIds[0];
}

test('status flow: seller confirms → ships → delivers; sold counter only increments on delivery', async () => {
  const id = await newOrder();
  assert.equal(await updateOrderStatus(db, 'seller1', id, 'confirmed'), 'confirmed');
  await updateOrderStatus(db, 'seller1', id, 'shipped');
  assert.equal((await db.doc('products/p1').get()).get('sold'), 0);
  await updateOrderStatus(db, 'seller1', id, 'delivered');
  assert.equal((await db.doc('products/p1').get()).get('sold'), 2);
  const o = (await db.doc(`orders/${id}`).get()).data()!;
  assert.deepEqual(o.statusHistory.map((e: { status: string }) => e.status), ['pending', 'confirmed', 'shipped', 'delivered']);
});

test('illegal transitions and wrong actors are rejected', async () => {
  const id = await newOrder();
  await assert.rejects(updateOrderStatus(db, 'seller1', id, 'delivered'), /Cannot change/);
  await assert.rejects(updateOrderStatus(db, 'seller2', id, 'confirmed'), /Order not found/); // other seller
  await assert.rejects(updateOrderStatus(db, 'buyer2', id, 'cancelled'), /Order not found/); // other buyer
  await assert.rejects(updateOrderStatus(db, 'buyer1', id, 'confirmed'), /Cannot change/); // buyer can't confirm
  await updateOrderStatus(db, 'seller1', id, 'confirmed');
  await assert.rejects(updateOrderStatus(db, 'buyer1', id, 'cancelled'), /Cannot change/); // buyer can cancel only while pending
  await updateOrderStatus(db, 'admin1', id, 'shipped');
  await assert.rejects(updateOrderStatus(db, 'seller1', id, 'cancelled'), /Cannot change/);
});

test('cancelling restores stock exactly once', async () => {
  const id = await newOrder();
  assert.equal(await stock('p1'), 3);
  await updateOrderStatus(db, 'buyer1', id, 'cancelled');
  assert.equal(await stock('p1'), 5);
  await assert.rejects(updateOrderStatus(db, 'buyer1', id, 'cancelled'), /Cannot change/);
  assert.equal(await stock('p1'), 5);
});
