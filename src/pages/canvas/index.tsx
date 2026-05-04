import { Suspense, lazy, useMemo, useState, type ElementType } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Settings } from 'lucide-react';
import { isChunkLoadError, reloadForChunkErrorOnce } from '../../shared/lib/browser';

async function loadCanvasChunk<T>(loader: () => Promise<T>) {
  try {
    return await loader();
  } catch (error) {
    if (isChunkLoadError(error) && reloadForChunkErrorOnce()) {
      return new Promise<T>(() => undefined);
    }
    throw error;
  }
}

const WorkspaceCanvas = lazy(() =>
  loadCanvasChunk(() =>
    import('../../features/workspace/components/WorkspaceCanvas').then((m) => ({ default: m.WorkspaceCanvas })),
  ),
);
const WorkspaceAddMenu = lazy(() =>
  loadCanvasChunk(() =>
    import('../../features/workspace/components/WorkspaceAddMenu').then((m) => ({ default: m.WorkspaceAddMenu })),
  ),
);
import { useWorkspaceStore } from '../../features/workspace/model/store';
import type { WorkspaceWidgetKind } from '../../features/workspace/model/types';
import { usePlan, planIncludes } from '../../shared/hooks/usePlan';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { useAuthStore } from '../../shared/stores/auth';
import { useRole } from '../../shared/hooks/useRole';
import { useEmployeePermissions } from '../../shared/hooks/useEmployeePermissions';
import { useChapanPermissions } from '../../shared/hooks/useChapanPermissions';
import {
  CHAPAN_NAV_ITEM,
  SETTINGS_NAV_ITEM,
  SIDEBAR_NAV_SECTIONS,
  type ShortcutNavItemId,
} from '../../shared/navigation/appNavigation';
import styles from './Canvas.module.css';

interface MobileMenuItem {
  to: string;
  label: string;
  description: string;
  color?: string;
  icon: ElementType;
}

function MobileMenuCard({ item }: { item: MobileMenuItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `${styles.mobileMenuCard} ${isActive ? styles.mobileMenuCardActive : ''}`
      }
    >
      <span
        className={styles.mobileMenuCardIcon}
        style={item.color ? ({ ['--card-color' as string]: item.color }) : undefined}
      >
        <Icon size={18} />
      </span>
      <span className={styles.mobileMenuCardBody}>
        <strong className={styles.mobileMenuCardTitle}>{item.label}</strong>
        <span className={styles.mobileMenuCardDescription}>{item.description}</span>
      </span>
      <ArrowRight size={16} className={styles.mobileMenuCardArrow} />
    </NavLink>
  );
}

/** Возвращает true, если сотрудник имеет доступ к данному nav-разделу */
function useCanAccessNavItem(id: ShortcutNavItemId): boolean {
  const { isOwner, isAdmin } = useRole();
  const perms = useEmployeePermissions();
  const chapan = useChapanPermissions();

  if (isOwner || isAdmin) return true;
  if (perms.permissions.length === 0) return true; // обычный member

  switch (id) {
    case 'leads':
    case 'deals':
    case 'customers':
    case 'tasks':
      return perms.canAccessSales;
    case 'warehouse':
      return perms.canAccessWarehouse;
    case 'production':
      return perms.canAccessProduction;
    case 'finance':
    case 'reports':
    case 'documents':
      return perms.canAccessFinancial;
    case 'employees':
      return perms.canManageTeam;
    case 'chapan':
      return chapan.hasAnyAccess;
    default:
      return true;
  }
}

export default function CanvasPage() {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addTile = useWorkspaceStore((s) => s.addTile);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const plan = usePlan();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isOwner, isAdmin } = useRole();
  const perms = useEmployeePermissions();
  const chapan = useChapanPermissions();

  const hasEmployeePerms = perms.permissions.length > 0 && !isOwner && !isAdmin;

  const visibleSections = useMemo(
    () =>
      SIDEBAR_NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!planIncludes(plan, item.planTier)) return false;
          if (!hasEmployeePerms) return true;
          switch (item.id) {
            case 'leads': case 'deals': case 'customers': case 'tasks':
              return perms.canAccessSales;
            case 'warehouse': return perms.canAccessWarehouse;
            case 'production': return perms.canAccessProduction;
            case 'finance': case 'reports': case 'documents':
              return perms.canAccessFinancial;
            case 'employees': return perms.canManageTeam;
            default: return true;
          }
        }),
      })).filter((section) => section.items.length > 0),
    [plan, hasEmployeePerms, perms, chapan],
  );

  function handleAddTile(kind: WorkspaceWidgetKind) {
    addTile(kind);
  }

  function handleLogout() {
    clearAuth();
    navigate('/', { replace: true });
  }

  if (isMobile) {
    return (
      <div className={styles.mobileRoot}>
        <section className={styles.mobileHero}>
          <span className={styles.mobileEyebrow}>KORT Mobile</span>
          <h1 className={styles.mobileTitle}>Главное меню</h1>
          <p className={styles.mobileSubtitle}>
            Быстрый доступ ко всем разделам.
          </p>

          <div className={styles.mobileMeta}>
            {org?.name && <span className={styles.mobileMetaChip}>{org.name}</span>}
            {user?.full_name && <span className={styles.mobileMetaChip}>{user.full_name}</span>}
          </div>
        </section>

        <div className={styles.mobileSections}>
          {visibleSections.map((section) => (
            <section key={section.label} className={styles.mobileSection}>
              <div className={styles.mobileSectionLabel}>{section.label}</div>
              <div className={styles.mobileSectionGrid}>
                {section.items.map((item) => (
                  <MobileMenuCard
                    key={item.id}
                    item={{
                      to: item.to,
                      label: item.label,
                      description: item.description,
                      color: item.color,
                      icon: item.icon,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}

          {planIncludes(plan, 'industrial') && (!hasEmployeePerms || chapan.hasAnyAccess) && (
            <section className={styles.mobileSection}>
              <div className={styles.mobileSectionLabel}>Кабинеты</div>
              <div className={styles.mobileSectionGrid}>
                <MobileMenuCard
                  item={{
                    to: CHAPAN_NAV_ITEM.to,
                    label: CHAPAN_NAV_ITEM.label,
                    description: CHAPAN_NAV_ITEM.description,
                    color: CHAPAN_NAV_ITEM.color,
                    icon: CHAPAN_NAV_ITEM.icon,
                  }}
                />
              </div>
            </section>
          )}
        </div>

        <div className={styles.mobileFooter}>
          <MobileMenuCard
            item={{
              to: SETTINGS_NAV_ITEM.to,
              label: SETTINGS_NAV_ITEM.label,
              description: 'Профиль, команда, язык интерфейса и общие параметры.',
              icon: Settings,
            }}
          />

          <button className={styles.mobileLogoutBtn} onClick={handleLogout}>
            <span className={styles.mobileLogoutIcon}>
              <LogOut size={18} />
            </span>
            <span className={styles.mobileLogoutBody}>
              <strong className={styles.mobileLogoutTitle}>Выйти</strong>
              <span className={styles.mobileLogoutDescription}>Завершить текущую сессию</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Suspense fallback={<div className={styles.canvasLoading} />}>
        <WorkspaceCanvas />
      </Suspense>

      {/* Add tile button */}
      <div className={styles.controls} data-workspace-ui="true">
        <button className={styles.addBtn} onClick={() => setAddMenuOpen(true)}>
          + Добавить ярлык
        </button>
      </div>

      <Suspense fallback={null}>
        <WorkspaceAddMenu
          open={addMenuOpen}
          onClose={() => setAddMenuOpen(false)}
          onSelect={handleAddTile}
        />
      </Suspense>
    </div>
  );
}
