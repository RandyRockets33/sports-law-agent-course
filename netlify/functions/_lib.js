// Shared library for Sports Agent Academy Netlify functions.
// Uses Netlify Blobs as the durable store (free tier).

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const TIER_INCLUDES = {
  full: ['all', 'lawyer', 'lawschool'],
  agent: ['all'],
  lawyer: ['all', 'lawyer'],
  lawschool: ['all', 'lawyer', 'lawschool']
};

function corsHeaders(origin = '*') {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

function json(statusCode, body, origin = '*') {
  return {
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body)
  };
}

function preflight(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  return null;
}

function blobOpts(name) {
  const opts = { name, consistency: 'strong' };
  if (process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    opts.siteID = process.env.NETLIFY_BLOBS_SITE_ID;
    opts.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return opts;
}
function userStore() { return getStore(blobOpts('saa-users')); }
function codeStore() { return getStore(blobOpts('saa-codes')); }
function certStore() { return getStore(blobOpts('saa-certs')); }
function txStore() { return getStore(blobOpts('saa-tx')); }

function genToken() { return crypto.randomBytes(24).toString('hex'); }
function genCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function genCredId(email) {
  const hash = crypto.createHash('sha256').update(email + Date.now()).digest('hex').slice(0, 8).toUpperCase();
  return `SAA-${hash}-${Date.now().toString(36).toUpperCase()}`;
}

function priceIdToTier(priceId) {
  const map = {
    // Current single-price full-access SKU ($497)
    'price_1ToB7eCpHNvhfs67EVaUJDFm': 'full',
    // Old $1497 price (deactivated, but historical checkouts still unlock)
    'price_1ToB58CpHNvhfs67IUEPVyF8': 'full',
    // Legacy three-tier prices — remapped to full since we collapsed tiers.
    'price_1To7GNCpHNvhfs67rrLj9u1E': 'full',
    'price_1To7GOCpHNvhfs67hOQ4MlFc': 'full',
    'price_1To7GPCpHNvhfs67ARHKEwRH': 'full'
  };
  return map[priceId] || null;
}

async function sendCodeEmail(email, code) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured, mock code =', code, 'for', email);
    return { mocked: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'Sports Agent Academy <enrollments@sportsagentacademy.io>',
    to: email,
    subject: 'Your Sports Agent Academy verification code',
    text: `Your verification code: ${code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request it, ignore this email.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:30px;color:#1a1a1a;background:#f7f5f0;border-radius:8px;">
      <h2 style="font-family:Georgia,serif;color:#0b1220;margin:0 0 14px;">Sports Agent Academy</h2>
      <p>Your verification code:</p>
      <div style="font-size:2rem;font-family:monospace;letter-spacing:0.3em;background:white;padding:1rem 1.4rem;border-radius:6px;border:1px solid #d4af37;display:inline-block;margin:0.5rem 0;">${code}</div>
      <p style="color:#555;font-size:0.9rem;">This code expires in 15 minutes. If you didn't request it, ignore this email.</p>
    </div>`
  });
  return { sent: true };
}

module.exports = {
  TIER_INCLUDES, json, preflight,
  userStore, codeStore, certStore, txStore,
  genToken, genCode, genCredId, priceIdToTier, sendCodeEmail
};
