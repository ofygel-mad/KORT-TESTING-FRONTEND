import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Archive, Download, Plus, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react';
import {
  useArchiveManualInvoice,
  useDeleteManualInvoice,
  useManualInvoices,
  useRestoreManualInvoice,
} from '../../../../entities/purchase/queries';
import { purchaseApi } from '../../../../entities/purchase/api';
import type { ManualInvoice } from '../../../../entities/purchase/types';
import { getFilenameFromContentDisposition, triggerBrowserDownload } from '../../../../shared/lib/browserDownload';
import { useCurrency } from '../../../../shared/hooks/useCurrency';
import { formatMoney } from '../../../../shared/utils/format';
import ManualInvoiceForm from './ManualInvoiceForm';
import PurchaseInvoicePreviewModal from './PurchaseInvoicePreviewModal';
import styles from './ChapanPurchase.module.css';

type Tab = 'workshop' | 'market';
type Scope = 'active' | 'archived';

const TAB_LABELS: Record<Tab, string> = {
  workshop: '\u0426\u0435\u0445',
  market: '\u0411\u0430\u0437\u0430\u0440',
};

const SCOPE_LABELS: Record<Scope, string> = {
  active: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435',
  archived: '\u0410\u0440\u0445\u0438\u0432',
};

function calculateInvoiceTotal(invoice: ManualInvoice) {
  return invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function formatInvoiceDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ChapanPurchasePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('workshop');
  const [formOpen, setFormOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const currency = useCurrency();

  const scope = (searchParams.get('view') === 'archived' ? 'archived' : 'active') as Scope;
  const setScope = (newScope: Scope) => {
    if (newScope === 'active') {
      searchParams.delete('view');
    } else {
      searchParams.set('view', 'archived');
    }
    setSearchParams(searchParams);
  };

  const activeWorkshop = useManualInvoices('workshop', false);
  const activeMarket = useManualInvoices('market', false);
  const archivedWorkshop = useManualInvoices('workshop', true);
  const archivedMarket = useManualInvoices('market', true);

  const archiveInvoice = useArchiveManualInvoice();
  const restoreInvoice = useRestoreManualInvoice();
  const deleteInvoice = useDeleteManualInvoice();

  const activeLists = useMemo(
    () => ({
      workshop: activeWorkshop.data?.results ?? [],
      market: activeMarket.data?.results ?? [],
    }),
    [activeMarket.data?.results, activeWorkshop.data?.results],
  );
  const archivedLists = useMemo(
    () => ({
      workshop: archivedWorkshop.data?.results ?? [],
      market: archivedMarket.data?.results ?? [],
    }),
    [archivedMarket.data?.results, archivedWorkshop.data?.results],
  );

  const currentLists = scope === 'active' ? activeLists : archivedLists;
  const current = currentLists[tab];
  const isLoading = scope === 'active'
    ? activeWorkshop.isLoading || activeMarket.isLoading
    : archivedWorkshop.isLoading || archivedMarket.isLoading;
  const isError = scope === 'active'
    ? activeWorkshop.isError || activeMarket.isError
    : archivedWorkshop.isError || archivedMarket.isError;
  const archivedCount = archivedLists.workshop.length + archivedLists.market.length;

  async function handleDownload(id: string, invoiceNum: string) {
    if (downloadingId) return;

    try {
      setDownloadingId(id);
      const response = await purchaseApi.download(id, currency);
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
      <div aria-hidden={previewId !== null}>
        <div className={styles.header}>
          <div>
            <div className={styles.headerTitle}>
              <ShoppingCart size={18} />
              <span>{'\u0417\u0430\u043a\u0443\u043f'}</span>
            </div>
            <div className={styles.headerSubtitle}>
              {scope === 'active'
                ? '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0441\u043e\u0441\u0442\u0430\u0432, \u043f\u043e\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0438 \u0438\u043b\u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0432 \u0430\u0440\u0445\u0438\u0432.'
                : '\u0410\u0440\u0445\u0438\u0432 \u0434\u0435\u0440\u0436\u0438\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435 \u0438 \u0443\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u044b\u0435 \u0431\u0435\u0437 \u0437\u0430\u0441\u043e\u0440\u0435\u043d\u0438\u044f \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0433\u043e \u0441\u043f\u0438\u0441\u043a\u0430.'}
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.scopeBtn} ${scope === 'archived' ? styles.scopeBtnActive : ''}`}
              onClick={() => setScope(scope === 'active' ? 'archived' : 'active')}
            >
              <Archive size={14} />
              {scope === 'active' ? '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0430\u0440\u0445\u0438\u0432' : '\u041a \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u043c'}
              <span className={styles.scopeBadge}>{archivedCount}</span>
            </button>
            {scope === 'active' && (
              <button type="button" className={styles.createBtn} onClick={() => setFormOpen(true)}>
                <Plus size={14} />
                {'\u041d\u043e\u0432\u0430\u044f \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0430\u044f'}
              </button>
            )}
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {(['workshop', 'market'] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.tab} ${tab === item ? styles.tabActive : ''}`}
                onClick={() => setTab(item)}
              >
                {TAB_LABELS[item]}
                <span className={styles.tabBadge}>{currentLists[item].length}</span>
              </button>
            ))}
          </div>

          <div className={styles.scopeMeta}>
            <span className={styles.scopeMetaLabel}>{SCOPE_LABELS[scope]}</span>
            <strong>{current.length}</strong>
          </div>
        </div>

        {isError && (
          <div className="kort-inline-error">
            <AlertCircle size={16} />
            {'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u044b\u0435.'}
          </div>
        )}

        {isLoading && <div className={styles.loadingBar} />}

        {!isLoading && current.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>
              {scope === 'active'
                ? '\u0412 \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u044b\u0445'
                : '\u0410\u0440\u0445\u0438\u0432 \u043f\u043e\u043a\u0430 \u043f\u0443\u0441\u0442'}
            </div>
            <div className={styles.emptyText}>
              {scope === 'active'
                ? `\u0414\u043b\u044f \u0432\u043a\u043b\u0430\u0434\u043a\u0438 \u00ab${TAB_LABELS[tab]}\u00bb \u043c\u043e\u0436\u043d\u043e \u0441\u0440\u0430\u0437\u0443 \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0435\u0440\u0432\u0443\u044e \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e.`
                : '\u0410\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u044b\u0435 \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c.'}
            </div>
          </div>
        )}

        {current.length > 0 && (
          <div className={styles.list}>
            {current.map((invoice) => {
              const total = calculateInvoiceTotal(invoice);
              const itemPreview = invoice.items
                .slice(0, 3)
                .map((item) => item.productName)
                .join(', ');
              return (
                <article
                  key={invoice.id}
                  className={`${styles.card} ${scope === 'archived' ? styles.cardArchived : ''}`}
                  aria-label={`${invoice.invoiceNum} ${invoice.title}`}
                  onClick={() => setPreviewId(invoice.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setPreviewId(invoice.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.cardInfo}>
                    <div className={styles.cardTopLine}>
                      <div className={styles.cardNum}>{invoice.invoiceNum}</div>
                      {invoice.archivedAt && (
                        <span className={styles.cardStatus}>{'\u0412 \u0430\u0440\u0445\u0438\u0432\u0435'}</span>
                      )}
                    </div>
                    <div className={styles.cardTitle}>{invoice.title}</div>
                    <div className={styles.cardMeta}>
                      {formatInvoiceDate(invoice.createdAt)} {'\u00b7'} {invoice.createdByName} {'\u00b7'} {invoice.items.length}{' '}
                      {'\u043f\u043e\u0437.'}
                    </div>
                    <div className={styles.cardPreview}>
                      {itemPreview || '\u2014'}
                      {invoice.items.length > 3 ? ` +${invoice.items.length - 3}` : ''}
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <div className={styles.cardTotal}>{formatMoney(total, currency)}</div>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={'\u0421\u043a\u0430\u0447\u0430\u0442\u044c XLSX'}
                      aria-label={'\u0421\u043a\u0430\u0447\u0430\u0442\u044c XLSX'}
                      disabled={downloadingId === invoice.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownload(invoice.id, invoice.invoiceNum);
                      }}
                    >
                      <Download size={14} />
                    </button>
                    {scope === 'active' ? (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title={'\u0410\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}
                        aria-label={'\u0410\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e'}
                        disabled={archiveInvoice.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          archiveInvoice.mutate(invoice.id);
                        }}
                      >
                        <Archive size={14} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title={'\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c'}
                          aria-label={'\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e'}
                          disabled={restoreInvoice.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            restoreInvoice.mutate(invoice.id);
                          }}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          title={'\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430'}
                          aria-label={'\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430'}
                          disabled={deleteInvoice.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteInvoice.mutate(invoice.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && <ManualInvoiceForm type={tab} onClose={() => setFormOpen(false)} />}

      <PurchaseInvoicePreviewModal
        invoiceId={previewId}
        open={previewId !== null}
        onClose={() => setPreviewId(null)}
        onRemoved={() => setPreviewId(null)}
      />
    </div>
  );
}
