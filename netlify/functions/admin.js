// Admin dashboard data endpoint. Restricted to ADMIN_EMAILS.
const Stripe = require('stripe');
const { json, preflight, userStore, certStore, txStore } = require('./_lib');

function isAdmin(email) {
  const admins = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return admins.includes((email || '').toLowerCase());
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const adminEmail = ((event.queryStringParameters || {}).email || '').trim().toLowerCase();
  if (!isAdmin(adminEmail)) return json(403, { error: 'Admin only' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Token required' });
  const users = userStore();
  const adminUser = await users.get(adminEmail, { type: 'json' });
  if (!adminUser) return json(401, { error: 'Sign in first' });
  const valid = (adminUser.tokens || []).some(t => t.token === token && t.expires > Date.now());
  if (!valid) return json(401, { error: 'Token invalid' });

  // Gather counts and recent activity
  const tx = txStore();
  const certs = certStore();

  // Walk through stores (small N right now — fine to scan)
  const userList = [];
  for await (const blob of users.list()) {
    const u = await users.get(blob.key, { type: 'json' });
    if (!u) continue;
    const txRec = await tx.get(blob.key, { type: 'json' });
    userList.push({
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      lastSignIn: u.lastSignIn,
      tier: txRec ? txRec.tier : null,
      transactionCount: txRec ? (txRec.transactions || []).length : 0,
      hasCert: !!u.certificate
    });
  }
  // Recent transactions across all users
  const recentTx = [];
  for (const u of userList) {
    const txRec = await tx.get(u.email.toLowerCase(), { type: 'json' });
    if (txRec && txRec.transactions) {
      for (const t of txRec.transactions) {
        recentTx.push({ email: u.email, ...t });
      }
    }
  }
  recentTx.sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

  // Certificates
  const certList = [];
  for await (const blob of certs.list()) {
    const c = await certs.get(blob.key, { type: 'json' });
    if (c) certList.push(c);
  }

  // Live Stripe stats (last 7 days)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let stripe7d = { sessions: 0, gross_usd: 0 };
  try {
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const sessions = await stripe.checkout.sessions.list({ limit: 100, created: { gte: since } });
    for (const s of sessions.data) {
      if (s.payment_status === 'paid' && s.metadata && s.metadata.course === 'sports-agent-academy') {
        stripe7d.sessions++;
        stripe7d.gross_usd += (s.amount_total || 0) / 100;
      }
    }
  } catch (e) {}

  // Totals
  const totalRevenue = recentTx.reduce((sum, t) => sum + (t.amount || 0) / 100, 0);

  return json(200, {
    ok: true,
    admin: adminEmail,
    stats: {
      userCount: userList.length,
      enrolledCount: userList.filter(u => u.tier).length,
      certCount: certList.length,
      totalRevenueUsd: totalRevenue,
      last7d: stripe7d
    },
    users: userList.sort((a, b) => (b.lastSignIn || 0) - (a.lastSignIn || 0)),
    recentTransactions: recentTx.slice(0, 50),
    certificates: certList.sort((a, b) => (b.issued || '').localeCompare(a.issued || '')).slice(0, 50)
  });
};
