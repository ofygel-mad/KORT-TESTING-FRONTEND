import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CircleCheck, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { useOrders } from '../../../../entities/order/queries';
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
  const [completedSearch, setCompletedSearch] = useState('');
  const [cancelledSearch, setCancelledSearch] = useState('');
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const deferredCompletedSearch = useDeferredValue(completedSearch);
  const deferredCancelledSearch = useDeferredValue(cancelledSearch);

  const {
    data: completedData,
    isLoading: isCompletedLoading,
    isError: isCompletedError,
  } = useOrders({
    statuses: 'completed',
    search: deferredCompletedSearch || undefined,
    limit: 200,
  });

  const {
    data: cancelledData,
    isLoading: isCancelledLoading,
    isError: isCancelledError,
  } = useOrders({
    statuses: 'cancelled',
    search: deferredCancelledSearch || undefined,
    limit: 200,
  });

  const completedOrders: ChapanOrder[] = completedData?.results ?? [];
  const cancelledOrders: ChapanOrder[] = cancelledData?.results ?? [];

  return (
    <>
      <div className={`${styles.root} kort-page-enter`}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <CircleCheck size={18} />
            <span>Завершённые заказы</span>
          </div>
          <div className={styles.headerSub}>Выполненные заказы по Чапану</div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={completedSearch}
              onChange={(e) => setCompletedSearch(e.target.value)}
              placeholder="Номер, клиент, модель..."
            />
          </div>
          <button
            type="button"
            className={styles.cancelledOrdersBtn}
            onClick={() => setCancelledOpen(true)}
          >
            <X size={14} />
            <span>{`\u041e\u0442\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b${cancelledData ? ` (${cancelledData.count})` : ''}`}</span>
          </button>
        </div>

        {!isCompletedLoading && (
          <div className={styles.count}>{`${completedData?.count ?? 0} \u0437\u0430\u043a\u0430\u0437\u043e\u0432`}</div>
        )}

        {isCompletedLoading && (
          <div className={styles.loading}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        )}

        {isCompletedError && (
          <div className="kort-inline-error">
            <AlertCircle size={16} />
            Не удалось загрузить заказы. Проверьте соединение и попробуйте обновить страницу.
          </div>
        )}

        {!isCompletedLoading && !isCompletedError && completedOrders.length === 0 && (
          <div className={styles.emptyState}>
            <CircleCheck size={36} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>Нет завершённых заказов</div>
            <div className={styles.emptyText}>
              {completedSearch
                ? 'Ничего не найдено по заданным фильтрам'
                : 'Заказы со статусом «Завершён» появятся здесь'}
            </div>
          </div>
        )}

        {!isCompletedLoading && !isCompletedError && completedOrders.length > 0 && (
          <div className={styles.list}>
            {completedOrders.map((order) => (
              <ArchiveRow
                key={order.id}
                order={order}
                onClick={() => navigate(`/workzone/chapan/archive/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {cancelledOpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancelled-orders-title"
          onClick={() => setCancelledOpen(false)}
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle} id="cancelled-orders-title">
                  {'\u041e\u0442\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b'}
                </div>
                <div className={styles.modalSub}>
                  {'\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u043f\u0438\u0441\u043e\u043a \u043e\u0442\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u0438 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f'}
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setCancelledOpen(false)}
                aria-label={`\u0417\u0430\u043a\u0440\u044b\u0442\u044c`}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalToolbar}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  value={cancelledSearch}
                  onChange={(e) => setCancelledSearch(e.target.value)}
                  placeholder="Номер, клиент, модель..."
                />
              </div>
            </div>

            {!isCancelledLoading && (
              <div className={styles.count}>{`${cancelledData?.count ?? 0} \u0437\u0430\u043a\u0430\u0437\u043e\u0432`}</div>
            )}

            <div className={styles.modalBody}>
              {isCancelledLoading && (
                <div className={styles.loading}>
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
                </div>
              )}

              {isCancelledError && (
                <div className="kort-inline-error">
                  <AlertCircle size={16} />
                  Не удалось загрузить отменённые заказы. Проверьте соединение и попробуйте ещё раз.
                </div>
              )}

              {!isCancelledLoading && !isCancelledError && cancelledOrders.length === 0 && (
                <div className={styles.emptyState}>
                  <X size={36} className={styles.emptyIcon} />
                  <div className={styles.emptyTitle}>{'\u041d\u0435\u0442 \u043e\u0442\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432'}</div>
                  <div className={styles.emptyText}>
                    {cancelledSearch
                      ? 'Ничего не найдено по заданным фильтрам'
                      : '\u0412 \u044d\u0442\u043e\u043c \u043e\u043a\u043d\u0435 \u0441\u043e\u0431\u0438\u0440\u0430\u044e\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u0442\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b'}
                  </div>
                </div>
              )}

              {!isCancelledLoading && !isCancelledError && cancelledOrders.length > 0 && (
                <div className={styles.list}>
                  {cancelledOrders.map((order) => (
                    <ArchiveRow
                      key={order.id}
                      order={order}
                      onClick={() => {
                        setCancelledOpen(false);
                        navigate(`/workzone/chapan/archive/${order.id}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ArchiveRow({ order, onClick }: { order: ChapanOrder; onClick: () => void }) {
  const first = order.items?.[0];
  const more = (order.items?.length ?? 0) - 1;

  return (
    <div
      className={styles.row}
      style={{ '--status-color': STATUS_COLOR[order.status] } as React.CSSProperties}
    >
      <span className={styles.rowStripe} />

      <div className={styles.rowNum}>
        <span className={styles.cardNum}>#{order.orderNumber}</span>
        <span className={styles.statusBadge}>{STATUS_LABEL[order.status]}</span>
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
      </div>

      <div className={styles.rowActions}>
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
