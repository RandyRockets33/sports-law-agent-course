const { json, preflight, userStore, txStore, certStore, genCredId } = require('./_lib');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  if (!email || !name) return json(400, { error: 'Email and name required' });

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
  if (!txRec || !txRec.tier) return json(403, { error: 'No active enrollment found' });

  const certs = certStore();
  const credId = genCredId(email);
  const rec = {
    credId,
    name,
    email,
    tier: txRec.tier,
    issued: new Date().toISOString().slice(0, 10)
  };
  await certs.setJSON(credId, rec);

  // Also store on user record
  user.certificate = { credId, issued: rec.issued, name, tier: rec.tier };
  user.name = name;
  await users.setJSON(email, user);

  return json(200, { ok: true, credId, issued: rec.issued, name, tier: rec.tier });
};
