import ReactDOM from 'react-dom/client';
import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast, Toaster } from 'sonner';
import * as Sentry from '@sentry/react';
import { AppRouter } from './app/router';
import { ConsoleRoot } from './console';
import { api } from './shared/api/client';
import type { AuthSessionResponse } from './shared/api/contracts';
import { readApiErrorMessage, readApiErrorStatus } from './shared/api/errors';
import { ensureDevAuthBypass } from './shared/config/devAccess';
import './shared/design/globals.css';
import { getNavigator, getWindow, isBrowser } from './shared/lib/browser';
import { isChunkLoadError, reloadForChunkErrorOnce } from './shared/lib/browser';
import { readStorage, reloadWindow, writeStorage } from './shared/lib/browser';
import { useAuthStore } from './shared/stores/auth';
import { PageLoader } from './shared/ui/PageLoader';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // treat data as fresh for 60 s (was 30 s)
      gcTime:    10 * 60 * 1000,   // evict unused cache after 10 min (default 5 min)
      retry: 1,
      refetchOnWindowFocus: false, // don't re-fetch just because user switched tabs
    },
    mutations: {
      onError: (error: unknown) => {
        toast.error(readApiErrorMessage(error, 'Произошла ошибка'));
      },
    },
  },
});

type BootstrapResponse = Omit<AuthSessionResponse, 'access' | 'refresh'> & { orgs?: import('./shared/stores/auth').OrgSummary[] };


function SessionBootstrap({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const inviteContext = useAuthStore((state) => state.inviteContext);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setTokens = useAuthStore((state) => state.setTokens);
  const syncSession = useAuthStore((state) => state.syncSession);
  const [ready, setReady] = useState(() => !token);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);

    const syncFromBootstrap = (session: BootstrapResponse) => {
      syncSession({
        user: session.user,
        org: session.org,
        capabilities: session.capabilities,
        role: session.role,
        membership: session.membership,
        inviteContext,
        orgs: session.orgs,
      });
    };

    const tryRefreshSession = async () => {
      if (!refreshToken) {
        clearAuth();
        return false;
      }

      try {
        const refreshed = await api.post<{ access: string; refresh?: string }>('/auth/token/refresh/', {
          refresh: refreshToken,
        });
        const nextRefreshToken = refreshed.refresh ?? refreshToken;
        setTokens(refreshed.access, nextRefreshToken);

        const session = await api.get<BootstrapResponse | null>('/auth/bootstrap/');
        if (!session) {
          clearAuth();
          return false;
        }

        syncFromBootstrap(session);
        return true;
      } catch (error) {
        const status = readApiErrorStatus(error);
        if (status === 400 || status === 401 || status === 403) {
          clearAuth();
        }
        return false;
      }
    };

    api.get<BootstrapResponse | null>('/auth/bootstrap/')
      .then(async (session) => {
        if (cancelled) {
          return;
        }

        if (!session) {
          await tryRefreshSession();
          return;
        }

        syncFromBootstrap(session);
      })
      .catch(async (error) => {
        if (cancelled) {
          return;
        }

        if ((readApiErrorStatus(error) === 401 || readApiErrorStatus(error) === 403) && refreshToken) {
          await tryRefreshSession();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearAuth, inviteContext, refreshToken, setTokens, syncSession, token]);

  if (!ready) {
    return <PageLoader />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>
        <AppRouter />
      </SessionBootstrap>
      <Toaster position="bottom-right" richColors />
      <ConsoleRoot />
    </QueryClientProvider>
  );
}

const nav = getNavigator();
const win = getWindow();

async function clearServiceWorkersAndCaches() {
  if (!nav || !('serviceWorker' in nav) || !win) {
    return false;
  }

  const registrations = await nav.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    return false;
  }

  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in win) {
    const cacheKeys = await win.caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => win.caches.delete(cacheKey)));
  }

  return true;
}

async function cleanupDevServiceWorker() {
  if (!isBrowser || !import.meta.env.DEV || !nav || !('serviceWorker' in nav) || !win) {
    return false;
  }

  try {
    const hadController = Boolean(nav.serviceWorker.controller);
    const cleaned = await clearServiceWorkersAndCaches();
    if (!cleaned || !hadController) {
      return false;
    }

    const key = 'kort:dev-sw-reset';
    if (readStorage(key, 'session') === 'done') {
      return false;
    }

    writeStorage(key, 'done', 'session');
    reloadWindow();
    return true;
  } catch {
    return false;
  }
}

async function bootstrap() {
  ensureDevAuthBypass();

  if (await cleanupDevServiceWorker()) {
    return;
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();

if (isBrowser && win) {
  const handleChunkLoadFailure = (error: unknown) => {
    if (!isChunkLoadError(error)) return false;
    return reloadForChunkErrorOnce();
  };

  win.addEventListener('error', (event) => {
    if (handleChunkLoadFailure(event.error ?? event.message)) {
      event.preventDefault();
    }
  });

  win.addEventListener('unhandledrejection', (event) => {
    if (handleChunkLoadFailure(event.reason)) {
      event.preventDefault();
    }
  });
}

if (isBrowser && nav && 'serviceWorker' in nav && import.meta.env.PROD && win) {
  const clearLegacyServiceWorkers = async () => {
    try {
      await clearServiceWorkersAndCaches();
    } catch {
      // ignore service worker cleanup failures
    }
  };

  win.addEventListener('load', () => {
    void clearLegacyServiceWorkers();
  });
}
