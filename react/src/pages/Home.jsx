import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listAds, resolveAd } from '../api/ads';
import AdCard from '../components/AdCard';

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [resolving, setResolving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ads', { limit: 20, offset: 0 }],
    queryFn: () => listAds({ limit: 20, offset: 0 }),
  });

  const onOpen = async () => {
    setUrlError('');
    const value = String(url || '').trim();
    if (!value) {
      setUrlError('Вставьте ссылку на объявление');
      return;
    }
    const lower = value.toLowerCase();
    const startsWithHttp = lower.startsWith('http://') || lower.startsWith('https://');
    if (!startsWithHttp) {
      setUrlError('Ссылка должна начинаться с http:// или https://');
      return;
    }
    setResolving(true);
    try {
      const result = await resolveAd(value);
      const ad = result?.ad;
      if (result?.success && ad?._id) {
        navigate(`/ad/${ad._id}`);
      } else {
        setUrlError('Не удалось открыть объявление');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || 'Ошибка при открытии объявления';
      setUrlError(msg);
    } finally {
      setResolving(false);
    }
  };

  const ads = data?.data || [];

  return (
    <div>
      <section className="hero">
        <h1>Откройте объявление Авито по ссылке</h1>
        <p>Вставьте ссылку на объявление, мы создадим карточку и покажем статистику просмотров и комментарии.</p>
        <div className="inline-form">
          <input
            className="input"
            placeholder="https://www.avito.ru/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
          />
          <button className="btn primary" onClick={onOpen} disabled={resolving}>{resolving ? 'Открываем...' : 'Открыть объявление'}</button>
        </div>
        {urlError ? <div className="error">{urlError}</div> : <div className="help">Проверьте, что ссылка ведет на конкретное объявление.</div>}
      </section>

      <h2 className="section-title">Популярные объявления</h2>
      {isLoading && (
        <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="spinner" /> Загрузка объявлений...
        </div>
      )}
      {isError && (
        <div className="error">Не удалось загрузить список. {String(error?.message || '')} <button className="btn ghost" onClick={() => refetch()}>Повторить</button></div>
      )}
      {!isLoading && !isError && ads.length === 0 && (
        <div className="empty">Пока нет объявлений</div>
      )}
      <div className="grid">
        {ads.map((ad) => (
          <AdCard key={ad._id} ad={ad} onClick={() => navigate(`/ad/${ad._id}`)} />
        ))}
      </div>
    </div>
  );
}
