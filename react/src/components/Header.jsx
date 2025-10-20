import React, { useEffect, useState } from 'react';
import AuthModal from './AuthModal';

const Header = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      setUser(null);
    }
  }, []);

  const onLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const onAuthSuccess = (profile) => {
    setUser(profile);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-logo" />
          <div className="brand-title">Easyappz · Комментарии к объявлениям</div>
        </div>
        <div className="header-actions">
          {user ? (
            <>
              <span className="muted" title={user.email}>{user.email}</span>
              <button className="btn danger" onClick={onLogout}>Выйти</button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={() => { setMode('login'); setAuthOpen(true); }}>Войти</button>
              <button className="btn primary" onClick={() => { setMode('register'); setAuthOpen(true); }}>Регистрация</button>
            </>
          )}
        </div>
      </div>

      {authOpen && (
        <AuthModal
          mode={mode}
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onAuthSuccess={onAuthSuccess}
        />
      )}
    </header>
  );
};

export default Header;
