// ============================================================
// BAZARE — Firebase Config
// firebase-config.js  (load এর পরেই auth, db ready হবে)
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

// Initialize
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global variables — সব page এ available থাকবে
var auth    = firebase.auth();
var db      = firebase.firestore();

// Collections
var COL = {
  USERS:    'users',
  SELLERS:  'sellers',
  PRODUCTS: 'products',
  ORDERS:   'orders',
};