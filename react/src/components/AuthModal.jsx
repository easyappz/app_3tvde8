import React, { useEffect, useState } from 'react';
import { apiLogin, apiRegister } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, defaultTab = 'login', onClose }) {
  const { login } = useAuth();
  const [tab, setTab] = useState(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setTab(defaultTab); setError(''); setEmail(''); setPassword(''); }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const close = () => {
    if (!loading) onClose && onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = String(email || '').trim();
    const trimmedPassword = String(password || '').trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Введите email и пароль');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'register') {
        const data = await apiRegister({ email: trimmedEmail, password: trimmedPassword });
        if (data && data.success && data.token && data.user) {
          login(data.user, data.token);
          close();
        } else {
          setError('Не удалось зарегистрироваться');
        }
      } else {
        const data = await apiLogin({ email: trimmedEmail, password: trimmedPassword });
        if (data && data.success && data.token && data.user) {
          login(data.user, data.token);
          close();
        } else {
          setError('Неверные учетные данные');
        }
      }
    } catch (err) {
      const apiMsg = err?.response?.data?.error;
      setError(apiMsg || 'Произошла ошибка. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{tab === 'register' ? 'Регистрация' : 'Вход'}</h3>
        <div className="form-row" style={{ marginBottom: 10 }}>
          <button className={`btn ${tab === 'login' ? 'primary' : 'ghost'}`} onClick={() => setTab('login')}>Вход</button>
          <button className={`btn ${tab === 'register' ? 'primary' : 'ghost'}`} onClick={() => setTab('register')}>Регистрация</button>
        </div>
        <form onSubmit={submit}>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div style={{ height: 10 }} />
          <label className="label" htmlFor="password">Пароль</label>
          <input id="password" className="input" type="password" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <div className="error">{error}</div> : <div className="help">Используйте действующий email. Пароль не короче 6 символов.</div>}
          <div className="modal-footer">
            <button type="button" className="btn ghost" onClick={close} disabled={loading}>Отмена</button>
            <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Отправка...' : (tab === 'register' ? 'Зарегистрироваться' : 'Войти')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
