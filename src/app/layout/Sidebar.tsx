import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { useAuthStore } from '../../shared/stores/auth';
import { KortLogo } from '../../shared/ui/KortLogo';
import {
  CANVAS_NAV_ITEM,
  CHAPAN_NAV_ITEM,
  SETTINGS_NAV_ITEM,
  SIDEBAR_NAV_SECTIONS,
  type ShortcutNavItem,
} from '../../shared/navigation/appNavigation';
import { usePlan, planIncludes } from '../../shared/hooks/usePlan';
import styles from './Sidebar.module.css';

function SidebarRouteItem({
  item,
  className = '',
  showChevron = false,
}: {
  item: { to: string; icon: React.ElementType; label: string; end?: boolean };
  className?: string;
  showChevron?: boolean;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `${styles.navItem} ${className} ${isActive ? styles.navItemActive : ''}`.trim()
      }
    >
      <Icon size={15} className={styles.navIcon} />
      <span className={styles.navLabel}>{item.label}</span>
      {showChevron && <ChevronRight size={11} className={styles.navExternalIcon} />}
    </NavLink>
  );
}

function NavGroup({ label, items }: { label: string; items: ShortcutNavItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.navGroup}>
      <div className={styles.navGroupLabel}>{label}</div>
      {items.map((item) => (
        <SidebarRouteItem key={item.id} item={item} />
      ))}
    </div>
  );
}

export function Sidebar({ chromeTone = 'dark' }: { chromeTone?: 'canvas' | 'dark' | 'light' }) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const plan = usePlan();

  function handleLogout() {
    clearAuth();
    navigate('/', { replace: true });
  }

  return (
    <aside className={styles.sidebar} data-chrome={chromeTone}>
      <div className={styles.logo}>
        <KortLogo size={28} />
        <span className={styles.logoText}>KORT</span>
      </div>

      <nav className={styles.nav}>
        <SidebarRouteItem item={CANVAS_NAV_ITEM} />

        {SIDEBAR_NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            planIncludes(plan, item.planTier),
          );
          return (
            <NavGroup key={section.label} label={section.label} items={visibleItems} />
          );
        })}

        {planIncludes(plan, 'industrial') && (
          <>
            <div className={styles.navDivider} />
            <div className={styles.navGroup}>
              <div className={styles.navGroupLabel}>Кабинеты</div>
              <SidebarRouteItem
                item={CHAPAN_NAV_ITEM}
                className={styles.navItemChapan}
                showChevron
              />
            </div>
          </>
        )}
      </nav>

      <div className={styles.bottom}>
        <SidebarRouteItem item={SETTINGS_NAV_ITEM} />
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Выйти</span>
        </button>
      </div>
    </aside>
  );
}
