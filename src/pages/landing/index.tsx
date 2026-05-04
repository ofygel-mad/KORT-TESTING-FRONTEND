import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mountLanding } from '../../../PROJECT/src/main';
import { AuthModal } from '../../features/auth/AuthModal';
import { resolvePostAuthPath } from '../../features/auth/navigation';
import { useAuthStore } from '../../shared/stores/auth';

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? '';

type ModalState = { step: 'login' | 'company' } | null;

export default function LandingPage() {
  const navigate = useNavigate();
  const unlock = useAuthStore((s) => s.unlock);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    return mountLanding(wrap, {
      appUrl: APP_URL,
      onLogin: () => setModal({ step: 'login' }),
      onRegister: () => setModal({ step: 'company' }),
    });
  }, []);

  return (
    <>
      <div ref={wrapRef} />
      {modal && (
        <AuthModal
          open
          initialStep={modal.step}
          onClose={() => setModal(null)}
          onAuthSuccess={() => {
            unlock();
            const state = useAuthStore.getState();
            navigate(resolvePostAuthPath({ org: state.org, membership: state.membership }), { replace: true });
          }}
        />
      )}
    </>
  );
}
