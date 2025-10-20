import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const EASY_TAG = '1760914455134-react/src/pages/EmailVerify.jsx';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function EmailVerify() {
  const query = useQuery();
  const tokenParam = query.get('token') || '';
  const { login } = useAuth();

  const [status, setStatus] = useState(tokenParam ? 'loading' : 'error');
  const [message, setMessage] = useState(tokenParam ? 'Подтверждаем вашу почту...' : 'Токен не найден');

  useEffect(() => {
    let isMounted = true;
    async function run() {
      if (!tokenParam) return;
      setStatus('loading');
      setMessage('Подтверждаем вашу почту...');
      try {
        const data = await verifyEmail(tokenParam);
        if (!isMounted) return;
        if (data?.success) {
          if (data?.token && data?.user) {
            login(data.user, data.token);
          }
          setStatus('success');
          setMessage('Email успешно подтверждён! Вы вошли в аккаунт.');
        } else {
          setStatus('error');
          setMessage(data?.error || 'Не удалось подтвердить почту');
        }
      } catch (err) {
        if (!isMounted) return;
        const msg = err?.response?.data?.error || 'Произошла ошибка при подтверждении';
        setStatus('error');
        setMessage(msg);
      }
    }
    run();
    return () => { isMounted = false; };
  }, [tokenParam, login]);

  return (
    <div data-easytag={EASY_TAG}>
      <div className="hero" data-easytag={EASY_TAG}>
        <h1 style={{ margin: 0, fontSize: 20 }} data-easytag={EASY_TAG}>Подтверждение email</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }} data-easytag={EASY_TAG}>
          {status === 'loading' && <div className="spinner" data-easytag={EASY_TAG} />}
          <p className={status === 'error' ? 'error' : 'muted'} style={{ margin: 0 }} data-easytag={EASY_TAG}>{message}</p>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }} data-easytag={EASY_TAG}>
          <Link to="/" className="btn primary" data-easytag={EASY_TAG}>На главную</Link>
        </div>
      </div>
    </div>
  );
}
