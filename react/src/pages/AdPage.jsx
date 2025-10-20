import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAd } from '../api/ads';
import { addComment, listComments } from '../api/comments';
import { useAuth } from '../context/AuthContext';

function formatDate(dt) {
  try {
    return new Date(dt).toLocaleString('ru-RU');
  } catch (e) {
    return '';
  }
}

export default function AdPage() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const { data: adData, isLoading: adLoading, isError: adError } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => getAd(id),
    enabled: Boolean(id),
  });

  const { data: commentsData, isLoading: commentsLoading, isError: commentsError, refetch: refetchComments } = useQuery({
    queryKey: ['comments', id, 'DESC'],
    queryFn: () => listComments(id, { sort: 'DESC', limit: 50, offset: 0 }),
    enabled: Boolean(id),
  });

  const ad = adData?.ad;
  const comments = commentsData?.data || [];

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const onSend = async (e) => {
    e.preventDefault();
    setSendError('');
    const value = String(text || '').trim();
    if (!value) { setSendError('Введите текст комментария'); return; }

    setSending(true);
    try {
      const res = await addComment(id, value);
      if (res?.success) {
        setText('');
        await refetchComments();
        await qc.invalidateQueries({ queryKey: ['ad', id] });
      } else {
        setSendError('Не удалось отправить комментарий');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Ошибка отправки комментария';
      setSendError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link className="back-link" to="/">⟵ На главную</Link>
      </div>

      {adLoading && (
        <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="spinner" /> Загружаем объявление...
        </div>
      )}
      {adError && (
        <div className="error">Не удалось загрузить объявление</div>
      )}

      {ad && (
        <div className="ad-hero" style={{ marginBottom: 16 }}>
          {ad.image ? (
            <img className="ad-cover" src={ad.image} alt={ad.title} />
          ) : (
            <div className="ad-cover" style={{ height: 240 }} />
          )}
          <div className="ad-info">
            <h2 className="ad-title">{ad.title}</h2>
            <div className="ad-views">Просмотры: {typeof ad.views === 'number' ? ad.views : 0}</div>
            <div className="help" style={{ marginTop: 8 }}>Создано: {ad.createdAt ? formatDate(ad.createdAt) : '—'}</div>
            <a className="btn ghost" style={{ marginTop: 12, display: 'inline-block' }} href={ad.url} target="_blank" rel="noreferrer">Открыть на Авито</a>
          </div>
        </div>
      )}

      <section className="comments">
        <h3 style={{ margin: 0, marginBottom: 8 }}>Комментарии</h3>
        {commentsLoading && (
          <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="spinner" /> Загружаем комментарии...
          </div>
        )}
        {commentsError && (
          <div className="error">Не удалось загрузить комментарии</div>
        )}
        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="empty">Пока нет комментариев. Будьте первым!</div>
        )}
        {comments.map((c) => (
          <div key={c._id} className="comment">
            <div className="comment-head">
              <span>{c?.user?.email || 'Аноним'}</span>
              <span>{c?.createdAt ? formatDate(c.createdAt) : ''}</span>
            </div>
            <div className="comment-text">{c.text}</div>
          </div>
        ))}

        {isAuthenticated ? (
          <form onSubmit={onSend} style={{ marginTop: 12 }}>
            <label className="label" htmlFor="comment">Добавить комментарий</label>
            <textarea id="comment" className="input" rows={3} placeholder="Ваш комментарий..." value={text} onChange={(e) => setText(e.target.value)} />
            {sendError ? <div className="error">{sendError}</div> : <div className="help">Будьте вежливы. Комментарий увидят другие пользователи.</div>}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" type="submit" disabled={sending}>{sending ? 'Отправка...' : 'Отправить'}</button>
            </div>
          </form>
        ) : (
          <div className="help" style={{ marginTop: 8 }}>Чтобы оставить комментарий, войдите в аккаунт.</div>
        )}
      </section>
    </div>
  );
}
