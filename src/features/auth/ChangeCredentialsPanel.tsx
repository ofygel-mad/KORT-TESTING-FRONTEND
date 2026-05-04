import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../shared/api/client';
import { useRole } from '../../shared/hooks/useRole';
import { useAuthStore } from '../../shared/stores/auth';
import { usePinStore } from '../../shared/stores/pin';
import styles from './ChangeCredentialsPanel.module.css';

export function ChangeCredentialsPanel() {
  const navigate = useNavigate();
  const { isOwner } = useRole();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const clearPin = usePinStore((state) => state.clearPin);

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/auth/change-credentials/', {
        email,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    onSuccess: () => {
      clearPin();
      clearAuth();
      toast.success('Данные для входа обновлены. Войдите заново.');
      navigate('/', { replace: true });
    },
    onError: (response: any) => {
      setError(response?.message ?? 'Не удалось обновить данные для входа.');
    },
  });

  if (!isOwner) {
    return null;
  }

  function handleSubmit() {
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Укажите новую электронную почту.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    mutation.mutate();
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <KeyRound size={18} />
        </div>
        <div>
          <div className={styles.title}>Смена электронной почты и пароля владельца</div>
          <div className={styles.subtitle}>
            После сохранения текущая сессия будет закрыта. Следующий вход выполняется уже по новой электронной почте и новому паролю.
          </div>
        </div>
      </div>

      <div className={styles.form}>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label}>Новая электронная почта</label>
            <input
              className="kort-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@company.kz"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Новый пароль</label>
            <input
              className="kort-input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Минимум 6 символов"
              autoComplete="new-password"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Повторите пароль</label>
            <input
              className="kort-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Повторите новый пароль"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className={styles.note}>
          Аккаунт не удаляется и данные не теряются. Меняются только почта и пароль для входа владельца.
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.submit} disabled={mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? 'Сохраняем...' : 'Сохранить и выйти'}
          </button>
        </div>
      </div>
    </div>
  );
}
