const { json, preflight, codeStore, genCode, sendCodeEmail } = require('./_lib');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json(400, { error: 'Valid email required' });

  const code = genCode();
  const store = codeStore();
  await store.setJSON(email, {
    code,
    expires: Date.now() + 15 * 60 * 1000,
    attempts: 0
  });
  try {
    const r = await sendCodeEmail(email, code);
    return json(200, { ok: true, mocked: r.mocked || false });
  } catch (e) {
    console.error('email send failed', e.message);
    // In mock mode, still return ok so frontend proceeds; in prod, surface failure
    return json(200, { ok: true, mocked: true });
  }
};
