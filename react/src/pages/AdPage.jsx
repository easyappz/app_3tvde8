import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getById } from '../api/ads';
import { listByAd } from '../api/comments';
import CommentForm from '../components/CommentForm';

const AdPage = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const {
    data: adData,
    isPending: adLoading,
    isError: adError,
  } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => getById(id),
  });

  const {
    data: commentsData,
    isPending: commentsLoading,
    isError: commentsError,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['comments', id, { limit: 20, offset: 0, sort: 'DESC' }],
    queryFn: () => listByAd(id, { limit: 20, offset: 0, sort: 'DESC' }),
    enabled: Boolean(id),
  });

  const ad = adData?.ad;
  const comments = commentsData?.data || [];

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Link to="/" className="back-link">← На главную</Link>
      </div>

      {adLoading && <div className="loading">Загрузка объявления…</div>}
      {adError && <div className="error">Не удалось загрузить объявление</div>}

      {!adLoading && !adError && ad && (
        <div className="ad-hero">
          <img
            className="ad-cover"
            src={ad.image || '/logo512.png'}
            alt={ad.title || 'ad'}
            onError={(e) => { e.currentTarget.src = '/logo512.png'; }}
          />
          <div className="ad-info">
            <h1 className="ad-title">{ad.title || 'Объявление'}</h1>
            <div className="ad-views">Просмотры: {typeof ad.views === 'number' ? ad.views : 0}</div>
            <div className="help" style={{ marginTop: 10 }}>Оригинал: <a href={ad.url} target="_blank" rel="noreferrer">открыть на Avito</a></div>
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />

      <div className="comments">
        <h3 style={{ margin: 0 }}>Комментарии</h3>
        <div style={{ height: 10 }} />
        {commentsLoading && <div className="loading">Загрузка комментариев…</div>}
        {commentsError && <div className="error">Не удалось загрузить комментарии</div>}
        {!commentsLoading && !commentsError && (
          comments.length ? (
            <div>
              {comments.map((c) => (
                <div key={c._id} className="comment">
                  <div className="comment-head">
                    <span>{c.user?.email || 'Аноним'}</span>
                    <span>{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
                  </div>
                  <div className="comment-text">{c.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Пока нет комментариев — станьте первым!</div>
          )
        )}

        <div style={{ height: 14 }} />
        <CommentForm
          adId={id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['comments', id] });
            refetchComments();
          }}
        />
      </div>
    </div>
  );
};

export default AdPage;
