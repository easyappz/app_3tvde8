import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

import Header from './components/Header';
import Home from './pages/Home';
import AdPage from './pages/AdPage';

function App() {
  return (
    <ErrorBoundary>
      <div className="app-root">
        <Header />
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ad/:id" element={<AdPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
