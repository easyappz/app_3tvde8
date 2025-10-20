import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('login');

  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true" />
          <div className="brand-title">Easyappz</div>
        </div>
        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <span className="muted" title={user?.email || ''}>{user?.email || 'Профиль'}</span>
              <button className="btn danger" onClick={logout}>Выйти</button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={() => { setInitialTab('login'); setOpen(true); }}>Войти</button>
              <button className="btn primary" onClick={() => { setInitialTab('register'); setOpen(true); }}>Регистрация</button>
            </>
          )}
        </div>
      </div>
      {open && (
        <AuthModal isOpen={open} defaultTab={initialTab} onClose={() => setOpen(false)} />)
      }
    </header>
  );
}
