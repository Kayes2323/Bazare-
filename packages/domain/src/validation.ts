import type { PaymentMethod, PlaceOrderRequest } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const MAX_LINES_PER_ORDER = 20;
export const MAX_QTY_PER_LINE = 100;
const PAYMENT_METHODS: PaymentMethod[] = ['cod', 'bkash', 'nagad'];

/** Normalises a Bangladeshi mobile number to 01XXXXXXXXX, or returns null. Accepts +880 / 880 / 0 prefixes. */
export function normalizeBdPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s-]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('880') ? '0' + digits.slice(3) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

export function isPositiveInt(n: unknown, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= max;
}

const text = (v: unknown, field: string, min: number, max: number): string => {
  if (typeof v !== 'string') throw new ValidationError(`${field} is required`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw new ValidationError(`${field} must be ${min}-${max} characters`);
  return s;
};

/** Validates untrusted checkout input. Never trusts prices, seller ids or totals — those are not accepted at all. */
export function parsePlaceOrderRequest(raw: unknown): PlaceOrderRequest {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError('Invalid request');
  const r = raw as Record<string, unknown>;

  const clientOrderKey = text(r.clientOrderKey, 'clientOrderKey', 8, 64);
  if (!/^[A-Za-z0-9_-]+$/.test(clientOrderKey)) throw new ValidationError('clientOrderKey has invalid characters');

  if (!Array.isArray(r.items) || r.items.length === 0) throw new ValidationError('Cart is empty');
  if (r.items.length > MAX_LINES_PER_ORDER) throw new ValidationError('Too many items in one order');

  const seen = new Set<string>();
  const items = r.items.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const productId = text(o.productId, 'productId', 1, 128);
    if (productId.includes('/')) throw new ValidationError('Invalid productId');
    if (seen.has(productId)) throw new ValidationError('Duplicate product in cart');
    seen.add(productId);
    if (!isPositiveInt(o.qty, MAX_QTY_PER_LINE)) throw new ValidationError('Invalid quantity');
    if (o.expectedPrice !== undefined && !isPositiveInt(o.expectedPrice, 100_000_000)) throw new ValidationError('Invalid price');
    return o.expectedPrice === undefined ? { productId, qty: o.qty } : { productId, qty: o.qty, expectedPrice: o.expectedPrice };
  });

  const phone = normalizeBdPhone(r.phone);
  if (!phone) throw new ValidationError('Enter a valid Bangladeshi mobile number');

  const paymentMethod = r.paymentMethod as PaymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new ValidationError('Invalid payment method');

  let paymentPhone = '';
  if (paymentMethod !== 'cod') {
    const p = normalizeBdPhone(r.paymentPhone);
    if (!p) throw new ValidationError('Enter a valid payment number');
    paymentPhone = p;
  }

  return {
    clientOrderKey,
    items,
    name: text(r.name, 'name', 2, 80),
    phone,
    address: text(r.address, 'address', 5, 300),
    district: text(r.district, 'district', 2, 40),
    upazila: typeof r.upazila === 'string' ? r.upazila.trim().slice(0, 60) : '',
    note: typeof r.note === 'string' ? r.note.trim().slice(0, 300) : '',
    paymentMethod,
    paymentPhone,
  };
}
