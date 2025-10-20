import instance from './axios';

export const register = async ({ email, password }) => {
  const res = await instance.post('/api/auth/register', { email, password });
  return res.data;
};

export const login = async ({ email, password }) => {
  const res = await instance.post('/api/auth/login', { email, password });
  return res.data;
};
