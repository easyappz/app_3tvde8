import instance from './axios';

export async function apiRegister({ email, password }) {
  const res = await instance.post('/api/auth/register', { email, password });
  return res.data;
}

export async function apiLogin({ email, password }) {
  const res = await instance.post('/api/auth/login', { email, password });
  return res.data;
}
