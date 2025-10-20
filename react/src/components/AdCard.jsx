import React from 'react';

const EASY_TAG = '1760914455134-react/src/components/AdCard.jsx';

export default function AdCard({ ad, onClick }) {
  const title = (ad?.title || '').trim() || 'Без названия';
  const views = typeof ad?.views === 'number' ? ad.views : 0;
  const img = ad?.image || '';

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) onClick();
    }
  };

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      aria-label="Открыть объявление"
      onClick={onClick}
      onKeyDown={onKey}
      data-easytag={EASY_TAG}
    >
      <div
        className="card-media"
        style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#f2f2f2', borderRadius: 8, overflow: 'hidden' }}
        data-easytag={EASY_TAG}
      >
        {img ? (
          <img
            className="card-cover"
            src={img}
            alt={title || 'Изображение объявления'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            data-easytag={EASY_TAG}
          />
        ) : (
          <div
            className="card-cover placeholder"
            role="img"
            aria-label="Изображение недоступно"
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12 }}
            data-easytag={EASY_TAG}
          >
            Нет изображения
          </div>
        )}
      </div>

      <div className="card-body" data-easytag={EASY_TAG}>
        <div className="card-title" title={title} data-easytag={EASY_TAG}>{title}</div>
        <div className="card-meta" data-easytag={EASY_TAG}>Просмотры: {views}</div>
      </div>
    </div>
  );
}
