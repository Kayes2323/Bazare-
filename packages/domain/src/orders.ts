import type { OrderItem, OrderStatus, Product, Role } from './types';

/** Existing storefront rule: free delivery above ৳999 per seller order, otherwise ৳60. */
export const FREE_DELIVERY_THRESHOLD = 999;
export const FLAT_DELIVERY_CHARGE = 60;

export function deliveryChargeFor(subtotal: number): number {
  return subtotal > FREE_DELIVERY_THRESHOLD ? 0 : FLAT_DELIVERY_CHARGE;
}

export class OrderError extends Error {
  constructor(
    public code: 'not_found' | 'unavailable' | 'out_of_stock' | 'own_product' | 'forbidden' | 'bad_transition' | 'price_changed',
    message: string,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

export interface PricedOrder {
  sellerId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
}

/**
 * Builds per-seller priced orders from *server-read* products. Quantities are the only client input.
 * Throws OrderError when a product is missing, inactive, out of stock, or owned by the buyer.
 */
export function priceOrders(
  buyerId: string,
  lines: { productId: string; qty: number; expectedPrice?: number }[],
  products: Map<string, Pick<Product, 'sellerId' | 'name' | 'price' | 'stock' | 'status' | 'imageUrl' | 'emoji'> | undefined>,
): PricedOrder[] {
  const bySeller = new Map<string, OrderItem[]>();
  for (const { productId, qty, expectedPrice } of lines) {
    const p = products.get(productId);
    if (!p) throw new OrderError('not_found', 'A product in your cart no longer exists');
    if (p.status !== 'active') throw new OrderError('unavailable', `${p.name} is not available`);
    if (p.sellerId === buyerId) throw new OrderError('own_product', 'You cannot buy your own product');
    if (!Number.isInteger(p.stock) || p.stock < qty) throw new OrderError('out_of_stock', `${p.name}: only ${Math.max(0, p.stock)} left`);
    if (expectedPrice !== undefined && expectedPrice !== p.price) {
      throw new OrderError('price_changed', `${p.name}: দাম পরিবর্তন হয়েছে (এখন ৳${p.price})`);
    }
    const item: OrderItem = {
      id: productId,
      name: p.name,
      price: p.price,
      qty,
      lineTotal: p.price * qty,
      imageUrl: p.imageUrl || '',
      emoji: p.emoji || '📦',
    };
    bySeller.set(p.sellerId, [...(bySeller.get(p.sellerId) ?? []), item]);
  }
  return [...bySeller].map(([sellerId, items]) => {
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const deliveryCharge = deliveryChargeFor(subtotal);
    return { sellerId, items, subtotal, deliveryCharge, total: subtotal + deliveryCharge };
  });
}

/** Forward flow plus cancellation. `delivered` and `cancelled` are terminal. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function allowedNextStatuses(current: OrderStatus, actor: 'buyer' | 'seller' | 'admin'): OrderStatus[] {
  if (actor === 'buyer') return current === 'pending' ? ['cancelled'] : [];
  return NEXT[current] ?? [];
}

export function canTransition(current: OrderStatus, next: OrderStatus, actor: 'buyer' | 'seller' | 'admin'): boolean {
  return allowedNextStatuses(current, actor).includes(next);
}

/** Resolves how a user relates to an order. A seller/buyer id match wins over a global admin role only for display; admins may act on any order. */
export function actorFor(uid: string, role: Role, order: { buyerId: string; sellerId: string }): 'buyer' | 'seller' | 'admin' | null {
  if (role === 'admin') return 'admin';
  if (order.sellerId === uid) return 'seller';
  if (order.buyerId === uid) return 'buyer';
  return null;
}
