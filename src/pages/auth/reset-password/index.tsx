import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, KeyRound } from 'lucide-react';
import { api } from '../../../shared/api/client';
import { readApiErrorMessage } from '../../../shared/api/errors';
import { AuthRouteLayout } from '../../../features/auth/AuthRouteLayout';

import styles from '../../../features/auth/AuthModal.module.css';

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.passwordField}>
      <input
        className={styles.input}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((state) => !state)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {visible ? 'Скрыть' : 'Показать'}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthRouteLayout>
        <div
          className={styles.panel}
          style={{ minHeight: 'unset', padding: '48px 40px', maxWidth: 440, margin: '0 auto' }}
        >
          <div className={styles.errorMessage}>
            Ссылка недействительна. Запросите новую в форме входа.
          </div>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => navigate('/')}
          >
            На страницу входа
          </button>
        </div>
      </AuthRouteLayout>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (newPassword.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/reset-password/', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setDone(true);
    } catch (cause) {
      const message = readApiErrorMessage(cause, '');
      setError(
        message || 'Ссылка недействительна или уже была использована. Запросите новую.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthRouteLayout>
      <div className={styles.panel} style={{ minHeight: 'unset', maxWidth: 440, margin: '0 auto' }}>
        <div className={styles.formSide} style={{ width: '100%' }}>
          <div className={styles.formViewport}>
            <div className={styles.stepContent}>
              {!done ? (
                <form onSubmit={handleSubmit}>
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Новый пароль</h2>
                    <p className={styles.subtitle}>
                      Введите новый пароль для вашего аккаунта.
                    </p>
                  </div>

                  <div className={styles.formFields}>
                    <PasswordField
                      value={newPassword}
                      onChange={(value) => {
                        setNewPassword(value);
                        setError('');
                      }}
                      placeholder="Новый пароль"
                      autoComplete="new-password"
                    />
                    <PasswordField
                      value={confirmPassword}
                      onChange={(value) => {
                        setConfirmPassword(value);
                        setError('');
                      }}
                      placeholder="Повторите пароль"
                      autoComplete="new-password"
                    />
                  </div>

                  {error && <div className={styles.errorMessage}>{error}</div>}

                  <button type="submit" className={styles.primaryButton} disabled={loading}>
                    <KeyRound size={16} />
                    {loading ? 'Сохраняем...' : 'Установить пароль'}
                  </button>
                </form>
              ) : (
                <div className={styles.stepHeader} style={{ textAlign: 'center' }}>
                  <CheckCircle
                    size={40}
                    color="var(--fill-positive, #22c55e)"
                    style={{ margin: '0 auto 16px' }}
                  />
                  <h2 className={styles.title}>Пароль изменён</h2>
                  <p className={styles.subtitle}>Войдите с новым паролем.</p>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    style={{ marginTop: 24 }}
                    onClick={() => navigate('/')}
                  >
                    <KeyRound size={16} />
                    Войти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthRouteLayout>
  );
}
