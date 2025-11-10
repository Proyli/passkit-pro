const jwt = require('jsonwebtoken');

function getSecret() {
  return (
    process.env.AUTH_JWT_SECRET ||
    process.env.WALLET_TOKEN_SECRET ||
    'dev-auth'
  );
}

exports.requireAuth = (req, res, next) => {
  try {
    const h = String(req.headers.authorization || '').trim();
    if (!h.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'missing bearer token' });
    const token = h.slice('Bearer '.length).trim();
    const payload = jwt.verify(token, getSecret());
    req.user = { sub: payload.sub, email: payload.email, role: payload.role || 'user' };
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
};

exports.requireRole = (role) => (req, res, next) => {
  const r = (req.user && req.user.role) || 'user';
  if (String(r).toLowerCase() !== String(role).toLowerCase()) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  return next();
};

// Minimal rate limiter (in-memory)
const bucket = new Map();
exports.rateLimit = ({ windowMs = 15 * 60 * 1000, max = 200 } = {}) => (req, res, next) => {
  const key = req.ip || req.headers['x-forwarded-for'] || 'ip';
  const now = Date.now();
  const rec = bucket.get(key) || { n: 0, ts: now };
  if (now - rec.ts > windowMs) { rec.n = 0; rec.ts = now; }
  rec.n += 1; bucket.set(key, rec);
  if (rec.n > max) return res.status(429).json({ ok: false, error: 'rate limit' });
  next();
};

