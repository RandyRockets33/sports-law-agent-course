const { json, preflight, txStore, codeStore, genCode, sendCodeEmail } = require('./_lib');

function validTeamCode(code) {
  const configured = (process.env.TEAM_TEST_CODES || 'GDTEST100,SAAFREE100')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return configured.includes((code || '').trim().toUpperCase());
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  if (!email || !email.includes('@')) return json(400, { error: 'Valid email required' });
  if (!validTeamCode(code)) return json(403, { error: 'Invalid team code' });

  const tx = txStore();
  const rec = (await tx.get(email, { type: 'json' })) || { transactions: [] };
  rec.tier = 'full';
  rec.transactions = rec.transactions || [];
  rec.transactions.push({
    sessionId: 'team-code-' + Date.now(),
    tier: 'full',
    amount: 0,
    currency: 'usd',
    paidAt: Date.now(),
    note: 'team code ' + code.toUpperCase()
  });
  await tx.setJSON(email, rec);

  const authCode = genCode();
  await codeStore().setJSON(email, {
    code: authCode,
    expires: Date.now() + 15 * 60 * 1000,
    attempts: 0
  });

  let emailResult = {};
  try {
    emailResult = await sendCodeEmail(email, authCode);
  } catch (e) {
    console.error('team-code email send failed', e.message);
    emailResult = { mocked: true };
  }

  return json(200, {
    ok: true,
    email,
    tier: 'full',
    verificationSent: !emailResult.mocked,
    mocked: !!emailResult.mocked
  });
};
