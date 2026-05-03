import { useDeferredValue, useEffect, useRef, useState, type CSSProperties, type ElementType } from 'react';
import { AlertTriangle, Bell, Check, CheckCheck, CheckCircle2, CheckSquare, Clock, Download, Eye, FileText, LayoutGrid, Layers, List, Plus, RotateCcw, Search, Star, Warehouse, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useArchiveOrder, useChangeOrderStatus, useConfirmSeamstress, useCreateInvoice, useOrders, usePreviewInvoiceDocument, useInvoices } from '../../../../entities/order/queries';
import type { ChapanOrder, InvoiceDocumentPayload, OrderStatus, Priority, Urgency } from '../../../../entities/order/types';
import { useAuthStore } from '@/shared/stores/auth';
import { buildItemLine } from '../../../../shared/utils/itemLine';
import { useChapanUiStore } from '../../../../features/workzone/chapan/store';
import ChapanInvoicePreviewModal from '../invoices/ChapanInvoicePreviewModal';
import styles from './ChapanReady.module.css';

type ReadyStatus = Extract<OrderStatus, 'confirmed' | 'in_production' | 'ready'>;
type ViewMode = 'grid' | 'list';
type ReadyOrder = ChapanOrder & { status: ReadyStatus };
type DisplayGroup =
  | { kind: 'single'; order: ReadyOrder }
  | { kind: 'batch'; orders: ReadyOrder[] };

const STATUS_LABEL: Record<ReadyStatus, string> = {
  confirmed: 'Частично готово',
  in_production: 'Частично готово',
  ready: 'Готово',
};


const STATUS_COLOR: Record<ReadyStatus, string> = {
  confirmed: '#8B5CF6',
  in_production: '#E5922A',
  ready: '#4FC999',
};

const URGENCY_LABEL = 'Срочно';
const DEMANDING_LABEL = 'Требовательный';

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

const VIEW_OPTIONS: { key: ViewMode; label: string; icon: ElementType }[] = [
  { key: 'grid', label: 'Плитки', icon: LayoutGrid },
  { key: 'list', label: 'Список', icon: List },
];

const BATCH_WINDOW_DAYS = 2;


function viewStorageKey(userId?: string) {
  return `chapan_ready_view_${userId ?? 'guest'}`;
}

function groupStorageKey(userId?: string) {
  return `chapan_ready_grouped_${userId ?? 'guest'}`;
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value)} ₸`;
}

function formatDate(value: string | null) {
  if (!value) return 'Без даты';
  return new Date(value).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

function getOrderBalance(order: Pick<ChapanOrder, 'totalAmount' | 'paidAmount'>) {
  return Math.max(0, order.totalAmount - order.paidAmount);
}

function isOverdue(date: string | null) {
  return !!date && new Date(date) < new Date();
}

function hasPendingProduction(order: ReadyOrder): boolean {
  return (order.productionTasks ?? []).some(task => task.status !== 'done');
}

function getItemTaskMap(order: ReadyOrder) {
  return new Map(
    (order.productionTasks ?? []).map(task => [task.orderItemId, task])
  );
}

function hasWarehouseFulfillment(order: ChapanOrder): boolean {
  return (order.items ?? []).some(item => item.fulfillmentMode === 'warehouse');
}

function hasPendingRouting(order: ReadyOrder): boolean {
  return (order.items ?? []).some(item => !item.fulfillmentMode || item.fulfillmentMode === 'unassigned');
}

function pendingRoutingCount(order: ReadyOrder): number {
  return (order.items ?? []).filter(item => !item.fulfillmentMode || item.fulfillmentMode === 'unassigned').length;
}

function getRejectedInvoice(order: ReadyOrder) {
  return order.invoiceOrders?.find(io => io.invoice?.status === 'rejected')?.invoice ?? null;
}

function buildItemSignature(orderItem: ChapanOrder['items'][number]) {
  return [
    orderItem.productName?.toLowerCase().trim() ?? '',
    orderItem.size?.toLowerCase().trim() ?? '',
    String(orderItem.quantity ?? 0),
    String(orderItem.unitPrice ?? 0),
  ].join('|');
}

function groupSignature(order: ChapanOrder) {
  return [
    ...(order.items ?? []).map(buildItemSignature).sort(),
    order.status,
    order.urgency ?? order.priority,
    String(order.isDemandingClient ?? (order.priority === 'vip')),
    order.paymentStatus,
    order.requiresInvoice ? 'invoice' : 'direct',
  ].join('|');
}

function buildGroups(orders: ReadyOrder[]): DisplayGroup[] {
  const buckets = new Map<string, ReadyOrder[]>();

  for (const order of orders) {
    const key = groupSignature(order);
    buckets.set(key, [...(buckets.get(key) ?? []), order]);
  }

  const result: DisplayGroup[] = [];

  for (const [, bucket] of buckets) {
    if (bucket.length === 1) {
      result.push({ kind: 'single', order: bucket[0] });
      continue;
    }

    const withDate = bucket
      .filter((order) => order.dueDate)
      .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
    const withoutDate = bucket.filter((order) => !order.dueDate);
    const clusters: ReadyOrder[][] = [];
    let current: ReadyOrder[] = [];

    for (const order of withDate) {
      if (!current.length) {
        current.push(order);
        continue;
      }

      const diffDays = (+new Date(order.dueDate!) - +new Date(current[0].dueDate!)) / 86_400_000;
      if (diffDays <= BATCH_WINDOW_DAYS) current.push(order);
      else {
        clusters.push(current);
        current = [order];
      }
    }

    if (current.length) clusters.push(current);
    if (withoutDate.length) clusters.push(withoutDate);

    for (const cluster of clusters) {
      if (cluster.length === 1) result.push({ kind: 'single', order: cluster[0] });
      else result.push({ kind: 'batch', orders: cluster });
    }
  }

  return result;
}

function buildOrderSelectionKey(orderIds: string[]) {
  return [...orderIds].sort().join('|');
}

function getStageActionLabel(_status: ReadyStatus) {
  return 'На склад';
}

function getNextStage(_status: ReadyStatus): string | null {
  return 'on_warehouse';
}

export default function ChapanReadyPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const membershipRole = useAuthStore((state) => state.membership.role);
  const employeePermissions = useAuthStore((state) => state.user?.employee_permissions ?? []);

  const isWorkshopUser =
    employeePermissions.includes('production')
    && membershipRole !== 'owner'
    && membershipRole !== 'admin';

  const [search, setSearch] = useState('');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(viewStorageKey(userId));
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });
  const [grouped, setGroupedState] = useState(() => {
    const saved = localStorage.getItem(groupStorageKey(userId));
    return saved !== null ? saved !== 'false' : true;
  });
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workshopBlockedOrders, setWorkshopBlockedOrders] = useState<string[] | null>(null);
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false);
  const [batchPreviewDocument, setBatchPreviewDocument] = useState<InvoiceDocumentPayload | null>(null);
  const [batchPreviewSelectionKey, setBatchPreviewSelectionKey] = useState('');
  const [detailOrder, setDetailOrder] = useState<ReadyOrder | null>(null);
  const openInvoicesDrawer = useChapanUiStore((s) => s.openInvoicesDrawer);
  const { data: pendingData } = useInvoices({ status: 'pending_confirmation', limit: 1 });
  const pendingCount = pendingData?.count ?? 0;
  const viewPickerRef = useRef<HTMLDivElement>(null);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!showViewMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!viewPickerRef.current?.contains(event.target as Node)) {
        setShowViewMenu(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showViewMenu]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    setShowViewMenu(false);
    localStorage.setItem(viewStorageKey(userId), mode);
  };

  const toggleGrouped = () => {
    setGroupedState((value) => {
      localStorage.setItem(groupStorageKey(userId), String(!value));
      return !value;
    });
  };

  const { data: readyData, isLoading: readyLoading, isError: readyError } = useOrders({
    archived: false,
    statuses: 'ready',
    search: deferredSearch || undefined,
    limit: 200,
  });
  const { data: partialData, isLoading: partialLoading, isError: partialError } = useOrders({
    archived: false,
    statuses: 'confirmed,in_production',
    search: deferredSearch || undefined,
    limit: 200,
  });

  const changeStatus = useChangeOrderStatus();
  const archiveOrder = useArchiveOrder();
  const createInvoice = useCreateInvoice();
  const confirmSeamstress = useConfirmSeamstress();
  const previewInvoiceDocument = usePreviewInvoiceDocument();

  const isLoading = readyLoading || partialLoading;
  const isError = readyError || partialError;

  const orderMap = new Map<string, ReadyOrder>();
  for (const order of readyData?.results ?? []) {
    if (order.status === 'ready') {
      orderMap.set(order.id, order as ReadyOrder);
    }
  }
  for (const order of partialData?.results ?? []) {
    if (
      (order.status === 'confirmed' || order.status === 'in_production') &&
      (hasWarehouseFulfillment(order) || (order.productionTasks ?? []).some(t => t.status === 'done'))
    ) {
      orderMap.set(order.id, order as ReadyOrder);
    }
  }
  const orders = [...orderMap.values()];

  const displayGroups = grouped
    ? buildGroups(orders)
    : orders.map((order) => ({ kind: 'single' as const, order }));

  async function advanceOrders(targetOrders: ReadyOrder[]) {
    for (const order of targetOrders) {
      const nextStatus = getNextStage(order.status);
      if (nextStatus) {
        await changeStatus.mutateAsync({ id: order.id, status: nextStatus });
        await archiveOrder.mutateAsync(order.id);
      }
    }
  }

  async function dispatchReadyOrders(targetOrders: ReadyOrder[], onSuccess?: () => void) {
    const pendingWorkshop = targetOrders.filter(o => hasPendingProduction(o));
    if (pendingWorkshop.length > 0) {
      setWorkshopBlockedOrders(pendingWorkshop.map(o => `#${o.orderNumber}`));
      return;
    }

    const requiresInvoice = targetOrders.some((order) => order.requiresInvoice);
    const draftDocument = getDraftDocumentForOrders(targetOrders);

    if (requiresInvoice) {
      const invoice = await createInvoice.mutateAsync({
        orderIds: targetOrders.map((order) => order.id),
        documentPayload: draftDocument,
      });
      await confirmSeamstress.mutateAsync(invoice.id);
      openInvoicesDrawer('pending_confirmation');
    } else {
      await advanceOrders(targetOrders);
    }

    onSuccess?.();
  }

  function handleAdvance(order: ReadyOrder) {
    void dispatchReadyOrders([order]);
  }

  function handleAdvanceMany(batchOrders: ReadyOrder[]) {
    void dispatchReadyOrders(batchOrders);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectMany(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const selectedOrderIds = selectedOrders.map((order) => order.id);
  const selectedOrderKey = buildOrderSelectionKey(selectedOrderIds);

  function getDraftDocumentForOrders(targetOrders: ReadyOrder[]) {
    const targetKey = buildOrderSelectionKey(targetOrders.map((order) => order.id));
    return targetKey !== '' && targetKey === batchPreviewSelectionKey
      ? batchPreviewDocument ?? undefined
      : undefined;
  }

  function handleTransferToWarehouse() {
    return void dispatchReadyOrders(selectedOrders, exitSelectMode);
  }

  async function handleBatchInvoiceDownload() {
    const { apiClient } = await import('../../../../shared/api/client');
    try {
      const response = await apiClient.post('/chapan/orders/batch-invoice', {
        orderIds: [...selectedIds],
        style: 'branded',
        currency: useAuthStore.getState().org?.currency ?? 'KZT',
        documentPayload: getDraftDocumentForOrders(selectedOrders),
      }, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nakladnaya-batch-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
  }

  async function handleOpenBatchPreview() {
    if (selectedOrderIds.length === 0) return;

    if (!batchPreviewDocument || batchPreviewSelectionKey !== selectedOrderKey) {
      const document = await previewInvoiceDocument.mutateAsync({ orderIds: selectedOrderIds });
      setBatchPreviewDocument(document);
      setBatchPreviewSelectionKey(selectedOrderKey);
    }

    setBatchPreviewOpen(true);
  }

  const currentView = VIEW_OPTIONS.find((option) => option.key === viewMode)!;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <CheckCheck size={18} />
          <span>Готовые заказы</span>
        </div>
        <div className={styles.headerSub}>Формирование накладных и передача на склад</div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Номер, клиент, изделие..."
          />
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.viewPickerWrap} ref={viewPickerRef}>
            <button
              className={`${styles.viewBtn} ${showViewMenu ? styles.viewBtnOpen : ''}`}
              onClick={() => setShowViewMenu((value) => !value)}
            >
              <currentView.icon size={13} />
              <span>Вид</span>
            </button>

            {showViewMenu && (
              <div className={styles.viewMenu}>
                <div className={styles.viewMenuTitle}>Отображение</div>
                {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    className={`${styles.viewMenuItem} ${viewMode === key ? styles.viewMenuItemActive : ''}`}
                    onClick={() => setViewMode(key)}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                    {viewMode === key && <Check size={11} className={styles.viewMenuCheck} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`${styles.groupToggle} ${grouped ? styles.groupToggleActive : ''}`}
            onClick={toggleGrouped}
          >
            <Layers size={13} />
            <span>Группировать</span>
          </button>

          <button
            className={`${styles.groupToggle} ${selectMode ? styles.selectToggleActive : ''}`}
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          >
            <CheckSquare size={13} />
            <span>Отметить</span>
          </button>

          <button
            className={styles.groupToggle}
            onClick={() => openInvoicesDrawer('pending_confirmation')}
          >
            <FileText size={13} />
            <span>Ожидает</span>
            {pendingCount > 0 && <span className={styles.pendingBadge}>{pendingCount}</span>}
          </button>
        </div>
      </div>

      {!isLoading && (
        <div className={styles.count}>
          {orders.length} заказов с готовыми позициями
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.skeleton} />
          ))}
        </div>
      )}

      {isError && <div className={styles.error}>Не удалось загрузить раздел «Готово»</div>}

      {!isLoading && !isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Пока пусто</div>
          <div className={styles.emptyText}>
            Как только по заказу появится хотя бы одна готовая позиция, он появится здесь.
          </div>
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        viewMode === 'grid' ? (
          <div className={styles.tableScrollWrap}>
            <div className={styles.tableHeader}>
              <div className={styles.tableHeaderCol} />
              <div className={styles.tableHeaderCol}>Заказ</div>
              <div className={styles.tableHeaderCol}>Клиент</div>
              <div className={styles.tableHeaderCol}>Изделия</div>
              <div className={styles.tableHeaderCol}>Оплата</div>
              <div className={styles.tableHeaderCol}>Сумма</div>
              <div className={styles.tableHeaderCol}>Дедлайн</div>
              <div className={styles.tableHeaderCol} />
            </div>
            <div className={styles.grid}>
              {displayGroups.map((group, index) => (
                group.kind === 'single' ? (
                  <ReadyCard
                    key={group.order.id}
                    order={group.order}
                    onAdvance={() => handleAdvance(group.order)}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(group.order.id)}
                    onToggleSelect={() => toggleSelect(group.order.id)}
                  />
                ) : (
                  <ReadyBatchCard
                    key={`batch-${index}`}
                    orders={group.orders}
                    onAdvance={() => handleAdvanceMany(group.orders)}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelectMany={() => toggleSelectMany(group.orders.map((o) => o.id))}
                  />
                )
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {displayGroups.map((group, index) => (
              group.kind === 'single' ? (
                <ReadyRow
                  key={group.order.id}
                  order={group.order}
                  onAdvance={() => handleAdvance(group.order)}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(group.order.id)}
                  onToggleSelect={() => toggleSelect(group.order.id)}
                />
              ) : (
                <ReadyBatchRow
                  key={`batch-row-${index}`}
                  orders={group.orders}
                  onAdvance={() => handleAdvanceMany(group.orders)}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelectMany={() => toggleSelectMany(group.orders.map((o) => o.id))}
                />
              )
            ))}
          </div>
        )
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className={styles.floatingBar}>
          <div className={styles.floatingLeft}>
            <span className={styles.floatingCount}>{selectedIds.size} выбрано</span>
            <button className={styles.floatingClear} onClick={exitSelectMode}>
              <X size={14} />
              Снять выбор
            </button>
          </div>
          <div className={styles.floatingRight}>
            <button
              className={styles.floatingAction}
              onClick={() => void handleOpenBatchPreview()}
              disabled={previewInvoiceDocument.isPending}
            >
              <Eye size={13} />
              {previewInvoiceDocument.isPending ? 'Preview...' : 'Просмотр'}
            </button>
            <button className={styles.floatingAction} onClick={handleBatchInvoiceDownload}>
              <Download size={13} />
              Накладная
            </button>
            <button
              className={`${styles.floatingAction} ${styles.floatingActionPrimary}`}
              onClick={handleTransferToWarehouse}
              disabled={createInvoice.isPending || selectedOrders.some(hasPendingProduction)}
            >
              <Warehouse size={13} />
              {selectedOrders.some(hasPendingProduction)
                ? 'Ждём цех'
                : createInvoice.isPending
                  ? 'Создание...'
                  : `На склад (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <ChapanInvoicePreviewModal
        open={batchPreviewOpen}
        onClose={() => setBatchPreviewOpen(false)}
        draftDocument={batchPreviewDocument}
        draftTitle={selectedOrderIds.length > 0 ? `${selectedOrderIds.length} выбранных заказов` : 'Новая накладная'}
        loading={previewInvoiceDocument.isPending}
        onDraftSave={async (document) => {
          setBatchPreviewDocument(document);
          setBatchPreviewSelectionKey(selectedOrderKey);
        }}
      />

      {workshopBlockedOrders && (
        <div className={styles.confirmOverlay} onClick={() => setWorkshopBlockedOrders(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>
              <Clock size={16} />
              Ждём цех
            </div>
            <div className={styles.confirmText}>
              Передача на склад невозможна — производство ещё не завершено:
              {workshopBlockedOrders.map((label) => (
                <div key={label} className={styles.unpaidLine}>{label}</div>
              ))}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmSecondary} onClick={() => setWorkshopBlockedOrders(null)}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOrder && (
        <ReadyProductionDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}

function ReadyProductionDetailModal({
  order,
  onClose,
}: {
  order: ReadyOrder;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span>#{order.orderNumber}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Status and deadline */}
          <div className={styles.detailSection}>
            <div className={styles.detailGrid}>
              <span className={styles.detailLabel}>Статус:</span>
              <span
                className={styles.statusBadge}
                style={{ color: STATUS_COLOR[order.status] }}
              >
                {STATUS_LABEL[order.status]}
              </span>

              {order.dueDate && (
                <>
                  <span className={styles.detailLabel}>Срок:</span>
                  <span className={styles.detailValue}>{formatDate(order.dueDate)}</span>
                </>
              )}
            </div>
          </div>

          {/* Order items with production status */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionLabel}>Позиции</div>
            {order.items && order.items.length > 0 ? (
              <div className={styles.itemsList}>
                {(() => {
                  const taskByItemId = getItemTaskMap(order);
                  return order.items.map((item) => {
                    const task = taskByItemId.get(item.id);
                    const mode = item.fulfillmentMode;
                    let statusLabel = '';
                    let statusColor = 'var(--text-secondary)';
                    if (task) {
                      if (task.status === 'done') { statusLabel = 'Готово'; statusColor = '#4FC999'; }
                      else if (task.status === 'in_progress') { statusLabel = 'В работе'; statusColor = '#E5922A'; }
                      else { statusLabel = 'В очереди'; statusColor = '#8B5CF6'; }
                    } else if (mode === 'warehouse') {
                      statusLabel = 'Склад'; statusColor = 'var(--text-secondary)';
                    } else if (!mode || mode === 'unassigned') {
                      statusLabel = 'Без маршрута'; statusColor = '#D94F4F';
                    }
                    return (
                      <div key={item.id} className={styles.itemRow}>
                        <div className={styles.itemName}>
                          {buildItemLine(item) || item.productName}
                        </div>
                        <div className={styles.itemMeta}>
                          <span>{item.size}</span>
                          <span>×{item.quantity}</span>
                          {statusLabel && <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>}
                        </div>
                        {item.workshopNotes && (
                          <div className={styles.itemNote}>{item.workshopNotes}</div>
                        )}
                        {task && (
                          <>
                            {task.assignedTo && (
                              <div className={styles.taskAssigned}>{task.assignedTo}</div>
                            )}
                            {task.notes && (
                              <div className={styles.taskNote}>
                                <span className={styles.noteLabel}>К заданию:</span>
                                {task.notes}
                              </div>
                            )}
                            {task.defects && (
                              <div className={styles.taskDefects}>
                                <span className={styles.noteLabel}>Дефекты:</span>
                                {task.defects}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className={styles.emptyMessage}>Нет позиций</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadyCard({
  order,
  onAdvance,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  order: ReadyOrder;
  onAdvance: () => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const firstItem = order.items?.[0];
  const moreItems = (order.items?.length ?? 0) - 1;
  const nextStageLabel = getStageActionLabel(order.status);
  const isPendingWorkshop = hasPendingProduction(order);
  const isPendingRouting = hasPendingRouting(order);
  const pendingCount = pendingRoutingCount(order);
  const rejectedInvoice = getRejectedInvoice(order);
  const hasPositionList = order.items.length > 1 && (order.productionTasks?.length ?? 0) > 0;

  const handleSelectToggle = () => {
    if (selectMode && onToggleSelect) onToggleSelect();
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as CSSProperties}
      onClick={handleSelectToggle}
    >
      {/* Col 1: select indicator */}
      <div className={`${styles.readyCell} ${styles.cellSelect}`}>
        {isSelected && <span className={styles.selectCheckmark}><Check size={13} /></span>}
      </div>

      {/* Col 2: order number + status */}
      <div className={`${styles.readyCell} ${styles.cellOrderNum}`}>
        <span className={styles.orderNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
      </div>

      {/* Col 3: client info + alert badges */}
      <div className={`${styles.readyCell} ${styles.cellClient}`}>
        <span className={styles.clientName}>{order.clientName}</span>
        {order.clientPhone && <span className={styles.phone}>{order.clientPhone}</span>}
        {(isPendingRouting || isPendingWorkshop || (order.urgency ?? order.priority) === 'urgent' || (order.isDemandingClient ?? order.priority === 'vip')) && (
          <div className={styles.badgeRow}>
            {isPendingRouting && <span className={styles.pendingRoutingBadge}><AlertTriangle size={9} /> {pendingCount} без маршрута</span>}
            {isPendingWorkshop && <span className={styles.workshopBadge}><Clock size={9} /> Ждём цех</span>}
            {(order.urgency ?? order.priority) === 'urgent' && <span className={styles.priorityBadge}><AlertTriangle size={9} /> {URGENCY_LABEL}</span>}
            {(order.isDemandingClient ?? (order.priority === 'vip')) && <span className={styles.priorityBadge}><Star size={9} /> {DEMANDING_LABEL}</span>}
          </div>
        )}
      </div>

      {/* Col 4: first item summary */}
      <div className={`${styles.readyCell} ${styles.cellItems}`}>
        {firstItem && (
          <>
            <span className={styles.itemName}>{buildItemLine(firstItem)}</span>
            <span className={styles.itemMeta}>{firstItem.size}{firstItem.quantity > 1 && ` × ${firstItem.quantity}`}</span>
          </>
        )}
        {moreItems > 0 && <span className={styles.itemMore}>+ ещё {moreItems}</span>}
      </div>

      {/* Col 5: payment status */}
      <div className={`${styles.readyCell} ${styles.cellPayment}`}>
        <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>

      {/* Col 6: total amount */}
      <div className={`${styles.readyCell} ${styles.cellAmount}`}>
        <span className={styles.amount}>{formatMoney(order.totalAmount)}</span>
      </div>

      {/* Col 7: deadline */}
      <div className={`${styles.readyCell} ${styles.cellDeadline}`}>
        <span className={styles.deadline} style={{ color: isOverdue(order.dueDate) ? '#D94F4F' : undefined }}>
          {formatDate(order.dueDate)}
        </span>
      </div>

      {/* Col 8: action */}
      <div className={`${styles.readyCell} ${styles.cellAction}`} onClick={(e) => e.stopPropagation()}>
        {!selectMode && (
          rejectedInvoice ? (
            <button
              className={styles.primaryAction}
              onClick={onAdvance}
              disabled={isPendingWorkshop || isPendingRouting}
              style={{ background: '#D94F4F', borderColor: 'rgba(217,79,79,.4)', color: '#fff' }}
            >
              <RotateCcw size={13} /> Переправить
            </button>
          ) : (
            <button className={styles.primaryAction} onClick={onAdvance} disabled={isPendingWorkshop || isPendingRouting}>
              {isPendingRouting ? 'Назначьте маршрут' : isPendingWorkshop ? 'Ждём цех' : nextStageLabel}
            </button>
          )
        )}
      </div>

      {/* Secondary row: rejected invoice detail */}
      {rejectedInvoice && (
        <div className={styles.rejectedBannerRow}>
          <XCircle size={13} />
          <span>Склад отклонил накладную {rejectedInvoice.invoiceNumber}</span>
          {rejectedInvoice.rejectionReason && (
            <span className={styles.rejectedReason}>— {rejectedInvoice.rejectionReason}</span>
          )}
        </div>
      )}

      {/* Secondary row: per-item production status */}
      {hasPositionList && (() => {
        const taskByItemId = getItemTaskMap(order);
        return (
          <div className={styles.positionListRow}>
            {order.items.map((item) => {
              const task = taskByItemId.get(item.id);
              const mode = item.fulfillmentMode;
              let label = 'Без маршрута';
              let color = 'var(--text-secondary)';
              if (task) {
                if (task.status === 'done') { label = 'Готово'; color = '#4FC999'; }
                else if (task.status === 'in_progress') { label = 'В работе'; color = '#E5922A'; }
                else { label = 'В очереди'; color = '#8B5CF6'; }
              } else if (mode === 'warehouse') {
                label = 'Склад'; color = 'var(--text-secondary)';
              }
              return (
                <div key={item.id} className={styles.positionRow}>
                  <span className={styles.positionName}>{buildItemLine(item) || item.productName}</span>
                  <span className={styles.positionStatus} style={{ color }}>{label}</span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

function ReadyBatchCard({
  orders,
  onAdvance,
  selectMode,
  selectedIds,
  onToggleSelectMany,
}: {
  orders: ReadyOrder[];
  onAdvance: () => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelectMany?: () => void;
}) {
  const firstOrder = orders[0];
  const firstItem = firstOrder.items?.[0];
  const totalQuantity = orders.reduce(
    (sum, order) => sum + (order.items ?? []).reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const nextStageLabel = getStageActionLabel(firstOrder.status);
  const allSelected = selectedIds ? orders.every((o) => selectedIds.has(o.id)) : false;
  const anyPendingWorkshop = orders.some(hasPendingProduction);
  const anyPendingRouting = orders.some(hasPendingRouting);

  const handleSelectToggle = selectMode && onToggleSelectMany ? onToggleSelectMany : undefined;

  return (
    <div
      className={`${styles.batchCard} ${allSelected ? styles.cardSelected : ''}`}
      style={{ '--status-color': STATUS_COLOR[firstOrder.status] } as CSSProperties}
      onClick={handleSelectToggle}
    >
      <div className={styles.batchHead}>
        {allSelected && <Check size={14} className={styles.rowCheckmark} />}
        <span className={styles.batchCount}>{orders.length}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[firstOrder.status]}</span>
      </div>

      {firstItem && (
        <div className={styles.batchProduct}>
          <span className={styles.itemName}>{buildItemLine(firstItem)}</span>
          <span className={styles.itemMeta}>{firstItem.size ?? ''}</span>
        </div>
      )}

      {orders.length <= 3 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {orders.map((o) => (
            <span key={o.id} style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>
              #{o.orderNumber}
            </span>
          ))}
        </div>
      )}

      <div className={styles.batchMeta}>
        <span>{totalQuantity} шт.</span>
        <span>{formatDate(firstOrder.dueDate)}</span>
      </div>

      {!selectMode && (
        <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
          <button className={styles.primaryAction} onClick={onAdvance} disabled={anyPendingWorkshop || anyPendingRouting}>
            {anyPendingRouting ? 'Назначьте маршрут' : anyPendingWorkshop ? 'Ждём цех' : `На склад ×${orders.length}`}
          </button>
        </div>
      )}
    </div>
  );
}

function ReadyRow({
  order,
  onAdvance,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  order: ReadyOrder;
  onAdvance: () => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const firstItem = order.items?.[0];
  const nextStageLabel = getStageActionLabel(order.status);
  const isPendingWorkshop = hasPendingProduction(order);
  const isPendingRouting = hasPendingRouting(order);
  const pendingCount = pendingRoutingCount(order);
  const rejectedInvoice = getRejectedInvoice(order);

  const handleSelectToggle = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect();
    }
  };

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as CSSProperties}
      onClick={handleSelectToggle}
    >
      <span className={styles.rowStripe} />
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          {isSelected && <Check size={13} className={styles.rowCheckmark} />}
          <span className={styles.itemName}>{buildItemLine(firstItem) || 'Без позиции'}{order.items.length > 1 && ` +${order.items.length - 1}`}</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
          {isPendingRouting && (
            <span className={styles.pendingRoutingBadge}><AlertTriangle size={10} /> {pendingCount} без маршрута</span>
          )}
          {isPendingWorkshop && (
            <span className={styles.workshopBadge}><Clock size={10} /> Ждём цех</span>
          )}
          <span className={styles.payBadge} style={{ color: PAY_COLOR[order.paymentStatus] }}>
            {PAY_LABEL[order.paymentStatus]}
          </span>
        </div>
        {rejectedInvoice && (
          <div className={styles.rejectedInvoiceBanner}>
            <XCircle size={14} />
            <span>Склад отклонил накладную {rejectedInvoice.invoiceNumber}</span>
            {rejectedInvoice.rejectionReason && (
              <span className={styles.rejectedReason}>Причина: {rejectedInvoice.rejectionReason}</span>
            )}
          </div>
        )}
        <div className={styles.rowClient}>{order.clientName}</div>
        <div className={styles.rowMeta}>
          <span className={styles.orderNumberSecondary}>#{order.orderNumber}</span>
          <span>{formatMoney(order.totalAmount)}</span>
          <span>{formatDate(order.dueDate)}</span>
          {order.productionTasks && order.productionTasks.length > 0 && (() => {
            const done = order.productionTasks.filter(t => t.status === 'done').length;
            const total = order.productionTasks.length;
            const color = done === total ? '#4FC999' : done > 0 ? '#E5922A' : '#8B5CF6';
            return <span style={{ color, fontWeight: 500 }}>{done}/{total} гот.</span>;
          })()}
        </div>
      </div>

      {!selectMode && (
        <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
          {rejectedInvoice ? (
            <button
              className={styles.primaryAction}
              onClick={onAdvance}
              disabled={isPendingWorkshop || isPendingRouting}
              style={{ background: '#D94F4F' }}
              title={`Переправить накладную #${rejectedInvoice.invoiceNumber}`}
            >
              <RotateCcw size={14} style={{ marginRight: 4 }} />
              Переправить
            </button>
          ) : (
            <button className={styles.primaryAction} onClick={onAdvance} disabled={isPendingWorkshop || isPendingRouting}>
              {isPendingRouting ? 'Назначьте маршрут' : isPendingWorkshop ? 'Ждём цех' : nextStageLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReadyBatchRow({
  orders,
  onAdvance,
  selectMode,
  selectedIds,
  onToggleSelectMany,
}: {
  orders: ReadyOrder[];
  onAdvance: () => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelectMany?: () => void;
}) {
  const firstOrder = orders[0];
  const firstItem = firstOrder.items?.[0];
  const nextStageLabel = getStageActionLabel(firstOrder.status);
  const allSelected = selectedIds ? orders.every((o) => selectedIds.has(o.id)) : false;
  const anyPendingWorkshop = orders.some(hasPendingProduction);
  const anyPendingRouting = orders.some(hasPendingRouting);

  const handleSelectToggle = selectMode && onToggleSelectMany ? onToggleSelectMany : undefined;

  return (
    <div className={styles.batchRowWrap}>
      <div
        className={`${styles.row} ${allSelected ? styles.rowSelected : ''}`}
        style={{ '--status-color': STATUS_COLOR[firstOrder.status] } as CSSProperties}
        onClick={handleSelectToggle}
      >
        <span className={styles.rowStripe} />
        <div className={styles.rowMain}>
          <div className={styles.rowTop}>
            {allSelected && <Check size={13} className={styles.rowCheckmark} />}
            <span className={styles.batchCount}>{orders.length}</span>
            <span className={styles.statusBadge}>{STATUS_LABEL[firstOrder.status]}</span>
          </div>
          <div className={styles.rowClient}>{firstItem?.productName ?? 'Без позиции'}</div>
          <div className={styles.rowMeta}>
            <span>{orders.length} заказов</span>
            <span>{formatDate(firstOrder.dueDate)}</span>
          </div>
        </div>

        {!selectMode && (
          <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
            <button className={styles.primaryAction} onClick={onAdvance} disabled={anyPendingWorkshop || anyPendingRouting}>
              {anyPendingRouting ? 'Назначьте маршрут' : anyPendingWorkshop ? 'Ждём цех' : `На склад ×${orders.length}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
