import instance from './axios';

export async function listComments(adId, { limit = 20, offset = 0, sort = 'DESC' } = {}) {
  const res = await instance.get(`/api/ads/${adId}/comments`, { params: { limit, offset, sort } });
  return res.data;
}

export async function addComment(adId, text) {
  const res = await instance.post(`/api/ads/${adId}/comments`, { text });
  return res.data;
}
