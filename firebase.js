// ============================================================
// BAZARE — Firebase Configuration
// firebase-config.js
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyC8Q7rswU-Zm2VemMwEobyTtLI544QQfIk",
  authDomain:        "bazare-abe67.firebaseapp.com",
  projectId:         "bazare-abe67",
  storageBucket:     "bazare-abe67.firebasestorage.app",
  messagingSenderId: "599192892463",
  appId:             "1:599192892463:web:7c4c7135777c0a78aac2da",
  measurementId:     "G-3PT69DDP7E"
};

// Initialize Firebase (compat SDK via CDN)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

// ── Firestore Collections ──
const COLLECTIONS = {
  USERS:    'users',       // all users (buyer + seller)
  SELLERS:  'sellers',     // seller profiles (pending/approved/rejected)
  PRODUCTS: 'products',    // all products
  ORDERS:   'orders',      // all orders
  REVIEWS:  'reviews',     // product reviews
  CART:     'carts',       // user carts
};

// ── User Roles ──
const ROLES = {
  BUYER:  'buyer',
  SELLER: 'seller',
  ADMIN:  'admin',
};

// ── Seller Status ──
const SELLER_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};