import instance from './axios';

export async function resolveAd(url) {
  const res = await instance.post('/api/ads/resolve', { url });
  return res.data;
}

export async function listAds({ limit = 20, offset = 0 } = {}) {
  const res = await instance.get('/api/ads', { params: { limit, offset } });
  return res.data;
}

export async function getAd(id) {
  const res = await instance.get(`/api/ads/${id}`);
  return res.data;
}
