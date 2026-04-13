import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronLeft, ChevronRight, FlaskConical, LayoutGrid, Layers, List, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useCreateOrder, useOrders, useOrderWarehouseStates, useTrashOrder, useOrgManagers } from '../../../../entities/order/queries';
import { toast } from 'sonner';
import type { ChapanOrder, OrderStatus, OrderWarehouseState } from '../../../../entities/order/types';
import { useProductsAvailability } from '../../../../entities/warehouse/queries';
import type { ProductsAvailabilityMap } from '../../../../entities/warehouse/types';
import { useAuthStore } from '../../../../shared/stores/auth';
import { useEmployeePermissions } from '../../../../shared/hooks/useEmployeePermissions';
import { buildItemLine } from '../../../../shared/utils/itemLine';
import { useChapanUiStore } from '../../../../features/workzone/chapan/store';
import { useUnpaidAlerts } from '../../../../entities/alert/queries';
import OrderDetailDrawer from './OrderDetailDrawer';
import styles from './ChapanOrders.module.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый', confirmed: 'Подтверждён', in_production: 'В цехе',
  ready: 'Готов', transferred: 'Передан', on_warehouse: 'На складе',
  shipped: 'Отправлен', completed: 'Завершён', cancelled: 'Отменён',
};

const ACTIVE_STATUSES: OrderStatus[] = ['new', 'confirmed', 'in_production', 'ready', 'shipped'];
const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#7C3AED', confirmed: '#3B82F6', in_production: '#F59E0B',
  ready: '#10B981', transferred: '#8B5CF6', on_warehouse: '#8B5CF6',
  shipped: '#3B82F6', completed: '#4A5268',
  cancelled: '#EF4444',
};
const PAY_LABEL: Record<string, string> = { not_paid: 'Не оплачен', partial: 'Частично', paid: 'Оплачен' };
const PAY_COLOR: Record<string, string> = { not_paid: '#EF4444', partial: '#F59E0B', paid: '#10B981' };
const URGENCY_LABEL: Record<string, string> = { normal: '', urgent: '🔴 Срочно' };
const DEMANDING_LABEL = '⭐ Требовательный';

function fmt(n: number) { return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸'; }
function isOverdue(d: string | null) { return !!d && new Date(d) < new Date(); }
function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

function getWarehouseBadge(state?: OrderWarehouseState) {
  if (!state) return null;

  if (state.documentSummary.shipment > 0) {
    return { label: `shipment ${state.documentSummary.shipment}`, tone: 'in' as const };
  }

  if (state.reservationSummary.active > 0) {
    return { label: `резерв ${state.reservationSummary.qtyReserved}`, tone: 'in' as const };
  }

  if (state.documentSummary.handoff > 0 || state.site?.code) {
    return { label: state.site?.code ? `site ${state.site.code}` : 'warehouse linked', tone: 'in' as const };
  }

  return null;
}

const ORDER_MONEY_FORMATTER = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });
const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat('ru-KZ', { day: '2-digit', month: 'short' });


type ViewMode = 'grid' | 'list';

const VIEW_OPTIONS: { key: ViewMode; label: string; Icon: React.ElementType }[] = [
  { key: 'grid', label: 'Плитки', Icon: LayoutGrid },
  { key: 'list', label: 'Список', Icon: List },
];

function viewStorageKey(userId?: string) { return `chapan_orders_view_${userId ?? 'guest'}`; }
function groupStorageKey(userId?: string) { return `chapan_orders_grouped_${userId ?? 'guest'}`; }

function handleClickableKey(event: React.KeyboardEvent, onActivate: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onActivate();
}

// ── Grouping logic ────────────────────────────────────────────────────────────

const BATCH_WINDOW_DAYS = 2;

type DisplayGroup =
  | { kind: 'single'; order: ChapanOrder }
  | { kind: 'batch'; orders: ChapanOrder[] };

function itemSignature(item: ChapanOrder['items'][number]) {
  return [
    item.productName?.toLowerCase().trim() ?? '',
    item.fabric?.toLowerCase().trim() ?? '',
    item.size?.toLowerCase().trim() ?? '',
    String(item.quantity ?? 0),
    String(item.unitPrice ?? 0),
  ].join('|');
}

function groupSignature(order: ChapanOrder): string {
  if (!order.items?.length) return `@@${order.id}`;
  return [
    ...(order.items).map(itemSignature).sort(),
    order.status,
    order.urgency ?? order.priority,
    String(order.isDemandingClient ?? (order.priority === 'vip')),
  ].join('||');
}

function buildGroups(orders: ChapanOrder[]): DisplayGroup[] {
  const buckets = new Map<string, ChapanOrder[]>();
  for (const o of orders) {
    const key = groupSignature(o);
    const arr = buckets.get(key) ?? [];
    arr.push(o);
    buckets.set(key, arr);
  }
  const result: DisplayGroup[] = [];
  for (const [, bucket] of buckets) {
    if (bucket.length === 1) { result.push({ kind: 'single', order: bucket[0] }); continue; }
    const withDate = bucket.filter(o => o.dueDate).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
    const noDate = bucket.filter(o => !o.dueDate);
    const clusters: ChapanOrder[][] = [];
    let cur: ChapanOrder[] = [];
    for (const o of withDate) {
      if (!cur.length) { cur.push(o); continue; }
      if ((+new Date(o.dueDate!) - +new Date(cur[0].dueDate!)) / 86_400_000 <= BATCH_WINDOW_DAYS) {
        cur.push(o);
      } else {
        clusters.push(cur); cur = [o];
      }
    }
    if (cur.length) clusters.push(cur);
    if (noDate.length) clusters.push(noDate);
    for (const c of clusters) {
      if (c.length === 1) result.push({ kind: 'single', order: c[0] });
      else result.push({ kind: 'batch', orders: c });
    }
  }
  return result;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChapanOrdersPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const { selectedOrderId, setSelectedOrderId, orderFilters, setOrderFilters, resetOrderFilters } = useChapanUiStore();

  const { search, statusFilter, payFilter, managerFilter, calendarDate } = orderFilters;

  const setSearch = (val: string) => setOrderFilters({ search: val });
  const setStatusFilter = (val: string) => setOrderFilters({ statusFilter: val });
  const setPayFilter = (val: string) => setOrderFilters({ payFilter: val });
  const setManagerFilter = (val: string) => setOrderFilters({ managerFilter: val });
  const setCalendarDate = (val: Date | null) => setOrderFilters({ calendarDate: val });

  const [showFilters, setShowFilters] = useState(false);
  const { data: orgManagers } = useOrgManagers();
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [grouped, setGroupedState] = useState(true);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [isSeedingOrders, setIsSeedingOrders] = useState(false);
  const createOrder = useCreateOrder();
  const viewPickerRef = useRef<HTMLDivElement>(null);

  // Calendar filter state
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));

  const { isAbsolute } = useEmployeePermissions();
  const trashOrder = useTrashOrder();

  const handleTrash = (id: string) => {
    if (window.confirm('Переместить заказ в корзину?')) {
      trashOrder.mutate(id);
    }
  };

  const handleSeedOrders = async () => {
    setIsSeedingOrders(true);
    try {
      const isoDate = (offsetDays: number): string => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().slice(0, 10);
      };
      const silent = { onSuccess: () => {}, onError: () => {} };

      await Promise.all([
        createOrder.mutateAsync({
          idempotencyKey: crypto.randomUUID(),
          clientName: 'Скарлетт Йоханссон',
          clientPhone: '+77771111111',
          priority: 'normal',
          city: 'Алматы',
          deliveryType: 'pickup',
          source: 'instagram',
          urgency: 'normal',
          dueDate: isoDate(7),
          prepayment: 45000,
          paymentMethod: 'cash',
          items: [
            { productName: 'Пальто', size: 'M', gender: 'female', color: 'Чёрный', quantity: 1, unitPrice: 45000 },
          ],
        }, silent),

        createOrder.mutateAsync({
          idempotencyKey: crypto.randomUUID(),
          clientName: 'Дженнифер Лопес',
          clientPhone: '+77772222222',
          priority: 'urgent',
          city: 'Астана',
          deliveryType: 'post',
          deliveryFee: 2000,
          source: 'whatsapp',
          urgency: 'urgent',
          dueDate: isoDate(5),
          prepayment: 20000,
          paymentMethod: 'kaspi_terminal',
          items: [
            { productName: 'Платье', size: 'S', gender: 'female', color: 'Красный', quantity: 1, unitPrice: 32000 },
            { productName: 'Блуза', size: 'S', gender: 'female', color: 'Белый', quantity: 2, unitPrice: 8500 },
          ],
        }, silent),

        createOrder.mutateAsync({
          idempotencyKey: crypto.randomUUID(),
          clientName: 'Леонардо ДиКаприо',
          clientPhone: '+77773333333',
          priority: 'normal',
          city: 'Шымкент',
          deliveryType: 'train',
          deliveryFee: 3000,
          source: 'call',
          urgency: 'normal',
          dueDate: isoDate(14),
          items: [
            { productName: 'Пиджак', size: 'L', gender: 'male', color: 'Серый', quantity: 1, unitPrice: 55000 },
            { productName: 'Рубашка', size: 'L', gender: 'male', color: 'Белый', quantity: 2, unitPrice: 12000 },
            { productName: 'Брюки', size: 'L', gender: 'male', color: 'Чёрный', quantity: 1, unitPrice: 28000 },
          ],
        }, silent),
      ]);

      toast.success('3 тестовых заказа созданы');
    } catch {
      toast.error('Не удалось создать тестовые заказы');
    } finally {
      setIsSeedingOrders(false);
    }
  };

  const { data: alertsData } = useUnpaidAlerts();
  const alerts = useMemo(() => alertsData?.results ?? [], [alertsData?.results]);
  const activeAlertOrderIds = useMemo(() => new Set(alerts.map((a) => a.orderId)), [alerts]);

  const deferred = useDeferredValue(search);
  const hasActiveFilters = Boolean(search || statusFilter || payFilter || managerFilter || calendarDate);

  useEffect(() => {
    const savedView = localStorage.getItem(viewStorageKey(userId));
    if (savedView === 'grid' || savedView === 'list') setViewModeState(savedView);
    const savedGroup = localStorage.getItem(groupStorageKey(userId));
    if (savedGroup !== null) setGroupedState(savedGroup !== 'false');
  }, [userId]);

  // A1 fix: авторедирект убран — он вызывал цикл возврата.
  // selectedOrderId теперь очищается при входе в ChapanOrderDetail.

  useEffect(() => {
    if (!showViewMenu) return;
    const handle = (e: MouseEvent) => {
      if (!viewPickerRef.current?.contains(e.target as Node)) setShowViewMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showViewMenu]);

const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    setShowViewMenu(false);
    localStorage.setItem(viewStorageKey(userId), mode);
  };

  const toggleGrouped = () => {
    setGroupedState(v => {
      localStorage.setItem(groupStorageKey(userId), String(!v));
      return !v;
    });
  };

  const calendarDateFrom = useMemo(() => {
    if (!calendarDate) return undefined;
    const d = new Date(calendarDate);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [calendarDate]);

  const calendarDateTo = useMemo(() => {
    if (!calendarDate) return undefined;
    const d = new Date(calendarDate);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [calendarDate]);

  const { data, isLoading, isError } = useOrders({
    search: deferred || undefined,
    status: statusFilter || undefined,
    paymentStatus: payFilter || undefined,
    managerId: managerFilter || undefined,
    archived: false,
    limit: 200,
    createdFrom: calendarDateFrom,
    createdTo: calendarDateTo,
  });

  // Month orders: fetch entire month to mark days with orders
  const monthFrom = useMemo(() => {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [calendarMonth]);
  const monthTo = useMemo(() => {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [calendarMonth]);

  const { data: monthData } = useOrders({
    archived: false,
    limit: 500,
    createdFrom: monthFrom,
    createdTo: monthTo,
  });

  const daysWithOrders = useMemo(() => {
    const set = new Set<string>();
    for (const o of monthData?.results ?? []) {
      set.add(o.createdAt.slice(0, 10));
    }
    return set;
  }, [monthData?.results]);
  const orders: ChapanOrder[] = useMemo(() => {
    const raw = data?.results ?? [];
    // D1: urgent-заказы всегда наверху, внутри каждой группы — порядок сервера
    return [...raw].sort((a, b) => {
      const urgA = (a.urgency ?? a.priority) === 'urgent' ? 0 : 1;
      const urgB = (b.urgency ?? b.priority) === 'urgent' ? 0 : 1;
      return urgA - urgB;
    });
  }, [data?.results]);

  const newProductNames = useMemo(() => [
    ...new Set(
      orders
        .filter((o) => o.status === 'new' || o.status === 'confirmed')
        .flatMap((o) => (o.items ?? []).map((i) => i.productName).filter((n): n is string => !!n)),
    ),
  ], [orders]);
  const { data: stockMap } = useProductsAvailability(newProductNames);
  const orderIdsForWarehouseState = useMemo(() => orders.map((order) => order.id), [orders]);
  const { data: warehouseStatesData } = useOrderWarehouseStates(orderIdsForWarehouseState);
  const warehouseStatesByOrderId = useMemo(
    () => new Map((warehouseStatesData?.results ?? []).map((state) => [state.orderId, state] as const)),
    [warehouseStatesData?.results],
  );

  const showToolbarCreateButton =
    isLoading || isError || hasActiveFilters || (data?.count ?? 0) > 0;

  const displayGroups: DisplayGroup[] = useMemo(
    () => (grouped ? buildGroups(orders) : orders.map((order) => ({ kind: 'single', order }))),
    [grouped, orders],
  );
  const batchCount = useMemo(
    () => displayGroups.filter((group) => group.kind === 'batch').length,
    [displayGroups],
  );

  const currentView = useMemo(() => VIEW_OPTIONS.find((v) => v.key === viewMode)!, [viewMode]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Номер, клиент, модель..."
          />
        </div>
        <div className={styles.toolbarRight}>
          {/* View picker */}
          <div className={styles.viewPickerWrap} ref={viewPickerRef}>
            <button
              className={`${styles.viewBtn} ${showViewMenu ? styles.viewBtnOpen : ''}`}
              onClick={() => setShowViewMenu(v => !v)}
              title="Изменить вид отображения"
            >
              <currentView.Icon size={13} />
              <span>Вид</span>
            </button>
            {showViewMenu && (
              <div className={styles.viewMenu}>
                <div className={styles.viewMenuTitle}>Отображение</div>
                {VIEW_OPTIONS.map(({ key, label, Icon }) => (
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

          {/* Grouping toggle */}
          <button
            className={`${styles.groupToggle} ${grouped ? styles.groupToggleActive : ''}`}
            onClick={toggleGrouped}
            title={grouped ? 'Отключить группировку' : 'Группировать похожие заказы'}
          >
            <Layers size={13} />
            <span>Группировать</span>
            {grouped && batchCount > 0 && <span className={styles.groupDot}>{batchCount}</span>}
          </button>

          <button
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={13} /><span>Фильтры</span>
            {(statusFilter || payFilter || managerFilter || calendarDate) && <span className={styles.filterDot} />}
          </button>

          {/* Alerts bell icon */}
          <button
            className={styles.alertsBtn}
            onClick={() => setShowAlertsPanel(!showAlertsPanel)}
            title={alerts.length > 0 ? `${alerts.length} неоплаченных заказов` : 'Нет активных алертов'}
            style={{
              position: 'relative',
              padding: '6px 10px',
              borderRadius: '8px',
              background: alerts.length > 0 ? 'rgba(217, 79, 79, 0.1)' : 'transparent',
              border: alerts.length > 0 ? '1px solid rgba(217, 79, 79, 0.25)' : '1px solid transparent',
              color: alerts.length > 0 ? '#D94F4F' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 140ms',
            }}
          >
            <Bell size={13} />
            {alerts.length > 0 && <span>{alerts.length}</span>}
          </button>

          <button
            className={styles.filterToggle}
            onClick={() => {
              if (window.confirm('⚠️ Создать 3 тестовых заказа?\n\nУбедитесь, что вы не на продакшене.')) {
                handleSeedOrders();
              }
            }}
            disabled={isSeedingOrders}
            title="Создать 3 тестовых заказа"
          >
            <FlaskConical size={13} />
            <span>{isSeedingOrders ? '...' : 'Тест-данные'}</span>
          </button>

          {showToolbarCreateButton && (
            <button className={styles.newBtn} onClick={() => navigate('/workzone/chapan/orders/new')}>
              <Plus size={14} /> Новый заказ
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Статус</label>
            <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Все активные</option>
              {ACTIVE_STATUSES.map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Оплата</label>
            <select className={styles.filterSelect} value={payFilter} onChange={e => setPayFilter(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {orgManagers && orgManagers.length > 1 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Менеджер</label>
              <select className={styles.filterSelect} value={managerFilter} onChange={e => setManagerFilter(e.target.value)}>
                <option value="">Все</option>
                {orgManagers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div className={styles.filterGroupCalendar}>
            <label className={styles.filterLabel}>
              Дата оформления
              {calendarDate && (
                <span className={styles.filterCalendarSelected}>
                  {calendarDate.toLocaleDateString('ru-KZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
            </label>
            <MiniCalendar
              month={calendarMonth}
              selected={calendarDate}
              daysWithOrders={daysWithOrders}
              today={today}
              onSelectDay={(d) => {
                const isSame = calendarDate && d.toDateString() === calendarDate.toDateString();
                setCalendarDate(isSame ? null : d);
              }}
              onPrevMonth={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              onNextMonth={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            />
          </div>
          {(statusFilter || payFilter || managerFilter || calendarDate) && (
            <button className={styles.clearFilters} onClick={resetOrderFilters}>Сбросить</button>
          )}
        </div>
      )}

      {!isLoading && (
        <div className={styles.count}>
          {data?.count ?? 0} заказов
          {grouped && batchCount > 0 && <span className={styles.countBatch}> · {batchCount} групп</span>}
        </div>
      )}
      {isLoading && <div className={styles.loading}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className={styles.skeleton} />)}</div>}
      {isError && <div className={styles.error}>Не удалось загрузить заказы</div>}

      {!isLoading && !isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>{hasActiveFilters ? 'Ничего не найдено' : 'Заказов пока нет'}</div>
          <div className={styles.emptyText}>{hasActiveFilters ? 'Измените фильтры' : 'Создайте первый заказ'}</div>
          {!hasActiveFilters && (
            <button className={styles.emptyAction} onClick={() => navigate('/workzone/chapan/orders/new')}>+ Создать заказ</button>
          )}
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <div key={viewMode} className={styles.viewContent}>
          {viewMode === 'grid' ? (
            <div className={styles.grid}>
              {displayGroups.map((g, i) =>
                g.kind === 'single'
                  ? <OrderCard key={g.order.id} order={g.order} onSelectOrder={setSelectedOrderId} hasAlert={activeAlertOrderIds.has(g.order.id)} stockMap={stockMap} warehouseState={warehouseStatesByOrderId.get(g.order.id)} onTrash={handleTrash} />
                  : <BatchCard key={`batch-${i}`} group={g} onSelectOrder={setSelectedOrderId} />
              )}
            </div>
          ) : (
            <div className={styles.list}>
              {displayGroups.map((g, i) =>
                g.kind === 'single'
                  ? <OrderRow key={g.order.id} order={g.order} onSelectOrder={setSelectedOrderId} hasAlert={activeAlertOrderIds.has(g.order.id)} stockMap={stockMap} warehouseState={warehouseStatesByOrderId.get(g.order.id)} onTrash={handleTrash} />
                  : <BatchRow key={`batch-${i}`} group={g} onSelectOrder={setSelectedOrderId} />
              )}
            </div>
          )}
        </div>
      )}

      {selectedOrderId && <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} navigate={navigate} />}

      {/* Alerts panel */}
      {showAlertsPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0, 0, 0, 0.2)',
          }}
          onClick={() => setShowAlertsPanel(false)}
        >
          <div
            style={{
              position: 'fixed',
              top: '64px',
              right: '12px',
              width: 'min(360px, calc(100vw - 24px))',
              maxHeight: 'min(500px, calc(100dvh - 88px))',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              overflow: 'auto',
              zIndex: 41,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Неоплаченные заказы</span>
                <button
                  onClick={() => setShowAlertsPanel(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: '12px' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  Нет активных алертов
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      background: 'rgba(217, 79, 79, 0.08)',
                      border: '1px solid rgba(217, 79, 79, 0.25)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedOrderId(alert.orderId);
                      setShowAlertsPanel(false);
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                      {alert.orderNumber}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {alert.order.clientName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#D94F4F', fontWeight: 500 }}>
                      Остаток: {(alert.order.totalAmount - alert.order.paidAmount).toLocaleString('ru-KZ')} ₸
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating reset filter button */}
      {hasActiveFilters && (
        <button
          onClick={resetOrderFilters}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 16px',
            background: '#F59E0B',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 30,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
          title="Сбросить фильтры"
        >
          <span>✕</span>
          <span>Сбросить фильтр</span>
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function MiniCalendar({
  month,
  selected,
  daysWithOrders,
  today,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: {
  month: Date;
  selected: Date | null;
  daysWithOrders: Set<string>;
  today: Date;
  onSelectDay: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();

  // First day of month (0=Sun…6=Sat), shift to Mon-based (0=Mon…6=Sun)
  const firstDow = new Date(year, mon, 1).getDay();
  const startOffset = (firstDow + 6) % 7; // Mon=0

  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const selectedStr = selected ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}` : null;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full 6-row grid
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={styles.calendarDropdown}>
      <div className={styles.calendarHeader}>
        <button className={styles.calendarNavBtn} onClick={onPrevMonth}><ChevronLeft size={13} /></button>
        <span className={styles.calendarMonthLabel}>{MONTH_NAMES[mon]} {year}</span>
        <button className={styles.calendarNavBtn} onClick={onNextMonth}><ChevronRight size={13} /></button>
      </div>
      <div className={styles.calendarGrid}>
        {WEEKDAYS.map(w => (
          <div key={w} className={styles.calendarWeekday}>{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className={styles.calendarEmpty} />;
          const dayStr = `${year}-${String(mon + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isToday = dayStr === todayStr;
          const isSelected = dayStr === selectedStr;
          const hasOrders = daysWithOrders.has(dayStr);
          return (
            <button
              key={dayStr}
              className={[
                styles.calendarDay,
                isToday ? styles.calendarDayToday : '',
                isSelected ? styles.calendarDaySelected : '',
              ].join(' ')}
              onClick={() => onSelectDay(new Date(year, mon, day))}
              title={hasOrders ? `${day} — есть заказы` : String(day)}
            >
              <span>{day}</span>
              {hasOrders && <span className={styles.calendarDot} />}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className={styles.calendarFooter}>
          <button className={styles.calendarClear} onClick={() => onSelectDay(selected)}>
            <X size={11} /> Сбросить дату
          </button>
        </div>
      )}
    </div>
  );
}

// ── Single grid card ──────────────────────────────────────────────────────────

const OrderCard = memo(function OrderCard({ order, onSelectOrder, hasAlert, stockMap, warehouseState, onTrash }: { order: ChapanOrder; onSelectOrder: (id: string) => void; hasAlert?: boolean; stockMap?: ProductsAvailabilityMap; warehouseState?: OrderWarehouseState; onTrash?: (id: string) => void }) {
  const overdue = isOverdue(order.dueDate);
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;
  const showStock = (order.status === 'new' || order.status === 'confirmed') && !!first?.productName && !!stockMap;
  const stockInfo = showStock ? stockMap![first!.productName] : undefined;
  const isUrgent = (order.urgency ?? order.priority) === 'urgent';
  const isDemanding = order.isDemandingClient ?? (order.priority === 'vip');
  const warehouseBadge = getWarehouseBadge(warehouseState);

  return (
    <div
      className={`${styles.card} ${hasAlert ? styles.cardAlert : ''} ${isUrgent ? styles.cardUrgent : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
      role="button"
      tabIndex={0}
      onClick={() => onSelectOrder(order.id)}
      onKeyDown={(event) => handleClickableKey(event, () => onSelectOrder(order.id))}
    >
      {first && (
        <div className={styles.cardItems}>
          <span className={styles.cardItemName}>{buildItemLine(first)}</span>
          {(first.size) && (
            <span className={styles.cardItemMeta}>
              {[first.size, first.length ? `дл. ${first.length}` : ''].filter(Boolean).join(' · ')}
              {first.quantity > 1 && ` × ${first.quantity}`}
            </span>
          )}
          {more > 0 && <span className={styles.cardMoreItems}>+ещё {more}</span>}
        </div>
      )}
      <div className={styles.cardHead}>
        <span className={styles.cardOrderNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {isUrgent && (
          <span className={`${styles.priorityBadge} ${styles.urgent}`}>{URGENCY_LABEL['urgent']}</span>
        )}
        {isDemanding && (
          <span className={`${styles.priorityBadge} ${styles.vip}`}>{DEMANDING_LABEL}</span>
        )}
        {stockInfo !== undefined && (
          <span className={stockInfo.available ? styles.stockPillIn : styles.stockPillOut}>
            {stockInfo.available ? `склад: ${stockInfo.qty} шт.` : 'нет на складе'}
          </span>
        )}
        {warehouseBadge && (
          <span className={warehouseBadge.tone === 'in' ? styles.stockPillIn : styles.stockPillOut}>
            {warehouseBadge.label}
          </span>
        )}
        {onTrash && (
          <button
            type="button"
            className={styles.trashBtn}
            title="В корзину"
            onClick={(e) => { e.stopPropagation(); onTrash(order.id); }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className={styles.cardClient}>{order.clientName}</div>
      <span className={styles.cardPhone}>{order.clientPhone}</span>
      {order.managerName && (
        <span className={styles.cardManager}>👤 {order.managerName}</span>
      )}
      <div className={styles.cardDivider} />
      <div className={styles.cardFoot}>
        <span className={styles.cardAmount}>{fmt(order.totalAmount)}</span>
        <span className={styles.cardPay} style={{ color: PAY_COLOR[order.paymentStatus] }}>{PAY_LABEL[order.paymentStatus]}</span>
      </div>
      <div className={styles.cardDates}>
        <span className={styles.cardDateLabel}>Создан:</span>
        <span className={styles.cardDateValue}>{fmtDate(order.createdAt)}</span>
        {order.dueDate && (
          <>
            <span className={styles.cardDateLabel}>Завершить до:</span>
            <span className={styles.cardDateValue} style={{ color: overdue ? '#EF4444' : '#10B981' }}>
              {fmtDate(order.dueDate)}
            </span>
          </>
        )}
      </div>
    </div>
  );
});

// ── Batch grid card ───────────────────────────────────────────────────────────

const BatchCard = memo(function BatchCard({ group, onSelectOrder }: { group: { orders: ChapanOrder[] }; onSelectOrder: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { orders } = group;
  const first = orders[0];
  const item = first.items?.[0];
  const totalQty = orders.reduce((s, o) => s + (o.items?.[0]?.quantity ?? 1), 0);

  const dated = orders.filter(o => o.dueDate).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
  const minDate = dated[0]?.dueDate ?? null;
  const maxDate = dated[dated.length - 1]?.dueDate ?? null;
  const anyOverdue = orders.some(o => isOverdue(o.dueDate));
  const depth = orders.length >= 3 ? 2 : 1;

  return (
    <div
      className={[
        styles.batchOuter,
        depth >= 2 ? styles.batchOuter3 : '',
        expanded ? styles.batchOuterExpanded : '',
      ].join(' ')}
      style={{ '--status-color': STATUS_COLOR[first.status] } as React.CSSProperties}
    >
      <button
        className={`${styles.batchCard} ${expanded ? styles.batchCardOpen : ''}`}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <div className={styles.batchHead}>
          <span className={styles.batchCountBadge}>{orders.length}</span>
          <span className={styles.batchLabel}>заказа</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[first.status]}</span>
          {(first.urgency ?? first.priority) === 'urgent' && (
            <span className={`${styles.priorityBadge} ${styles.urgent}`}>{URGENCY_LABEL['urgent']}</span>
          )}
          {(first.isDemandingClient ?? (first.priority === 'vip')) && (
            <span className={`${styles.priorityBadge} ${styles.vip}`}>{DEMANDING_LABEL}</span>
          )}
          <span className={`${styles.batchChevron} ${expanded ? styles.batchChevronOpen : ''}`}>›</span>
        </div>

        {item && (
          <div className={styles.batchProduct}>
            <span className={styles.batchProductName}>{buildItemLine(item)}</span>
            {item.size && (
              <span className={styles.cardItemMeta}>{item.size}</span>
            )}
          </div>
        )}

        <div className={styles.batchStats}>
          <span className={styles.batchQtyTag}>{totalQty} шт. итого</span>
          {minDate && (
            <span
              className={styles.batchDateRange}
              style={{ color: anyOverdue ? '#EF4444' : '#6B7280' }}
            >
              {fmtDate(minDate)}
              {maxDate && maxDate !== minDate ? ` — ${fmtDate(maxDate)}` : ''}
            </span>
          )}
        </div>

        <div className={styles.batchAvatarRow}>
          {orders.slice(0, 6).map(o => (
            <span key={o.id} className={styles.batchAvatar} title={o.clientName}>
              {o.clientName[0]?.toUpperCase() ?? '?'}
            </span>
          ))}
          {orders.length > 6 && <span className={styles.batchAvatarPlus}>+{orders.length - 6}</span>}
        </div>
      </button>

      {expanded && (
        <div
          className={styles.batchExpandList}
          style={{ '--status-color': STATUS_COLOR[first.status] } as React.CSSProperties}
        >
          {orders.map((o, i) => {
            const overdue = isOverdue(o.dueDate);
            return (
              <button
                key={o.id}
                className={styles.batchMiniCard}
                style={{ '--status-color': STATUS_COLOR[o.status], '--delay': `${i * 40}ms` } as React.CSSProperties}
                onClick={e => { e.stopPropagation(); onSelectOrder(o.id); }}
              >
                <span className={styles.batchMiniStripe} />
                <div className={styles.batchMiniContent}>
                  <div className={styles.batchMiniTop}>
                    <span className={styles.cardNum}>#{o.orderNumber}</span>
                    <span className={styles.batchMiniClient}>{o.clientName}</span>
                    {(o.urgency ?? o.priority) === 'urgent' && (
                      <span className={`${styles.priorityBadge} ${styles.urgent}`} style={{ fontSize: '9px' }}>{URGENCY_LABEL['urgent']}</span>
                    )}
                    {(o.isDemandingClient ?? (o.priority === 'vip')) && (
                      <span className={`${styles.priorityBadge} ${styles.vip}`} style={{ fontSize: '9px' }}>{DEMANDING_LABEL}</span>
                    )}
                  </div>
                  <div className={styles.batchMiniBot}>
                    <span className={styles.cardItemMeta}>{o.items?.[0]?.quantity ?? 1} шт.</span>
                    <span className={styles.cardAmount}>{fmt(o.totalAmount)}</span>
                    <span className={styles.cardPay} style={{ color: PAY_COLOR[o.paymentStatus] }}>{PAY_LABEL[o.paymentStatus]}</span>
                    {o.dueDate && (
                      <span className={styles.cardDate} style={{ color: overdue ? '#EF4444' : '#6B7280', marginLeft: 'auto' }}>
                        {overdue ? '⚠ ' : ''}{fmtDate(o.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ── Single list row ───────────────────────────────────────────────────────────

const OrderRow = memo(function OrderRow({ order, onSelectOrder, hasAlert, stockMap, warehouseState, onTrash }: { order: ChapanOrder; onSelectOrder: (id: string) => void; hasAlert?: boolean; stockMap?: ProductsAvailabilityMap; warehouseState?: OrderWarehouseState; onTrash?: (id: string) => void }) {
  const overdue = isOverdue(order.dueDate);
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;
  const showStock = (order.status === 'new' || order.status === 'confirmed') && !!first?.productName && !!stockMap;
  const stockInfo = showStock ? stockMap![first!.productName] : undefined;
  const isUrgent = (order.urgency ?? order.priority) === 'urgent';
  const isDemanding = order.isDemandingClient ?? (order.priority === 'vip');
  const warehouseBadge = getWarehouseBadge(warehouseState);

  return (
    <div
      className={`${styles.row} ${hasAlert ? styles.rowAlert : ''} ${isUrgent ? styles.rowUrgent : ''}`}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
      role="button"
      tabIndex={0}
      onClick={() => onSelectOrder(order.id)}
      onKeyDown={(event) => handleClickableKey(event, () => onSelectOrder(order.id))}
    >
      <span className={styles.rowStripe} />
      <div className={styles.rowProduct}>
        {first ? (
          <>
            <span className={styles.cardItemName}>{buildItemLine(first)}</span>
            {first.size && (
              <span className={styles.cardItemMeta}>
                {[first.size, first.length ? `дл. ${first.length}` : ''].filter(Boolean).join(' · ')}
                {first.quantity > 1 && ` × ${first.quantity}`}
              </span>
            )}
            {more > 0 && <span className={styles.cardMoreItems}>+ещё {more}</span>}
          </>
        ) : (
          <span className={styles.cardItemMeta}>—</span>
        )}
      </div>
      <div className={styles.rowNum}>
        <span className={styles.rowOrderNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {isUrgent && (
          <span className={`${styles.priorityBadge} ${styles.urgent}`}>{URGENCY_LABEL['urgent']}</span>
        )}
        {isDemanding && (
          <span className={`${styles.priorityBadge} ${styles.vip}`}>{DEMANDING_LABEL}</span>
        )}
        {stockInfo !== undefined && (
          <span className={stockInfo.available ? styles.stockPillIn : styles.stockPillOut}>
            {stockInfo.available ? `склад: ${stockInfo.qty} шт.` : 'нет на складе'}
          </span>
        )}
        {warehouseBadge && (
          <span className={warehouseBadge.tone === 'in' ? styles.stockPillIn : styles.stockPillOut}>
            {warehouseBadge.label}
          </span>
        )}
      </div>
      <div className={styles.rowClient}>
        <span className={styles.cardClient}>{order.clientName}</span>
        <span className={styles.cardPhone}>{order.clientPhone}</span>
        {order.managerName && (
          <span className={styles.cardManager}>👤 {order.managerName}</span>
        )}
      </div>
      <div className={styles.rowFin}>
        <span className={styles.cardAmount}>{fmt(order.totalAmount)}</span>
        <span className={styles.cardPay} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>
      <div className={styles.rowDate}>
        <div className={styles.rowDateInner}>
          <span className={styles.rowDateLabel}>Создан:</span>
          <span>{fmtDate(order.createdAt)}</span>
        </div>
        <div className={styles.rowDateInner}>
          <span className={styles.rowDateLabel}>До:</span>
          {order.dueDate
            ? <span style={{ color: overdue ? '#EF4444' : '#10B981' }}>{fmtDate(order.dueDate)}</span>
            : <span className={styles.rowDateEmpty}>—</span>
          }
        </div>
        {onTrash && (
          <button type="button" className={styles.trashBtnRow} title="В корзину" onClick={e => { e.stopPropagation(); onTrash(order.id); }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
});

// ── Batch list row ────────────────────────────────────────────────────────────

const BatchRow = memo(function BatchRow({ group, onSelectOrder }: { group: { orders: ChapanOrder[] }; onSelectOrder: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { orders } = group;
  const first = orders[0];
  const item = first.items?.[0];
  const totalQty = orders.reduce((s, o) => s + (o.items?.[0]?.quantity ?? 1), 0);

  const dated = orders.filter(o => o.dueDate).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));
  const minDate = dated[0]?.dueDate ?? null;
  const maxDate = dated[dated.length - 1]?.dueDate ?? null;
  const anyOverdue = orders.some(o => isOverdue(o.dueDate));

  return (
    <div className={styles.batchRowOuter}>
      <button
        className={`${styles.row} ${styles.batchRow} ${expanded ? styles.batchRowOpen : ''}`}
        style={{ '--status-color': STATUS_COLOR[first.status] } as React.CSSProperties}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.rowStripe} />
        <div className={styles.rowProduct}>
          {item ? (
            <>
              <span className={styles.cardItemName}>{buildItemLine(item)}</span>
              {item.size && (
                <span className={styles.cardItemMeta}>{item.size}</span>
              )}
            </>
          ) : <span className={styles.cardItemMeta}>—</span>}
        </div>
        <div className={styles.rowNum}>
          <span className={styles.batchCountBadge}>{orders.length}</span>
          <span className={styles.statusBadge}>{STATUS_LABEL[first.status]}</span>
          {(first.urgency ?? first.priority) === 'urgent' && (
            <span className={`${styles.priorityBadge} ${styles.urgent}`}>{URGENCY_LABEL['urgent']}</span>
          )}
          {(first.isDemandingClient ?? (first.priority === 'vip')) && (
            <span className={`${styles.priorityBadge} ${styles.vip}`}>{DEMANDING_LABEL}</span>
          )}
        </div>
        <div className={styles.rowClient}>
          <div className={styles.batchAvatarRow}>
            {orders.slice(0, 5).map(o => (
              <span key={o.id} className={styles.batchAvatar} title={o.clientName}>
                {o.clientName[0]?.toUpperCase() ?? '?'}
              </span>
            ))}
            {orders.length > 5 && <span className={styles.batchAvatarPlus}>+{orders.length - 5}</span>}
          </div>
        </div>
        <div className={styles.rowFin}>
          <span className={styles.batchQtyTag}>{totalQty} шт.</span>
        </div>
        <div className={styles.rowDate}>
          {minDate
            ? <span style={{ color: anyOverdue ? '#EF4444' : '#6B7280' }}>
                {fmtDate(minDate)}
                {maxDate && maxDate !== minDate ? `–${fmtDate(maxDate)}` : ''}
              </span>
            : <span className={styles.rowDateEmpty}>—</span>
          }
          <span className={`${styles.batchChevron} ${expanded ? styles.batchChevronOpen : ''}`}>›</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.batchRowExpanded}>
          {orders.map(o => (
            <OrderRow key={o.id} order={o} onSelectOrder={onSelectOrder} />
          ))}
        </div>
      )}
    </div>
  );
});
