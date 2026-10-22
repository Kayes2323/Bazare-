import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, increment } from 'firebase/firestore';

let env: RulesTestEnvironment;

const product = (over: Record<string, unknown> = {}) => ({
  sellerId: 'seller1', sellerName: 'Shop', name: 'Panjabi', category: 'fashion', description: 'nice',
  price: 500, stock: 10, status: 'active', imageUrls: [], sold: 0, rating: 0, reviewCount: 0, ...over,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bazare',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), { uid: 'admin1', role: 'admin' });
    await setDoc(doc(db, 'users/seller1'), { uid: 'seller1', role: 'seller' });
    await setDoc(doc(db, 'users/seller2'), { uid: 'seller2', role: 'seller' });
    await setDoc(doc(db, 'users/buyer1'), { uid: 'buyer1', role: 'buyer' });
    await setDoc(doc(db, 'users/buyer2'), { uid: 'buyer2', role: 'buyer' });
    await setDoc(doc(db, 'sellers/seller1'), { uid: 'seller1', status: 'approved', nid: 'SECRET' });
    await setDoc(doc(db, 'products/p1'), product());
    await setDoc(doc(db, 'products/draft1'), product({ status: 'draft' }));
    await setDoc(doc(db, 'orders/o1'), { buyerId: 'buyer1', sellerId: 'seller1', status: 'delivered', items: [{ id: 'p1' }], total: 560 });
  });
});

const as = (uid: string | null) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const asEmail = (uid: string, email: string, verified: boolean) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const OWNER_EMAIL = 'aakayes99@gmail.com';

// ── privilege escalation ─────────────────────────────────────
test('user cannot create profile with role admin or seller', async () => {
  const base = { uid: 'new1', name: 'N', email: '', phone: '', photoURL: '' };
  await assertFails(setDoc(doc(as('new1'), 'users/new1'), { ...base, role: 'admin' }));
  await assertFails(setDoc(doc(as('new1'), 'users/new1'), { ...base, role: 'seller' }));
  await assertSucceeds(setDoc(doc(as('new1'), 'users/new1'), { ...base, role: 'buyer' }));
});

test('buyer cannot promote themselves to admin or approved seller (the old admin-key flow)', async () => {
  await assertFails(updateDoc(doc(as('buyer1'), 'users/buyer1'), { role: 'admin' }));
  await assertFails(updateDoc(doc(as('buyer1'), 'users/buyer1'), { role: 'seller' }));
  await assertFails(updateDoc(doc(as('buyer1'), 'users/buyer1'), { sellerStatus: 'approved' }));
  await assertSucceeds(updateDoc(doc(as('buyer1'), 'users/buyer1'), { sellerStatus: 'pending', shopName: 'X' }));
});

test('admin can approve sellers; users cannot read other profiles', async () => {
  await assertSucceeds(updateDoc(doc(as('admin1'), 'users/buyer1'), { role: 'seller', sellerStatus: 'approved' }));
  await assertFails(getDoc(doc(as('buyer2'), 'users/buyer1')));
  await assertSucceeds(getDoc(doc(as('buyer1'), 'users/buyer1')));
});

test('seller application: pending only, private from other users', async () => {
  const app = { uid: 'buyer1', name: 'B', status: 'pending' };
  await assertFails(setDoc(doc(as('buyer1'), 'sellers/buyer1'), { ...app, status: 'approved' }));
  await assertSucceeds(setDoc(doc(as('buyer1'), 'sellers/buyer1'), app));
  await assertFails(getDoc(doc(as('buyer2'), 'sellers/buyer1')));
  await assertFails(getDoc(doc(as(null), 'sellers/seller1')));
  await assertFails(updateDoc(doc(as('seller1'), 'sellers/seller1'), { status: 'pending' })); // approved sellers can't self-edit status
  await assertSucceeds(updateDoc(doc(as('admin1'), 'sellers/buyer1'), { status: 'approved' }));
});

// ── products ─────────────────────────────────────────────────
test('public can read active products but not drafts', async () => {
  await assertSucceeds(getDoc(doc(as(null), 'products/p1')));
  await assertFails(getDoc(doc(as(null), 'products/draft1')));
  await assertFails(getDoc(doc(as('seller2'), 'products/draft1')));
  await assertSucceeds(getDoc(doc(as('seller1'), 'products/draft1')));
  await assertSucceeds(getDocs(query(collection(as(null), 'products'), where('status', '==', 'active'))));
  await assertFails(getDocs(collection(as(null), 'products')));
});

test('only approved-role sellers create products, only for themselves, with sane values', async () => {
  const s1 = as('seller1');
  await assertSucceeds(addDoc(collection(s1, 'products'), product()));
  await assertFails(addDoc(collection(as('buyer1'), 'products'), product({ sellerId: 'buyer1' })));
  await assertFails(addDoc(collection(s1, 'products'), product({ sellerId: 'seller2' })));
  await assertFails(addDoc(collection(s1, 'products'), product({ price: -5 })));
  await assertFails(addDoc(collection(s1, 'products'), product({ price: 99.5 })));
  await assertFails(addDoc(collection(s1, 'products'), product({ stock: -1 })));
  await assertFails(addDoc(collection(s1, 'products'), product({ sold: 50 })));
  await assertFails(addDoc(collection(s1, 'products'), product({ rating: 5 })));
});

test('sellers cannot edit or delete another seller\'s product; cannot forge counters', async () => {
  await assertFails(updateDoc(doc(as('seller2'), 'products/p1'), { price: 1 }));
  await assertFails(deleteDoc(doc(as('seller2'), 'products/p1')));
  await assertFails(updateDoc(doc(as('buyer1'), 'products/p1'), { stock: 0 }));
  await assertFails(updateDoc(doc(as('seller1'), 'products/p1'), { sold: 999 }));
  await assertFails(updateDoc(doc(as('seller1'), 'products/p1'), { sellerId: 'seller2' }));
  await assertSucceeds(updateDoc(doc(as('seller1'), 'products/p1'), { price: 450, stock: 7 }));
  await assertSucceeds(deleteDoc(doc(as('seller1'), 'products/p1')));
});

test('anyone can bump views by exactly 1, nothing else', async () => {
  await assertSucceeds(updateDoc(doc(as(null), 'products/p1'), { views: increment(1) }));
  await assertFails(updateDoc(doc(as(null), 'products/p1'), { views: increment(50) }));
  await assertFails(updateDoc(doc(as('buyer1'), 'products/p1'), { stock: increment(-1) }));
});

// ── orders ───────────────────────────────────────────────────
test('orders: only buyer, that seller and admin can read; nobody can write from the client', async () => {
  await assertSucceeds(getDoc(doc(as('buyer1'), 'orders/o1')));
  await assertSucceeds(getDoc(doc(as('seller1'), 'orders/o1')));
  await assertSucceeds(getDoc(doc(as('admin1'), 'orders/o1')));
  await assertFails(getDoc(doc(as('buyer2'), 'orders/o1')));
  await assertFails(getDoc(doc(as('seller2'), 'orders/o1')));
  await assertFails(getDoc(doc(as(null), 'orders/o1')));
  await assertSucceeds(getDocs(query(collection(as('buyer1'), 'orders'), where('buyerId', '==', 'buyer1'))));
  await assertFails(getDocs(query(collection(as('buyer2'), 'orders'), where('buyerId', '==', 'buyer1'))));
  await assertFails(addDoc(collection(as('buyer1'), 'orders'), { buyerId: 'buyer1', total: 1 }));
  await assertFails(updateDoc(doc(as('buyer1'), 'orders/o1'), { status: 'cancelled' }));
  await assertFails(updateDoc(doc(as('seller1'), 'orders/o1'), { status: 'delivered' }));
  await assertFails(updateDoc(doc(as('admin1'), 'orders/o1'), { total: 1 }));
});

// ── reviews ──────────────────────────────────────────────────
test('reviews: only the buyer of a delivered order, once, with valid rating', async () => {
  const r = { orderId: 'o1', productId: 'p1', buyerId: 'buyer1', rating: 5, comment: 'good' };
  await assertFails(setDoc(doc(as('buyer2'), 'reviews/o1'), { ...r, buyerId: 'buyer2' }));
  await assertFails(setDoc(doc(as('buyer1'), 'reviews/o1'), { ...r, rating: 9 }));
  await assertFails(setDoc(doc(as('buyer1'), 'reviews/o1'), { ...r, productId: 'other' }));
  await assertSucceeds(setDoc(doc(as('buyer1'), 'reviews/o1'), r));
  await assertFails(updateDoc(doc(as('buyer1'), 'reviews/o1'), { rating: 1 }));
  await assertSucceeds(getDoc(doc(as(null), 'reviews/o1')));
});

test('unknown collections are denied', async () => {
  await assertFails(getDoc(doc(as('admin1'), 'secrets/x')));
  await assertFails(setDoc(doc(as('admin1'), 'secrets/x'), { a: 1 }));
});

// ── search metadata & server-only collections ────────────────
test('product search metadata is validated; unauthorized seller cannot change stock/condition', async () => {
  const s1 = as('seller1');
  await assertSucceeds(addDoc(collection(s1, 'products'), product({ brand: 'Casio', model: 'FX-991ES', condition: 'used', categoryKey: 'calculator', aliases: ['fx991es'] })));
  await assertFails(addDoc(collection(s1, 'products'), product({ condition: 'mint' })));
  await assertFails(addDoc(collection(s1, 'products'), product({ brand: 123 })));
  await assertFails(addDoc(collection(s1, 'products'), product({ aliases: Array(11).fill('a') })));
  await assertFails(updateDoc(doc(as('seller2'), 'products/p1'), { stock: 999, condition: 'new' }));
  await assertFails(updateDoc(doc(as('buyer1'), 'products/p1'), { stock: 999 }));
  await assertSucceeds(updateDoc(doc(s1, 'products/p1'), { stock: 4, condition: 'used' }));
});

// ── bootstrap owner admin ──────────────────────────────────────
test('the owner email self-creates as admin only with a verified Firebase email claim', async () => {
  const base = { uid: 'owner1', name: 'Owner', email: OWNER_EMAIL, phone: '', photoURL: '' };
  await assertSucceeds(setDoc(doc(asEmail('owner1', OWNER_EMAIL, true), 'users/owner1'), { ...base, role: 'admin' }));
  await assertFails(setDoc(doc(asEmail('owner2', OWNER_EMAIL, false), 'users/owner2'), { ...base, uid: 'owner2', role: 'admin' })); // unverified email claim
  await assertFails(setDoc(doc(as('owner3'), 'users/owner3'), { ...base, uid: 'owner3', role: 'admin' })); // no email claim at all
});

test('a different email cannot self-create as admin even if it writes the owner email into the document', async () => {
  const spoofed = { uid: 'evil1', name: 'E', email: OWNER_EMAIL, phone: '', photoURL: '', role: 'admin' };
  await assertFails(setDoc(doc(asEmail('evil1', 'attacker@example.com', true), 'users/evil1'), spoofed));
});

test('an existing buyer profile under the owner email self-promotes to admin exactly once', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/owner4'), { uid: 'owner4', email: OWNER_EMAIL, role: 'buyer' });
  });
  const db4 = asEmail('owner4', OWNER_EMAIL, true);
  await assertSucceeds(updateDoc(doc(db4, 'users/owner4'), { role: 'admin' }));
  // cannot be used to also smuggle other field changes in the same write
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/owner5'), { uid: 'owner5', email: OWNER_EMAIL, role: 'buyer', shopName: 'X' });
  });
  await assertFails(updateDoc(doc(asEmail('owner5', OWNER_EMAIL, true), 'users/owner5'), { role: 'admin', shopName: 'Y' }));
});

test('rateLimits/aiUsage are not accessible from clients', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'rateLimits/x'), { count: 1 }); });
  await assertFails(getDoc(doc(as('admin1'), 'rateLimits/x')));
  await assertFails(setDoc(doc(as('buyer1'), 'rateLimits/x'), { count: 0 }));
});
