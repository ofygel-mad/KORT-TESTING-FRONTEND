import { useState, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArchiveIcon, RotateCcw, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { useOrders, useRestoreOrder } from '../../../../entities/order/queries';
import type { ChapanOrder, OrderStatus } from '../../../../entities/order/types';
import styles from './ChapanArchive.module.css';

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
  confirmed: '#3B82F6',
  in_production: '#F59E0B',
  ready: '#10B981',
  transferred: '#8B5CF6',
  on_warehouse: '#8B5CF6',
  shipped: '#3B82F6',
  completed: '#4A5268',
  cancelled: '#EF4444',
};

const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен',
  partial: 'Частично',
  paid: 'Оплачен',
};

const PAY_COLOR: Record<string, string> = {
  not_paid: '#EF4444',
  partial: '#F59E0B',
  paid: '#10B981',
};

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ChapanArchivePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const deferred = useDeferredValue(search);

  const { data, isLoading, isError } = useOrders({
    archived: true,
    search: deferred || undefined,
    status: statusFilter || undefined,
    limit: 200,
  });

  const orders: ChapanOrder[] = data?.results ?? [];

  return (
    <div className={`${styles.root} kort-page-enter`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <ArchiveIcon size={18} />
          <span>Архив заказов</span>
        </div>
        <div className={styles.headerSub}>Завершённые и отменённые заказы</div>
      </div>

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
        <select
          className={styles.statusSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="completed">Завершённые</option>
          <option value="cancelled">Отменённые</option>
        </select>
      </div>

      {!isLoading && <div className={styles.count}>{data?.count ?? 0} заказов в архиве</div>}

      {isLoading && (
        <div className={styles.loading}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {isError && (
        <div className="kort-inline-error">
          <AlertCircle size={16} />
          Не удалось загрузить архив. Проверьте соединение и попробуйте обновить страницу.
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className={styles.emptyState}>
          <ArchiveIcon size={36} className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>Архив пуст</div>
          <div className={styles.emptyText}>
            {search || statusFilter
              ? 'Ничего не найдено по заданным фильтрам'
              : 'Завершённые или отменённые заказы, перемещённые в архив, появятся здесь'}
          </div>
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <div className={styles.list}>
          {orders.map(order => (
            <ArchiveRow
              key={order.id}
              order={order}
              onClick={() => navigate(`/workzone/chapan/archive/${order.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArchiveRow({ order, onClick }: { order: ChapanOrder; onClick: () => void }) {
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;
  const restoreOrder = useRestoreOrder();

  return (
    <div
      className={styles.row}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
    >
      <span className={styles.rowStripe} />

      <div className={styles.rowNum}>
        <span className={styles.cardNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
        {order.isArchived && <span className={styles.archivedTag}>архив</span>}
      </div>

      <div className={styles.rowClient}>
        <span className={styles.clientName}>{order.clientName}</span>
        <span className={styles.clientPhone}>{order.clientPhone}</span>
      </div>

      <div className={styles.rowProduct}>
        {first ? (
          <>
            <span className={styles.itemName}>{first.productName}</span>
            <span className={styles.itemMeta}>
              {[first.size].filter(Boolean).join(' · ')}
              {first.quantity > 1 && ` × ${first.quantity}`}
            </span>
            {more > 0 && <span className={styles.itemMore}>+ещё {more}</span>}
          </>
        ) : (
          <span className={styles.itemMeta}>—</span>
        )}
      </div>

      <div className={styles.rowFin}>
        <span className={styles.amount}>{fmt(order.totalAmount)}</span>
        <span className={styles.payStatus} style={{ color: PAY_COLOR[order.paymentStatus] }}>
          {PAY_LABEL[order.paymentStatus]}
        </span>
      </div>

      <div className={styles.rowDates}>
        {order.status === 'completed' && order.completedAt && (
          <span className={styles.dateLabel}><Check size={10} className={styles.dateIcon} />{fmtDate(order.completedAt)}</span>
        )}
        {order.status === 'cancelled' && order.cancelledAt && (
          <span className={`${styles.dateLabel} ${styles.dateCancelled}`}><X size={10} className={styles.dateIcon} />{fmtDate(order.cancelledAt)}</span>
        )}
        {order.archivedAt && (
          <span className={styles.archivedDate}>{fmtDate(order.archivedAt)}</span>
        )}
      </div>

      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.restoreBtn}
          onClick={() => restoreOrder.mutate({ id: order.id, status: order.status })}
          disabled={restoreOrder.isPending}
        >
          <RotateCcw size={12} />
          <span>{restoreOrder.isPending ? '...' : 'Восстановить'}</span>
        </button>
        <button
          type="button"
          className={styles.viewBtn}
          onClick={onClick}
          title="Открыть заказ"
        >
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
