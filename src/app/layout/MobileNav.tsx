import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  CheckSquare,
  Home,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../shared/stores/auth';
import {
  CANVAS_NAV_ITEM,
  CHAPAN_NAV_ITEM,
  SETTINGS_NAV_ITEM,
  SIDEBAR_NAV_SECTIONS,
} from '../../shared/navigation/appNavigation';
import { usePlan, planIncludes } from '../../shared/hooks/usePlan';
import styles from './MobileNav.module.css';

const PRIMARY_TABS = [
  { to: '/', icon: Home, label: 'Главная', end: true },
  { to: '/crm/leads', icon: Users, label: 'Лиды' },
  { to: '/crm/deals', icon: Briefcase, label: 'Сделки' },
  { to: '/crm/tasks', icon: CheckSquare, label: 'Задачи' },
];

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const plan = usePlan();

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const scrollHost = document.querySelector('[data-app-scroll="true"]') as HTMLElement | null;
    if (!scrollHost) return;

    const previousOverflow = scrollHost.style.overflow;
    const previousTouchAction = scrollHost.style.touchAction;
    if (moreOpen) {
      scrollHost.style.overflow = 'hidden';
      scrollHost.style.touchAction = 'none';
    }

    return () => {
      scrollHost.style.overflow = previousOverflow;
      scrollHost.style.touchAction = previousTouchAction;
    };
  }, [moreOpen]);

  function handleLogout() {
    setMoreOpen(false);
    clearAuth();
    navigate('/', { replace: true });
  }

  function closeDrawer() {
    setMoreOpen(false);
  }

  return (
    <>
      <nav className={styles.nav}>
        {PRIMARY_TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}

        <button
          className={`${styles.navItem} ${moreOpen ? styles.navItemActive : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-label="Меню"
          aria-expanded={moreOpen}
        >
          <Menu size={20} />
          <span>Меню</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className={styles.backdrop} onClick={closeDrawer} aria-hidden="true" />

          <div className={styles.drawer} role="dialog" aria-modal="true" aria-label="Главное меню">
            <div className={styles.drawerHandle} aria-hidden="true" />

            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Меню</span>
              <button
                className={styles.drawerClose}
                onClick={closeDrawer}
                aria-label="Закрыть меню"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionLabel}>Главная</div>
                <NavLink
                  to={CANVAS_NAV_ITEM.to}
                  end
                  className={({ isActive }) =>
                    `${styles.drawerItem} ${isActive ? styles.drawerItemActive : ''}`
                  }
                  onClick={closeDrawer}
                >
                  <span className={styles.drawerItemIcon}>
                    <CANVAS_NAV_ITEM.icon size={16} />
                  </span>
                  Главное меню
                </NavLink>
              </div>

              {SIDEBAR_NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter((item) =>
                  planIncludes(plan, item.planTier),
                );
                if (!visibleItems.length) return null;

                return (
                  <div key={section.label} className={styles.drawerSection}>
                    <div className={styles.drawerSectionLabel}>{section.label}</div>
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.id}
                          to={item.to}
                          className={({ isActive }) =>
                            `${styles.drawerItem} ${isActive ? styles.drawerItemActive : ''}`
                          }
                          onClick={closeDrawer}
                        >
                          <span
                            className={styles.drawerItemIcon}
                            style={{ ['--item-color' as string]: item.color }}
                          >
                            <Icon size={16} />
                          </span>
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                );
              })}

              {planIncludes(plan, 'industrial') && (
                <div className={styles.drawerSection}>
                  <div className={styles.drawerSectionLabel}>Кабинеты</div>
                  <NavLink
                    to={CHAPAN_NAV_ITEM.to}
                    className={({ isActive }) =>
                      `${styles.drawerItem} ${isActive ? styles.drawerItemActive : ''}`
                    }
                    onClick={closeDrawer}
                  >
                    <span className={styles.drawerItemIcon}>
                      <CHAPAN_NAV_ITEM.icon size={16} />
                    </span>
                    {CHAPAN_NAV_ITEM.label}
                  </NavLink>
                </div>
              )}

              <div className={styles.drawerSection}>
                <NavLink
                  to={SETTINGS_NAV_ITEM.to}
                  className={({ isActive }) =>
                    `${styles.drawerItem} ${isActive ? styles.drawerItemActive : ''}`
                  }
                  onClick={closeDrawer}
                >
                  <span className={styles.drawerItemIcon}>
                    <SETTINGS_NAV_ITEM.icon size={16} />
                  </span>
                  {SETTINGS_NAV_ITEM.label}
                </NavLink>

                <button className={styles.drawerItemLogout} onClick={handleLogout}>
                  <span className={styles.drawerItemIcon}>
                    <LogOut size={16} />
                  </span>
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
