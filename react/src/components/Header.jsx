import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const EASY_TAG = '1760914455134-react/src/components/Header.jsx';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('login');

  return (
    <header className="header" data-easytag={EASY_TAG}>
      <div className="header-inner" data-easytag={EASY_TAG}>
        <div className="brand" data-easytag={EASY_TAG}>
          <div className="brand-logo" aria-hidden="true" data-easytag={EASY_TAG} />
          <div className="brand-title" data-easytag={EASY_TAG}>Авиатор</div>
        </div>
        <div className="header-actions" data-easytag={EASY_TAG}>
          {isAuthenticated ? (
            <>
              <span className="muted" title={user?.email || ''} data-easytag={EASY_TAG}>{user?.email || 'Профиль'}</span>
              <button className="btn danger" onClick={logout} data-easytag={EASY_TAG}>Выйти</button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={() => { setInitialTab('login'); setOpen(true); }} data-easytag={EASY_TAG}>Войти</button>
              <button className="btn primary" onClick={() => { setInitialTab('register'); setOpen(true); }} data-easytag={EASY_TAG}>Регистрация</button>
            </>
          )}
        </div>
      </div>
      {open && (
        <AuthModal isOpen={open} defaultTab={initialTab} onClose={() => setOpen(false)} />
      )}
    </header>
  );
}
