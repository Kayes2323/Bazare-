import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, availabilityOf, evaluate, parseQueryRules, runSearch, type Candidate, type SellerInfo } from '../src';

const NOW = Date.UTC(2026, 9, 20);
const DAY = 86_400_000;
const sellers = new Map<string, SellerInfo>([['s1', { status: 'approved', district: 'Dhaka' }], ['s2', { status: 'approved', district: 'Sylhet' }], ['bad', { status: 'pending' }]]);

let n = 0;
const P = (over: Partial<Candidate> = {}): Candidate => ({
  id: `p${++n}`, name: 'Casio FX-991ES Plus', category: 'ক্যালকুলেটর', categoryKey: 'calculator', brand: 'Casio', model: 'FX-991ES',
  condition: 'used', price: 1400, stock: 3, status: 'active', sellerId: 's1', sellerName: 'Shop', updatedAtMs: NOW - 2 * DAY, ...over,
});
const q = (s: string) => parseQueryRules(s);
const ids = (r: ReturnType<typeof runSearch>) => r.hits.map((h) => h.product.id);

test('exact model match ranks first and is labelled exact with reasons', () => {
  const exact = P({ id: 'exact' });
  const other = P({ id: 'ex', name: 'Casio FX-991EX', model: 'FX-991EX' });
  const r = runSearch([other, exact], sellers, q('1500 taka er moddhe used casio fx-991es calculator'), { nowMs: NOW });
  assert.equal(r.hits[0].product.id, 'exact'); assert.equal(r.hits[0].tier, 'exact');
  assert.ok(r.hits[0].reasons.some((x) => x.code === 'model_exact'));
  assert.equal(r.hits[1].tier, 'alternative');
  assert.ok(r.hits[1].reasons.some((x) => x.code === 'model_similar'));
});

test('model found only in the product name (legacy data without model field) still matches', () => {
  const r = runSearch([P({ id: 'legacy', model: undefined, brand: undefined, condition: undefined, name: 'Casio fx-991ES Plus used scientific calculator' })], sellers, q('used casio fx991es calculator'), { nowMs: NOW });
  assert.equal(r.hits[0].tier, 'exact');
});

test('preferred (hedged) model does not demote other models to alternative', () => {
  const r = runSearch([P({ id: 'a', model: 'FX-82MS', name: 'Casio FX-82MS' })], sellers, q('used casio calculator under 1500 tk preferably fx-991es'), { nowMs: NOW });
  assert.equal(r.hits[0].tier, 'exact');
  const withPref = runSearch([P({ id: 'a', model: 'FX-82MS', name: 'Casio FX-82MS' }), P({ id: 'b' })], sellers, q('used casio calculator under 1500 tk preferably fx-991es'), { nowMs: NOW });
  assert.deepEqual(ids(withPref), ['b', 'a']);
});

test('brand mismatch is an alternative, never an exact match', () => {
  const r = runSearch([P({ id: 'cit', brand: 'Citizen', name: 'Citizen SR-270X', model: 'SR-270X' })], sellers, q('casio calculator'), { nowMs: NOW });
  assert.equal(r.hits[0].tier, 'alternative');
  assert.ok(r.hits[0].reasons.some((x) => x.code === 'brand_mismatch'));
});

test('condition is a hard filter (explicit field, inferred words, unknown excluded)', () => {
  const r = runSearch([P({ id: 'new', condition: 'new' }), P({ id: 'used' }), P({ id: 'unk', condition: undefined, name: 'Casio calc' }), P({ id: 'inf', condition: undefined, name: 'পুরনো Casio calc' })],
    sellers, q('used casio calculator'), { nowMs: NOW });
  assert.deepEqual(ids(r).sort(), ['inf', 'used']);
  assert.equal(r.excluded.condition_mismatch, 1); assert.equal(r.excluded.condition_unknown, 1);
});

test('budget boundary: equal is eligible, one taka over is not', () => {
  const r = runSearch([P({ id: 'at', price: 1500 }), P({ id: 'over', price: 1501 }), P({ id: 'under', price: 1499 })], sellers, q('calculator 1500 taka er moddhe'), { nowMs: NOW });
  assert.deepEqual(ids(r).sort(), ['at', 'under']);
  assert.equal(r.excluded.over_budget, 1);
  const min = runSearch([P({ id: 'lo', price: 799 }), P({ id: 'ok', price: 800 })], sellers, q('calculator above 800 taka'), { nowMs: NOW });
  assert.deepEqual(ids(min), ['ok']);
});

test('inactive/draft, unapproved seller, zero stock are never returned', () => {
  const r = runSearch([P({ status: 'draft' }), P({ sellerId: 'bad' }), P({ sellerId: 'nobody' }), P({ stock: 0 }), P({ id: 'ok' })], sellers, q('calculator'), { nowMs: NOW });
  assert.deepEqual(ids(r), ['ok']);
  assert.equal(r.excluded.inactive, 1); assert.equal(r.excluded.seller_ineligible, 2); assert.equal(r.excluded.out_of_stock, 1);
});

test('missing/invalid fields are excluded or handled without throwing', () => {
  const r = runSearch([
    P({ price: undefined }), P({ price: 0 }), P({ price: 99.5 }), P({ stock: undefined }), P({ stock: -1 }), P({ stock: 1.5 }),
    P({ id: 'sparse', name: 'Calc', brand: undefined, model: undefined, imageUrl: undefined, description: undefined, aliases: undefined, updatedAtMs: undefined }),
  ] as Candidate[], sellers, q('calculator'), { nowMs: NOW });
  assert.deepEqual(ids(r), ['sparse']);
  assert.equal(r.hits[0].product.availability.status, 'unverified');
  assert.equal(r.hits[0].product.imageUrl, '');
});

test('stale listings are shown with an unverified-stock warning, never as verified', () => {
  const r = runSearch([P({ id: 'stale', updatedAtMs: NOW - 60 * DAY }), P({ id: 'fresh' })], sellers, q('calculator'), { nowMs: NOW });
  const stale = r.hits.find((h) => h.product.id === 'stale')!;
  assert.equal(stale.product.availability.status, 'unverified'); assert.equal(stale.product.availability.verified, false);
  assert.ok(stale.reasons.some((x) => x.code === 'stock_unverified'));
  assert.equal(r.hits[0].product.id, 'fresh'); // fresh outranks stale, all else equal
});

test('availability: boundaries', () => {
  assert.equal(availabilityOf({ stock: 3, updatedAtMs: NOW }, NOW).status, 'low_stock');
  assert.equal(availabilityOf({ stock: 4, updatedAtMs: NOW }, NOW).status, 'in_stock');
  assert.equal(availabilityOf({ stock: 4, updatedAtMs: NOW - 14 * DAY }, NOW).verified, true);
  assert.equal(availabilityOf({ stock: 4, updatedAtMs: NOW - 15 * DAY }, NOW).verified, false);
  assert.equal(availabilityOf({ stock: 0, updatedAtMs: NOW }, NOW).status, 'out_of_stock');
  assert.equal(availabilityOf({ stock: undefined }, NOW).status, 'unverified');
});

test('wrong category is excluded; legacy catalog category names map to the category', () => {
  const r = runSearch([P({ id: 'legacy', categoryKey: undefined, category: 'Calculator' }), P({ id: 'toy', categoryKey: undefined, category: 'গিফট আইটেম' })], sellers, q('calculator'), { nowMs: NOW });
  assert.deepEqual(ids(r), ['legacy']);
});

test('empty result: near-miss suggestions are labelled and capped; no results → none invented', () => {
  const r = runSearch([P({ id: 'a', price: 1700 }), P({ id: 'b', price: 3000 })], sellers, q('calculator 1500 taka er moddhe'), { nowMs: NOW });
  assert.equal(r.total, 0);
  assert.deepEqual(r.nearMisses.map((h) => h.product.id), ['a']);
  assert.equal(r.nearMisses[0].tier, 'near_miss');
  assert.ok(r.nearMisses[0].reasons.some((x) => x.code === 'over_budget'));
  const none = runSearch([], sellers, q('calculator'), { nowMs: NOW });
  assert.equal(none.total, 0); assert.deepEqual(none.nearMisses, []);
});

test('location: preferred boosts, required filters', () => {
  const dhaka = P({ id: 'd' }), syl = P({ id: 's', sellerId: 's2' });
  assert.deepEqual(ids(runSearch([syl, dhaka], sellers, q('calculator dhaka te'), { nowMs: NOW })), ['d', 's']);
  assert.deepEqual(ids(runSearch([syl, dhaka], sellers, q('calculator only dhaka'), { nowMs: NOW })), ['d']);
});

test('pagination is stable, bounded and reports hasMore', () => {
  const many = Array.from({ length: 30 }, (_, i) => P({ id: `m${String(i).padStart(2, '0')}`, price: 1000 + i }));
  const p1 = runSearch(many, sellers, q('calculator'), { nowMs: NOW, page: 1, pageSize: 12 });
  const p3 = runSearch(many, sellers, q('calculator'), { nowMs: NOW, page: 3, pageSize: 12 });
  assert.equal(p1.hits.length, 12); assert.equal(p1.hasMore, true); assert.equal(p1.total, 30);
  assert.equal(p3.hits.length, 6); assert.equal(p3.hasMore, false);
  assert.equal(runSearch(many, sellers, q('calculator'), { nowMs: NOW, pageSize: 5000 }).pageSize, 24);
  assert.equal(runSearch(many, sellers, q('calculator'), { nowMs: NOW, page: -4 }).page, 1);
  const all = [...runSearch(many, sellers, q('calculator'), { nowMs: NOW, page: 1, pageSize: 24 }).hits, ...runSearch(many, sellers, q('calculator'), { nowMs: NOW, page: 2, pageSize: 24 }).hits].map((h) => h.product.id);
  assert.equal(new Set(all).size, 30);
});

test('weights are configurable and change ranking (provisional weights are testable)', () => {
  const cheapFresh = P({ id: 'cheap', model: 'FX-82MS', name: 'Casio FX-82MS', price: 500 });
  const model = P({ id: 'model', price: 1490 });
  const query = q('used casio calculator under 1500 tk preferably fx-991es');
  assert.equal(runSearch([cheapFresh, model], sellers, query, { nowMs: NOW }).hits[0].product.id, 'model');
  const flipped = { ...DEFAULT_WEIGHTS, modelExact: 0, priceFit: 100 };
  assert.equal(runSearch([cheapFresh, model], sellers, query, { nowMs: NOW, weights: flipped }).hits[0].product.id, 'cheap');
});

test('public cards never include private/seller-internal fields', () => {
  const c = { ...P({ id: 'x' }), nid: '123', buyerPhone: '017', bkash: '017' } as unknown as Candidate;
  const r = evaluate(c, sellers.get('s1'), q('calculator'), { nowMs: NOW });
  assert.ok(r.eligible);
  if (r.eligible) assert.deepEqual(Object.keys(r.hit.product).sort(),
    ['availability', 'brand', 'category', 'condition', 'deliveryCharge', 'emoji', 'id', 'imageUrl', 'model', 'name', 'originalPrice', 'price', 'sellerId', 'sellerName']);
});
