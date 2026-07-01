const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const { json, txStore, priceIdToTier } = require('./_lib');

async function sendWelcomeEmail(email, name, tier, amount) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const display = name || email.split('@')[0];
  const url = 'https://sportsagentacademy.netlify.app';
  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'Sports Agent Academy <enrollments@sportsagentacademy.io>',
    to: email,
    bcc: process.env.ADMIN_EMAILS || undefined,
    subject: 'Welcome to Sports Agent Academy',
    text: `Welcome to Sports Agent Academy, ${display}.\n\nYour enrollment is confirmed. You have lifetime access to all 15 modules, the full instructional video library, the practitioner's guide, the four-volume reference library, and the certificate of completion when you finish the capstone.\n\nStart with Module 1: ${url}/modules/module_01.html\nYour account dashboard: ${url}/account/\nFull library: ${url}/library/\n\nSign in any time with your email; we'll send you a one-time verification code.\n\n— Sports Agent Academy`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;background:#0b1220;color:#e8edf7;padding:36px;"><div style="text-align:center;margin-bottom:28px;"><div style="font-family:Georgia,serif;color:#d4af37;font-size:1.7rem;font-weight:700;letter-spacing:-0.01em;">Sports Agent Academy</div><div style="width:60px;height:2px;background:#d4af37;margin:14px auto;"></div><div style="color:#9aa6c2;font-size:0.85rem;letter-spacing:0.14em;text-transform:uppercase;">Certification Program</div></div><h2 style="font-family:Georgia,serif;font-weight:600;color:#fff;font-size:1.45rem;">Welcome, ${display}.</h2><p style="line-height:1.7;color:#cad2e2;">Your enrollment is confirmed. You have lifetime access to every module, every video lecture, the four-volume reference library, the practitioner's guide, and the Certificate of Completion when you finish the capstone.</p><div style="background:#14213c;border:1px solid #324468;border-radius:10px;padding:20px;margin:24px 0;"><div style="font-size:0.78rem;color:#d4af37;letter-spacing:0.12em;text-transform:uppercase;">What to do first</div><ul style="margin:12px 0 0 0;padding-left:18px;line-height:1.9;color:#cad2e2;"><li>Open <a style="color:#d4af37;" href="${url}/modules/module_01.html">Module 1</a> to start the certification course.</li><li>Visit your <a style="color:#d4af37;" href="${url}/account/">account dashboard</a> to track progress and view your certificate.</li><li>Download the full <a style="color:#d4af37;" href="${url}/library/">reference library</a>.</li></ul></div><p style="color:#9aa6c2;font-size:0.9rem;">Sign in any time with your email — we'll send you a one-time verification code (no password). 14-day full refund. Reply to this email any time you need help.</p><p style="margin-top:32px;color:#6c7691;font-size:0.8rem;">Sports Agent Academy · An online certification academy<br>Receipt and payment confirmation will arrive separately from Stripe.</p></div>`
  });
}

async function notifyAdminOfEnrollment(email, name, tier, amount, sessionId) {
  if (!process.env.SMTP_HOST || !process.env.ADMIN_EMAILS) return;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'Sports Agent Academy <enrollments@sportsagentacademy.io>',
    to: process.env.ADMIN_EMAILS,
    subject: `[SAA] New enrollment: ${email} ($${(amount/100).toFixed(2)})`,
    text: `New enrollment\n\nEmail: ${email}\nName: ${name || '(not provided)'}\nTier: ${tier}\nAmount: $${(amount/100).toFixed(2)}\nSession: ${sessionId}\nDashboard: https://sportsagentacademy.netlify.app/admin/`
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return json(400, { error: 'Bad signature' });
  }

  // We handle checkout.session.completed (Payment Links emit this)
  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object;

    // Reject any session that is not explicitly for Sports Agent Academy.
    // Metadata is set on Payment Links; if a Stripe session hits this webhook for another product, ignore it.
    const sessionCourse = (session.metadata && session.metadata.course) || null;
    if (sessionCourse && sessionCourse !== 'sports-agent-academy') {
      console.log('Skipping non-SAA session', session.id, 'course=', sessionCourse);
      return json(200, { received: true, skipped: 'not-saa' });
    }

    const email = (session.customer_details && session.customer_details.email) || session.customer_email;
    if (!email) {
      console.warn('checkout.session.completed with no email', session.id);
      return json(200, { received: true });
    }
    // Look up line item to determine tier — only SAA price IDs map to a tier.
    let tier = null;
    let sawSaaPriceId = false;
    try {
      const lis = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5, expand: ['data.price'] });
      for (const li of lis.data) {
        const pid = li.price && li.price.id;
        const t = priceIdToTier(pid);
        if (t) { tier = t; sawSaaPriceId = true; break; }
      }
    } catch (e) {
      console.error('listLineItems failed', e.message);
    }
    // Metadata fallback (Payment Links set tier metadata)
    if (!tier && session.metadata && session.metadata.tier) tier = session.metadata.tier;
    // If we still don't have a tier AND the session is not identified as SAA, skip it entirely.
    if (!tier) {
      if (!sawSaaPriceId && sessionCourse !== 'sports-agent-academy') {
        console.log('Skipping session with no SAA identifiers:', session.id);
        return json(200, { received: true, skipped: 'no-saa-identifiers' });
      }
      // Session tagged for SAA but no tier — default to full.
      tier = 'full';
    }
    const lower = email.toLowerCase();
    const store = txStore();
    let rec = (await store.get(lower, { type: 'json' })) || { transactions: [] };
    // Upgrade-only: don't overwrite a higher tier with a lower one
    const RANK = { agent: 1, lawyer: 2, lawschool: 3, full: 4 };
    if (!rec.tier || (RANK[tier] || 0) >= (RANK[rec.tier] || 0)) rec.tier = tier;
    rec.transactions.push({
      sessionId: session.id,
      tier,
      amount: session.amount_total,
      currency: session.currency,
      paidAt: Date.now()
    });
    await store.setJSON(lower, rec);
    console.log('Granted', tier, 'to', lower, 'via', session.id);

    // Send welcome email + admin notification
    try {
      const name = (session.customer_details && session.customer_details.name) || '';
      await sendWelcomeEmail(lower, name, tier, session.amount_total);
      await notifyAdminOfEnrollment(lower, name, tier, session.amount_total || 0, session.id);
    } catch (e) {
      console.error('Welcome email failed:', e.message);
    }
  }
  return json(200, { received: true });
};
