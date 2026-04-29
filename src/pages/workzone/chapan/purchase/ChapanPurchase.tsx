import { useState } from 'react';
import { Download, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { useManualInvoices, useDeleteManualInvoice } from '../../../../entities/purchase/queries';
import { purchaseApi } from '../../../../entities/purchase/api';
import { getFilenameFromContentDisposition, triggerBrowserDownload } from '../../../../shared/lib/browserDownload';
import ManualInvoiceForm from './ManualInvoiceForm';
import styles from './ChapanPurchase.module.css';

type Tab = 'workshop' | 'market';

const TAB_LABELS: Record<Tab, string> = {
  workshop: 'Цех',
  market: 'Базар',
};

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

export default function ChapanPurchasePage() {
  const [tab, setTab] = useState<Tab>('workshop');
  const [formOpen, setFormOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: workshopData, isLoading: wLoading, isError: wError } = useManualInvoices('workshop');
  const { data: marketData, isLoading: mLoading, isError: mError } = useManualInvoices('market');
  const deleteInvoice = useDeleteManualInvoice();

  const workshopList = workshopData?.results ?? [];
  const marketList = marketData?.results ?? [];
  const current = tab === 'workshop' ? workshopList : marketList;
  const isLoading = wLoading || mLoading;
  const isError = wError || mError;

  async function handleDownload(id: string, invoiceNum: string) {
    if (downloadingId) return;

    try {
      setDownloadingId(id);
      const response = await purchaseApi.download(id);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const filename = getFilenameFromContentDisposition(
        response.headers['content-disposition'],
        `zakup_${invoiceNum}.xlsx`,
      );
      triggerBrowserDownload(blob, filename);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className={`${styles.root} kort-page-enter`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <ShoppingCart size={18} />
          <span>Закуп</span>
        </div>
        <button type="button" className={styles.createBtn} onClick={() => setFormOpen(true)}>
          <Plus size={14} />
          Новая накладная
        </button>
      </div>

      <div className={styles.tabs}>
        {(['workshop', 'market'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
            <span className={styles.tabBadge}>
              {t === 'workshop' ? workshopList.length : marketList.length}
            </span>
          </button>
        ))}
      </div>

      {isError && (
        <div className="kort-inline-error">
          <AlertCircle size={16} />
          Не удалось загрузить накладные.
        </div>
      )}

      {isLoading && <div className={styles.loadingBar} />}

      {!isLoading && current.length === 0 && (
        <div className={styles.empty}>
          Накладных в разделе «{TAB_LABELS[tab]}» пока нет
        </div>
      )}

      {current.length > 0 && (
        <div className={styles.list}>
          {current.map((inv) => {
            const total = inv.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
            const date = new Date(inv.createdAt).toLocaleDateString('ru-RU', {
              day: '2-digit', month: 'short', year: 'numeric',
            });
            return (
              <div key={inv.id} className={styles.card}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardNum}>{inv.invoiceNum}</div>
                  <div className={styles.cardTitle}>{inv.title}</div>
                  <div className={styles.cardMeta}>
                    {date} · {inv.createdByName} · {inv.items.length} поз.
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <div className={styles.cardTotal}>{fmt(total)}</div>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Скачать XLSX"
                    aria-label="Скачать XLSX"
                    disabled={downloadingId === inv.id}
                    onClick={() => void handleDownload(inv.id, inv.invoiceNum)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    title="Удалить"
                    aria-label="Удалить накладную"
                    onClick={() => deleteInvoice.mutate(inv.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <ManualInvoiceForm type={tab} onClose={() => setFormOpen(false)} />
      )}
    </div>
  );
}
