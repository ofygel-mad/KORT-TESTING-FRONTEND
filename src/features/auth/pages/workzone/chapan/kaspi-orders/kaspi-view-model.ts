import type { KaspiOrder, KaspiOrderItem, KaspiOrdersSummary } from '@/entities/kaspi/types';

export type KaspiStageKey = 'new' | 'in_progress' | 'completed' | 'cancelled' | 'issues' | 'stock';

export type KaspiStockRow = {
  orderId: string;
  orderCode: string | null;
  externalStatus: string | null;
  externalState: string | null;
  customerName: string | null;
  customerPhone: string | null;
  item: KaspiOrderItem;
  lastExternalUpdateAt: string | null;
};

export const KASPI_STAGE_META: Array<{
  key: KaspiStageKey;
  label: string;
  description: string;
  to: string;
}> = [
  {
    key: 'new',
    label: '\u041d\u043e\u0432\u044b\u0435',
    description: '\u0417\u0430\u043a\u0430\u0437\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 Kaspi \u0443\u0436\u0435 \u043e\u0434\u043e\u0431\u0440\u0438\u043b, \u043d\u043e \u043e\u043d\u0438 \u0435\u0449\u0451 \u043d\u0435 \u0443\u0448\u043b\u0438 \u0432 \u0438\u0441\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435.',
    to: '/workzone/chapan/kaspi-orders/new',
  },
  {
    key: 'in_progress',
    label: '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435',
    description: '\u041f\u0440\u0438\u043d\u044f\u0442\u044b\u0435 \u0438 \u0434\u0432\u0438\u0433\u0430\u044e\u0449\u0438\u0435\u0441\u044f \u043f\u043e \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435 \u0438\u043b\u0438 \u0432\u044b\u0434\u0430\u0447\u0435.',
    to: '/workzone/chapan/kaspi-orders/in-progress',
  },
  {
    key: 'completed',
    label: '\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435',
    description: '\u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0443\u0436\u0435 \u043f\u043e\u043f\u0430\u043b\u0438 \u0432 \u0443\u0447\u0451\u0442 \u043a\u0430\u043a \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435.',
    to: '/workzone/chapan/kaspi-orders/completed',
  },
  {
    key: 'cancelled',
    label: '\u041e\u0442\u043c\u0435\u043d\u044b',
    description: '\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435, \u043e\u0442\u043c\u0435\u043d\u044f\u0435\u043c\u044b\u0435 \u0438 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b.',
    to: '/workzone/chapan/kaspi-orders/cancelled',
  },
  {
    key: 'issues',
    label: '\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u044b',
    description: '\u0417\u0430\u043a\u0430\u0437\u044b \u0441 \u043e\u0448\u0438\u0431\u043a\u0430\u043c\u0438 sync, match \u0438\u043b\u0438 stock impact.',
    to: '/workzone/chapan/kaspi-orders/issues',
  },
  {
    key: 'stock',
    label: '\u0421\u043a\u043b\u0430\u0434 Kaspi',
    description: '\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0440\u0435\u0437 \u043f\u043e SKU, reservations \u0438 stock impact \u0431\u0435\u0437 \u0441\u043c\u0435\u0448\u0438\u0432\u0430\u043d\u0438\u044f \u0441 Chapan warehouse.',
    to: '/workzone/chapan/kaspi-orders/stock',
  },
];

const MONEY = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

export function formatKaspiMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '\u2014';
  }

  return `${MONEY.format(value)} \u20b8`;
}

export function formatKaspiDateTime(value: string | null) {
  if (!value) {
    return '\u2014';
  }

  return new Date(value).toLocaleString('ru-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getKaspiStatusTone(order: KaspiOrder) {
  if (order.externalStatus === 'COMPLETED') {
    return 'good';
  }
  if (order.externalStatus === 'CANCELLED' || order.externalStatus === 'RETURNED') {
    return 'bad';
  }
  if (order.externalStatus === 'ACCEPTED_BY_MERCHANT') {
    return 'info';
  }
  if (order.externalStatus === 'APPROVED_BY_BANK') {
    return 'warn';
  }
  return 'default';
}

export function getKaspiStockTone(order: KaspiOrder) {
  if (order.stockImpactState === 'reserved' || order.stockImpactState === 'released') {
    return 'good';
  }
  if (order.stockImpactState === 'pending_reservation' || order.stockImpactState === 'partial_reserved') {
    return 'warn';
  }
  if (order.stockImpactState === 'no_match' || order.stockImpactState === 'no_active_site') {
    return 'bad';
  }
  return 'default';
}

export function matchesKaspiStage(order: KaspiOrder, stage: Exclude<KaspiStageKey, 'stock'>) {
  if (stage === 'new') {
    return order.externalStatus === 'APPROVED_BY_BANK';
  }

  if (stage === 'in_progress') {
    if (order.externalStatus !== 'ACCEPTED_BY_MERCHANT') {
      return false;
    }
    return !order.externalState || ['NEW', 'SIGN_REQUIRED', 'PICKUP', 'DELIVERY', 'KASPI_DELIVERY', 'ARCHIVE'].includes(order.externalState);
  }

  if (stage === 'completed') {
    return order.externalStatus === 'COMPLETED';
  }

  if (stage === 'cancelled') {
    return order.externalStatus === 'CANCELLED' || order.externalStatus === 'RETURNED' || order.externalStatus === 'CANCELLING';
  }

  return order.matchState !== 'matched'
    || !['pending_acceptance', 'reserved', 'released'].includes(order.stockImpactState)
    || !!order.syncError;
}

export function matchesKaspiSearch(order: KaspiOrder, search: string) {
  if (!search.trim()) {
    return true;
  }

  const term = search.trim().toLowerCase();
  return [
    order.externalOrderCode,
    order.externalOrderId,
    order.customerName,
    order.customerPhone,
    ...order.matchedItems.map((item) => item.productName),
    ...order.unmatchedItems.map((item) => item.productName),
    ...order.matchedItems.map((item) => item.merchantSku),
    ...order.unmatchedItems.map((item) => item.merchantSku),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

export function getKaspiStageCount(summary: KaspiOrdersSummary | undefined, stage: KaspiStageKey) {
  if (!summary) {
    return 0;
  }

  switch (stage) {
    case 'new':
      return summary.newOrNeedsAcceptance;
    case 'in_progress':
      return summary.accepted + summary.handoffOrDeliveryInProgress;
    case 'completed':
      return summary.completed;
    case 'cancelled':
      return summary.cancelledOrReturned;
    case 'issues':
    case 'stock':
      return summary.unmatchedOrStockIssues;
    default:
      return summary.total;
  }
}

export function buildKaspiIssueLabel(order: KaspiOrder) {
  if (order.syncError) {
    return '\u041e\u0448\u0438\u0431\u043a\u0430 sync';
  }
  if (order.matchState !== 'matched') {
    return '\u041d\u0435\u043f\u043e\u043b\u043d\u044b\u0439 match SKU';
  }
  if (order.stockImpactState === 'no_active_site') {
    return '\u041d\u0435\u0442 active warehouse site';
  }
  if (order.stockImpactState === 'pending_reservation' || order.stockImpactState === 'partial_reserved') {
    return '\u0420\u0435\u0437\u0435\u0440\u0432 \u043d\u0435 \u0434\u043e\u0432\u0435\u0434\u0451\u043d \u0434\u043e \u043a\u043e\u043d\u0446\u0430';
  }
  if (order.stockImpactState === 'no_match') {
    return '\u0421\u043a\u043b\u0430\u0434 \u043d\u0435 \u0441\u0432\u044f\u0437\u0430\u043d \u0441 SKU Kaspi';
  }
  return '\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0440\u0430\u0437\u0431\u043e\u0440\u0430';
}

export function buildKaspiStockRows(orders: KaspiOrder[]): KaspiStockRow[] {
  return orders.flatMap((order) => {
    const items = [...order.matchedItems, ...order.unmatchedItems];
    return items.map((item) => ({
      orderId: order.externalOrderId,
      orderCode: order.externalOrderCode,
      externalStatus: order.externalStatus,
      externalState: order.externalState,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      item,
      lastExternalUpdateAt: order.lastExternalUpdateAt,
    }));
  });
}

export function matchesKaspiStockRow(row: KaspiStockRow, search: string) {
  if (!search.trim()) {
    return true;
  }

  const term = search.trim().toLowerCase();
  return [
    row.orderCode,
    row.orderId,
    row.customerName,
    row.customerPhone,
    row.item.productName,
    row.item.merchantSku,
    row.item.warehouseSku,
    row.item.warehouseItemName,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}
