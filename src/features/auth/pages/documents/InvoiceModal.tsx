import { createPortal } from 'react-dom';
import { useState } from 'react';
import { X, FileText, Sparkles, ArrowLeft, Download, Loader2, User, Phone, Calendar, Package } from 'lucide-react';
import { useOrders } from '@/entities/order/queries';
import type { ChapanOrder } from '@/entities/order/types';
import { apiClient } from '../../shared/api/client';
import { useAuthStore } from '../../shared/stores/auth';
import { calculateChapanOrderFinancials } from '@/shared/lib/chapanFinancials';
import styles from './InvoiceModal.module.css';
import { buildItemLine } from '../../shared/utils/itemLine';

type Step = 'style' | 'order-list';
type InvoiceStyle = 'default' | 'branded';

interface Props {
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

async function downloadInvoice(orderId: string, style: InvoiceStyle, orderNumber: string) {
  const currency = useAuthStore.getState().org?.currency ?? 'KZT';
  const response = await apiClient.get(`/chapan/orders/${orderId}/invoice`, {
    params: { style, currency },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `накладная-${orderNumber}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Root modal ────────────────────────────────────────────────────────────────

export function InvoiceModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('style');
  const [chosenStyle, setChosenStyle] = useState<InvoiceStyle>('branded');

  function handleStylePick(s: InvoiceStyle) {
    setChosenStyle(s);
    setStep('order-list');
  }

  return createPortal(
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            {step !== 'style' && (
              <button className={styles.backBtn} onClick={() => setStep('style')}>
                <ArrowLeft size={14} />
              </button>
            )}
            <div>
              <div className={styles.modalTitle}>Накладные</div>
              <div className={styles.modalSub}>
                {step === 'style' ? 'Выберите формат документа' : 'Выберите заказ для формирования'}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {step === 'style' && <StyleStep onPick={handleStylePick} />}
          {step === 'order-list' && (
            <OrderListStep style={chosenStyle} onClose={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Step 1: Style selection ───────────────────────────────────────────────────

function StyleStep({ onPick }: { onPick: (s: InvoiceStyle) => void }) {
  return (
    <div className={styles.styleGrid}>
      {/* Default */}
      <button className={styles.styleCard} onClick={() => onPick('default')}>
        <div className={styles.styleCardIcon} style={{ background: '#F1F5FA', color: '#4E5C78' }}>
          <FileText size={28} />
        </div>
        <div className={styles.styleCardLabel}>По умолчанию</div>
        <div className={styles.styleCardDesc}>
          Стандартная таблица без оформления. Подходит для внутреннего использования.
        </div>
        <div className={styles.styleCardBadge} style={{ background: '#F1F5FA', color: '#4E5C78' }}>
          Базовый
        </div>
      </button>

      {/* Branded */}
      <button className={styles.styleCard} onClick={() => onPick('branded')}>
        <div className={styles.styleCardIcon} style={{ background: '#E6F4EC', color: '#1A6B3C' }}>
          <Sparkles size={28} />
        </div>
        <div className={styles.styleCardLabel}>Фирменный</div>
        <div className={styles.styleCardDesc}>
          Брендированный шаблон с логотипом и фирменными цветами. Для клиентов и отправок.
        </div>
        <div className={styles.styleCardBadge} style={{ background: '#E6F4EC', color: '#1A6B3C' }}>
          Рекомендуем
        </div>
      </button>
    </div>
  );
}

// ── Step 2: Order list ────────────────────────────────────────────────────────

function OrderListStep({ style, onClose }: { style: InvoiceStyle; onClose: () => void }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  // Fetch ready orders (status: ready)
  const { data, isLoading, isError } = useOrders({ status: 'ready', limit: 200 });
  const orders = (data as any)?.results as ChapanOrder[] | undefined;

  async function handleDownload(order: ChapanOrder) {
    if (downloading) return;
    setDownloading(order.id);
    try {
      await downloadInvoice(order.id, style, order.orderNumber);
    } catch {
      alert('Не удалось сгенерировать накладную. Попробуйте ещё раз.');
    } finally {
      setDownloading(null);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.stateCenter}>
        <Loader2 size={24} className={styles.spin} />
        <span>Загрузка заказов…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.stateCenter}>
        <span style={{ color: 'var(--text-tertiary)' }}>Ошибка загрузки. Обновите страницу.</span>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className={styles.stateEmpty}>
        <Package size={36} style={{ color: 'var(--border-default)' }} />
        <div className={styles.stateEmptyTitle}>Нет заказов в статусе «Готово»</div>
        <div className={styles.stateEmptyDesc}>
          Накладная формируется только для заказов, готовых к отправке.
          <br />
          Переведите заказ в статус «Готово» в разделе Производство.
        </div>
      </div>
    );
  }

  const styleLabel = style === 'branded' ? 'Фирменный' : 'По умолчанию';

  return (
    <div className={styles.orderList}>
      <div className={styles.orderListHint}>
        Формат: <strong>{styleLabel}</strong> · Выберите заказ чтобы скачать накладную
      </div>

      {orders.map((order) => (
        <button
          key={order.id}
          className={styles.orderCard}
          onClick={() => handleDownload(order)}
          disabled={downloading === order.id}
        >
          {/* Order number + priority */}
          <div className={styles.orderCardTop}>
            <span className={styles.orderNum}>#{order.orderNumber}</span>
            {(order.urgency ?? order.priority) === 'urgent' && (
              <span className={`${styles.priorityBadge} ${styles.priority_urgent}`}>
                🔴 Срочный
              </span>
            )}
            {(order.isDemandingClient ?? (order.priority === 'vip')) && (
              <span className={`${styles.priorityBadge} ${styles.priority_vip}`}>
                ⭐ Требовательный
              </span>
            )}
            <span className={styles.itemCount}>
              {order.items.length} {order.items.length === 1 ? 'позиция' : order.items.length < 5 ? 'позиции' : 'позиций'}
            </span>
          </div>

          {/* Client */}
          <div className={styles.orderCardMeta}>
            <span className={styles.metaItem}>
              <User size={11} />
              {order.clientName}
            </span>
            {order.clientPhone && (
              <span className={styles.metaItem}>
                <Phone size={11} />
                {order.clientPhone}
              </span>
            )}
            {order.dueDate && (
              <span className={styles.metaItem}>
                <Calendar size={11} />
                {fmtDate(order.dueDate)}
              </span>
            )}
          </div>

          {/* Items preview */}
          <div className={styles.orderItems}>
            {order.items.slice(0, 3).map((item, i) => (
              <span key={i} className={styles.orderItemChip}>
                {buildItemLine(item)}{item.size ? ` - ${item.size}` : ''}{item.quantity > 1 ? ` - ${item.quantity} шт` : ''}
              </span>
            ))}
            {order.items.length > 3 && (
              <span className={styles.orderItemChip} style={{ color: 'var(--text-tertiary)' }}>
                +{order.items.length - 3} ещё
              </span>
            )}
          </div>

          {/* Total + download indicator */}
          <div className={styles.orderCardBottom}>
            <span className={styles.orderTotal}>{fmtMoney(calculateChapanOrderFinancials({
              itemsSubtotal: order.totalAmount,
              orderDiscount: order.orderDiscount,
              deliveryFee: order.deliveryFee,
              bankCommissionPercent: order.bankCommissionPercent,
              bankCommissionAmount: order.bankCommissionAmount,
            }).totalDue)}</span>
            <div className={styles.downloadBtn}>
              {downloading === order.id ? (
                <Loader2 size={14} className={styles.spin} />
              ) : (
                <Download size={14} />
              )}
              {downloading === order.id ? 'Генерация…' : 'Скачать .xlsx'}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
