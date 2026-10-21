/**
 * Bazare domain contracts. These mirror the Firestore document shapes.
 * Money is integer BDT (taka). Timestamps are Firestore Timestamps at rest
 * and are typed loosely here so the package has no Firebase dependency.
 */

export type Role = 'buyer' | 'seller' | 'admin';
export type SellerStatus = 'pending' | 'approved' | 'rejected';

/** users/{uid} — private to the owner and admins. `role` is only ever written by admins. */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  photoURL: string;
  role: Role;
  sellerStatus?: SellerStatus;
  shopName?: string;
}

/** sellers/{uid} — private application/store record (contains NID and payout numbers). */
export interface SellerProfile {
  uid: string;
  name: string;
  phone: string;
  email: string;
  district: string;
  shopName: string;
  category: string;
  shopDesc: string;
  fbPage: string;
  bkash: string;
  nagad: string;
  nid: string;
  logoUrl: string;
  status: SellerStatus;
}

export type ProductStatus = 'active' | 'draft';

/** products/{id} — public when status === 'active'. Never put private data here. */
export interface Product {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  deliveryCharge: number;
  emoji: string;
  imageUrl: string;
  imageUrls: string[];
  status: ProductStatus;
  sold: number;
  rating: number;
  reviewCount: number;
  views?: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
/** No payment gateway is integrated: bKash/Nagad are manual, so only `unpaid` is ever written today. */
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PaymentMethod = 'cod' | 'bkash' | 'nagad';

/** Field names kept compatible with orders written by the legacy checkout (`id` = product id). */
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  lineTotal: number;
  imageUrl: string;
  emoji: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  atMs: number;
  by: string;
  byRole: Role;
}

export interface ShippingAddress {
  full: string;
  district: string;
  upazila: string;
  note: string;
}

/** orders/{id} — one order per seller. Readable by buyer, that seller and admins. Written only by the server. */
export interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  sellerId: string;
  items: OrderItem[];
  productName: string;
  address: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentPhone: string;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
}

export interface PlaceOrderRequest {
  /** Client-generated key, reused on retry so a double-submit cannot create two orders. */
  clientOrderKey: string;
  /** `expectedPrice` = the price the buyer saw; the order is refused (409 price_changed) if it no longer matches. */
  items: { productId: string; qty: number; expectedPrice?: number }[];
  name: string;
  phone: string;
  address: string;
  district: string;
  upazila?: string;
  note?: string;
  paymentMethod: PaymentMethod;
  paymentPhone?: string;
}
