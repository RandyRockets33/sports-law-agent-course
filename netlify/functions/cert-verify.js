const { json, preflight, certStore } = require('./_lib');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  const id = ((event.queryStringParameters || {}).id || '').trim().toUpperCase().replace(/^\/+/, '');
  if (!id) return json(400, { error: 'Credential ID required' });
  const store = certStore();
  const rec = await store.get(id, { type: 'json' });
  if (!rec) return json(404, { error: 'Not found' });
  return json(200, { ok: true, name: rec.name, tier: rec.tier, issued: rec.issued, credId: rec.credId });
};
