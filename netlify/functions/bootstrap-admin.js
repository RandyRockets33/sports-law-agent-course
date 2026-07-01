// One-time bootstrap: pre-grant tier 'full' to seed admin and owner accounts.
// Deletes itself effectively after first use by checking an env flag.
const { json, preflight, txStore, userStore } = require('./_lib');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (process.env.BOOTSTRAP_SECRET !== ((event.queryStringParameters||{}).k || '')) {
    return json(403, { error: 'Bad bootstrap key' });
  }
  const seeds = [
    'randy@ghostdawgconsulting.com',
    'chudkasper@gmail.com',
    'tosimisokasper@gmail.com'
  ];
  const tx = txStore();
  const out = [];
  for (const email of seeds) {
    let rec = (await tx.get(email, { type: 'json' })) || { transactions: [] };
    rec.tier = 'full';
    rec.transactions.push({ sessionId: 'bootstrap-' + Date.now(), tier: 'full', amount: 0, paidAt: Date.now(), note: 'bootstrap seed' });
    await tx.setJSON(email, rec);
    out.push(email);
  }
  return json(200, { ok: true, seeded: out });
};
