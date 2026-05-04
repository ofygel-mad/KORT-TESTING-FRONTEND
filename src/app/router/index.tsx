import { createBrowserRouter, Navigate, NavLink, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '../../shared/ui/PageLoader';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { isChunkLoadError, reloadForChunkErrorOnce } from '../../shared/lib/browser';
import { useAuthStore } from '../../shared/stores/auth';
import { usePlan, planIncludes, PLAN_LABELS, type OrgMode } from '../../shared/hooks/usePlan';
import { useRole } from '../../shared/hooks/useRole';
import { useEmployeePermissions } from '../../shared/hooks/useEmployeePermissions';
import { useChapanPermissions } from '../../shared/hooks/useChapanPermissions';

import { Settings } from 'lucide-react';

function makePage(imp: () => Promise<{ default: ComponentType }>) {
  const Comp = lazy(async () => {
    try {
      return await imp();
    } catch (error) {
      if (isChunkLoadError(error) && reloadForChunkErrorOnce()) {
        return new Promise<{ default: ComponentType }>(() => undefined);
      }
      throw error;
    }
  });
  return function LazyPage() {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Comp />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

// Core pages
const CanvasPage     = makePage(() => import('../../pages/canvas'));
const LeadsPage      = makePage(() => import('../../pages/crm/leads'));
const DealsPage      = makePage(() => import('../../pages/crm/deals'));
const CustomersPage  = makePage(() => import('../../pages/crm/customers'));
const TasksPage      = makePage(() => import('../../pages/crm/tasks'));
const WarehousePage  = makePage(() => import('../../pages/warehouse'));
const WarehouseTwinPage = makePage(() => import('../../pages/warehouse/Twin'));
const WarehouseOperationsPage = makePage(() => import('../../pages/warehouse/Operations'));
const WarehouseControlTowerPage = makePage(() => import('../../pages/warehouse/ControlTower'));
const ProductionPage = makePage(() => import('../../pages/production'));
const FinancePage    = makePage(() => import('../../pages/finance'));
const EmployeesPage  = makePage(() => import('../../pages/employees'));
const ReportsPage    = makePage(() => import('../../pages/reports'));
const DocumentsPage  = makePage(() => import('../../pages/documents'));
const SettingsPage   = makePage(() => import('../../pages/settings'));
const OnboardingPage = makePage(() => import('../../pages/onboarding'));

// Landing page (public)
const LandingPage = makePage(() => import('../../pages/landing'));

// Dev panel — no auth, service password only
const DevPanelPage = makePage(() => import('../../pages/dev'));

// Auth pages
const AcceptInvitePage  = makePage(() => import('../../pages/auth/accept-invite'));
const ResetPasswordPage = makePage(() => import('../../pages/auth/reset-password'));

// Chapan Workzone — own layout
const ChapanShell           = makePage(() => import('../../pages/workzone/chapan/ChapanShell'));
const ChapanWarehousePage   = makePage(() => import('../../pages/workzone/chapan/warehouse/WarehousePage'));
const ChapanCatalogPage     = makePage(() => import('../../pages/workzone/chapan/catalog/ChapanCatalog'));
const ChapanOrdersPage   = makePage(() => import('../../pages/workzone/chapan/orders/ChapanOrders'));
const ChapanNewOrderPage = makePage(() => import('../../pages/workzone/chapan/orders/ChapanNewOrder'));
const ChapanOrderDetailPage = makePage(() => import('../../pages/workzone/chapan/orders/ChapanOrderDetail'));
const ChapanEditOrderPage   = makePage(() => import('../../pages/workzone/chapan/orders/ChapanEditOrder'));
const ChapanProductionPage  = makePage(() => import('../../pages/workzone/chapan/production/ChapanProduction'));
const ChapanReadyPage       = makePage(() => import('../../pages/workzone/chapan/ready/ChapanReady'));
const ChapanInvoicesPage    = makePage(() => import('../../pages/workzone/chapan/invoices/ChapanInvoices'));
const ChapanReturnsPage     = makePage(() => import('../../pages/workzone/chapan/returns/ChapanReturns'));
const ChapanArchivePage     = makePage(() => import('../../pages/workzone/chapan/archive/ChapanArchive'));
const ChapanShippingPage    = makePage(() => import('../../pages/workzone/chapan/shipping/ChapanShipping'));
const ChapanAnalyticsPage   = makePage(() => import('../../pages/workzone/chapan/analytics/ChapanAnalytics'));
const ChapanPurchasePage    = makePage(() => import('../../pages/workzone/chapan/purchase/ChapanPurchase'));
const ChapanClientsPage     = makePage(() => import('../../pages/workzone/chapan/clients/ChapanClients'));
const ChapanClientDetailPage = makePage(() => import('../../pages/workzone/chapan/clients/ChapanClientDetail'));

function RootIndex() {
  const user = useAuthStore((s) => s.user);
  if (user) return <CanvasPage />;
  return <LandingPage />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}


function RequireOrg({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.membership.status);
  if (!user) return null; // Wait for bootstrap to complete
  if (status !== 'active') return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

const PLAN_COLORS: Record<OrgMode, string> = {
  basic: '#5C8DFF',
  advanced: '#D97706',
  industrial: '#7C3AED',
};

function PlanGate({ required }: { required: OrgMode }) {
  const color = PLAN_COLORS[required];
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 14%, var(--bg-surface-elevated))`,
        border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        🔒
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Требуется план «{PLAN_LABELS[required]}»
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
          Этот модуль недоступен в вашем текущем режиме. Измените план в настройках организации.
        </div>
      </div>
      <NavLink
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          background: `color-mix(in srgb, ${color} 12%, var(--bg-surface))`,
          border: `1px solid color-mix(in srgb, ${color} 28%, var(--brand-panel-border))`,
          color: color,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        <Settings size={14} />
        Перейти в настройки
      </NavLink>
    </div>
  );
}

function RequirePlan({ tier, children }: { tier: OrgMode; children: ReactNode }) {
  const plan = usePlan();
  if (!planIncludes(plan, tier)) return <PlanGate required={tier} />;
  return <>{children}</>;
}

function PermissionDenied() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--fill-danger, #ef4444) 12%, var(--bg-surface-elevated))',
        border: '1.5px solid color-mix(in srgb, var(--fill-danger, #ef4444) 28%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        🔒
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Нет доступа
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
          У вас нет прав для просмотра этого раздела. Обратитесь к руководителю.
        </div>
      </div>
      <NavLink
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--fill-danger, #ef4444) 10%, var(--bg-surface))',
          border: '1px solid color-mix(in srgb, var(--fill-danger, #ef4444) 24%, var(--brand-panel-border))',
          color: 'var(--fill-danger, #ef4444)',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        На главную
      </NavLink>
    </div>
  );
}

type PermissionCheck =
  | 'sales' | 'warehouse' | 'production' | 'financial' | 'team' | 'chapan'
  | 'chapan_orders' | 'chapan_production' | 'chapan_ready' | 'chapan_archive' | 'chapan_shipping'
  | 'chapan_analytics' | 'chapan_purchase' | 'chapan_clients';

/**
 * Ограничивает доступ к маршруту для сотрудников без нужного права.
 * Владельцы и пользователи без employee_permissions (admin/manager) проходят свободно.
 */
function RequirePermission({ check, children }: { check: PermissionCheck; children: ReactNode }) {
  const { isOwner, isAdmin } = useRole();
  const perms = useEmployeePermissions();
  const chapan = useChapanPermissions();

  // Владельцы и admins — всегда пропускаем
  if (isOwner || isAdmin) return <>{children}</>;

  // Пользователи без employee_permissions (manager/viewer без флагов) — пропускаем
  if (perms.permissions.length === 0) return <>{children}</>;

  let allowed = false;
  switch (check) {
    case 'sales':             allowed = perms.canAccessSales; break;
    case 'warehouse':         allowed = perms.canAccessWarehouse; break;
    case 'production':        allowed = perms.canAccessProduction; break;
    case 'financial':         allowed = perms.canAccessFinancial; break;
    case 'team':              allowed = perms.canManageTeam; break;
    case 'chapan':            allowed = chapan.hasAnyAccess; break;
    case 'chapan_orders':     allowed = chapan.canAccessOrders; break;
    case 'chapan_production': allowed = chapan.canAccessProduction; break;
    case 'chapan_ready':      allowed = chapan.canAccessReady; break;
    case 'chapan_archive':    allowed = chapan.canAccessArchive; break;
    case 'chapan_shipping':   allowed = chapan.canAccessShipping; break;
    case 'chapan_analytics':  allowed = chapan.canAccessAnalytics; break;
    case 'chapan_purchase':   allowed = chapan.canAccessPurchase; break;
    case 'chapan_clients':    allowed = chapan.canAccessClients; break;
  }

  if (!allowed) return <PermissionDenied />;
  return <>{children}</>;
}

/**
 * Редирект на первый доступный раздел Чапана.
 * Используется как index-route вместо жёсткого Navigate to="orders".
 */
function ChapanDefaultRedirect() {
  const user = useAuthStore((s) => s.user);
  const { canAccessOrders, canAccessProduction, canAccessReady, canAccessArchive } = useChapanPermissions();

  if (!user) return null; // Wait for bootstrap to complete

  if (canAccessOrders)     return <Navigate to="orders"     replace />;
  if (canAccessProduction) return <Navigate to="production" replace />;
  if (canAccessReady)      return <Navigate to="ready"      replace />;
  if (canAccessArchive)    return <Navigate to="archive"    replace />;

  return <PermissionDenied />;
}

export const appRouter = createBrowserRouter([
  // ── KORT Core ─────────────────────────────────────────
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <RootIndex />,
      },
      {
        path: 'crm/leads',
        element: <RequireAuth><RequireOrg><RequirePermission check="sales"><LeadsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/deals',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="sales"><DealsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/customers',
        element: <RequireAuth><RequireOrg><RequirePermission check="sales"><CustomersPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/tasks',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="sales"><TasksPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse"><WarehousePage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/twin',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse"><WarehouseTwinPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/control-tower',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse"><WarehouseControlTowerPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/operations',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse"><WarehouseOperationsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/:id',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse"><ChapanOrderDetailPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'production',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="production"><ProductionPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'finance',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="financial"><FinancePage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'employees',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="team"><EmployeesPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'reports',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="financial"><ReportsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'documents',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="financial"><DocumentsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'settings',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
      {
        path: 'settings/:section',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
    ],
  },

  // ── Onboarding — own fullscreen layout, no sidebar ────
  {
    path: '/onboarding',
    element: <RequireAuth><OnboardingPage /></RequireAuth>,
  },

  // ── Chapan Workzone — own shell, own layout ────────────
  {
    path: '/workzone/chapan',
    element: <RequireAuth><RequirePlan tier="industrial"><RequirePermission check="chapan"><ChapanShell /></RequirePermission></RequirePlan></RequireAuth>,
    children: [
      {
        index: true,
        element: <ChapanDefaultRedirect />,
      },
      {
        path: 'orders',
        element: <RequirePermission check="chapan_orders"><ChapanOrdersPage /></RequirePermission>,
      },
      {
        path: 'orders/new',
        element: <RequirePermission check="chapan_orders"><ChapanNewOrderPage /></RequirePermission>,
      },
      {
        path: 'orders/:id',
        element: <RequirePermission check="chapan_orders"><ChapanOrderDetailPage /></RequirePermission>,
      },
      {
        path: 'orders/:id/edit',
        element: <RequirePermission check="chapan_orders"><ChapanEditOrderPage /></RequirePermission>,
      },
      {
        path: 'production',
        element: <RequirePermission check="chapan_production"><ChapanProductionPage /></RequirePermission>,
      },
      {
        path: 'ready',
        element: <RequirePermission check="chapan_ready"><ChapanReadyPage /></RequirePermission>,
      },
      {
        path: 'ready/:id',
        element: <RequirePermission check="chapan_ready"><ChapanOrderDetailPage /></RequirePermission>,
      },
      {
        path: 'invoices',
        element: <ChapanInvoicesPage />,
      },
      {
        path: 'returns',
        element: <ChapanReturnsPage />,
      },
      {
        path: 'shipping',
        element: <RequirePermission check="chapan_shipping"><ChapanShippingPage /></RequirePermission>,
      },
      {
        path: 'shipping/:id',
        element: <RequirePermission check="chapan_shipping"><ChapanOrderDetailPage /></RequirePermission>,
      },
      {
        path: 'archive',
        element: <RequirePermission check="chapan_archive"><ChapanArchivePage /></RequirePermission>,
      },
      {
        path: 'archive/:id',
        element: <RequirePermission check="chapan_archive"><ChapanOrderDetailPage /></RequirePermission>,
      },
      {
        path: 'warehouse',
        element: <ChapanWarehousePage />,
      },
      {
        path: 'catalog',
        element: <ChapanCatalogPage />,
      },
      {
        path: 'analytics',
        element: <RequirePermission check="chapan_analytics"><ChapanAnalyticsPage /></RequirePermission>,
      },
      {
        path: 'purchase',
        element: <RequirePermission check="chapan_purchase"><ChapanPurchasePage /></RequirePermission>,
      },
      {
        path: 'clients',
        element: <RequirePermission check="chapan_clients"><ChapanClientsPage /></RequirePermission>,
      },
      {
        path: 'clients/:id',
        element: <RequirePermission check="chapan_clients"><ChapanClientDetailPage /></RequirePermission>,
      },
      {
        path: 'settings',
        element: <Navigate to="../orders" replace />,
      },
    ],
  },

  // ── Auth ───────────────────────────────────────────────
  { path: '/auth/login',         element: <Navigate to="/" replace /> },
  { path: '/auth/register',      element: <Navigate to="/" replace /> },
  { path: '/auth/accept-invite', element: <AcceptInvitePage /> },
  { path: '/reset-password',     element: <ResetPasswordPage /> },

  // ── Dev panel — service password, no normal auth ──────
  { path: '/dev', element: <DevPanelPage /> },

  // ── Fallback ───────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
