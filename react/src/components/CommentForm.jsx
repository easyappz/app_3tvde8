import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { add as addComment } from '../api/comments';

const CommentForm = ({ adId, onSuccess }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const isAuthed = useMemo(() => {
    const token = localStorage.getItem('token');
    return Boolean(token);
  }, []);

  const mutation = useMutation({
    mutationFn: (payload) => addComment(adId, payload),
    onSuccess: (data) => {
      if (data && data.success) {
        setText('');
        if (onSuccess) onSuccess();
      } else {
        setError('Не удалось добавить комментарий');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Ошибка';
      setError(msg);
    },
  });

  if (!isAuthed) {
    return <div className="help">Чтобы оставить комментарий, войдите в аккаунт.</div>;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    const value = String(text || '').trim();
    if (!value) {
      setError('Введите текст комментария');
      return;
    }
    mutation.mutate({ text: value });
  };

  return (
    <form onSubmit={onSubmit}>
      <label className="label" htmlFor="comment">Новый комментарий</label>
      <textarea
        id="comment"
        className="input"
        rows={3}
        placeholder="Поделитесь своим мнением…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="error">{error}</div>}
      <div style={{ height: 8 }} />
      <button type="submit" className="btn primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Отправка…' : 'Добавить комментарий'}
      </button>
    </form>
  );
};

export default CommentForm;
