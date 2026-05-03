import type { ChapanOrder } from '@/entities/order/types';
import type { ChapanInvoice } from '@/entities/order/invoice.types';

export type AnomalyKind =
  | 'overdue'
  | 'unpaid_in_production'
  | 'invoice_rejected'
  | 'invoice_stale'
  | 'stuck_warehouse'
  | 'stuck_production'
  | 'partial_shipped';

export function detectInvoiceAnomalies(invoices: ChapanInvoice[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const inv of invoices) {
    const orderNumber = inv.items[0]?.order?.orderNumber ?? inv.invoiceNumber;
    const orderId = inv.items[0]?.orderId ?? '';

    if (inv.status === 'rejected') {
      anomalies.push({
        kind: 'invoice_rejected',
        orderId,
        orderNumber,
        message: `Склад отклонил накладную ${inv.invoiceNumber} (заказ #${orderNumber})`,
        hint: inv.rejectionReason ? `Причина: ${inv.rejectionReason}` : 'Исправьте и переотправьте накладную',
        route: '/workzone/chapan/ready',
      });
    }

    if (inv.status === 'pending_confirmation' && daysSince(inv.createdAt) >= 2) {
      anomalies.push({
        kind: 'invoice_stale',
        orderId,
        orderNumber,
        message: `Накладная ${inv.invoiceNumber} ждёт подтверждения 2+ дней`,
        hint: 'Напомните ЗавСкладу подтвердить накладную',
        route: '/workzone/chapan/invoices',
      });
    }
  }

  return anomalies;
}

export interface Anomaly {
  kind: AnomalyKind;
  orderId: string;
  orderNumber: string;
  message: string;
  hint: string;
  route: string;
}

const DAY_MS = 86_400_000;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / DAY_MS);
}

function daysOverdue(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 0 ? Math.ceil(diff / DAY_MS) : 0;
}

function orderRoute(order: ChapanOrder): string {
  const s = order.status;
  if (s === 'in_production' || s === 'confirmed') return '/workzone/chapan/production';
  if (s === 'ready') return '/workzone/chapan/ready';
  if (s === 'on_warehouse' || s === 'transferred') return '/workzone/chapan/warehouse';
  if (s === 'shipped') return '/workzone/chapan/shipping';
  return '/workzone/chapan/orders';
}

export function detectAnomalies(orders: ChapanOrder[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const ACTIVE = new Set(['new', 'confirmed', 'in_production', 'ready', 'transferred', 'on_warehouse', 'shipped']);

  for (const order of orders) {
    if (!ACTIVE.has(order.status)) continue;

    // Overdue deadline
    const overdueDays = daysOverdue(order.dueDate);
    if (overdueDays > 0) {
      anomalies.push({
        kind: 'overdue',
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: `Заказ #${order.orderNumber} просрочен на ${overdueDays} дн.`,
        hint: 'Уведомите клиента и обновите дедлайн',
        route: orderRoute(order),
      });
    }

    // Unpaid in production
    if ((order.status === 'in_production' || order.status === 'confirmed') && order.paymentStatus === 'not_paid') {
      anomalies.push({
        kind: 'unpaid_in_production',
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: `Заказ #${order.orderNumber} в цехе без оплаты`,
        hint: 'Уточните у менеджера статус оплаты',
        route: '/workzone/chapan/production',
      });
    }

    // Stuck on warehouse (>5 days)
    if (order.status === 'on_warehouse') {
      const days = daysSince(order.updatedAt);
      if (days >= 5) {
        anomalies.push({
          kind: 'stuck_warehouse',
          orderId: order.id,
          orderNumber: order.orderNumber,
          message: `Заказ #${order.orderNumber} на складе уже ${days} дн.`,
          hint: 'Уточните у менеджера отправки',
          route: '/workzone/chapan/warehouse',
        });
      }
    }

    // Stuck in production (>7 days)
    if (order.status === 'in_production') {
      const days = daysSince(order.updatedAt);
      if (days >= 7) {
        anomalies.push({
          kind: 'stuck_production',
          orderId: order.id,
          orderNumber: order.orderNumber,
          message: `Заказ #${order.orderNumber} в производстве уже ${days} дн.`,
          hint: 'Проверьте статус задач в цехе',
          route: '/workzone/chapan/production',
        });
      }
    }

    // Partial payment + shipped
    if (order.status === 'shipped' && order.paymentStatus === 'partial') {
      anomalies.push({
        kind: 'partial_shipped',
        orderId: order.id,
        orderNumber: order.orderNumber,
        message: `Заказ #${order.orderNumber} отправлен с частичной оплатой`,
        hint: 'Уточните у менеджера остаток задолженности',
        route: '/workzone/chapan/shipping',
      });
    }
  }

  return anomalies;
}

export type StatusBucket = 'in_production' | 'ready' | 'on_warehouse' | 'shipped';

export interface ManagerActivity {
  managerId: string;
  managerName: string;
  orders: ChapanOrder[];
}

export function groupByManager(orders: ChapanOrder[]): ManagerActivity[] {
  const map = new Map<string, ManagerActivity>();
  const ACTIVE = new Set(['new', 'confirmed', 'in_production', 'ready', 'transferred', 'on_warehouse', 'shipped']);

  for (const order of orders) {
    if (!ACTIVE.has(order.status)) continue;
    const id = order.managerId ?? 'unassigned';
    const name = order.managerName ?? 'Без менеджера';
    if (!map.has(id)) map.set(id, { managerId: id, managerName: name, orders: [] });
    map.get(id)!.orders.push(order);
  }

  return Array.from(map.values()).sort((a, b) => b.orders.length - a.orders.length);
}

export function countByStatus(orders: ChapanOrder[]): Record<StatusBucket, number> {
  const counts: Record<StatusBucket, number> = { in_production: 0, ready: 0, on_warehouse: 0, shipped: 0 };
  for (const o of orders) {
    if (o.status === 'in_production' || o.status === 'confirmed') counts.in_production++;
    else if (o.status === 'ready') counts.ready++;
    else if (o.status === 'on_warehouse' || o.status === 'transferred') counts.on_warehouse++;
    else if (o.status === 'shipped') counts.shipped++;
  }
  return counts;
}

export function nextStepLabel(order: ChapanOrder): string {
  switch (order.status) {
    case 'new':          return 'Подтвердить заказ';
    case 'confirmed':    return 'Передать в цех';
    case 'in_production': return 'Нажать «Готово»';
    case 'ready':        return 'Отправить на склад';
    case 'transferred':
    case 'on_warehouse': return 'Отправить клиенту';
    case 'shipped':      return 'Завершить заказ';
    default:             return '—';
  }
}

export function sectionLabel(order: ChapanOrder): string {
  switch (order.status) {
    case 'new':          return 'Заказы';
    case 'confirmed':
    case 'in_production': return 'Цех';
    case 'ready':        return 'Готово';
    case 'transferred':
    case 'on_warehouse': return 'Склад';
    case 'shipped':      return 'Отправка';
    default:             return order.status;
  }
}
