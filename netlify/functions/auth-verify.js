const { json, preflight, codeStore, userStore, txStore, genToken } = require('./_lib');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  if (!email || !code) return json(400, { error: 'Email and code required' });

  const codes = codeStore();
  const rec = await codes.get(email, { type: 'json' });
  if (!rec) return json(400, { error: 'No pending code for this email' });
  if (rec.expires < Date.now()) { await codes.delete(email); return json(400, { error: 'Code expired — request a new one' }); }
  if (rec.attempts >= 5) { await codes.delete(email); return json(400, { error: 'Too many attempts' }); }
  if (rec.code !== code) {
    rec.attempts++;
    await codes.setJSON(email, rec);
    return json(400, { error: 'Invalid code' });
  }
  // Code is good — clear and create/update user
  await codes.delete(email);
  const users = userStore();
  let user = await users.get(email, { type: 'json' });
  if (!user) {
    user = { email, name: email.split('@')[0], createdAt: Date.now(), tokens: [] };
  }
  const token = genToken();
  user.tokens = (user.tokens || []).filter(t => t.expires > Date.now()).slice(-10);
  user.tokens.push({ token, expires: Date.now() + 90 * 24 * 60 * 60 * 1000 });
  user.lastSignIn = Date.now();
  await users.setJSON(email, user);

  // Lookup any prior transactions
  const tx = txStore();
  let tier = null;
  try {
    const txRec = await tx.get(email, { type: 'json' });
    if (txRec && txRec.tier) tier = txRec.tier;
  } catch (e) {}

  return json(200, { ok: true, name: user.name, token, tier });
};
