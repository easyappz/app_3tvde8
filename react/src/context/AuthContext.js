import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const token = localStorage.getItem('token') || '';
    const userJson = localStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : null;
    return { token, user };
  } catch (e) {
    return { token: '', user: null };
  }
}

export function AuthProvider({ children }) {
  const [{ token, user }, setAuth] = useState(readStoredAuth());

  useEffect(() => {
    const onStorage = () => setAuth(readStoredAuth());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = (nextUser, nextToken) => {
    try {
      localStorage.setItem('token', nextToken || '');
      localStorage.setItem('user', JSON.stringify(nextUser || null));
    } catch (e) {}
    setAuth({ token: nextToken || '', user: nextUser || null });
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) {}
    setAuth({ token: '', user: null });
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, logout }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
