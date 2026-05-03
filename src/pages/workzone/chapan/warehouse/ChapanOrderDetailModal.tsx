import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Package, User, Phone, Clock, AlertTriangle, Send, RotateCcw, CheckSquare, FileText, Star,
} from 'lucide-react';
import {
  useOrder, useShipOrder, useCloseOrder, useReturnToReady,
} from '../../../../entities/order/queries';
import type { ChapanOrder } from '../../../../entities/order/types';
import { useChapanPermissions } from '../../../../shared/hooks/useChapanPermissions';
import modalStyles from '../invoices/ChapanInvoicePreviewModal.module.css';

const URGENCY_LABEL: Record<string, string> = { normal: '', urgent: 'Срочно' };
const DEMANDING_LABEL = 'Требовательный';
const PAY_LABEL: Record<string, string> = {
  not_paid: 'Не оплачен', partial: 'Частично оплачен', paid: 'Оплачен',
};
const PAY_COLOR: Record<string, string> = {
  not_paid: 'var(--fill-negative)', partial: 'var(--fill-warning)', paid: 'var(--fill-positive)',
};
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
const MONEY_FORMATTER = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

function fmtDate(s: string) { return DATE_FORMATTER.format(new Date(s)); }
function fmtMoney(n: number) { return MONEY_FORMATTER.format(n) + ' ₸'; }

interface Props {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ChapanOrderDetailModal({ orderId, open, onClose }: Props) {
  const { data: order, isLoading } = useOrder(orderId ?? '');
  const shipOrder = useShipOrder();
  const closeOrder = useCloseOrder();
  const returnToReady = useReturnToReady();
  const { canShipWithoutPayment } = useChapanPermissions();

  const [closeUnpaidWarning, setCloseUnpaidWarning] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [shipFormData, setShipFormData] = useState({
    courierType: '',
    recipientName: '',
    recipientAddress: '',
    shippingNote: '',
  });

  const orderNumber = order?.orderNumber ?? orderId ?? '';
  const clientName = order?.clientName ?? '';
  const clientPhone = order?.clientPhone ?? '';
  const dueDate = order?.dueDate ? fmtDate(order.dueDate) : '';
  const items = order?.items ?? [];
  const totalAmount = order?.totalAmount ?? 0;
  const paidAmount = order?.paidAmount ?? 0;
  const paymentStatus = order?.paymentStatus ?? 'not_paid';
  const status = order?.status ?? '';
  const urgency = order?.urgency ?? order?.priority;
  const isDemanding = order?.isDemandingClient ?? (order?.priority === 'vip');
  const invoiceOrders = order?.invoiceOrders ?? [];
  const requiresInvoice = order?.requiresInvoice ?? false;

  const content = !open ? null : (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className={modalStyles.headerTitle}>
            <div className={modalStyles.headerIcon}>
              <Package size={24} style={{ color: '#1A6B3C' }} />
            </div>
            <div>
              <div className={modalStyles.titleText}>#{orderNumber}</div>
              <div className={modalStyles.subtitle}>
                {clientName}
                {clientPhone && <> · <a href={`tel:${clientPhone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{clientPhone}</a></>}
                {dueDate && <> · Срок: {dueDate}</>}
              </div>
            </div>
          </div>
          <button className={modalStyles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={modalStyles.body}>
          {isLoading && <div className={modalStyles.state}>Загружаем заказ...</div>}

          {!isLoading && !order && (
            <div className={modalStyles.state}>Не удалось открыть заказ</div>
          )}

          {!isLoading && order && (
            <div className={modalStyles.workspace}>
              {/* Left panel — summary cards */}
              <aside className={modalStyles.ordersPanel}>
                <div className={modalStyles.panelHead}>
                  <div className={modalStyles.panelTitle}>Информация о заказе</div>
                </div>

                {/* Urgency & Demanding badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {urgency === 'urgent' && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)', color: '#D94F4F', fontSize: 12, fontWeight: 600,
                    }}>
                      <AlertTriangle size={11} /> {URGENCY_LABEL['urgent']}
                    </div>
                  )}
                  {isDemanding && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 12, background: 'rgba(201,168,76,0.1)',
                      border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', fontSize: 12, fontWeight: 600,
                    }}>
                      <Star size={11} /> {DEMANDING_LABEL}
                    </div>
                  )}
                </div>

                {/* Client card */}
                <div className={modalStyles.orderCard} style={{ pointerEvents: 'none', cursor: 'default' }}>
                  <div className={modalStyles.orderCardTop}>
                    <strong>Клиент</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                    <User size={14} /> {clientName}
                  </div>
                  {clientPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <Phone size={14} /> {clientPhone}
                    </div>
                  )}
                  {dueDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <Clock size={14} /> {dueDate}
                    </div>
                  )}
                </div>

                {/* Payment card */}
                <div className={modalStyles.orderCard} style={{ pointerEvents: 'none', cursor: 'default' }}>
                  <div className={modalStyles.orderCardTop}>
                    <strong>Оплата</strong>
                  </div>
                  <div style={{ fontSize: 13, color: PAY_COLOR[paymentStatus], fontWeight: 600, marginBottom: 4 }}>
                    {PAY_LABEL[paymentStatus]}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fill-positive)', marginBottom: 2 }}>
                    Оплачено: {fmtMoney(paidAmount)}
                  </div>
                  {paidAmount < totalAmount && (
                    <div style={{ fontSize: 12, color: 'var(--fill-negative)' }}>
                      Остаток: {fmtMoney(totalAmount - paidAmount)}
                    </div>
                  )}
                </div>

                {/* Invoices card */}
                {invoiceOrders.length > 0 && (
                  <div className={modalStyles.orderCard} style={{ pointerEvents: 'none', cursor: 'default' }}>
                    <div className={modalStyles.orderCardTop}>
                      <strong>Накладные</strong>
                    </div>
                    {invoiceOrders.map((io) => (
                      <div key={io.id} style={{ fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={12} />
                        <span>#{io.invoice?.invoiceNumber}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                          color: io.invoice?.warehouseConfirmed ? 'var(--fill-positive)' : 'var(--fill-warning)',
                          background: io.invoice?.warehouseConfirmed ? 'rgba(74,222,128,0.1)' : 'rgba(234,179,8,0.1)',
                        }}>
                          {io.invoice?.warehouseConfirmed ? 'Принята' : 'Ожидает'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoice requirement flag */}
                <div className={modalStyles.orderCard} style={{ pointerEvents: 'none', cursor: 'default' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Накладная обязательна:{' '}
                    <strong style={{ color: requiresInvoice ? 'var(--fill-warning)' : 'var(--fill-positive)' }}>
                      {requiresInvoice ? 'Да' : 'Нет'}
                    </strong>
                  </div>
                </div>
              </aside>

              {/* Right area — items, payment, actions */}
              <section className={modalStyles.content}>
                {/* Summary grid */}
                <div className={modalStyles.summaryGrid}>
                  <div className={modalStyles.summaryCard}>
                    <span>Заказ</span>
                    <strong>#{orderNumber}</strong>
                  </div>
                  <div className={modalStyles.summaryCard}>
                    <span>Оплата</span>
                    <strong style={{ color: PAY_COLOR[paymentStatus] }}>
                      {PAY_LABEL[paymentStatus]}
                    </strong>
                  </div>
                  <div className={modalStyles.summaryCard}>
                    <span>Позиций</span>
                    <strong>{items.length}</strong>
                  </div>
                  <div className={modalStyles.summaryCard}>
                    <span>Итого</span>
                    <strong>{fmtMoney(totalAmount)}</strong>
                  </div>
                </div>

                {/* Items table */}
                <div className={modalStyles.section}>
                  <div className={modalStyles.sectionHeader}>
                    <div>
                      <div className={modalStyles.sectionTitle}>Позиции</div>
                      <div className={modalStyles.sectionSubtitle}>{items.length} товаров в заказе</div>
                    </div>
                  </div>

                  <div className={modalStyles.tableWrap}>
                    <table className={modalStyles.table}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Модель</th>
                          <th style={{ textAlign: 'left' }}>Размер</th>
                          <th style={{ textAlign: 'center' }}>Кол-во</th>
                          <th style={{ textAlign: 'right' }}>Цена</th>
                          <th style={{ textAlign: 'right' }}>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className={modalStyles.tableRow}>
                            <td style={{ paddingLeft: 10 }}>{item.productName}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.size}</td>
                            <td style={{ textAlign: 'center', fontSize: 12 }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtMoney(item.unitPrice)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }} className={modalStyles.lineTotal}>
                              {fmtMoney(item.quantity * item.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment detail section */}
                <div className={modalStyles.section}>
                  <div className={modalStyles.sectionTitle}>Реквизиты оплаты</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Сумма заказа
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {fmtMoney(totalAmount)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Оплачено
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fill-positive)' }}>
                        {fmtMoney(paidAmount)}
                      </div>
                    </div>
                    {paidAmount < totalAmount && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Остаток
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fill-negative)' }}>
                          {fmtMoney(totalAmount - paidAmount)}
                        </div>
                      </div>
                    )}
                    {order?.expectedPaymentMethod && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Способ оплаты
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {order.expectedPaymentMethod}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        {!isLoading && order && (
          <div className={modalStyles.modalFooter}>
            {showReturnForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  Причина возврата в «Готово»
                </div>
                <input
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    background: 'var(--bg-surface-inset)',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Несоответствие состава, нет накладной..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (returnReason.trim()) {
                        returnToReady.mutate({ id: order.id, reason: returnReason.trim() }, { onSuccess: onClose });
                      }
                    }
                    if (e.key === 'Escape') { setShowReturnForm(false); setReturnReason(''); }
                  }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    style={{
                      flex: '1 1 100px',
                      minWidth: '80px',
                      padding: '8px 12px',
                      border: '1px solid var(--border-default)',
                      borderRadius: 8,
                      background: 'var(--bg-surface-inset)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                    onClick={() => { setShowReturnForm(false); setReturnReason(''); }}
                  >
                    Отмена
                  </button>
                  <button
                    style={{
                      flex: '2 1 100px',
                      minWidth: '80px',
                      padding: '8px 12px',
                      border: '1px solid var(--fill-negative)',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)',
                      color: 'var(--fill-negative)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      if (returnReason.trim()) {
                        returnToReady.mutate({ id: order.id, reason: returnReason.trim() }, { onSuccess: onClose });
                      }
                    }}
                    disabled={returnToReady.isPending || !returnReason.trim()}
                  >
                    <RotateCcw size={14} style={{ display: 'inline', marginRight: 4 }} />
                    {returnToReady.isPending ? 'Возврат...' : 'Вернуть в «Готово»'}
                  </button>
                </div>
              </div>
            ) : status === 'shipped' ? (
              <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <button
                  style={{
                    flex: '1 1 120px',
                    minWidth: '100px',
                    padding: '8px 14px',
                    border: '1px solid rgba(26,107,60,0.34)',
                    borderRadius: 8,
                    background: 'linear-gradient(180deg, rgba(38,174,102,0.16), rgba(26,107,60,0.12))',
                    color: '#1A6B3C',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={() => setCloseUnpaidWarning(true)}
                  disabled={closeOrder.isPending}
                >
                  <CheckSquare size={14} />
                  {closeOrder.isPending ? 'Завершение...' : 'Завершить заказ'}
                </button>
                {closeUnpaidWarning && (
                  <div style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${paymentStatus !== 'paid' ? 'var(--fill-negative)' : 'var(--fill-positive)'}`,
                    background: paymentStatus !== 'paid' ? 'rgba(239,68,68,0.08)' : 'rgba(38,174,102,0.08)',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <AlertTriangle size={15} style={{ color: paymentStatus !== 'paid' ? 'var(--fill-negative)' : 'var(--fill-positive)', flexShrink: 0 }} />
                      {paymentStatus !== 'paid'
                        ? <strong style={{ color: 'var(--fill-negative)' }}>Заказ не оплачен — остаток: {fmtMoney(totalAmount - paidAmount)}</strong>
                        : <strong style={{ color: '#1A6B3C' }}>Подтвердите завершение заказа #{orderNumber}</strong>
                      }
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 23 }}>
                      {paymentStatus !== 'paid'
                        ? 'После завершения заказ перейдёт в архив.'
                        : 'Заказ будет перемещён в раздел «Завершённые». Это действие необратимо.'
                      }
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid var(--border-default)', background: 'var(--bg-surface-inset)',
                          color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                        onClick={() => setCloseUnpaidWarning(false)}
                      >
                        Отмена
                      </button>
                      <button
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid rgba(26,107,60,0.34)', background: 'linear-gradient(180deg, rgba(38,174,102,0.16), rgba(26,107,60,0.12))',
                          color: '#1A6B3C', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                        onClick={() => { closeOrder.mutate(order.id); onClose(); }}
                      >
                        Да, завершить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : paymentStatus === 'paid' || canShipWithoutPayment ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {canShipWithoutPayment && paymentStatus !== 'paid' && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--fill-warning)',
                    background: 'rgba(245,158,11,0.08)',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  }}>
                    <AlertTriangle size={15} style={{ color: 'var(--fill-warning)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--fill-warning)', fontWeight: 600 }}>
                      Заказ не оплачен — остаток: {fmtMoney(totalAmount - paidAmount)}. Отправка производится вручную.
                    </span>
                  </div>
                )}
                {showShipForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Пометки к отгрузке
                    </div>
                    {[
                      { key: 'courierType', label: 'Способ доставки', placeholder: 'Курьер, самовывоз, СДЭК…' },
                      { key: 'recipientName', label: 'ФИО получателя', placeholder: 'Иванов Иван Иванович' },
                      { key: 'recipientAddress', label: 'Адрес доставки', placeholder: 'ул. Абая 10, кв. 5' },
                      { key: 'shippingNote', label: 'Комментарий', placeholder: 'Любые пометки…' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, fontWeight: 600 }}>{label}</div>
                        <input
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: '7px 10px', fontSize: 13,
                            background: 'var(--bg-surface-inset)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 6, color: 'var(--text-primary)',
                          }}
                          placeholder={placeholder}
                          value={shipFormData[key as keyof typeof shipFormData]}
                          onChange={(e) => setShipFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid var(--border-default)', background: 'var(--bg-surface-inset)',
                          color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                        onClick={() => setShowShipForm(false)}
                      >
                        Отмена
                      </button>
                      <button
                        style={{
                          flex: 2, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid rgba(26,107,60,0.34)', background: 'linear-gradient(180deg, rgba(38,174,102,0.16), rgba(26,107,60,0.12))',
                          color: '#1A6B3C', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                        disabled={shipOrder.isPending}
                        onClick={() => {
                          shipOrder.mutate({
                            id: order.id,
                            courierType: shipFormData.courierType.trim() || undefined,
                            recipientName: shipFormData.recipientName.trim() || undefined,
                            recipientAddress: shipFormData.recipientAddress.trim() || undefined,
                            shippingNote: shipFormData.shippingNote.trim() || undefined,
                          }, { onSuccess: onClose });
                        }}
                      >
                        <Send size={12} />
                        {shipOrder.isPending ? 'Отправка...' : 'Подтвердить'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap', alignItems: 'stretch' }}>
                    <button
                      style={{
                        flex: '1 1 120px',
                        minWidth: '100px',
                        padding: '8px 14px',
                        border: '1px solid rgba(26,107,60,0.34)',
                        borderRadius: 8,
                        background: 'linear-gradient(180deg, rgba(38,174,102,0.16), rgba(26,107,60,0.12))',
                        color: '#1A6B3C',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onClick={() => setShowShipForm(true)}
                    >
                      <Send size={14} />
                      Отправить клиенту
                    </button>
                    {status === 'on_warehouse' && (
                      <button
                        style={{
                          padding: '8px 14px',
                          border: '1px solid var(--fill-negative)',
                          borderRadius: 8,
                          background: 'rgba(239,68,68,0.08)',
                          color: 'var(--fill-negative)',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                        onClick={() => setShowReturnForm(true)}
                      >
                        <RotateCcw size={14} />
                        Вернуть
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'stretch' }}>
                <div style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fill-negative)',
                  background: 'rgba(239,68,68,0.08)', display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <AlertTriangle size={15} style={{ color: 'var(--fill-negative)', flexShrink: 0 }} />
                    <strong style={{ color: 'var(--fill-negative)' }}>Заказ не оплачен</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 23 }}>
                    Остаток: {fmtMoney(totalAmount - paidAmount)} — свяжитесь с менеджером
                  </div>
                </div>
                {status === 'on_warehouse' && (
                  <button
                    style={{
                      padding: '8px 14px',
                      border: '1px solid var(--fill-negative)',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)',
                      color: 'var(--fill-negative)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                    }}
                    onClick={() => setShowReturnForm(true)}
                  >
                    <RotateCcw size={14} />
                    Вернуть
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
