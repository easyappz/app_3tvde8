import React from 'react';

export default function AdCard({ ad, onClick }) {
  const title = ad?.title || 'Без названия';
  const views = typeof ad?.views === 'number' ? ad.views : 0;
  const img = ad?.image || '';
  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onClick && onClick(); }}>
      {img ? (
        <img className="card-cover" src={img} alt={title} />
      ) : (
        <div className="card-cover" />
      )}
      <div className="card-body">
        <div className="card-title">{title}</div>
        <div className="card-meta">Просмотры: {views}</div>
      </div>
    </div>
  );
}
