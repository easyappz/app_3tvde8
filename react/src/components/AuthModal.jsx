import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login, register } from '../api/auth';

const AuthModal = ({ open, onClose, mode = 'login', onAuthSuccess }) => {
  const [authMode, setAuthMode] = useState(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      if (data && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else {
        setError('Не удалось войти');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Ошибка входа';
      setError(msg);
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      if (data && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else {
        setError('Не удалось зарегистрироваться');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Ошибка регистрации';
      setError(msg);
    },
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Заполните email и пароль');
      return;
    }
    if (authMode === 'login') {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password });
    }
  };

  if (!open) return null;

  const loading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h3>
        <form onSubmit={onSubmit}>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div style={{ height: 10 }} />

          <label className="label" htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="Минимум 6 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? <div className="error">{error}</div> : <div className="help">Токен сохранится в localStorage</div>}

          <div className="modal-footer">
            <button type="button" className="btn ghost" onClick={onClose}>Отмена</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? 'Перейти к регистрации' : 'У меня есть аккаунт'}
              </button>
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? 'Загрузка…' : (authMode === 'login' ? 'Войти' : 'Зарегистрироваться')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
