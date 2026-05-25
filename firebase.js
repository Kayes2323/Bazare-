// ============================================================
// BAZARE — Firebase Config (real credentials)
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

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// Collections
const COL = {
  USERS:    'users',
  SELLERS:  'sellers',
  PRODUCTS: 'products',
  ORDERS:   'orders',
};