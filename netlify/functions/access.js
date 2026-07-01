const { json, preflight, userStore, txStore } = require('./_lib');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const email = ((event.queryStringParameters || {}).email || '').trim().toLowerCase();
  if (!email) return json(400, { error: 'Email required' });

  // Verify Bearer token belongs to user
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Token required' });

  const users = userStore();
  const user = await users.get(email, { type: 'json' });
  if (!user) return json(404, { error: 'Unknown user' });
  const valid = (user.tokens || []).some(t => t.token === token && t.expires > Date.now());
  if (!valid) return json(401, { error: 'Token invalid or expired' });

  const tx = txStore();
  const txRec = await tx.get(email, { type: 'json' });
  return json(200, { ok: true, tier: txRec ? txRec.tier : null, transactions: txRec ? txRec.transactions || [] : [] });
};
