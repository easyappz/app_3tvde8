import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAd } from '../api/ads';
import { addComment, listComments } from '../api/comments';
import { useAuth } from '../context/AuthContext';

const EASY_TAG = '1760914455134-react/src/pages/AdPage.jsx';

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

  const { data: adData, isLoading: adLoading, isError: adError, error: adErr } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => getAd(id),
    enabled: Boolean(id),
  });

  const { data: commentsData, isLoading: commentsLoading, isError: commentsError, error: commentsErr, refetch: refetchComments } = useQuery({
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
        setSendError(res?.error || 'Не удалось отправить комментарий');
      }
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;
      if (status === 429 && serverMsg) {
        setSendError(serverMsg);
      } else {
        const msg = serverMsg || 'Ошибка отправки комментария';
        setSendError(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const showDegradedHelp = Boolean(
    ad && (
      !ad.image || !String(ad.title || '').trim() || String(ad.title || '').trim() === 'Объявление Avito'
    )
  );

  return (
    <div data-easytag={EASY_TAG}>
      <div style={{ marginBottom: 12 }} data-easytag={EASY_TAG}>
        <Link className="back-link" to="/" data-easytag={EASY_TAG}>⟵ На главную</Link>
      </div>

      {adLoading && (
        <div data-easytag={EASY_TAG}>
          <div className="ad-hero" style={{ marginBottom: 16 }} data-easytag={EASY_TAG}>
            <div
              className="skeleton"
              style={{ height: 240, width: '100%', background: '#eee', borderRadius: 8 }}
              data-easytag={EASY_TAG}
            />
            <div className="ad-info" style={{ marginTop: 10 }} data-easytag={EASY_TAG}>
              <div className="skeleton" style={{ height: 18, width: '60%', background: '#eee', borderRadius: 4, marginBottom: 8 }} data-easytag={EASY_TAG} />
              <div className="skeleton" style={{ height: 14, width: '30%', background: '#f0f0f0', borderRadius: 4 }} data-easytag={EASY_TAG} />
            </div>
          </div>
          <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-easytag={EASY_TAG}>
            <div className="spinner" data-easytag={EASY_TAG} /> Загружаем объявление...
          </div>
        </div>
      )}

      {adError && (
        <div className="error" data-easytag={EASY_TAG}>
          Не удалось загрузить объявление. {String(adErr?.response?.data?.error || adErr?.message || '')}
        </div>
      )}

      {ad && (
        <div className="ad-hero" style={{ marginBottom: 16 }} data-easytag={EASY_TAG}>
          {ad.image ? (
            <img className="ad-cover" src={ad.image} alt={ad.title || 'Изображение объявления'} data-easytag={EASY_TAG} />
          ) : (
            <div className="ad-cover" style={{ height: 240, background: '#f2f2f2', borderRadius: 8 }} data-easytag={EASY_TAG} />
          )}
          <div className="ad-info" data-easytag={EASY_TAG}>
            <h2 className="ad-title" data-easytag={EASY_TAG}>{(ad.title || '').trim() || 'Без названия'}</h2>
            <div className="ad-views" data-easytag={EASY_TAG}>Просмотры: {typeof ad.views === 'number' ? ad.views : 0}</div>
            <div className="help" style={{ marginTop: 8 }} data-easytag={EASY_TAG}>Создано: {ad.createdAt ? formatDate(ad.createdAt) : '—'}</div>
            <a className="btn ghost" style={{ marginTop: 12, display: 'inline-block' }} href={ad.url} target="_blank" rel="noreferrer" data-easytag={EASY_TAG}>Открыть на Авито</a>
          </div>
          {showDegradedHelp && (
            <div className="muted" style={{ marginTop: 12, background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, padding: '8px 10px' }} data-easytag={EASY_TAG}>
              Не удалось автоматически подтянуть детали объявления. Это может быть временным ограничением со стороны Avito. Попробуйте позже.
            </div>
          )}
        </div>
      )}

      <section className="comments" data-easytag={EASY_TAG}>
        <h3 style={{ margin: 0, marginBottom: 8 }} data-easytag={EASY_TAG}>Комментарии</h3>
        {commentsLoading && (
          <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-easytag={EASY_TAG}>
            <div className="spinner" data-easytag={EASY_TAG} /> Загружаем комментарии...
          </div>
        )}
        {commentsError && (
          <div className="error" data-easytag={EASY_TAG}>
            Не удалось загрузить комментарии. {String(commentsErr?.response?.data?.error || commentsErr?.message || '')}
          </div>
        )}
        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="empty" data-easytag={EASY_TAG}>Пока нет комментариев. Будьте первым!</div>
        )}
        {comments.map((c) => (
          <div key={c._id} className="comment" data-easytag={EASY_TAG}>
            <div className="comment-head" data-easytag={EASY_TAG}>
              <span data-easytag={EASY_TAG}>{c?.user?.email || 'Аноним'}</span>
              <span data-easytag={EASY_TAG}>{c?.createdAt ? formatDate(c.createdAt) : ''}</span>
            </div>
            <div className="comment-text" data-easytag={EASY_TAG}>{c.text}</div>
          </div>
        ))}

        {isAuthenticated ? (
          <form onSubmit={onSend} style={{ marginTop: 12 }} data-easytag={EASY_TAG}>
            <label className="label" htmlFor="comment" data-easytag={EASY_TAG}>Добавить комментарий</label>
            <textarea id="comment" className="input" rows={3} placeholder="Ваш комментарий..." value={text} onChange={(e) => setText(e.target.value)} data-easytag={EASY_TAG} />
            {sendError ? <div className="error" data-easytag={EASY_TAG}>{sendError}</div> : <div className="help" data-easytag={EASY_TAG}>Будьте вежливы. Комментарий увидят другие пользователи.</div>}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }} data-easytag={EASY_TAG}>
              <button className="btn primary" type="submit" disabled={sending} data-easytag={EASY_TAG}>{sending ? 'Отправка...' : 'Отправить'}</button>
            </div>
          </form>
        ) : (
          <div className="help" style={{ marginTop: 8 }} data-easytag={EASY_TAG}>Чтобы оставить комментарий, войдите в аккаунт.</div>
        )}
      </section>
    </div>
  );
}
