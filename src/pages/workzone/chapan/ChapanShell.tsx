import { useRef, useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { CircleCheck, CheckCheck, ChevronLeft, Factory, FileText, Package, ShoppingCart, TrendingUp, Truck, Users, Warehouse, Undo2, Boxes } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth';
import { useChapanPermissions } from '../../../shared/hooks/useChapanPermissions';
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher';
import { useChapanUiStore } from '../../../features/workzone/chapan/store';
import ChapanInvoicesDrawer from './invoices/ChapanInvoicesDrawer';
import ChapanMonitorWidget from '../../../features/chapan-monitor/ChapanMonitorWidget';
import styles from './ChapanShell.module.css';
import { useEmployeePermissions } from '../../../shared/hooks/useEmployeePermissions';

// Статичный список используется только как источник данных; фильтрация — ниже
const ALL_SECTION_NAV = [
  { to: '/workzone/chapan/orders',     label: 'Заказы',       icon: Package,   perm: 'orders'     },
  { to: '/workzone/chapan/production', label: 'Цех', icon: Factory,   perm: 'production' },
  { to: '/workzone/chapan/ready',      label: 'Готово',       icon: CheckCheck,  perm: 'ready'     },
  { to: '/workzone/chapan/shipping',   label: 'Отправка',     icon: Truck,       perm: 'shipping'  },
  { to: '/workzone/chapan/archive',    label: 'Завершённые',  icon: CircleCheck, perm: 'archive'   },
] as const;

const SWIPE_EDGE_ZONE = 28;   // px from left edge to begin tracking
const SWIPE_THRESHOLD  = 72;   // px of horizontal travel to trigger navigate(-1)

export default function ChapanShell() {
  const { isAbsolute } = useEmployeePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((state) => state.membership.role);
  const isAdmin = role === 'owner' || role === 'admin';
  const {
    canAccessOrders,
    canAccessProduction,
    canAccessReady,
    canAccessArchive,
    canAccessShipping,
    canAccessWarehouseNav,
    canAccessInvoices,
    canAccessAnalytics,
    canAccessPurchase,
    canAccessClients,
  } = useChapanPermissions();
  const invoicesDrawerOpen = useChapanUiStore((s) => s.invoicesDrawerOpen);
  const invoicesDrawerFilter = useChapanUiStore((s) => s.invoicesDrawerFilter);
  const setInvoicesDrawerOpen = useChapanUiStore((s) => s.setInvoicesDrawerOpen);

  const isSubPage = /\/workzone\/chapan\/.+\/.+/.test(location.pathname) || location.search.length > 0;

  // ── Swipe-back (iOS-style left-edge gesture) ─────────────────────────────
  const dragXRef   = useRef(0);
  const [dragX,    setDragX]    = useState(0);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!isSubPage) return;

    let startX = 0, startY = 0, active = false;

    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      if (t.clientX > SWIPE_EDGE_ZONE) return;
      startX = t.clientX;
      startY = t.clientY;
      active = false;
    }

    function onMove(e: TouchEvent) {
      if (startX === 0) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!active) {
        // cancel if the gesture is more vertical than horizontal
        if (Math.abs(dy) > Math.abs(dx) + 5) { startX = 0; return; }
        if (dx < 5) return; // wait for clear rightward intent
        active = true;
      }
      e.preventDefault(); // lock out native scroll while swiping back
      const next = Math.max(0, Math.min(dx, window.innerWidth * 0.65));
      dragXRef.current = next;
      setDragX(next);
    }

    function onEnd() {
      if (!active) { startX = 0; return; }
      startX = 0;
      active = false;
      const dx = dragXRef.current;
      dragXRef.current = 0;
      if (dx >= SWIPE_THRESHOLD) {
        setDragX(0);
        navigate(-1);
      } else {
        // spring back: enable transition first, then reset dragX in next frame
        setSettling(true);
        requestAnimationFrame(() => setDragX(0));
        setTimeout(() => setSettling(false), 300);
      }
    }

    document.addEventListener('touchstart',  onStart, { passive: true  });
    document.addEventListener('touchmove',   onMove,  { passive: false });
    document.addEventListener('touchend',    onEnd);
    document.addEventListener('touchcancel', onEnd);

    return () => {
      document.removeEventListener('touchstart',  onStart);
      document.removeEventListener('touchmove',   onMove);
      document.removeEventListener('touchend',    onEnd);
      document.removeEventListener('touchcancel', onEnd);
      dragXRef.current = 0;
      setDragX(0);
      setSettling(false);
    };
  }, [isSubPage, navigate]);
  // ─────────────────────────────────────────────────────────────────────────

  const sectionAccess: Record<typeof ALL_SECTION_NAV[number]['perm'], boolean> = {
    orders:     canAccessOrders,
    production: canAccessProduction,
    ready:      canAccessReady,
    shipping:   canAccessShipping,
    archive:    canAccessArchive,
  };

  const navItems = [
    ...ALL_SECTION_NAV.filter((item) => sectionAccess[item.perm]),
    ...(canAccessInvoices                  ? [{ to: '/workzone/chapan/invoices'  as const, label: 'Накладные', icon: FileText      }] : []),
    ...((isAdmin || canAccessWarehouseNav) ? [{ to: '/workzone/chapan/warehouse' as const, label: 'Склад',     icon: Warehouse     }] : []),
    ...(isAdmin                            ? [{ to: '/workzone/chapan/catalog'   as const, label: 'Каталог',   icon: Boxes         }] : []),
    ...(isAdmin                            ? [{ to: '/workzone/chapan/returns'   as const, label: 'Возвраты',  icon: Undo2         }] : []),
    ...(canAccessPurchase                  ? [{ to: '/workzone/chapan/purchase'  as const, label: 'Закуп',     icon: ShoppingCart  }] : []),
    ...(canAccessAnalytics                 ? [{ to: '/workzone/chapan/analytics' as const, label: 'Аналитика', icon: TrendingUp    }] : []),
    ...(canAccessClients                   ? [{ to: '/workzone/chapan/clients'   as const, label: 'Клиенты',   icon: Users         }] : []),
  ];

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        {isSubPage ? (
          <button className={styles.kortBackGreen} onClick={() => navigate(-1)}>
            <ChevronLeft size={14} />
            <span>Назад</span>
          </button>
        ) : (
          <button className={styles.kortBack} onClick={() => navigate('/')}>
            <ChevronLeft size={14} />
            <span>На главную</span>
          </button>
        )}
        <div className={styles.topbarRight}>
          <ThemeSwitcher />
        </div>
      </div>

      {/* Mobile horizontal rail — hidden on desktop via CSS */}
      <nav className={styles.mobileRail}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.mobileRailItem} ${isActive ? styles.mobileRailItemActive : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.logoWrap}>
            <span className={styles.logoText}>Чапан</span>
            <span className={styles.logoSub}>Управление производством</span>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className={styles.sidebarBottom} />
        </aside>

        <main
          className={styles.main}
          style={dragX > 0 || settling ? {
            transform:  dragX > 0 ? `translateX(${dragX}px)` : 'translateX(0)',
            transition: settling ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
            willChange: 'transform',
          } : undefined}
        >
          <Outlet />
        </main>
      </div>

      {/* iOS-style swipe-back edge affordance — appears only during active drag on mobile */}
      {dragX > 0 && (
        <div
          className={styles.swipeEdge}
          style={{ opacity: Math.min(dragX / SWIPE_THRESHOLD, 1) }}
        >
          <ChevronLeft size={20} />
        </div>
      )}

      <ChapanInvoicesDrawer open={invoicesDrawerOpen} onClose={() => setInvoicesDrawerOpen(false)} initialFilter={invoicesDrawerFilter as 'all' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'archived'} />

      {isAdmin && <ChapanMonitorWidget />}
    </div>
  );
}
