// Vercel Serverless Function (Node.js)
// Environment: requires Vercel Postgres (Marketplace -> Neon) so POSTGRES_* env vars are available.
// Dependency: @vercel/postgres

const { sql } = require('@vercel/postgres');

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function sanitizePhoneDigits(p) {
  return String(p || '').replace(/[^0-9]/g, '').slice(0, 11);
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      ip TEXT,
      device TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

module.exports = async function handler(req, res) {
  // Basic CORS (optional, same-origin on Vercel typically OK)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String((body.name || '')).trim();
    const phoneDigits = sanitizePhoneDigits(body.phone);
    const device = (body.device === 'mobile' || body.device === 'pc') ? body.device : 'unknown';
    const ip = getClientIp(req);

    if (!name) return res.status(400).json({ ok: false, error: 'name_required' });
    if (phoneDigits.length < 10 || phoneDigits.length > 11) return res.status(400).json({ ok: false, error: 'phone_invalid' });

    await ensureTable();

    const { rows } = await sql`
      INSERT INTO submissions (name, phone, ip, device)
      VALUES (${name}, ${phoneDigits}, ${ip}, ${device})
      RETURNING id, name, phone, ip, device, created_at;
    `;

    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('submit error:', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};