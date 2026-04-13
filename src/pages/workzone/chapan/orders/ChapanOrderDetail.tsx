import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Clock, CreditCard, MessageSquare, AlertTriangle, Pencil, ArchiveIcon, RotateCcw, Download, Package, XCircle, FileText, Paperclip, Trash2, Upload, Undo2 } from 'lucide-react';
import { useOrder, useChangeOrderStatus, useAddPayment, useAddOrderActivity, useRestoreOrder, useCloseOrder, useCreateInvoice, useSetRequiresInvoice, useRouteSingleItem, useUploadAttachment, useDeleteAttachment, useReassignManager, useOrgManagers, useReturns, useCreateReturn, useConfirmReturn, useDeleteReturnDraft } from '../../../../entities/order/queries';
import { useChapanPermissions } from '../../../../shared/hooks/useChapanPermissions';
import { useProductsAvailability } from '../../../../entities/warehouse/queries';
import type { OrderItem, OrderItemFulfillmentMode, OrderStatus, Priority, Urgency, OrderAttachment, ReturnReason, ReturnRefundMethod, ReturnItemCondition, RETURN_REASON_LABELS, RETURN_REFUND_METHOD_LABELS } from '../../../../entities/order/types';
import { RETURN_REASON_LABELS as REASON_LABELS, RETURN_REFUND_METHOD_LABELS as REFUND_LABELS, RETURN_CONDITION_LABELS } from '../../../../entities/order/types';
import { attachmentsApi } from '../../../../entities/order/api';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '../../../../shared/api/client';
import { useChapanUiStore } from '../../../../features/workzone/chapan/store';
import { buildItemLine } from '../../../../shared/utils/itemLine';
import styles from './ChapanOrderDetail.module.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_production: 'В цехе',
  ready: 'Готов',
  transferred: 'Передан',
  on_warehouse: 'На складе',
  shipped: 'Отправлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#7C3AED',
  confirmed: '#C9A84C',
  in_production: '#E5922A',
  ready: '#4FC999',
  transferred: '#A78BFA',
  on_warehouse: '#8B5CF6',
  shipped: '#3B82F6',
  completed: 'rgba(240,232,212,.35)',
  cancelled: '#D94F4F',
};

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен',
  partial: 'Частично',
  paid: 'Оплачен',
};

const PAY_COLOR: Record<string, string> = {
  not_paid: '#D94F4F',
  partial: '#E5922A',
  paid: '#4FC999',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  kaspi_qr: 'Kaspi QR',
  kaspi_terminal: 'Kaspi терминал',
  transfer: 'Перевод',
  halyk: 'Халык',
  mixed: 'Смешанный',
};

const PROD_STATUS_LABEL: Record<string, string> = {
  queued: 'Очередь',
  in_progress: 'В работе',
  done: 'Готово',
};

const URGENCY_LABEL: Record<Urgency, string> = {
  normal: '',
  urgent: '🔴 Срочно',
};
const DEMANDING_LABEL = '⭐ Требовательный';

const ROUTE_LABEL: Record<OrderItemFulfillmentMode, string> = {
  unassigned: 'Не выбран',
  warehouse: 'Готово',
  production: 'В производство',
};

function fmt(n: number) {
  return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
}

function fmtDatetime(s: string) {
  return new Date(s).toLocaleString('ru-KZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPaymentMethod(method: string) {
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

function formatItemMeta(item: Pick<OrderItem, 'fabric' | 'size' | 'quantity'>) {
  // fabric omitted — color/gender shown in separate line; keep size + qty
  const meta = [item.size].filter(Boolean).join(' · ');
  return item.quantity > 1 ? `${meta}${meta ? ' · ' : ''}× ${item.quantity}` : meta;
}


function resolveItemFulfillmentMode(order: { status: OrderStatus; productionTasks?: Array<{ orderItemId: string }> }, item: OrderItem): OrderItemFulfillmentMode {
  if (item.fulfillmentMode === 'warehouse' || item.fulfillmentMode === 'production') return item.fulfillmentMode;
  const hasTask = (order.productionTasks ?? []).some((task) => task.orderItemId === item.id);
  if (hasTask) return 'production';
  if (['ready', 'on_warehouse', 'shipped', 'completed'].includes(order.status)) return 'warehouse';
  return 'unassigned';
}

async function downloadInvoice(orderId: string, orderNumber: string) {
  const response = await apiClient.get(`/chapan/orders/${orderId}/invoice`, {
    params: { style: 'branded' },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nakladnaya-${orderNumber}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const paySchema = z.object({
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  method: z.string().min(1),
  note: z.string().optional(),
});

type PayForm = z.infer<typeof paySchema>;

export default function ChapanOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const setSelectedOrderId = useChapanUiStore((state) => state.setSelectedOrderId);

  // A1 fix: очищаем selectedOrderId при входе в карточку,
  // чтобы возврат на список заказов не вызывал повторный редирект.
  useEffect(() => {
    setSelectedOrderId(null);
  }, [setSelectedOrderId]);

  const detailContext = (() => {
    if (location.pathname.startsWith('/workzone/chapan/ready/')) {
      return { backPath: '/workzone/chapan/ready', backLabel: 'Готово' };
    }
    if (location.pathname.startsWith('/workzone/chapan/archive/')) {
      return { backPath: '/workzone/chapan/archive', backLabel: 'Архив' };
    }
    if (location.pathname.startsWith('/warehouse/')) {
      return { backPath: '/warehouse', backLabel: 'Склад' };
    }
    return { backPath: '/workzone/chapan/orders', backLabel: 'Заказы' };
  })();

  const { data: order, isLoading, isError } = useOrder(id!);
  const changeStatus = useChangeOrderStatus();
  const addPayment = useAddPayment();
  const addActivity = useAddOrderActivity();
  const restoreOrder = useRestoreOrder();
  const closeOrder = useCloseOrder();
  const createInvoice = useCreateInvoice();
  const setRequiresInvoice = useSetRequiresInvoice();
  const routeSingleItem = useRouteSingleItem();
  const uploadAttachment = useUploadAttachment(id!);
  const deleteAttachment = useDeleteAttachment(id!);
  const reassignManager = useReassignManager();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { canReassignManager } = useChapanPermissions();
  const { data: orgManagers } = useOrgManagers();

  const pendingInvoice = order?.status === 'ready'
    ? order.invoiceOrders?.find((io) => io.invoice.status === 'pending_confirmation')?.invoice
    : undefined;

  const productNames = [...new Set((order?.items ?? []).map((item) => item.productName).filter(Boolean))];
  const { data: stockMap } = useProductsAvailability(productNames);

  // Route confirmation modal state
  type RouteConfirmDraft = { itemId: string; itemName: string; fulfillmentMode: 'warehouse' | 'production' };
  const [routeConfirmDraft, setRouteConfirmDraft] = useState<RouteConfirmDraft | null>(null);

  const [showPayForm, setShowPayForm] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [restorePromptOpen, setRestorePromptOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedNewManagerId, setSelectedNewManagerId] = useState('');

  // ── Return form state ──────────────────────────────────────────────────────
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState<ReturnReason>('defect');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState<ReturnRefundMethod>('cash');
  type ReturnItemDraft = { selected: boolean; qty: number; condition: ReturnItemCondition };
  const [returnItemDrafts, setReturnItemDrafts] = useState<Record<string, ReturnItemDraft>>({});

  const { data: returnsData } = useReturns({ orderId: id! });
  const existingReturns = returnsData?.results ?? [];
  const createReturn = useCreateReturn();
  const confirmReturn = useConfirmReturn();
  const deleteReturnDraft = useDeleteReturnDraft();

  function openReturnForm() {
    const drafts: Record<string, ReturnItemDraft> = {};
    for (const item of order?.items ?? []) {
      drafts[item.id] = { selected: true, qty: item.quantity, condition: 'good' };
    }
    setReturnItemDrafts(drafts);
    setReturnReason('defect');
    setReturnNotes('');
    setReturnRefundMethod('cash');
    setShowReturnForm(true);
  }

  async function handleSubmitReturn() {
    if (!order) return;
    const items = (order.items ?? [])
      .filter((item) => returnItemDrafts[item.id]?.selected)
      .map((item) => ({
        orderItemId: item.id,
        productName: item.productName,
        size: item.size,
        fabric: item.fabric ?? undefined,
        color: item.color ?? undefined,
        gender: item.gender ?? undefined,
        qty: returnItemDrafts[item.id]?.qty ?? item.quantity,
        unitPrice: item.unitPrice,
        refundAmount: (returnItemDrafts[item.id]?.qty ?? item.quantity) * item.unitPrice,
        condition: returnItemDrafts[item.id]?.condition ?? 'good',
      }));
    if (items.length === 0) return;

    createReturn.mutate(
      { orderId: order.id, reason: returnReason, reasonNotes: returnNotes || undefined, refundMethod: returnRefundMethod, items },
      {
        onSuccess: (draft) => {
          setShowReturnForm(false);
          confirmReturn.mutate(draft.id);
        },
      },
    );
  }

  const {
    register: registerPay,
    handleSubmit: handlePaySubmit,
    reset: resetPay,
    setValue: setPayValue,
    watch: watchPay,
    formState: { errors: payErrors },
  } = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { method: 'cash' },
  });

  const payAmount = watchPay('amount');

  async function onPaySubmit(data: PayForm) {
    if (!id) return;
    await addPayment.mutateAsync({ id, dto: data });
    resetPay({ method: 'cash' });
    setShowPayForm(false);
  }

  async function handleComment() {
    if (!comment.trim() || !id) return;
    setSubmittingComment(true);
    try {
      await addActivity.mutateAsync({ id, content: comment.trim() });
      setComment('');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleInvoiceDownload() {
    if (!id || !order || invoiceDownloading) return;
    setInvoiceDownloading(true);
    try {
      await downloadInvoice(id, order.orderNumber);
    } finally {
      setInvoiceDownloading(false);
    }
  }

  async function handleTransferToWarehouse() {
    if (!order) return;
    try {
      if (order.requiresInvoice) {
        // Create накладная — stay on page; order detail will show pending invoice state
        await createInvoice.mutateAsync({ orderIds: [order.id] });
      } else {
        // No invoice required — directly set status
        await changeStatus.mutateAsync({ id: order.id, status: 'on_warehouse' });
      }
    } catch {
      // error toast handled in mutation
    }
  }

  function handleRouteConfirm() {
    if (!routeConfirmDraft || !order) return;
    const closeModal = () => setRouteConfirmDraft(null);

    routeSingleItem.mutate(
      { orderId: order.id, itemId: routeConfirmDraft.itemId, fulfillmentMode: routeConfirmDraft.fulfillmentMode },
      { onSuccess: closeModal },
    );
  }

  if (isLoading) {
    return <div className={styles.root}><div className={styles.loadingSkeleton}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonBlock} />)}</div></div>;
  }

  if (isError || !order) {
    return (
      <div className={styles.root}>
        <div className={styles.errorState}>
          <AlertTriangle size={24} />
          <p>Заказ не найден</p>
          <button onClick={() => { setSelectedOrderId(null); navigate(detailContext.backPath); }}>← Вернуться</button>
        </div>
      </div>
    );
  }
  const balance = order.totalAmount - order.paidAmount;
  const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== 'completed';
  const orderItems = order.items ?? [];
  const productionTaskByItemId = new Map((order.productionTasks ?? []).map((task) => [task.orderItemId, task]));
  const currentRoutes = Object.fromEntries(orderItems.map((item) => [item.id, resolveItemFulfillmentMode(order, item)]));

  const warehouseItems = orderItems.filter((item) => currentRoutes[item.id] === 'warehouse');
  const productionItems = orderItems.filter((item) => currentRoutes[item.id] === 'production');
  const unroutedItems = orderItems.filter((item) => currentRoutes[item.id] === 'unassigned');
  const hasUnfinishedProduction = productionItems.some((pItem) => {
    const pTask = productionTaskByItemId.get(pItem.id);
    return !pTask || pTask.status !== 'done';
  });

  const isNewOrder = order.status === 'new';

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <div className={styles.orderMeta}>
          <h1 className={styles.orderNum}>#{order.orderNumber}</h1>
          <span className={styles.statusChip} style={{ '--sc': STATUS_COLOR[order.status] } as React.CSSProperties}>{STATUS_LABEL[order.status]}</span>
          {(order.urgency ?? order.priority) === 'urgent' && (
            <span className={styles.priorityChip} data-urgency="urgent">🔴 Срочно</span>
          )}
          {(order.isDemandingClient ?? (order.priority === 'vip')) && (
            <span className={styles.priorityChip} data-urgency="demanding">⭐ Требовательный</span>
          )}
          {isOverdue && <span className={styles.overdueChip}>Просрочен</span>}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Клиент</div>
            <div className={styles.clientName}>{order.clientName}</div>
            {order.clientPhone && (
              <a href={`tel:${order.clientPhone}`} className={styles.clientPhone}>{order.clientPhone}</a>
            )}
            {order.clientPhoneForeign && (
              <a href={`tel:${order.clientPhoneForeign}`} className={styles.clientPhone}>{order.clientPhoneForeign}</a>
            )}
            {(order.city || order.deliveryType || order.source || order.dueDate || order.managerName) && (
              <div className={styles.clientMeta}>
                {order.city && (
                  <div className={styles.clientMetaRow}>
                    <span className={styles.clientMetaIcon}>🏙</span>
                    <span className={styles.clientMetaLabel}>Город</span>
                    <span className={styles.clientMetaValue}>{order.city}</span>
                  </div>
                )}
                {order.deliveryType && (
                  <div className={styles.clientMetaRow}>
                    <span className={styles.clientMetaIcon}>📦</span>
                    <span className={styles.clientMetaLabel}>Доставка</span>
                    <span className={styles.clientMetaValue}>{order.deliveryType}</span>
                  </div>
                )}
                {order.source && (
                  <div className={styles.clientMetaRow}>
                    <span className={styles.clientMetaIcon}>📣</span>
                    <span className={styles.clientMetaLabel}>Источник</span>
                    <span className={styles.clientMetaValue}>{order.source}</span>
                  </div>
                )}
                {order.dueDate && (
                  <div className={styles.clientMetaRow}>
                    <span className={styles.clientMetaIcon}>📅</span>
                    <span className={styles.clientMetaLabel}>Дедлайн</span>
                    <span className={`${styles.clientMetaValue} ${isOverdue ? styles.clientMetaOverdue : ''}`}>
                      {new Date(order.dueDate).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className={styles.clientMetaRow}>
                  <span className={styles.clientMetaIcon}>👤</span>
                  <span className={styles.clientMetaLabel}>Менеджер</span>
                  <span className={styles.clientMetaValue}>{order.managerName ?? 'Не указан'}</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Позиции заказа</div>
            {orderItems.length > 0 && (
              <div className={styles.routeSummaryHint}>
                Зафиксировано: {warehouseItems.length} готово · {productionItems.length} в цехе · {unroutedItems.length} без решения
              </div>
            )}
            <div className={styles.itemsList}>
              {(order.items ?? []).map((item) => {
                const stock = stockMap?.[item.productName];
                const hasEnoughStock = (stock?.qty ?? 0) >= item.quantity;
                const route = currentRoutes[item.id] ?? 'unassigned';

                const task = productionTaskByItemId.get(item.id);
                const badgeLabel = route === 'production' && task
                  ? (PROD_STATUS_LABEL[task.status] ?? ROUTE_LABEL[route])
                  : ROUTE_LABEL[route];
                const isRouteable = ['new', 'confirmed', 'in_production'].includes(order.status);
                const isTerminal = ['ready', 'transferred', 'on_warehouse', 'shipped', 'completed', 'cancelled'].includes(order.status);

                // For warehouse items that are waiting for production items to finish
                const isWaiting = route === 'warehouse' && order.status === 'in_production' && hasUnfinishedProduction;
                const effectiveBadgeLabel = isWaiting ? 'Ожидает цех' : badgeLabel;
                const badgeClass = isWaiting
                  ? styles.routeBadgeWaiting
                  : route === 'warehouse'
                    ? styles.routeBadgeWarehouse
                    : route === 'production'
                      ? (task?.status === 'done' ? styles.routeBadgeDone : styles.routeBadgeProduction)
                      : styles.routeBadgePending;
                const routeHint = route === 'warehouse'
                  ? (isWaiting ? 'Зафиксировано как готово. Ожидает завершения остальных позиций.' : 'Зафиксировано как готово.')
                  : route === 'production'
                    ? (task?.status === 'done' ? 'Позиция отшита и зафиксирована цехом.' : 'Зафиксировано: отправлено в цех.')
                    : 'Маршрут для этой позиции ещё не выбран.';

                const showBadge = isTerminal || (!isNewOrder && route !== 'unassigned');

                return (
                  <div key={item.id} className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemHead}>
                        <span className={styles.itemName}>{buildItemLine(item)}</span>
                        {showBadge && (
                          <span className={`${styles.routeBadge} ${badgeClass}`}>
                            {effectiveBadgeLabel}
                          </span>
                        )}
                      </div>
                      <span className={styles.itemMeta}>{formatItemMeta(item)}</span>
                      {item.length && (
                        <span className={styles.itemMeta} style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                          дл. {item.length}
                        </span>
                      )}
                      {item.workshopNotes && <span className={styles.itemNote}>↳ {item.workshopNotes}</span>}
                      {order.status === 'new' && stock !== undefined && (
                        <span className={hasEnoughStock ? styles.stockBadgeIn : styles.stockBadgeOut}>
                          {hasEnoughStock ? <><CheckCircle2 size={10} /> В наличии ({stock.qty} шт.)</> : <><XCircle size={10} /> Нет в наличии</>}
                        </span>
                      )}
                      <span className={`${styles.routeHint} ${route === 'unassigned' ? styles.routeHintMuted : styles.routeHintStrong}`}>
                        {routeHint}
                      </span>
                      {isRouteable && (
                        <div className={styles.routeActions}>
                          <button
                            type="button"
                            className={`${styles.routeActionBtn} ${route === 'warehouse' ? styles.routeActionBtnActive : ''}`}
                            onClick={() => setRouteConfirmDraft({ itemId: item.id, itemName: buildItemLine(item), fulfillmentMode: 'warehouse' })}
                            disabled={routeSingleItem.isPending || route === 'warehouse'}
                            title={route === 'warehouse' ? 'Позиция уже зафиксирована как готовая' : undefined}
                          >
                            Готово
                          </button>
                          <button
                            type="button"
                            className={`${styles.routeActionBtn} ${styles.routeActionBtnPrimary} ${route === 'production' ? styles.routeActionBtnActive : ''}`}
                            onClick={() => setRouteConfirmDraft({ itemId: item.id, itemName: buildItemLine(item), fulfillmentMode: 'production' })}
                            disabled={routeSingleItem.isPending || route === 'production'}
                            title={route === 'production' ? 'Позиция уже отправлена в цех' : undefined}
                          >
                            В цех
                          </button>
                        </div>
                      )}
                    </div>
                    <span className={styles.itemPrice}>{fmt(item.quantity * item.unitPrice)}</span>
                  </div>
                );
              })}
              {(order.items ?? []).length === 0 && <div className={styles.noItems}>Позиции не указаны</div>}
            </div>
            <div className={styles.itemsTotal}>
              <span>
                Итого
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                  {orderItems.length} {orderItems.length === 1 ? 'позиция' : orderItems.length < 5 ? 'позиции' : 'позиций'}
                  {' · '}
                  {orderItems.reduce((s, i) => s + (i.quantity ?? 1), 0)} шт.
                </span>
              </span>
              <strong>{fmt(order.totalAmount)}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Финансы</div>
            <div className={styles.finTable}>
              {order.deliveryFee > 0 && (
                <div className={styles.finRow}><span>Доставка</span><strong>{fmt(order.deliveryFee)}</strong></div>
              )}
              {order.bankCommissionAmount > 0 && (
                <div className={styles.finRow}><span>Комиссия банка{order.bankCommissionPercent > 0 ? ` (${order.bankCommissionPercent}%)` : ''}</span><strong>{fmt(order.bankCommissionAmount)}</strong></div>
              )}
              {order.orderDiscount > 0 && (
                <div className={styles.finRow}><span>Скидка</span><strong style={{ color: '#4FC999' }}>−{fmt(order.orderDiscount)}</strong></div>
              )}
              <div className={styles.finRow}><span>Итого к оплате</span><strong>{fmt(order.totalAmount)}</strong></div>
              <div className={styles.finRow}><span>Оплачено</span><strong style={{ color: '#4FC999' }}>{fmt(order.paidAmount)}</strong></div>
              <div className={`${styles.finRow} ${styles.finRowBalance}`}><span>Остаток</span><strong style={{ color: balance > 0 ? '#E8C97A' : '#4FC999' }}>{fmt(balance)}</strong></div>
              <div className={styles.finRow}><span>Статус оплаты</span><span style={{ color: PAY_COLOR[order.paymentStatus], fontWeight: 500, fontSize: 12 }}>{PAY_LABEL[order.paymentStatus]}</span></div>
              {order.expectedPaymentMethod && (
                <div className={styles.finRow}><span>Ожидаемый способ доплаты</span><span style={{ fontWeight: 500 }}>{order.expectedPaymentMethod}</span></div>
              )}
              {order.postalCode && (
                <div className={styles.finRow}><span>Индекс</span><span style={{ fontWeight: 500 }}>{order.postalCode}</span></div>
              )}
              {order.orderDate && (
                <div className={styles.finRow}><span>Дата заказа</span><span style={{ fontWeight: 500 }}>{new Date(order.orderDate).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
              )}
            </div>

            {(order.payments ?? []).length > 0 && (
              <div className={styles.payHistory}>
                <div className={styles.payHistoryLabel}>История оплат</div>
                {(order.payments ?? []).map((payment) => (
                  <div key={payment.id} className={styles.payRow}>
                    <span>{fmtDatetime(payment.createdAt)}</span>
                    <span>{formatPaymentMethod(payment.method)}</span>
                    {payment.note && <span className={styles.payNote}>{payment.note}</span>}
                    <strong style={{ color: '#4FC999', marginLeft: 'auto' }}>+{fmt(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            )}

            {!showPayForm ? (
              <button className={styles.addPayBtn} onClick={() => { setShowPayForm(true); setTimeout(() => setPayValue('amount', balance), 0); }}>
                <CreditCard size={13} />
                Добавить оплату
              </button>
            ) : (
              <form className={styles.payForm} onSubmit={handlePaySubmit(onPaySubmit)}>
                <div className={styles.payFormRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Сумма ₸</label>
                    {(() => {
                      const { onChange: onAmountChange, ...amountRest } = registerPay('amount');
                      return <input {...amountRest} onChange={(e) => { if (Number(e.target.value) > balance) e.target.value = String(balance); onAmountChange(e); }} type="number" min="0.01" max={balance} step="any" className={`${styles.payInput} ${payErrors.amount ? styles.payInputError : ''}`} placeholder="0" autoFocus onFocus={(e) => e.target.select()} />;
                    })()}
                    {payErrors.amount && <span className={styles.payError}>{payErrors.amount.message}</span>}
                    {!payErrors.amount && Number(payAmount) > 0 && Number(payAmount) <= balance && <span className={styles.payBalanceHint}>Остаток после оплаты: {new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(balance - Number(payAmount))} ₸</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Метод</label>
                    <select {...registerPay('method')} className={styles.payInput}>{Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </div>
                </div>
                <input {...registerPay('note')} className={styles.payInput} placeholder="Примечание (необязательно)" />
                <div className={styles.payFormActions}>
                  <button type="submit" className={styles.paySubmit} disabled={addPayment.isPending}>{addPayment.isPending ? 'Сохранение...' : 'Сохранить'}</button>
                  <button type="button" className={styles.payCancel} onClick={() => setShowPayForm(false)}>Отмена</button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Действия</div>
            <div className={styles.actions}>
              {!['completed', 'cancelled'].includes(order.status) && (
                <button className={`${styles.actionBtn} ${styles.actionEdit}`} onClick={() => navigate(`/workzone/chapan/orders/${order.id}/edit`)}>
                  <Pencil size={13} />
                  Редактировать заказ
                </button>
              )}

              {canReassignManager && (
                <button
                  className={`${styles.actionBtn} ${styles.actionSecondary}`}
                  onClick={() => { setSelectedNewManagerId(order.managerId ?? ''); setReassignOpen(true); }}
                >
                  <span style={{ fontSize: 13 }}>👤</span>
                  Переназначить менеджера
                </button>
              )}

              {isNewOrder && (
                <div className={styles.newOrderRouteHint}>
                  <Package size={13} />
                  Назначьте маршрут для каждой позиции выше
                </div>
              )}

              {['ready', 'transferred', 'on_warehouse', 'completed'].includes(order.status) && (
                <button className={`${styles.actionBtn} ${styles.actionSecondary}`} onClick={handleInvoiceDownload} disabled={invoiceDownloading}>
                  <Download size={13} />
                  {invoiceDownloading ? 'Подготовка накладной...' : 'Скачать накладную'}
                </button>
              )}

              {order.status === 'ready' && pendingInvoice && (
                <div className={styles.invoicePanel}>
                  <div className={styles.invoicePanelTitle}>
                    <Clock size={12} />
                    Накладная <span className={styles.invoicePanelNum}>#{pendingInvoice.invoiceNumber}</span> ожидает подтверждения
                  </div>
                  <div className={styles.invoiceConfirms}>
                    <span className={`${styles.invoiceChip} ${pendingInvoice.seamstressConfirmed ? styles.invoiceChipDone : ''}`}>
                      {pendingInvoice.seamstressConfirmed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      Швея
                    </span>
                    <span className={`${styles.invoiceChip} ${pendingInvoice.warehouseConfirmed ? styles.invoiceChipDone : ''}`}>
                      {pendingInvoice.warehouseConfirmed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      Склад
                    </span>
                  </div>
                  <div className={styles.invoicePanelHint}>
                    Заказ перейдёт на склад в ожидании подтверждения от склада
                  </div>
                </div>
              )}
              {order.status === 'transferred' && <button className={`${styles.actionBtn} ${styles.actionSecondary}`} onClick={() => changeStatus.mutate({ id: order.id, status: 'completed' })} disabled={changeStatus.isPending}>Завершить заказ</button>}

              {['ready', 'transferred', 'on_warehouse', 'completed'].includes(order.status) && !order.isArchived && (
                <button
                  className={`${styles.actionBtn} ${styles.actionArchive}`}
                  onClick={() => { closeOrder.mutate(order.id); }}
                  disabled={closeOrder.isPending}
                >
                  <ArchiveIcon size={13} />
                  {closeOrder.isPending ? 'Закрытие...' : 'Закрыть сделку'}
                </button>
              )}

              {!['completed', 'cancelled'].includes(order.status) && <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => setCancelConfirmOpen(true)} disabled={changeStatus.isPending}>Отменить заказ</button>}

              {['shipped', 'completed'].includes(order.status) && !showReturnForm && (
                <button className={`${styles.actionBtn} ${styles.actionReturn}`} onClick={openReturnForm}>
                  <Undo2 size={13} />
                  Оформить возврат
                </button>
              )}

              {['shipped', 'completed'].includes(order.status) && showReturnForm && (
                <div className={styles.returnForm}>
                  <div className={styles.returnFormTitle}>Акт возврата</div>

                  <div className={styles.returnField}>
                    <label className={styles.returnLabel}>Причина</label>
                    <select className={styles.returnSelect} value={returnReason} onChange={(e) => setReturnReason(e.target.value as ReturnReason)}>
                      {(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.returnField}>
                    <label className={styles.returnLabel}>Метод возврата денег</label>
                    <select className={styles.returnSelect} value={returnRefundMethod} onChange={(e) => setReturnRefundMethod(e.target.value as ReturnRefundMethod)}>
                      {(Object.entries(REFUND_LABELS) as [ReturnRefundMethod, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.returnField}>
                    <label className={styles.returnLabel}>Позиции возврата</label>
                    <div className={styles.returnItems}>
                      {(order.items ?? []).map((item) => {
                        const draft = returnItemDrafts[item.id] ?? { selected: true, qty: item.quantity, condition: 'good' as ReturnItemCondition };
                        return (
                          <div key={item.id} className={`${styles.returnItem} ${!draft.selected ? styles.returnItemDisabled : ''}`}>
                            <input
                              type="checkbox"
                              checked={draft.selected}
                              onChange={(e) => setReturnItemDrafts((prev) => ({ ...prev, [item.id]: { ...draft, selected: e.target.checked } }))}
                            />
                            <div className={styles.returnItemName}>
                              <span>{item.productName}</span>
                              <span className={styles.returnItemMeta}>{item.size}{item.color ? ` · ${item.color}` : ''}</span>
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              className={styles.returnQtyInput}
                              value={draft.qty}
                              disabled={!draft.selected}
                              onChange={(e) => setReturnItemDrafts((prev) => ({ ...prev, [item.id]: { ...draft, qty: Math.max(1, Math.min(item.quantity, Number(e.target.value))) } }))}
                            />
                            <select
                              className={styles.returnConditionSelect}
                              value={draft.condition}
                              disabled={!draft.selected}
                              onChange={(e) => setReturnItemDrafts((prev) => ({ ...prev, [item.id]: { ...draft, condition: e.target.value as ReturnItemCondition } }))}
                            >
                              {(Object.entries(RETURN_CONDITION_LABELS) as [ReturnItemCondition, string][]).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.returnField}>
                    <label className={styles.returnLabel}>Примечание (необязательно)</label>
                    <input className={styles.returnSelect} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Доп. информация о возврате..." />
                  </div>

                  <div className={styles.returnFormActions}>
                    <button
                      className={styles.returnSubmitBtn}
                      onClick={handleSubmitReturn}
                      disabled={createReturn.isPending || confirmReturn.isPending || !(order.items ?? []).some((i) => returnItemDrafts[i.id]?.selected)}
                    >
                      <Undo2 size={13} />
                      {createReturn.isPending || confirmReturn.isPending ? 'Оформление...' : 'Подтвердить возврат'}
                    </button>
                    <button className={styles.returnCancelBtn} onClick={() => setShowReturnForm(false)}>Отмена</button>
                  </div>
                </div>
              )}

              {order.status === 'completed' && (
                <>
                  <div className={styles.completedBadge}>Заказ завершён</div>
                  {order.isArchived && <div className={styles.archivedBadge}>В архиве</div>}
                </>
              )}

              {(order.status === 'cancelled' || (order.isArchived && order.status !== 'completed')) && (
                <>
                  <div className={styles.cancelledBadge}>{order.status === 'cancelled' ? 'Заказ отменён' : 'Заказ в архиве'}</div>
                  <button className={`${styles.actionBtn} ${styles.actionSecondary}`} onClick={() => setRestorePromptOpen(true)} disabled={restoreOrder.isPending}>
                    <RotateCcw size={13} />
                    {restoreOrder.isPending ? 'Восстановление...' : 'Восстановить заказ'}
                  </button>
                </>
              )}
            </div>
          </div>

          {existingReturns.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>Возвраты</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {existingReturns.map((ret) => (
                  <div key={ret.id} className={styles.returnHistoryRow}>
                    <div className={styles.returnHistoryLeft}>
                      <span className={styles.returnHistoryNum}>{ret.returnNumber}</span>
                      <span className={styles.returnHistoryReason}>{REASON_LABELS[ret.reason]}</span>
                      <span className={styles.returnHistoryDate}>{new Date(ret.createdAt).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <div className={styles.returnHistoryRight}>
                      <span className={styles.returnHistoryAmount}>−{new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(ret.totalRefundAmount)} ₸</span>
                      <span className={`${styles.returnHistoryStatus} ${ret.status === 'confirmed' ? styles.returnHistoryStatusDone : styles.returnHistoryStatusDraft}`}>
                        {ret.status === 'confirmed' ? 'Подтверждён' : 'Черновик'}
                      </span>
                      {ret.status === 'draft' && (
                        <button
                          className={styles.returnConfirmMiniBtn}
                          onClick={() => confirmReturn.mutate(ret.id)}
                          disabled={confirmReturn.isPending}
                        >
                          <CheckCircle2 size={11} />
                          Подтвердить
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {warehouseItems.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>Склад</div>
              <div className={styles.routeList}>
                {warehouseItems.map((item) => (
                  <div key={item.id} className={styles.routeListItem}>
                    <div className={styles.routeListInfo}>
                      <span className={styles.routeListName}>{item.productName}</span>
                      <span className={styles.routeListMeta}>{formatItemMeta(item)}</span>
                    </div>
                    <span className={`${styles.routeStatus} ${styles.routeStatusWarehouse}`}>{['on_warehouse', 'shipped', 'completed'].includes(order.status) ? 'На складе' : 'К отправке'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {productionItems.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardLabel}>Производство</div>
              <div className={styles.prodList}>
                {productionItems.map((item) => {
                  const task = productionTaskByItemId.get(item.id);
                  return (
                    <div key={item.id} className={`${styles.prodTask} ${task?.isBlocked ? styles.prodTaskBlocked : ''}`}>
                      <div className={styles.prodTaskLeft}>
                        <span className={styles.prodTaskName}>{item.productName}</span>
                        <span className={styles.prodTaskMeta}>{formatItemMeta(item)}</span>
                        {task?.assignedTo && <span className={styles.prodTaskWorker}>Исполнитель: {task.assignedTo}</span>}
                        {task?.isBlocked && task.blockReason && <span className={styles.prodTaskBlock}>Блок: {task.blockReason}</span>}
                      </div>
                      <span className={`${styles.prodStatus} ${task?.status === 'done' ? styles.prodStatusDone : ''}`}>{task ? (PROD_STATUS_LABEL[task.status] ?? task.status) : 'Очередь'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardLabel}>
              <Paperclip size={13} style={{ marginRight: 6, opacity: 0.6 }} />
              Вложения
              {(order.attachments ?? []).length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {(order.attachments ?? []).length}
                </span>
              )}
            </div>

            {/* File list */}
            {(order.attachments ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {(order.attachments as OrderAttachment[]).map(att => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <FileText size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.fileName}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {(att.sizeBytes / 1024).toFixed(0)} КБ
                    </span>
                    <a
                      href={attachmentsApi.download(id!, att.id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}
                      title="Скачать"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, flexShrink: 0 }}
                      title="Удалить"
                      onClick={() => deleteAttachment.mutate(att.id)}
                      disabled={deleteAttachment.isPending}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8,
                border: '1px dashed var(--border-default)',
                background: 'transparent', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit',
                opacity: uploadAttachment.isPending ? 0.6 : 1,
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAttachment.isPending}
            >
              <Upload size={13} />
              {uploadAttachment.isPending ? 'Загрузка...' : 'Прикрепить файл'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.xlsx,.xls"
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                for (const file of files) {
                  await uploadAttachment.mutateAsync(file);
                }
                e.target.value = '';
              }}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>История</div>
            <div className={styles.activityList}>
              {(order.activities ?? []).length === 0 && <div className={styles.noActivity}>Нет записей</div>}
              {(order.activities ?? []).map((activity) => (
                <div key={activity.id} className={styles.actItem}>
                  <div className={styles.actMeta}>
                    <span className={styles.actAuthor}>{activity.authorName}</span>
                    <span className={styles.actDate}>{fmtDatetime(activity.createdAt)}</span>
                  </div>
                  {activity.content && <div className={styles.actContent}>{activity.content}</div>}
                </div>
              ))}
            </div>

            <div className={styles.commentBox}>
              <input
                className={styles.commentInput}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Добавить комментарий..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleComment();
                  }
                }}
              />
              <button className={styles.commentBtn} onClick={() => void handleComment()} disabled={!comment.trim() || submittingComment}>
                <MessageSquare size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {routeConfirmDraft && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="route-confirm-title" onClick={() => setRouteConfirmDraft(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle} id="route-confirm-title">
              {routeConfirmDraft.fulfillmentMode === 'warehouse' ? 'Отметить как Готово?' : 'Отправить в цех?'}
            </div>

            <div className={styles.confirmText}>
              Позиция <strong>«{routeConfirmDraft.itemName}»</strong> будет{' '}
              {routeConfirmDraft.fulfillmentMode === 'warehouse' ? 'отмечена как готовая к отправке' : 'отправлена в цех на пошив'}.
            </div>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmSecondary}
                onClick={() => setRouteConfirmDraft(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmPrimary}
                onClick={handleRouteConfirm}
                disabled={routeSingleItem.isPending}
              >
                {routeSingleItem.isPending ? 'Подождите...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelConfirmOpen && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="cancel-title" onClick={() => setCancelConfirmOpen(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle} id="cancel-title">Отменить заказ?</div>
            <div className={styles.confirmText}>Заказ #{order.orderNumber} будет переведён в статус «Отменён». Это действие можно отменить через «Восстановить заказ».</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setCancelConfirmOpen(false)}>Не отменять</button>
              <button type="button" className={styles.confirmDanger} onClick={() => { setCancelConfirmOpen(false); changeStatus.mutate({ id: order.id, status: 'cancelled' }); }} disabled={changeStatus.isPending}>Да, отменить</button>
            </div>
          </div>
        </div>
      )}

      {restorePromptOpen && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="restore-title">
          <div className={styles.confirmDialog}>
            <div className={styles.confirmTitle} id="restore-title">{order.status === 'cancelled' ? 'Восстановить заказ?' : 'Убрать заказ из архива?'}</div>
            <div className={styles.confirmText}>{order.status === 'cancelled' ? 'Заказ вернётся в статус "Новый".' : 'Заказ снова станет обычным активным заказом.'}</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setRestorePromptOpen(false)}>Отмена</button>
              <button type="button" className={styles.confirmPrimary} onClick={() => { setRestorePromptOpen(false); restoreOrder.mutate({ id: order.id, status: order.status }); }} disabled={restoreOrder.isPending}>Восстановить</button>
            </div>
          </div>
        </div>
      )}

      {reassignOpen && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="reassign-title" onClick={() => setReassignOpen(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className={styles.confirmTitle} id="reassign-title">Переназначить менеджера</div>
            <div className={styles.confirmText} style={{ marginBottom: 4 }}>
              Текущий менеджер: <strong>{order.managerName ?? 'Не указан'}</strong>
            </div>
            <div className={styles.confirmText} style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
              Действие будет зафиксировано в истории заказа.
            </div>
            <select
              value={selectedNewManagerId}
              onChange={(e) => setSelectedNewManagerId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <option value="">— Выберите менеджера —</option>
              {(orgManagers ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.role === 'owner' ? ' (Владелец)' : m.role === 'admin' ? ' (Адм.)' : ''}
                </option>
              ))}
            </select>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setReassignOpen(false)}>Отмена</button>
              <button
                type="button"
                className={styles.confirmPrimary}
                disabled={!selectedNewManagerId || selectedNewManagerId === order.managerId || reassignManager.isPending}
                onClick={() => {
                  if (!selectedNewManagerId) return;
                  reassignManager.mutate(
                    { orderId: order.id, managerId: selectedNewManagerId },
                    { onSuccess: () => setReassignOpen(false) },
                  );
                }}
              >
                {reassignManager.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
