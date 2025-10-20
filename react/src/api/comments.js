import instance from './axios';

export const listByAd = async (adId, { limit = 20, offset = 0, sort = 'DESC' } = {}) => {
  const res = await instance.get(`/api/ads/${adId}/comments`, {
    params: { limit, offset, sort },
  });
  return res.data;
};

export const add = async (adId, { text }) => {
  const res = await instance.post(`/api/ads/${adId}/comments`, { text });
  return res.data;
};
