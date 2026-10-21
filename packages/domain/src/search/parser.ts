import { CATEGORIES, categoryByKey, type CategoryDef } from './categories';
import { modelKey, normalizeText, wordTokens } from './text';
import type { Condition, SearchQuery } from './types';

export const EMPTY_QUERY: SearchQuery = { categoryKey: null, budgetMin: null, budgetMax: null, condition: null, brand: null, model: null, location: null, keywords: [] };

export const MAX_QUERY_CHARS = 300;
const MAX_PRICE = 10_000_000;

const USED = ['used', 'second hand', 'secondhand', 'second-hand', 'old', 'পুরনো', 'পুরোনো', 'পুরাতন', 'ব্যবহৃত', 'ইউজড', 'সেকেন্ড হ্যান্ড', 'সেকেন্ডহ্যান্ড', 'purano', 'puran', 'purono'];
const NEW = ['brand new', 'new', 'নতুন', 'নিউ', 'notun', 'natun', 'fresh', 'sealed', 'ব্র্যান্ড নিউ'];
const REFURB = ['refurbished', 'refurb', 'রিফার্বিশড', 'রিফারবিশড'];
/** Hedge words make brand/model a preference instead of a requirement. */
const HEDGES = ['preferably', 'prefer', 'possibly', 'ideally', 'if possible', 'if available', 'better if', 'would be nice', 'or similar', 'হলে ভালো', 'হলে ভাল', 'ভালো হয়', 'ভাল হয়', 'যদি পাওয়া যায়', 'পছন্দ', 'hole bhalo', 'hole valo', 'bhalo hoy', 'valo hoy', 'jodi pawa jay', 'jodi paoa jay', 'চাইলে', 'অথবা অন্য'];
const UNDER = ['under', 'within', 'below', 'max', 'maximum', 'upto', 'up to', 'less than', 'budget', 'মধ্যে', 'মধ্যেই', 'কমে', 'নিচে', 'পর্যন্ত', 'বাজেট', 'moddhe', 'moddhye', 'kome', 'niche', 'porjonto', 'er moddhe'];
const OVER = ['above', 'over', 'more than', 'minimum', 'at least', 'বেশি', 'উপরে', 'কমপক্ষে', 'beshi', 'upore'];
const CURRENCY = ['taka', 'tk', 'bdt', 'টাকা', 'টাকার', 'টাকায়', '৳', 'tk.', 'takar', 'takay'];
const STOP = new Set(['i', 'want', 'need', 'looking', 'for', 'a', 'an', 'the', 'in', 'of', 'with', 'and', 'or', 'to', 'me', 'please', 'চাই', 'দরকার', 'লাগবে', 'একটা', 'একটি', 'খুঁজছি', 'দিন', 'সহ', 'এবং', 'er', 'ta', 'chai', 'lagbe', 'ekta', 'dorkar', 'koto', 'price', 'দাম', 'taka', 'tk', 'টাকা', 'টাকার', 'মধ্যে', 'moddhe', 'under', 'within', 'used', 'new', 'preferably']);

const DISTRICTS: [string, string[]][] = [
  ['dhaka', ['dhaka', 'ঢাকা', 'dhaka-te', 'ঢাকায়']], ['chattogram', ['chattogram', 'chittagong', 'ctg', 'চট্টগ্রাম']],
  ['sylhet', ['sylhet', 'সিলেট']], ['rajshahi', ['rajshahi', 'রাজশাহী']], ['khulna', ['khulna', 'খুলনা']],
  ['barishal', ['barishal', 'barisal', 'বরিশাল']], ['rangpur', ['rangpur', 'রংপুর']], ['mymensingh', ['mymensingh', 'ময়মনসিংহ']],
  ['cumilla', ['cumilla', 'comilla', 'কুমিল্লা']], ['gazipur', ['gazipur', 'গাজীপুর']], ['narayanganj', ['narayanganj', 'নারায়ণগঞ্জ']],
  ['bogura', ['bogura', 'bogra', 'বগুড়া']], ['jashore', ['jashore', 'jessore', 'যশোর']], ['dinajpur', ['dinajpur', 'দিনাজপুর']],
  ['tangail', ['tangail', 'টাঙ্গাইল']], ['narsingdi', ['narsingdi', 'নরসিংদী']], ['faridpur', ['faridpur', 'ফরিদপুর']],
  ["cox's bazar", ['cox bazar', "cox's bazar", 'coxs bazar', 'কক্সবাজার']], ['noakhali', ['noakhali', 'নোয়াখালী']], ['pabna', ['pabna', 'পাবনা']],
];

const has = (hay: string, needle: string) => {
  const n = normalizeText(needle);
  if (/^[\x00-\x7f]+$/.test(n)) return new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(hay);
  return hay.includes(n); // Bangla: substring (suffixes like -এ/-র attach to words)
};
const hasAny = (hay: string, list: string[]) => list.some((w) => has(hay, w));

function parseBudget(text: string): { min: number | null; max: number | null; consumed: string[] } {
  const consumed: string[] = [];
  const num = (s: string, k?: string) => Math.round(parseFloat(s) * (k ? 1000 : 1));
  // range: 1000-1500 / 1000 to 1500 (with currency somewhere in the text)
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to|থেকে|theke)\s*(\d+(?:\.\d+)?)\s*(k)?/);
  if (range && (hasAny(text, CURRENCY) || hasAny(text, UNDER))) {
    const a = num(range[1], range[3]), b = num(range[2], range[3]);
    consumed.push(range[1], range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b), consumed };
  }
  const re = /(?:৳\s*)?(\d+(?:\.\d+)?)\s*(k)?\s*(?:\/-|৳|taka|tk\.?|bdt|টাকার?|টাকায়|takar|takay)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const rest = text.slice(m.index + m[0].length);
    const before = text.slice(0, m.index);
    const marked = /৳|\/-|taka|tk|bdt|টাকা|takar|takay/.test(m[0]) || /৳\s*$/.test(before);
    const nextWords = rest.trim().split(' ').slice(0, 3).join(' ');
    const prevWords = before.trim().split(' ').slice(-2).join(' ');
    const dirUnder = hasAny(nextWords, UNDER) || hasAny(prevWords, ['under', 'within', 'below', 'max', 'upto', 'up to', 'less than', 'budget', 'বাজেট']);
    const dirOver = hasAny(nextWords, OVER) || hasAny(prevWords, OVER);
    // a number glued to letters (fx991es) is a model, not money
    if (/^[a-z]/.test(text.slice(m.index + m[0].length - (m[0].endsWith(' ') ? 1 : 0), m.index + m[0].length + 1)) && !marked) continue;
    if (!marked && !dirUnder && !dirOver) continue;
    const v = num(m[1], m[2]);
    if (!(v > 0)) continue;
    consumed.push(m[1]);
    return dirOver ? { min: v, max: null, consumed } : { min: null, max: v, consumed };
  }
  return { min: null, max: null, consumed };
}

function findBrand(text: string, cat: CategoryDef | null): string | null {
  const pools = cat ? [cat] : CATEGORIES;
  for (const c of pools) for (const b of c.brands) if (hasAny(text, b.aliases)) return b.name;
  return null;
}

function findModel(text: string, cat: CategoryDef | null): string | null {
  const pools = cat ? [cat] : CATEGORIES;
  for (const c of pools) {
    const m = c.modelPattern && text.match(c.modelPattern);
    if (m) return modelKey(m[0]);
  }
  return null;
}

/**
 * Deterministic rule-based understanding of Bangla / Banglish / English queries.
 * This is both the no-AI path and the cross-check on AI output. Pure and unit-tested.
 */
export function parseQueryRules(raw: string): SearchQuery {
  const text = normalizeText(raw.slice(0, MAX_QUERY_CHARS));
  const q: SearchQuery = { ...EMPTY_QUERY, keywords: [] };

  // category (alias words first, then a model-number pattern implies it)
  let cat: CategoryDef | null = CATEGORIES.find((c) => hasAny(text, c.aliases)) ?? null;
  if (!cat) cat = CATEGORIES.find((c) => c.modelPattern?.test(text)) ?? null;
  q.categoryKey = cat?.key ?? null;

  const b = parseBudget(text);
  q.budgetMin = b.min; q.budgetMax = b.max;

  const wantsUsed = hasAny(text, USED), wantsNew = hasAny(text, NEW), wantsRefurb = hasAny(text, REFURB);
  const conds = [wantsUsed && 'used', wantsNew && 'new', wantsRefurb && 'refurbished'].filter(Boolean) as Condition[];
  q.condition = conds.length === 1 ? conds[0] : null; // "new or used" = no condition filter

  const hedged = hasAny(text, HEDGES);
  const brand = findBrand(text, cat);
  if (brand) q.brand = { value: brand, required: !hedged };
  const model = findModel(text, cat);
  if (model) q.model = { value: model, required: !hedged };

  for (const [name, aliases] of DISTRICTS) {
    if (hasAny(text, aliases)) { q.location = { value: name, required: /\bonly\b|শুধু|shudhu/.test(text) }; break; }
  }

  const known = new Set<string>([...(cat?.aliases ?? []), ...b.consumed, ...(model ? wordTokens(model) : [])].map(normalizeText));
  q.keywords = wordTokens(text)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !known.has(t) && !/^\d+$/.test(t) && !(brand && t === brand) && !modelKey(t).startsWith(model ?? '\u0000'))
    .filter((t) => !(cat && cat.brands.some((x) => x.aliases.map(normalizeText).includes(t))))
    .filter((t) => !DISTRICTS.some(([, al]) => al.includes(t)))
    .filter((t) => !hasAny(t, [...USED, ...NEW, ...REFURB, ...HEDGES, ...UNDER, ...OVER, ...CURRENCY]))
    .slice(0, 8);
  return q;
}

/** A clarifying question is asked only if no category can be determined (results would be meaningless). */
export function clarificationFor(q: SearchQuery, raw: string): { code: 'need_category'; question: string } | null {
  if (q.categoryKey) return null;
  const bangla = /[ঀ-৿]/.test(raw);
  return {
    code: 'need_category',
    question: bangla ? 'কোন ধরনের পণ্য খুঁজছেন? (যেমন: সায়েন্টিফিক ক্যালকুলেটর)' : 'What kind of product are you looking for? (e.g. a scientific calculator)',
  };
}

export class QueryValidationError extends Error {}

const SAFE_STR = /^[\p{L}\p{N}\p{M}\s'\-+]{1,60}$/u;
function pref(v: unknown, field: string): { value: string; required: boolean } | null {
  if (v == null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o !== 'object' || typeof o.value !== 'string' || !SAFE_STR.test(o.value) || typeof o.required !== 'boolean') throw new QueryValidationError(`bad ${field}`);
  return { value: field === 'model' ? modelKey(o.value) : normalizeText(o.value), required: o.required };
}
function money(v: unknown, field: string): number | null {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > MAX_PRICE) throw new QueryValidationError(`bad ${field}`);
  return v;
}

/**
 * Strict allow-list validation of untrusted structured output (from the AI model or the client).
 * Unknown keys, wrong types, unknown categories or over-long strings reject the whole object.
 */
export function validateSearchQuery(raw: unknown): SearchQuery {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new QueryValidationError('not an object');
  const o = raw as Record<string, unknown>;
  const allowed = new Set(['categoryKey', 'budgetMin', 'budgetMax', 'condition', 'brand', 'model', 'location', 'keywords']);
  for (const k of Object.keys(o)) if (!allowed.has(k)) throw new QueryValidationError(`unknown key ${k}`);

  const categoryKey = o.categoryKey == null ? null : String(o.categoryKey);
  if (categoryKey !== null && !categoryByKey(categoryKey)) throw new QueryValidationError('unknown category');
  const condition = o.condition == null ? null : o.condition;
  if (condition !== null && !['new', 'used', 'refurbished'].includes(condition as string)) throw new QueryValidationError('bad condition');
  const kw = o.keywords ?? [];
  if (!Array.isArray(kw) || kw.length > 8 || kw.some((k) => typeof k !== 'string' || !SAFE_STR.test(k))) throw new QueryValidationError('bad keywords');

  const q: SearchQuery = {
    categoryKey,
    budgetMin: money(o.budgetMin, 'budgetMin'),
    budgetMax: money(o.budgetMax, 'budgetMax'),
    condition: condition as Condition | null,
    brand: pref(o.brand, 'brand'),
    model: pref(o.model, 'model'),
    location: pref(o.location, 'location'),
    keywords: (kw as string[]).map(normalizeText),
  };
  if (q.budgetMin !== null && q.budgetMax !== null && q.budgetMin > q.budgetMax) throw new QueryValidationError('budget range inverted');
  return q;
}

/**
 * Merges AI output with the deterministic parse. Numbers and condition are facts we can verify from the raw text,
 * so the rule parser wins on any disagreement (guards against model hallucination or prompt injection).
 */
export function reconcile(ai: SearchQuery, rules: SearchQuery, raw: string): SearchQuery {
  const text = normalizeText(raw);
  const grounded = (n: number | null) => n !== null && (text.includes(String(n)) || text.includes(`${n / 1000}k`));
  const budgetMax = rules.budgetMax ?? (grounded(ai.budgetMax) ? ai.budgetMax : null);
  const budgetMin = rules.budgetMin ?? (grounded(ai.budgetMin) ? ai.budgetMin : null);
  return {
    ...ai,
    categoryKey: ai.categoryKey ?? rules.categoryKey,
    budgetMin: budgetMin !== null && budgetMax !== null && budgetMin > budgetMax ? null : budgetMin,
    budgetMax,
    condition: rules.condition, // only trust condition words that are literally in the text
    model: rules.model ?? ai.model,
    brand: rules.brand ?? ai.brand,
    location: rules.location ?? ai.location,
  };
}
