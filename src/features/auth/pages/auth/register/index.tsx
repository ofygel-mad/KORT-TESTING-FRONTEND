import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModal } from '../../../AuthModal';
import { AuthRouteLayout } from '../../../AuthRouteLayout';
import { resolvePostAuthPath } from '../../../navigation';
import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../../../shared/config/devAccess';
import { useAuthStore } from '../../../shared/stores/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const unlock = useAuthStore((state) => state.unlock);
  const user = useAuthStore((state) => state.user);
  const org = useAuthStore((state) => state.org);
  const membership = useAuthStore((state) => state.membership);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);

  useEffect(() => {
    if (DEV_RUNTIME_BLOCKERS_DISABLED) {
      navigate('/', { replace: true });
      return;
    }
    if (!user || !isUnlocked) return;
    navigate(resolvePostAuthPath({ org, membership }), { replace: true });
  }, [isUnlocked, membership, navigate, org, user]);

  return (
    <AuthRouteLayout>
      <AuthModal
        open
        initialStep="company"
        onClose={() => navigate('/', { replace: true })}
        onAuthSuccess={() => {
          unlock();
          const state = useAuthStore.getState();
          navigate(resolvePostAuthPath({ org: state.org, membership: state.membership }), { replace: true });
        }}
      />
    </AuthRouteLayout>
  );
}
