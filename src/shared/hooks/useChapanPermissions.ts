import type { EmployeePermission } from '../api/contracts';
import { useEmployeePermissions } from './useEmployeePermissions';
import { useRole } from './useRole';

/**
 * Single access layer for the Chapan module.
 * All section gates and action gates should be derived here.
 */
export function useChapanPermissions() {
  const { isAbsolute, canAccessWarehouse, permissions } = useEmployeePermissions();
  const { isAdmin } = useRole();

  const has = (permission: EmployeePermission) => permissions.includes(permission);
  const isChapanAdmin = isAbsolute || has('chapan_full_access');

  const canAccessOrders = isChapanAdmin || has('chapan_access_orders');
  const canAccessProduction = isChapanAdmin || has('chapan_access_production');
  const canAccessReady = isChapanAdmin || has('chapan_access_ready');
  const canAccessArchive = isChapanAdmin || has('chapan_access_archive');
  const canAccessWarehouseNav =
    isAbsolute
    || canAccessWarehouse
    || isChapanAdmin
    || has('chapan_access_warehouse_nav');
  const canManageSettings = isAdmin || isChapanAdmin || has('chapan_manage_settings');

  const canCreateOrder = canAccessOrders;
  const canManageProduction = isChapanAdmin || has('chapan_manage_production');
  const canConfirmInvoice = isChapanAdmin || has('chapan_confirm_invoice');
  const canAccessInvoices = canAccessReady || canConfirmInvoice || canAccessWarehouseNav;
  const canRestoreArchive = canCreateOrder;
  // Переназначение менеджера: admin/owner или сотрудник с chapan_full_access / full_access
  const canReassignManager = isAdmin || isChapanAdmin;

  // Warehouse operator permissions
  const isWarehouseOperator =
    isAbsolute || isChapanAdmin || has('chapan_warehouse_operator') || canAccessWarehouse;
  const canConfirmInvoiceReceipt = isWarehouseOperator;
  const canShipOrders = isWarehouseOperator || has('chapan_shipping');
  const canRejectInvoice = isWarehouseOperator;
  const canAccessShipping = isWarehouseOperator || has('chapan_shipping');
  // Shipping managers (chapan_shipping) can send orders even when payment is pending
  const canShipWithoutPayment = canAccessShipping;
  // Only order managers can edit invoice prices; warehouse operators are read-only
  const canEditInvoicePrices = (canAccessOrders || isChapanAdmin) && !isWarehouseOperator;
  const canAccessAnalytics = isAdmin || isChapanAdmin;
  const canAccessPurchase = isAdmin || isChapanAdmin;
  const canAccessClients = isAdmin || isChapanAdmin;

  const hasAnyAccess =
    canAccessOrders
    || canAccessProduction
    || canAccessReady
    || canAccessArchive
    || canAccessInvoices
    || canManageSettings;

  return {
    canAccessOrders,
    canAccessProduction,
    canAccessReady,
    canAccessArchive,
    canAccessWarehouseNav,
    canAccessInvoices,
    canManageSettings,
    canCreateOrder,
    canManageProduction,
    canConfirmInvoice,
    canRestoreArchive,
    canReassignManager,
    isWarehouseOperator,
    canConfirmInvoiceReceipt,
    canShipOrders,
    canRejectInvoice,
    canAccessShipping,
    canShipWithoutPayment,
    canEditInvoicePrices,
    canAccessAnalytics,
    canAccessPurchase,
    canAccessClients,
    hasAnyAccess,
  };
}
