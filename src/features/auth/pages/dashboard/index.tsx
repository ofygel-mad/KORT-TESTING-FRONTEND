import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceCanvas } from '../../features/workspace/components/WorkspaceCanvas';
import { WorkspaceAddMenu } from '../../features/workspace/components/WorkspaceAddMenu';
import { WorkspaceSpotlight } from '../../features/workspace/components/WorkspaceSpotlight';
import { useWorkspaceStore } from '../../features/workspace/model/store';
import { WorkspaceLock } from '../../WorkspaceLock';
import { resolvePostAuthPath } from '../../navigation';
import { DEV_RUNTIME_BLOCKERS_DISABLED } from '../../shared/config/devAccess';
import { useAuthStore } from '../../shared/stores/auth';
import { useUIStore } from '../../shared/stores/ui';
import styles from './Dashboard.module.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const addTile = useWorkspaceStore((state) => state.addTile);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const hasCompanyAccess = useAuthStore((state) => state.membership.status === 'active');
  const effectiveUnlocked = DEV_RUNTIME_BLOCKERS_DISABLED || isUnlocked;
  const effectiveCompanyAccess = DEV_RUNTIME_BLOCKERS_DISABLED || hasCompanyAccess;
  const workspaceAddMenuOpen = useUIStore((s) => s.workspaceAddMenuOpen);
  const closeWorkspaceAddMenu = useUIStore((s) => s.closeWorkspaceAddMenu);

  useEffect(() => {
    if (!effectiveUnlocked) return;

    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSpotlightOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [effectiveUnlocked]);

  return (
    <div className={styles.dashRoot}>
      {/* ⚠️  WorkspaceCanvas contains the 3D scene — it is React.memo-wrapped and
           must stay at the top, always rendered, with NO conditional wrappers or
           key changes that could cause a re-mount and destroy the WebGL context. */}
      <WorkspaceCanvas />

      {!effectiveUnlocked && (
        <WorkspaceLock
          onUnlocked={() => {
            const state = useAuthStore.getState();
            navigate(
              resolvePostAuthPath({ org: state.org, membership: state.membership }),
              { replace: true },
            );
          }}
        />
      )}

      {effectiveUnlocked && (
        <>
          <WorkspaceAddMenu
            open={workspaceAddMenuOpen}
            onClose={closeWorkspaceAddMenu}
            onSelect={(kind) => {
              addTile(kind);
              closeWorkspaceAddMenu();
            }}
          />
          <WorkspaceSpotlight
            open={spotlightOpen}
            onClose={() => setSpotlightOpen(false)}
          />
        </>
      )}
    </div>
  );
}
