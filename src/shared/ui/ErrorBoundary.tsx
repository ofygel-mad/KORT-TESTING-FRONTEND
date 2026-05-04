import * as Sentry from '@sentry/react';
import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import styles from './ErrorBoundary.module.css';
import {
  isChunkLoadError,
  redirectTo,
  reloadWindow,
} from '../lib/browser';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[Kort ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const chunkError = isChunkLoadError(this.state.error);
    const title = chunkError ? 'Приложение обновилось' : 'Что-то пошло не так';
    const message = chunkError
      ? 'Открытая вкладка попыталась загрузить устаревший JS-файл после деплоя. Обновите страницу, чтобы подтянуть актуальную версию.'
      : this.state.error?.message;

    return (
      <div className={styles.root}>
        <div className={styles.icon}>
          <AlertTriangle size={28} />
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          {chunkError && (
            <Button
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                reloadWindow({ bustCache: true });
              }}
            >
              Обновить страницу
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              redirectTo('/');
            }}
          >
            На главную
          </Button>
        </div>
      </div>
    );
  }
}
