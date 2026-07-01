// Admin endpoint: manually grant or revoke tier for a user. Restricted to ADMIN_EMAILS.
const { json, preflight, userStore, txStore } = require('./_lib');

function isAdmin(email) {
  const admins = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return admins.includes((email || '').toLowerCase());
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const adminEmail = ((body.adminEmail) || '').trim().toLowerCase();
  if (!isAdmin(adminEmail)) return json(403, { error: 'Admin only' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Token required' });
  const users = userStore();
  const adminUser = await users.get(adminEmail, { type: 'json' });
  const valid = adminUser && (adminUser.tokens || []).some(t => t.token === token && t.expires > Date.now());
  if (!valid) return json(401, { error: 'Token invalid' });

  const targetEmail = (body.email || '').trim().toLowerCase();
  const action = body.action;
  if (!targetEmail || !action) return json(400, { error: 'email and action required' });

  const tx = txStore();
  let rec = (await tx.get(targetEmail, { type: 'json' })) || { transactions: [] };
  if (action === 'grant') {
    rec.tier = body.tier || 'full';
    rec.transactions.push({
      sessionId: 'admin-grant-' + Date.now(),
      tier: rec.tier,
      amount: 0,
      currency: 'usd',
      paidAt: Date.now(),
      note: 'admin grant by ' + adminEmail
    });
  } else if (action === 'revoke') {
    rec.tier = null;
    rec.transactions.push({
      sessionId: 'admin-revoke-' + Date.now(),
      tier: null,
      amount: 0,
      paidAt: Date.now(),
      note: 'admin revoke by ' + adminEmail
    });
  } else {
    return json(400, { error: 'unknown action' });
  }
  await tx.setJSON(targetEmail, rec);
  return json(200, { ok: true, email: targetEmail, tier: rec.tier });
};
