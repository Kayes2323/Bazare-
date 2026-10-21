import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ValidationError } from '../packages/domain/src';
import { aiParserFromEnv } from './_lib/ai-parser';
import { adminDb, verifiedUid, errorResponse } from './_lib/http';
import { callerKey, limitsFromEnv } from './_lib/limits';
import { SearchError, searchProducts } from './_lib/search-service';

// POST /api/search  { q, page?, pageSize?, filters? }  — feature-flagged by AI_SEARCH_ENABLED=true
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (JSON.stringify(req.body ?? '').length > 4000) return res.status(413).json({ error: 'Request too large' });
  try {
    const uid = await verifiedUid(req.headers.authorization);
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
    const out = await searchProducts({
      db: adminDb(), ai: aiParserFromEnv(), limits: limitsFromEnv(), uid, callerKey: callerKey(uid, ip), nowMs: Date.now(),
      enabled: process.env.AI_SEARCH_ENABLED === 'true',
      enabledCategories: (process.env.AI_SEARCH_CATEGORIES || 'calculator').split(',').map((s) => s.trim()).filter(Boolean),
    }, req.body);
    return res.status(200).json(out);
  } catch (e) {
    if (e instanceof SearchError) return res.status(e.status).json({ error: e.message, code: e.code });
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message, code: 'invalid' });
    const { status, body } = errorResponse(e);
    return res.status(status).json(body);
  }
}
