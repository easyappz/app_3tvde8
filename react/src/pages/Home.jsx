import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listAds, resolveAd } from '../api/ads';
import AdCard from '../components/AdCard';

const EASY_TAG = '1760914455134-react/src/pages/Home.jsx';

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveHint, setResolveHint] = useState('');
  const [resolveWarnings, setResolveWarnings] = useState([]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ads', { limit: 20, offset: 0 }],
    queryFn: () => listAds({ limit: 20, offset: 0 }),
  });

  const onOpen = async () => {
    setUrlError('');
    setResolveHint('');
    setResolveWarnings([]);

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
      if (result?.degraded) {
        setResolveHint('Данные могли быть получены в урезанном режиме. Некоторые детали объявления могут отсутствовать.');
        setResolveWarnings(Array.isArray(result?.warnings) ? result.warnings : []);
      }
      const ad = result?.ad;
      if (result?.success && ad?._id) {
        navigate(`/ad/${ad._id}`);
      } else {
        setUrlError(result?.error || 'Не удалось открыть объявление');
      }
    } catch (e) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.error;
      let msg = '';
      if (status === 429) {
        msg = 'Сервис перегружен, попробуйте позже';
      } else if (status === 422) {
        msg = 'Не удалось разобрать объявление. Проверьте ссылку и попробуйте ещё раз.';
      } else if (status === 403) {
        msg = 'Доступ запрещён. Войдите в аккаунт и попробуйте снова.';
      } else if (status === 400) {
        msg = serverMsg || 'Некорректная ссылка на объявление';
      } else if (status === 500) {
        msg = serverMsg || 'Внутренняя ошибка сервера. Попробуйте позже.';
      } else {
        msg = serverMsg || 'Ошибка при открытии объявления';
      }
      setUrlError(msg);
    } finally {
      setResolving(false);
    }
  };

  const ads = data?.data || [];

  return (
    <div data-easytag={EASY_TAG}>
      <section className="hero" data-easytag={EASY_TAG}>
        <h1 data-easytag={EASY_TAG}>Откройте объявление Авито по ссылке</h1>
        <p data-easytag={EASY_TAG}>Вставьте ссылку на объявление, мы создадим карточку и покажем статистику просмотров и комментарии.</p>
        <div className="inline-form" data-easytag={EASY_TAG}>
          <input
            className="input"
            placeholder="https://www.avito.ru/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
            disabled={resolving}
            data-easytag={EASY_TAG}
          />
          <button className="btn primary" onClick={onOpen} disabled={resolving} data-easytag={EASY_TAG}>{resolving ? 'Открываем...' : 'Открыть объявление'}</button>
        </div>
        {urlError ? (
          <div className="error" data-easytag={EASY_TAG}>{urlError}</div>
        ) : (
          <div className="help" data-easytag={EASY_TAG}>Проверьте, что ссылка ведет на конкретное объявление.</div>
        )}
        {!!resolveHint && (
          <div className="muted" style={{ marginTop: 8, background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, padding: '8px 10px' }} data-easytag={EASY_TAG}>
            ⚠️ {resolveHint}
            {resolveWarnings.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }} data-easytag={EASY_TAG}>
                {resolveWarnings.map((w, i) => (
                  <li key={i} data-easytag={EASY_TAG}>{String(w)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <h2 className="section-title" data-easytag={EASY_TAG}>Популярные объявления</h2>
      {isLoading && (
        <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-easytag={EASY_TAG}>
          <div className="spinner" data-easytag={EASY_TAG} /> Загрузка объявлений...
        </div>
      )}
      {isError && (
        <div className="error" data-easytag={EASY_TAG}>
          Не удалось загрузить список. {String(error?.response?.data?.error || error?.message || '')}
          <button className="btn ghost" onClick={() => refetch()} style={{ marginLeft: 8 }} data-easytag={EASY_TAG}>Повторить</button>
        </div>
      )}
      {!isLoading && !isError && ads.length === 0 && (
        <div className="empty" data-easytag={EASY_TAG}>Пока нет объявлений</div>
      )}
      <div className="grid" data-easytag={EASY_TAG}>
        {ads.map((ad) => (
          <AdCard key={ad._id} ad={ad} onClick={() => navigate(`/ad/${ad._id}`)} />
        ))}
      </div>
    </div>
  );
}
