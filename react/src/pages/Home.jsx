import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resolveByUrl, listTop } from '../api/ads';
import AdCard from '../components/AdCard';

const Home = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const { data: topData, isPending: topLoading, isError: topError } = useQuery({
    queryKey: ['ads', 'top', { limit: 12 }],
    queryFn: () => listTop({ limit: 12, offset: 0 }),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveByUrl,
    onSuccess: (data) => {
      if (data && data.success && data.ad && data.ad._id) {
        navigate(`/ad/${data.ad._id}`);
      } else {
        setError('Не удалось обработать ссылку');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Ошибка обработки ссылки';
      setError(msg);
    },
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    const value = String(url || '').trim();
    if (!value) {
      setError('Введите ссылку на объявление Авито');
      return;
    }
    resolveMutation.mutate({ url: value });
  };

  return (
    <div>
      <div className="hero">
        <h1>Быстрые комментарии к объявлениям Авито</h1>
        <p>Вставьте ссылку на объявление — мы найдём его и откроем страницу с обсуждением.</p>
        <form className="inline-form" onSubmit={onSubmit}>
          <input
            className="input"
            type="url"
            placeholder="Вставьте ссылку на объявление Авито"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={resolveMutation.isPending}>
            {resolveMutation.isPending ? 'Открываем…' : 'Открыть'}
          </button>
        </form>
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      <h2 className="section-title">Самые просматриваемые</h2>
      {topLoading && <div className="loading">Загрузка объявлений…</div>}
      {topError && <div className="error">Не удалось загрузить список объявлений</div>}
      {!topLoading && !topError && (
        topData?.data?.length ? (
          <div className="grid">
            {topData.data.map((ad) => (
              <AdCard key={ad._id} ad={ad} />
            ))}
          </div>
        ) : (
          <div className="empty">Пока нет объявлений</div>
        )
      )}
    </div>
  );
};

export default Home;
