import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { OrderError, ValidationError } from '../../packages/domain/src';

export function adminDb() {
  if (!getApps().length) {
    // FIREBASE_SERVICE_ACCOUNT holds the service-account JSON (set in Vercel env, never committed).
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    initializeApp(json ? { credential: cert(JSON.parse(json)) } : { credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT });
  }
  return getFirestore();
}

/** Returns the verified uid from `Authorization: Bearer <Firebase ID token>`, or null. */
export async function verifiedUid(authHeader: string | undefined): Promise<string | null> {
  const m = /^Bearer (.+)$/.exec(authHeader ?? '');
  if (!m) return null;
  try {
    return (await getAuth().verifyIdToken(m[1])).uid;
  } catch {
    return null;
  }
}

/** Maps domain errors to safe client messages; anything unexpected is logged server-side and returned as a generic 500. */
export function errorResponse(e: unknown): { status: number; body: { error: string; code?: string } } {
  if (e instanceof ValidationError) return { status: 400, body: { error: e.message, code: 'invalid' } };
  if (e instanceof OrderError) {
    const status = e.code === 'not_found' ? 404 : e.code === 'forbidden' ? 403 : 409;
    return { status, body: { error: e.message, code: e.code } };
  }
  console.error('unexpected error', e instanceof Error ? e.message : 'unknown');
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
}
