import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryValidationError, clarificationFor, parseQueryRules, reconcile, validateSearchQuery, normalizeText, modelKey } from '../src';

test('normalizes Bangla digits, separators and model keys', () => {
  assert.equal(normalizeText('১,৫০০ টাকা'), '1500 টাকা');
  assert.equal(modelKey('FX-991 ES'), 'fx991es');
});

test('Bangla: ১৫০০ টাকার মধ্যে used Casio FX-991ES calculator চাই।', () => {
  const q = parseQueryRules('১৫০০ টাকার মধ্যে used Casio FX-991ES calculator চাই।');
  assert.equal(q.categoryKey, 'calculator');
  assert.equal(q.budgetMax, 1500); assert.equal(q.budgetMin, null);
  assert.equal(q.condition, 'used');
  assert.deepEqual(q.brand, { value: 'casio', required: true });
  assert.deepEqual(q.model, { value: 'fx991es', required: true });
});

test('Bangla script brand/category/condition words', () => {
  const q = parseQueryRules('পুরনো ক্যাসিও ক্যালকুলেটর ২০০০ টাকার মধ্যে');
  assert.equal(q.categoryKey, 'calculator'); assert.equal(q.condition, 'used');
  assert.equal(q.brand?.value, 'casio'); assert.equal(q.budgetMax, 2000);
});

test('Banglish', () => {
  const q = parseQueryRules('1500 taka er moddhe used casio fx 991 es calculator lagbe');
  assert.equal(q.categoryKey, 'calculator'); assert.equal(q.budgetMax, 1500); assert.equal(q.condition, 'used');
  assert.equal(q.model?.value, 'fx991es'); assert.equal(q.model?.required, true);
  const n = parseQueryRules('notun casio calculator dhaka te chai');
  assert.equal(n.condition, 'new'); assert.equal(n.location?.value, 'dhaka');
});

test('English with hedge: preference vs requirement', () => {
  const q = parseQueryRules('scientific calculator under 1,500 tk, preferably fx-991es');
  assert.equal(q.budgetMax, 1500);
  assert.deepEqual(q.model, { value: 'fx991es', required: false });
  const strict = parseQueryRules('casio fx-991es calculator');
  assert.equal(strict.model?.required, true);
  const bn = parseQueryRules('ক্যালকুলেটর fx-991es হলে ভালো হয়');
  assert.equal(bn.model?.required, false);
});

test('model digits are never mistaken for a budget', () => {
  const q = parseQueryRules('casio fx991ex calculator');
  assert.equal(q.budgetMax, null); assert.equal(q.budgetMin, null);
});

test('budget ranges and lower bounds', () => {
  const r = parseQueryRules('calculator 1000-1500 taka');
  assert.equal(r.budgetMin, 1000); assert.equal(r.budgetMax, 1500);
  assert.equal(parseQueryRules('calculator above 800 taka').budgetMin, 800);
  assert.equal(parseQueryRules('calculator 1.5k tk').budgetMax, 1500);
});

test('both new and used → no condition filter', () => {
  assert.equal(parseQueryRules('new or used calculator').condition, null);
});

test('clarifies only when category is unknown', () => {
  const q = parseQueryRules('কিছু একটা কিনতে চাই');
  assert.equal(clarificationFor(q, 'কিছু একটা কিনতে চাই')?.code, 'need_category');
  assert.match(clarificationFor(q, 'কিছু')!.question, /[ঀ-৿]/);
  assert.equal(clarificationFor(parseQueryRules('calculator'), 'calculator'), null);
  assert.equal(clarificationFor(parseQueryRules('casio fx-82ms'), 'casio fx-82ms'), null); // model implies category
});

test('oversized input is truncated, not crashing', () => {
  const q = parseQueryRules('calculator ' + 'x'.repeat(100000));
  assert.equal(q.categoryKey, 'calculator');
});

// ── untrusted AI / client output ──
const good = { categoryKey: 'calculator', budgetMax: 1500, condition: 'used', brand: { value: 'Casio', required: true }, model: { value: 'FX-991ES', required: false }, keywords: ['scientific'] };

test('validateSearchQuery accepts a well-formed object and normalizes it', () => {
  const q = validateSearchQuery(good);
  assert.equal(q.model?.value, 'fx991es'); assert.equal(q.brand?.value, 'casio'); assert.equal(q.budgetMin, null);
});

test('validateSearchQuery rejects malicious or malformed output', () => {
  const bad: unknown[] = [
    null, 'DROP TABLE', [], { ...good, __proto__: { admin: true }, sellerId: 'x' },
    { ...good, extra: 1 }, { ...good, categoryKey: 'drugs' }, { ...good, categoryKey: { $ne: null } },
    { ...good, budgetMax: -5 }, { ...good, budgetMax: 1.5 }, { ...good, budgetMax: '1500' }, { ...good, budgetMax: 1e12 },
    { ...good, condition: "used' OR 1=1" }, { ...good, brand: { value: '<script>alert(1)</script>', required: true } },
    { ...good, model: { value: 'x'.repeat(200), required: true } }, { ...good, brand: { value: 'casio', required: 'yes' } },
    { ...good, keywords: ['a'.repeat(100)] }, { ...good, keywords: Array(20).fill('ok') },
    { ...good, budgetMin: 2000, budgetMax: 1000 },
    { ...good, location: { value: '../../etc/passwd', required: true } },
  ];
  for (const b of bad) assert.throws(() => validateSearchQuery(b), QueryValidationError, JSON.stringify(b)?.slice(0, 60));
});

test('reconcile: rule-parsed numbers/condition override AI hallucinations', () => {
  const raw = '1500 taka er moddhe casio calculator';
  const rules = parseQueryRules(raw);
  const ai = validateSearchQuery({ categoryKey: 'calculator', budgetMax: 99999, condition: 'new', brand: { value: 'casio', required: true } });
  const m = reconcile(ai, rules, raw);
  assert.equal(m.budgetMax, 1500); assert.equal(m.condition, null);
  // an AI budget not present in the text is dropped
  const noBudget = reconcile(validateSearchQuery({ categoryKey: 'calculator', budgetMax: 777 }), parseQueryRules('calculator'), 'calculator');
  assert.equal(noBudget.budgetMax, null);
});
