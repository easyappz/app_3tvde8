import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdCard = ({ ad }) => {
  const navigate = useNavigate();
  if (!ad) return null;

  return (
    <div className="card" onClick={() => navigate(`/ad/${ad._id}`)}>
      <img
        className="card-cover"
        src={ad.image || '/logo192.png'}
        alt={ad.title || 'ad'}
        onError={(e) => { e.currentTarget.src = '/logo192.png'; }}
      />
      <div className="card-body">
        <div className="card-title">{ad.title || 'Объявление'}</div>
        <div className="card-meta">Просмотры: {typeof ad.views === 'number' ? ad.views : 0}</div>
      </div>
    </div>
  );
};

export default AdCard;
