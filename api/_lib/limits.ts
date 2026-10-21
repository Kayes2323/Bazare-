import type { Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

/** Fixed-window counter in Firestore (`rateLimits/*`, server-only; rules deny all client access). Returns false when over limit. */
export async function consume(db: Firestore, key: string, limit: number, windowMs: number, nowMs: number): Promise<boolean> {
  const window = Math.floor(nowMs / windowMs);
  const ref = db.collection('rateLimits').doc(`${key}_${window}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.get('count') as number) : 0;
    if (count >= limit) return false;
    tx.set(ref, { count: count + 1, expiresAt: new Date((window + 2) * windowMs) }); // TTL policy on `expiresAt` cleans these up
    return true;
  });
}

/** Stable, non-reversible identifier for anonymous callers (IP is never stored raw). */
export function callerKey(uid: string | null, ip: string, salt = process.env.RATE_LIMIT_SALT ?? 'bazare'): string {
  return uid ? `u_${uid}` : `ip_${createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 20)}`;
}

export interface Limits { perMinuteAnon: number; perMinuteUser: number; aiPerUserPerDay: number; aiGlobalPerDay: number }
export const DEFAULT_LIMITS: Limits = { perMinuteAnon: 8, perMinuteUser: 20, aiPerUserPerDay: 30, aiGlobalPerDay: 500 }; // PROVISIONAL
export const limitsFromEnv = (): Limits => ({
  perMinuteAnon: Number(process.env.SEARCH_RPM_ANON) || DEFAULT_LIMITS.perMinuteAnon,
  perMinuteUser: Number(process.env.SEARCH_RPM_USER) || DEFAULT_LIMITS.perMinuteUser,
  aiPerUserPerDay: Number(process.env.AI_DAILY_PER_USER) || DEFAULT_LIMITS.aiPerUserPerDay,
  aiGlobalPerDay: Number(process.env.AI_DAILY_GLOBAL) || DEFAULT_LIMITS.aiGlobalPerDay,
});
