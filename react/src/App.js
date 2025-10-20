import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

import Header from './components/Header';
import Home from './pages/Home';
import AdPage from './pages/AdPage';
import EmailVerify from './pages/EmailVerify';

const EASY_TAG = '1760914455134-react/src/App.js';

function App() {
  return (
    <ErrorBoundary>
      <div className="app-root" data-easytag={EASY_TAG}>
        <Header />
        <main className="container" data-easytag={EASY_TAG}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ad/:id" element={<AdPage />} />
            <Route path="/verify-email" element={<EmailVerify />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
