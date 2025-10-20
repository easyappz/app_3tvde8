import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { addComment } from '../api/comments';

const EASY_TAG = '1760914455134-react/src/components/CommentForm.jsx';

const CommentForm = ({ adId, onSuccess }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const isAuthed = useMemo(() => {
    const token = localStorage.getItem('token');
    return Boolean(token);
  }, []);

  const mutation = useMutation({
    mutationFn: (textValue) => addComment(adId, textValue),
    onSuccess: (data) => {
      if (data && data.success) {
        setText('');
        if (onSuccess) onSuccess();
      } else {
        setError(data?.error || 'Не удалось добавить комментарий');
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Ошибка';
      setError(msg);
    },
  });

  if (!isAuthed) {
    return <div className="help" data-easytag={EASY_TAG}>Чтобы оставить комментарий, войдите в аккаунт.</div>;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    const value = String(text || '').trim();
    if (!value) {
      setError('Введите текст комментария');
      return;
    }
    mutation.mutate(value);
  };

  return (
    <form onSubmit={onSubmit} data-easytag={EASY_TAG}>
      <label className="label" htmlFor="comment" data-easytag={EASY_TAG}>Новый комментарий</label>
      <textarea
        id="comment"
        className="input"
        rows={3}
        placeholder="Поделитесь своим мнением…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-easytag={EASY_TAG}
      />
      {error && <div className="error" data-easytag={EASY_TAG}>{error}</div>}
      <div style={{ height: 8 }} data-easytag={EASY_TAG} />
      <button type="submit" className="btn primary" disabled={mutation.isPending} data-easytag={EASY_TAG}>
        {mutation.isPending ? 'Отправка…' : 'Добавить комментарий'}
      </button>
    </form>
  );
};

export default CommentForm;
