// Grants the admin role to a user. Run locally by the founder with a service-account JSON:
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/set-admin.mjs <uid>
// Never commit the service-account file. This replaces the old in-browser "admin key" flow.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const uid = process.argv[2];
if (!uid) { console.error('usage: node scripts/set-admin.mjs <uid>'); process.exit(1); }
initializeApp({ credential: applicationDefault(), projectId: 'bazare-abe67' });
await getFirestore().doc(`users/${uid}`).set({ role: 'admin' }, { merge: true });
console.log(`users/${uid}.role = admin`);
