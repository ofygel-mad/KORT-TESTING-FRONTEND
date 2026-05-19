import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useTrashedOrders, useRestoreFromTrash, usePermanentDelete } from '@/entities/order/queries';
import { useEmployeePermissions } from '../../../../shared/hooks/useEmployeePermissions';
import type { ChapanOrder } from '@/entities/order/types';
import { calculateChapanOrderFinancials } from '@/shared/lib/chapanFinancials';
import styles from './ChapanTrash.module.css';

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-KZ', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ChapanTrashPage() {
  const navigate = useNavigate();
  const { isAbsolute } = useEmployeePermissions();
  const { data: orders = [], isLoading } = useTrashedOrders();
  const restore = useRestoreFromTrash();
  const permDelete = usePermanentDelete();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!isAbsolute) {
    return (
      <div className={styles.root}>
        <div className={styles.forbidden}>
          <AlertTriangle size={32} />
          <p>Корзина доступна только владельцу или пользователю с полным доступом.</p>
        </div>
      </div>
    );
  }

  function handleRestore(id: string) {
    restore.mutate(id);
  }

  function handlePermanentDelete(id: string) {
    setConfirmId(id);
  }

  function confirmDelete() {
    if (!confirmId) return;
    permDelete.mutate(confirmId, { onSuccess: () => setConfirmId(null) });
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/workzone/chapan/orders')}>
          <ChevronLeft size={16} />
          Заказы
        </button>
        <div className={styles.titleRow}>
          <Trash2 size={18} />
          <h1 className={styles.title}>Корзина</h1>
          {orders.length > 0 && <span className={styles.count}>{orders.length}</span>}
        </div>
        <p className={styles.hint}>Заказы в корзине не отображаются в основных списках. Только вы можете восстановить или удалить их навсегда.</p>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          {[1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className={styles.empty}>
          <Trash2 size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>Корзина пуста</p>
          <p className={styles.emptyHint}>Удалённые заказы появятся здесь</p>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <div className={styles.list}>
          {orders.map((order: ChapanOrder) => (
            <div key={order.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowHead}>
                  <span className={styles.orderNum}>#{order.orderNumber}</span>
                  <span className={styles.client}>{order.clientName}</span>
                  <span className={styles.deletedAt}>
                    удалён {order.deletedAt ? fmtDate(order.deletedAt) : '—'}
                  </span>
                </div>
                <div className={styles.rowMeta}>
                  {order.items?.[0] && (
                    <span className={styles.product}>
                      {order.items[0].productName}
                      {order.items.length > 1 && ` +${order.items.length - 1}`}
                    </span>
                  )}
                  <span className={styles.amount}>{fmt(calculateChapanOrderFinancials({
                    itemsSubtotal: order.totalAmount,
                    orderDiscount: order.orderDiscount,
                    deliveryFee: order.deliveryFee,
                    bankCommissionPercent: order.bankCommissionPercent,
                    bankCommissionAmount: order.bankCommissionAmount,
                  }).totalDue)}</span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <button
                  className={styles.restoreBtn}
                  onClick={() => handleRestore(order.id)}
                  disabled={restore.isPending}
                  title="Восстановить"
                >
                  <RotateCcw size={14} />
                  Восстановить
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handlePermanentDelete(order.id)}
                  disabled={permDelete.isPending}
                  title="Удалить навсегда"
                >
                  <Trash2 size={14} />
                  Удалить навсегда
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm permanent delete modal */}
      {confirmId && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}><Trash2 size={24} /></div>
            <h2 className={styles.modalTitle}>Удалить навсегда?</h2>
            <p className={styles.modalText}>
              Это действие необратимо. Заказ, все его позиции, платежи и история будут удалены без возможности восстановления.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setConfirmId(null)}>
                Отмена
              </button>
              <button
                className={styles.modalConfirm}
                onClick={confirmDelete}
                disabled={permDelete.isPending}
              >
                {permDelete.isPending ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
