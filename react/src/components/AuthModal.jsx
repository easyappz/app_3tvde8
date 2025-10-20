import React, { useEffect, useState } from 'react';
import { apiLogin, apiRegister } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const EASY_TAG = '1760914455134-react/src/components/AuthModal.jsx';

export default function AuthModal({ isOpen, defaultTab = 'login', onClose }) {
  const { login } = useAuth();
  const [tab, setTab] = useState(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredInfo, setRegisteredInfo] = useState(false);

  useEffect(() => {
    setTab(defaultTab);
    setError('');
    setEmail('');
    setPassword('');
    setRegisteredInfo(false);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const close = () => {
    if (!loading) onClose && onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (registeredInfo) {
      close();
      return;
    }

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
        if (data && data.success) {
          // Do NOT auto-login after registration. Show info about email confirmation.
          setRegisteredInfo(true);
          setPassword('');
        } else {
          setError(data?.error || 'Не удалось зарегистрироваться');
        }
      } else {
        const data = await apiLogin({ email: trimmedEmail, password: trimmedPassword });
        if (data && data.success && data.token && data.user) {
          login(data.user, data.token);
          close();
        } else {
          setError(data?.error || 'Неверные учетные данные');
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
    <div className="modal-overlay" onClick={close} data-easytag={EASY_TAG}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-easytag={EASY_TAG}>
        <h3 data-easytag={EASY_TAG}>{registeredInfo ? 'Подтверждение почты' : (tab === 'register' ? 'Регистрация' : 'Вход')}</h3>

        {!registeredInfo && (
          <div className="form-row" style={{ marginBottom: 10 }} data-easytag={EASY_TAG}>
            <button
              className={`btn ${tab === 'login' ? 'primary' : 'ghost'}`}
              onClick={() => setTab('login')}
              type="button"
              data-easytag={EASY_TAG}
            >
              Вход
            </button>
            <button
              className={`btn ${tab === 'register' ? 'primary' : 'ghost'}`}
              onClick={() => setTab('register')}
              type="button"
              data-easytag={EASY_TAG}
            >
              Регистрация
            </button>
          </div>
        )}

        <form onSubmit={submit} data-easytag={EASY_TAG}>
          {!registeredInfo ? (
            <>
              <label className="label" htmlFor="email" data-easytag={EASY_TAG}>Email</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-easytag={EASY_TAG}
              />
              <div style={{ height: 10 }} data-easytag={EASY_TAG} />
              <label className="label" htmlFor="password" data-easytag={EASY_TAG}>Пароль</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-easytag={EASY_TAG}
              />
              {error ? (
                <div className="error" data-easytag={EASY_TAG}>{error}</div>
              ) : (
                <div className="help" data-easytag={EASY_TAG}>Используйте действующий email. Пароль не короче 6 символов.</div>
              )}
              <div className="modal-footer" data-easytag={EASY_TAG}>
                <button type="button" className="btn ghost" onClick={close} disabled={loading} data-easytag={EASY_TAG}>Отмена</button>
                <button type="submit" className="btn primary" disabled={loading} data-easytag={EASY_TAG}>
                  {loading ? 'Отправка...' : (tab === 'register' ? 'Зарегистрироваться' : 'Войти')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="hero" style={{ marginTop: 8 }} data-easytag={EASY_TAG}>
                <p className="muted" style={{ margin: 0 }} data-easytag={EASY_TAG}>
                  Мы отправили письмо для подтверждения. Проверьте вашу почту и перейдите по ссылке для завершения регистрации.
                </p>
              </div>
              {error && <div className="error" data-easytag={EASY_TAG}>{error}</div>}
              <div className="modal-footer" data-easytag={EASY_TAG}>
                <button type="button" className="btn primary" onClick={close} data-easytag={EASY_TAG}>Понятно</button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
