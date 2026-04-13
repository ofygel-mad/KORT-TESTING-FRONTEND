import { useState } from 'react';
import { FileText, Check, Clock, X, Download, AlertTriangle } from 'lucide-react';
import {
  useInvoices,
  useConfirmWarehouse,
  useRejectInvoice,
} from '../../../../entities/order/queries';
import type { ChapanInvoice, InvoiceStatus } from '../../../../entities/order/types';
import { useChapanPermissions } from '../../../../shared/hooks/useChapanPermissions';
import styles from './ChapanInvoices.module.css';

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending_confirmation: 'Ожидает',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
  archived: 'Архив',
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  pending_confirmation: '#F59E0B',
  confirmed: '#10B981',
  rejected: '#EF4444',
  archived: '#6B7280',
};

type TabKey = '' | 'pending_confirmation' | 'confirmed' | 'rejected';

const TABS: { key: TabKey; label: string }[] = [
  { key: '', label: 'Все' },
  { key: 'pending_confirmation', label: 'Ожидают' },
  { key: 'confirmed', label: 'Подтверждены' },
  { key: 'rejected', label: 'Отклонены' },
];

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-KZ', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function ChapanInvoicesPage() {
  const [tab, setTab] = useState<TabKey>('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { canConfirmInvoice, canAccessWarehouseNav } = useChapanPermissions();

  const { data, isLoading, isError } = useInvoices({
    status: tab || undefined,
    limit: 200,
  });

  const invoices: ChapanInvoice[] = data?.results ?? [];

  const confirmWarehouse = useConfirmWarehouse();
  const rejectInvoice = useRejectInvoice();

  function handleRejectSubmit() {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectInvoice.mutate(
      { id: rejectTarget, reason: rejectReason.trim() },
      { onSuccess: () => { setRejectTarget(null); setRejectReason(''); } },
    );
  }

  async function handleDownload(invoiceId: string, invoiceNumber: string) {
    const { apiClient } = await import('../../../../shared/api/client');
    try {
      const response = await apiClient.get(`/chapan/invoices/${invoiceId}/download`, {
        params: { style: 'branded' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nakladnaya-${invoiceNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <FileText size={18} />
          <span>Накладные</span>
        </div>
        <div className={styles.headerSub}>Передача заказов на склад с двусторонним подтверждением</div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && !isError && invoices.length > 0 && (() => {
        const now = Date.now();
        const pending = invoices.filter((inv) => inv.status === 'pending_confirmation');
        const waitingSeamstress = pending.filter((inv) => !inv.seamstressConfirmed).length;
        const waitingWarehouse = pending.filter((inv) => !inv.warehouseConfirmed).length;
        const stale = pending.filter((inv) => {
          const confirmedAt = inv.seamstressConfirmedAt || inv.warehouseConfirmedAt;
          const ageH = confirmedAt
            ? (now - new Date(confirmedAt).getTime()) / 3_600_000
            : 0;
          return (inv.seamstressConfirmed !== inv.warehouseConfirmed) && ageH >= 24;
        }).length;
        if (pending.length === 0) return null;
        return (
          <div className={styles.sverkaBar}>
            <AlertTriangle size={14} style={{ flexShrink: 0, color: '#D97706' }} />
            <span className={styles.sverkaTitle}>Сверка:</span>
            {waitingSeamstress > 0 && <span className={styles.sverkaChip}>Ждёт цех: <strong>{waitingSeamstress}</strong></span>}
            {waitingWarehouse > 0 && <span className={styles.sverkaChip}>Ждёт склад: <strong>{waitingWarehouse}</strong></span>}
            {stale > 0 && <span className={`${styles.sverkaChip} ${styles.sverkaChipDanger}`}>Зависших: <strong>{stale}</strong></span>}
          </div>
        );
      })()}

      {!isLoading && <div className={styles.count}>{data?.count ?? 0} накладных</div>}

      {isLoading && (
        <div className={styles.loading}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {isError && <div className={styles.error}>Не удалось загрузить накладные</div>}

      {!isLoading && !isError && invoices.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>Накладных пока нет</div>
          <div className={styles.emptyText}>
            {tab
              ? 'Ничего не найдено по заданному фильтру'
              : 'Накладные создаются при передаче готовых заказов на склад из раздела «Готово»'}
          </div>
        </div>
      )}

      {!isLoading && !isError && invoices.length > 0 && (
        <div className={styles.list}>
          {invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              onConfirmWarehouse={() => confirmWarehouse.mutate(inv.id)}
              onReject={() => { setRejectTarget(inv.id); setRejectReason(''); }}
              onDownload={() => handleDownload(inv.id, inv.invoiceNumber)}
              isConfirming={confirmWarehouse.isPending}
              canConfirmWarehouseInvoice={canAccessWarehouseNav}
            />
          ))}
        </div>
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <div className={styles.confirmOverlay} onClick={() => setRejectTarget(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>Отклонить накладную</div>
            <div className={styles.confirmText}>Укажите причину отклонения:</div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отклонения..."
              style={{
                width: '100%', minHeight: 80, resize: 'vertical',
                background: 'var(--ch-surface)', border: '1px solid var(--ch-border)',
                borderRadius: 8, color: 'var(--ch-text)', fontFamily: 'inherit',
                fontSize: 13, padding: '10px 12px', outline: 'none', marginBottom: 16,
              }}
            />
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmSecondary} onClick={() => setRejectTarget(null)}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmDanger}
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || rejectInvoice.isPending}
              >
                {rejectInvoice.isPending ? 'Отклонение...' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({
  invoice,
  onConfirmWarehouse,
  onReject,
  onDownload,
  isConfirming,
  canConfirmWarehouseInvoice,
}: {
  invoice: ChapanInvoice;
  onConfirmWarehouse: () => void;
  onReject: () => void;
  onDownload: () => void;
  isConfirming: boolean;
  canConfirmWarehouseInvoice: boolean;
}) {
  const orderCount = invoice.items?.length ?? 0;
  const isPending = invoice.status === 'pending_confirmation';
  const oneConfirmed = invoice.seamstressConfirmed !== invoice.warehouseConfirmed;
  const confirmedAt = invoice.seamstressConfirmedAt || invoice.warehouseConfirmedAt;
  const ageHours = confirmedAt
    ? (Date.now() - new Date(confirmedAt).getTime()) / 3_600_000
    : 0;
  const isStale = isPending && oneConfirmed && ageHours >= 24;

  return (
    <div className={styles.row}>
      <div className={styles.rowNum}>
        <span className={styles.invoiceNumber}>
          #{invoice.invoiceNumber}
          {isStale && (
            <span className={styles.staleBadge}>
              <AlertTriangle size={10} /> Зависла
            </span>
          )}
        </span>
        <span className={styles.invoiceDate}>{fmtDate(invoice.createdAt)}</span>
        <span className={styles.creatorLine}>{invoice.createdByName}</span>
      </div>

      <div className={styles.rowOrderCount}>
        {orderCount} {orderCount === 1 ? 'заказ' : orderCount < 5 ? 'заказа' : 'заказов'}
      </div>

      <div className={styles.rowStatus}>
        <span
          className={styles.statusBadge}
          style={{ '--badge-color': STATUS_COLOR[invoice.status] } as React.CSSProperties}
        >
          {STATUS_LABEL[invoice.status]}
        </span>
        {invoice.status === 'rejected' && invoice.rejectionReason && (
          <span style={{ fontSize: 11, color: 'var(--ch-text-muted)' }} title={invoice.rejectionReason}>
            {invoice.rejectionReason.length > 30
              ? invoice.rejectionReason.slice(0, 30) + '...'
              : invoice.rejectionReason}
          </span>
        )}
      </div>

      <div className={styles.rowConfirm}>
        <span className={`${styles.confirmItem} ${invoice.seamstressConfirmed ? styles.confirmDone : styles.confirmPending}`}>
          {invoice.seamstressConfirmed ? <Check size={12} /> : <Clock size={12} />}
          Швея
        </span>
        <span className={`${styles.confirmItem} ${invoice.warehouseConfirmed ? styles.confirmDone : styles.confirmPending}`}>
          {invoice.warehouseConfirmed ? <Check size={12} /> : <Clock size={12} />}
          Склад
        </span>
        {invoice.seamstressConfirmed && invoice.seamstressConfirmedAt && (
          <span style={{ fontSize: 10, color: 'var(--ch-text-muted)' }}>
            {fmtDateTime(invoice.seamstressConfirmedAt)}
          </span>
        )}
      </div>

      <div className={styles.rowActions}>
        <button type="button" className={styles.downloadBtn} onClick={onDownload} title="Скачать XLSX">
          <Download size={13} />
        </button>

        {isPending && !invoice.warehouseConfirmed && canConfirmWarehouseInvoice && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
            onClick={(e) => { e.stopPropagation(); onConfirmWarehouse(); }}
            disabled={isConfirming}
          >
            <Check size={12} />
            Принято
          </button>
        )}

        {isPending && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={(e) => { e.stopPropagation(); onReject(); }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
