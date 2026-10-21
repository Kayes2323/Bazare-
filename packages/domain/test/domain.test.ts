import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderError, ValidationError, allowedNextStatuses, canTransition, deliveryChargeFor, normalizeBdPhone,
  parsePlaceOrderRequest, priceOrders, actorFor,
} from '../src';

const prod = (over = {}) => ({ sellerId: 's1', name: 'Shirt', price: 400, stock: 5, status: 'active' as const, imageUrl: '', emoji: '👕', ...over });
const validReq = (over = {}) => ({
  clientOrderKey: 'key-12345678', items: [{ productId: 'p1', qty: 2 }], name: 'Rahim', phone: '01712345678',
  address: 'House 1, Road 2', district: 'Dhaka', paymentMethod: 'cod', ...over,
});

test('normalizeBdPhone accepts local and international forms, rejects junk', () => {
  assert.equal(normalizeBdPhone('01712345678'), '01712345678');
  assert.equal(normalizeBdPhone('+8801712345678'), '01712345678');
  assert.equal(normalizeBdPhone('880 1712-345678'), '01712345678');
  for (const bad of ['0121234567', '1234', '', null, 17, '+9779812345678']) assert.equal(normalizeBdPhone(bad), null);
});

test('parsePlaceOrderRequest accepts a valid request and ignores client-sent prices/seller ids', () => {
  const r = parsePlaceOrderRequest(validReq({ items: [{ productId: 'p1', qty: 2, price: 1, sellerId: 'evil' }], total: 1 }));
  assert.deepEqual(r.items, [{ productId: 'p1', qty: 2 }]);
  assert.ok(!('total' in r));
});

test('parsePlaceOrderRequest rejects bad input', () => {
  const bad: unknown[] = [
    null, validReq({ items: [] }), validReq({ items: [{ productId: 'p1', qty: 0 }] }), validReq({ items: [{ productId: 'p1', qty: -2 }] }),
    validReq({ items: [{ productId: 'p1', qty: 1.5 }] }), validReq({ items: [{ productId: 'p1', qty: 1000 }] }),
    validReq({ items: [{ productId: 'p1', qty: 1 }, { productId: 'p1', qty: 1 }] }), validReq({ items: [{ productId: 'a/b', qty: 1 }] }),
    validReq({ phone: '123' }), validReq({ paymentMethod: 'card' }), validReq({ paymentMethod: 'bkash' }),
    validReq({ clientOrderKey: 'short' }), validReq({ clientOrderKey: 'bad key with spaces!' }), validReq({ address: '' }),
  ];
  for (const b of bad) assert.throws(() => parsePlaceOrderRequest(b), ValidationError);
  assert.equal(parsePlaceOrderRequest(validReq({ paymentMethod: 'bkash', paymentPhone: '01812345678' })).paymentPhone, '01812345678');
});

test('delivery: free only above ৳999', () => {
  assert.equal(deliveryChargeFor(999), 60);
  assert.equal(deliveryChargeFor(1000), 0);
});

test('priceOrders uses server prices, groups per seller, computes totals', () => {
  const products = new Map([['p1', prod()], ['p2', prod({ sellerId: 's2', price: 1200 })], ['p3', prod({ price: 100 })]]);
  const orders = priceOrders('buyer', [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }, { productId: 'p3', qty: 1 }], products);
  assert.equal(orders.length, 2);
  const s1 = orders.find((o) => o.sellerId === 's1')!;
  assert.equal(s1.subtotal, 900); assert.equal(s1.deliveryCharge, 60); assert.equal(s1.total, 960);
  const s2 = orders.find((o) => o.sellerId === 's2')!;
  assert.equal(s2.deliveryCharge, 0); assert.equal(s2.total, 1200);
});

test('priceOrders rejects missing, inactive, out-of-stock and own products', () => {
  const run = (p: ReturnType<typeof prod> | undefined, qty = 1, buyer = 'b') => () => priceOrders(buyer, [{ productId: 'p', qty }], new Map([['p', p]]));
  assert.throws(run(undefined), (e) => e instanceof OrderError && e.code === 'not_found');
  assert.throws(run(prod({ status: 'draft' as never })), (e) => e instanceof OrderError && e.code === 'unavailable');
  assert.throws(run(prod({ stock: 1 }), 2), (e) => e instanceof OrderError && e.code === 'out_of_stock');
  assert.throws(run(prod({ stock: 0 })), (e) => e instanceof OrderError && e.code === 'out_of_stock');
  assert.throws(run(prod(), 1, 's1'), (e) => e instanceof OrderError && e.code === 'own_product');
});

test('status transitions per actor', () => {
  assert.deepEqual(allowedNextStatuses('pending', 'buyer'), ['cancelled']);
  assert.deepEqual(allowedNextStatuses('confirmed', 'buyer'), []);
  assert.ok(canTransition('pending', 'confirmed', 'seller'));
  assert.ok(canTransition('shipped', 'delivered', 'seller'));
  assert.ok(!canTransition('pending', 'delivered', 'seller'), 'cannot skip steps');
  assert.ok(!canTransition('shipped', 'cancelled', 'seller'), 'shipped orders cannot be cancelled');
  assert.ok(!canTransition('delivered', 'cancelled', 'admin'), 'terminal');
  assert.ok(!canTransition('cancelled', 'pending', 'admin'), 'terminal');
  assert.ok(!canTransition('pending', 'confirmed', 'buyer'), 'buyers cannot confirm');
});

test('actorFor', () => {
  const o = { buyerId: 'b', sellerId: 's' };
  assert.equal(actorFor('b', 'buyer', o), 'buyer');
  assert.equal(actorFor('s', 'seller', o), 'seller');
  assert.equal(actorFor('a', 'admin', o), 'admin');
  assert.equal(actorFor('x', 'seller', o), null);
  assert.equal(actorFor('x', 'buyer', o), null);
});
