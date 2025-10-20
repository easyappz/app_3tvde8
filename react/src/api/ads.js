import instance from './axios';

export const listTop = async ({ limit = 20, offset = 0 } = {}) => {
  const res = await instance.get('/api/ads', { params: { limit, offset } });
  return res.data;
};

export const resolveByUrl = async ({ url }) => {
  const res = await instance.post('/api/ads/resolve', { url });
  return res.data;
};

export const getById = async (id) => {
  const res = await instance.get(`/api/ads/${id}`);
  return res.data;
};
