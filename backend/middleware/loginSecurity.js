const axios = require('axios');

function getClientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  return fwd || req.ip || '';
}

exports.enforceLoginSecurity = async (req, res, next) => {
  try {
    // 1) IP allowlist (optional)
    const list = String(process.env.LOGIN_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) {
      const ip = getClientIp(req);
      if (!list.includes(ip)) return res.status(403).json({ ok: false, error: 'login not allowed from this IP' });
    }

    // 2) reCAPTCHA (optional)
    const secret = process.env.RECAPTCHA_SECRET;
    if (secret) {
      const token = req.body?.captchaToken || req.headers['x-captcha-token'];
      if (!token) return res.status(400).json({ ok: false, error: 'missing captcha' });
      try {
        const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
          params: { secret, response: token }, timeout: 5000,
        });
        if (!data || data.success !== true) return res.status(400).json({ ok: false, error: 'captcha failed' });
      } catch (e) {
        return res.status(400).json({ ok: false, error: 'captcha verify error' });
      }
    }
    next();
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'login blocked' });
  }
};

