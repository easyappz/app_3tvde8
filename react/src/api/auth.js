import instance from './axios';

export async function apiRegister({ email, password }) {
  const res = await instance.post('/api/auth/register', { email, password });
  return res.data;
}

export async function apiLogin({ email, password }) {
  const res = await instance.post('/api/auth/login', { email, password });
  return res.data;
}

// Email verification endpoint (will be available on backend):
// GET /api/auth/verify-email?token=...
export async function verifyEmail(token) {
  const res = await instance.get('/api/auth/verify-email', { params: { token } });
  return res.data;
}

// Optional: resend verification letter. Not used by default.
export async function resendVerification(email) {
  const res = await instance.post('/api/auth/resend-verification', { email });
  return res.data;
}
