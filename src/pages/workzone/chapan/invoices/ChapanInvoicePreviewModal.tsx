import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, PencilLine, Save, X } from 'lucide-react';
import { useInvoice, useSaveInvoiceDocument } from '../../../../entities/order/queries';
import { apiClient } from '../../../../shared/api/client';
import type {
  InvoiceDocumentPayload,
  InvoiceDocumentRow,
  InvoiceDocumentSourceOrder,
} from '../../../../entities/order/types';
import styles from './ChapanInvoicePreviewModal.module.css';

const TABLE_KEYS = [
  'itemNumber',
  'productName',
  'gender',
  'length',
  'size',
  'color',
  'quantity',
  'orders',
  'unitPrice',
] as const satisfies ReadonlyArray<keyof InvoiceDocumentRow>;

const WAREHOUSE_PRICE_LABEL = 'Внутр. цена';
const ALL_ORDERS_FILTER = '__all__';

function cloneDocument(document: InvoiceDocumentPayload): InvoiceDocumentPayload {
  return JSON.parse(JSON.stringify(document)) as InvoiceDocumentPayload;
}

function serializeDocument(document: InvoiceDocumentPayload | null) {
  return document ? JSON.stringify(document) : '';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value);
}

function formatSourceOrders(sourceOrders?: InvoiceDocumentSourceOrder[]) {
  if (!sourceOrders || sourceOrders.length === 0) {
    return 'Связка с заказами не сохранена';
  }

  return sourceOrders.map((sourceOrder) => `#${sourceOrder.orderNumber}`).join(' / ');
}

function rowContainsOrder(row: InvoiceDocumentRow, orderId: string) {
  return (row.sourceOrders ?? []).some((sourceOrder) => sourceOrder.orderId === orderId);
}

function calculateTotals(document: InvoiceDocumentPayload | null) {
  if (!document) {
    return { totalQuantity: 0, totalAmount: 0 };
  }

  return calculateRowTotals(document.rows);
}

function calculateRowTotals(rows: InvoiceDocumentRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.totalQuantity += Number(row.quantity) || 0;
      acc.totalAmount += (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
      return acc;
    },
    { totalQuantity: 0, totalAmount: 0 },
  );
}

function collectSourceOrders(document: InvoiceDocumentPayload | null) {
  if (!document) {
    return [];
  }

  const orderMap = new Map<string, {
    orderId: string;
    orderNumber: string;
    rowCount: number;
    rows: string[];
  }>();

  for (const row of document.rows) {
    for (const sourceOrder of row.sourceOrders ?? []) {
      const existing = orderMap.get(sourceOrder.orderId);
      if (existing) {
        existing.rowCount += 1;
        existing.rows.push(row.id);
        continue;
      }

      orderMap.set(sourceOrder.orderId, {
        orderId: sourceOrder.orderId,
        orderNumber: sourceOrder.orderNumber,
        rowCount: 1,
        rows: [row.id],
      });
    }
  }

  return Array.from(orderMap.values()).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, 'ru'));
}

interface Props {
  invoiceId?: string | null;
  open: boolean;
  onClose: () => void;
  draftDocument?: InvoiceDocumentPayload | null;
  draftTitle?: string | null;
  loading?: boolean;
  onDraftSave?: (document: InvoiceDocumentPayload) => Promise<void> | void;
  footer?: React.ReactNode;
}

export default function ChapanInvoicePreviewModal({
  invoiceId = null,
  open,
  onClose,
  draftDocument,
  draftTitle,
  loading = false,
  onDraftSave,
  footer,
}: Props) {
  const invoiceMode = Boolean(invoiceId);
  const { data: invoice, isLoading: invoiceLoading } = useInvoice(invoiceId ?? '');
  const saveDocument = useSaveInvoiceDocument();

  const [draft, setDraft] = useState<InvoiceDocumentPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string>(ALL_ORDERS_FILTER);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const sourceDocument = invoiceMode ? (invoice?.documentPayload ?? null) : (draftDocument ?? null);
  const effectiveLoading = invoiceMode ? invoiceLoading : loading;
  const titleValue = invoiceMode
    ? `Накладная №${invoice?.invoiceNumber ?? invoiceId ?? ''}`
    : (draft?.invoiceNumber ? `Черновик №-${draft.invoiceNumber}` : (draftTitle ?? 'Черновик накладной'));

  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setSavedSnapshot('');
    setEditing(false);
    setConfirmCloseOpen(false);
    setActiveOrderId(ALL_ORDERS_FILTER);
    setActiveRowId(null);
  }, [invoiceId, open, draftTitle]);

  useEffect(() => {
    if (!open || !sourceDocument) return;
    const next = cloneDocument(sourceDocument);
    setDraft(next);
    setSavedSnapshot(serializeDocument(next));
    setEditing(false);
    setConfirmCloseOpen(false);
    setActiveOrderId(ALL_ORDERS_FILTER);
    setActiveRowId(next.rows[0]?.id ?? null);
  }, [open, sourceDocument]);

  const dirty = draft !== null && serializeDocument(draft) !== savedSnapshot;
  const totals = useMemo(() => calculateTotals(draft), [draft]);
  const sourceOrders = useMemo(() => collectSourceOrders(draft), [draft]);

  const visibleRows = useMemo(() => {
    if (!draft) {
      return [];
    }

    if (activeOrderId === ALL_ORDERS_FILTER) {
      return draft.rows;
    }

    return draft.rows.filter((row) => rowContainsOrder(row, activeOrderId));
  }, [activeOrderId, draft]);
  const visibleTotals = useMemo(() => calculateRowTotals(visibleRows), [visibleRows]);
  const activeOrder = useMemo(
    () => sourceOrders.find((order) => order.orderId === activeOrderId) ?? null,
    [activeOrderId, sourceOrders],
  );

  useEffect(() => {
    if (!draft) {
      return;
    }

    if (activeOrderId !== ALL_ORDERS_FILTER && !sourceOrders.some((order) => order.orderId === activeOrderId)) {
      setActiveOrderId(ALL_ORDERS_FILTER);
    }
  }, [activeOrderId, draft, sourceOrders]);

  useEffect(() => {
    if (!visibleRows.some((row) => row.id === activeRowId)) {
      setActiveRowId(visibleRows[0]?.id ?? null);
    }
  }, [activeRowId, visibleRows]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (saveDocument.isPending) return;
      if (dirty) {
        setConfirmCloseOpen(true);
        return;
      }
      setEditing(false);
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dirty, onClose, open, saveDocument.isPending]);

  if (!open) {
    return null;
  }

  async function handleSave() {
    if (!draft) return false;

    if (invoiceMode && invoice) {
      const saved = await saveDocument.mutateAsync({ id: invoice.id, documentPayload: draft });
      const next = cloneDocument(saved.documentPayload ?? draft);
      setDraft(next);
      setSavedSnapshot(serializeDocument(next));
      setEditing(false);
      return true;
    }

    if (onDraftSave) {
      await onDraftSave(draft);
    }

    const next = cloneDocument(draft);
    setDraft(next);
    setSavedSnapshot(serializeDocument(next));
    setEditing(false);
    return true;
  }

  async function handleDownload() {
    if (!invoiceMode || !invoiceId || downloading) return;
    setDownloading(true);
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
      link.download = `nakladnaya-${invoice?.invoiceNumber ?? invoiceId.slice(0, 8)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function attemptClose() {
    if (saveDocument.isPending) return;
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }
    setEditing(false);
    onClose();
  }

  function resetDraft() {
    if (!sourceDocument) return;
    const next = cloneDocument(sourceDocument);
    setDraft(next);
    setSavedSnapshot(serializeDocument(next));
    setEditing(false);
    setActiveOrderId(ALL_ORDERS_FILTER);
    setActiveRowId(next.rows[0]?.id ?? null);
  }

  function updateRow(rowId: string, key: keyof InvoiceDocumentRow, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => {
          if (row.id !== rowId) return row;
          if (key === 'quantity' || key === 'unitPrice' || key === 'warehouseUnitPrice') {
            return { ...row, [key]: value === '' ? null : Number(value) || 0 };
          }
          return { ...row, [key]: value };
        }),
      };
    });
  }

  return (
    <div className={styles.overlay} onClick={() => void attemptClose()}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}>
              <Eye size={18} />
            </div>
            <div>
              <div className={styles.titleText}>Просмотр накладной</div>
              <div className={styles.subtitle}>{titleValue}</div>
            </div>
          </div>

          <div className={styles.headerActions}>
            {invoiceMode && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => void handleDownload()}
                disabled={downloading || !invoice}
              >
                <Download size={14} />
                {downloading ? 'Скачивание...' : 'Скачать'}
              </button>
            )}
            {!editing ? (
              <button type="button" className={styles.secondaryBtn} onClick={() => setEditing(true)} disabled={!draft}>
                <PencilLine size={14} />
                Редактировать
              </button>
            ) : (
              <>
                <button type="button" className={styles.ghostBtn} onClick={resetDraft}>
                  Отмена
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void handleSave()}
                  disabled={!dirty || saveDocument.isPending}
                >
                  <Save size={14} />
                  {saveDocument.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
              </>
            )}

            <button type="button" className={styles.iconBtn} onClick={() => void attemptClose()}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {effectiveLoading && <div className={styles.state}>Подготавливаем накладную...</div>}

          {!effectiveLoading && !draft && (
            <div className={styles.state}>Не удалось открыть preview накладной</div>
          )}

          {!effectiveLoading && draft && (
            <div className={styles.workspace}>
              <aside className={styles.ordersPanel}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitle}>Заказы в накладной</div>
                  <div className={styles.panelSubTitle}>
                    Нажмите на заказ, чтобы увидеть только связанные строки
                  </div>
                </div>

                <button
                  type="button"
                  className={`${styles.orderCard} ${activeOrderId === ALL_ORDERS_FILTER ? styles.orderCardActive : ''}`}
                  onClick={() => setActiveOrderId(ALL_ORDERS_FILTER)}
                >
                  <div className={styles.orderCardTop}>
                    <strong>Все заказы</strong>
                    <span>{draft.rows.length} строк</span>
                  </div>
                  <div className={styles.orderCardMeta}>
                    Общая сводная таблица по текущей накладной
                  </div>
                </button>

                <div className={styles.orderList}>
                  {sourceOrders.map((order) => (
                    <button
                      key={order.orderId}
                      type="button"
                      className={`${styles.orderCard} ${activeOrderId === order.orderId ? styles.orderCardActive : ''}`}
                      onClick={() => setActiveOrderId(order.orderId)}
                    >
                      <div className={styles.orderCardTop}>
                        <strong>#{order.orderNumber}</strong>
                        <span>{order.rowCount} строк</span>
                      </div>
                      <div className={styles.orderCardMeta}>
                        Входит в {order.rowCount} сводн{order.rowCount === 1 ? 'ую строку' : order.rowCount < 5 ? 'ые строки' : 'ых строк'}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <section className={styles.content}>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <span>Дата накладной</span>
                    <strong>{draft.invoiceDate || '-'}</strong>
                  </div>
                  <div className={styles.summaryCard}>
                    <span>Рейс</span>
                    <strong>{draft.route || '-'}</strong>
                  </div>
                  <div className={styles.summaryCard}>
                    <span>Сводных строк</span>
                    <strong>{visibleRows.length}</strong>
                  </div>
                  <div className={styles.summaryCard}>
                    <span>{activeOrder ? 'Итого в фильтре' : 'Итого по документу'}</span>
                    <strong>{formatMoney(activeOrder ? visibleTotals.totalAmount : totals.totalAmount)} ₸</strong>
                  </div>
                </div>

                {activeOrder && (
                  <div className={styles.filterBanner}>
                    <div className={styles.filterBannerText}>
                      Сейчас открыт заказ <strong>#{activeOrder.orderNumber}</strong>.
                      В таблице показаны только связанные строки, количество: <strong>{visibleRows.length}</strong>.
                    </div>
                    <button
                      type="button"
                      className={styles.filterReset}
                      onClick={() => setActiveOrderId(ALL_ORDERS_FILTER)}
                    >
                      Показать всю накладную
                    </button>
                  </div>
                )}

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <div className={styles.sectionTitle}>Таблица накладной</div>
                      <div className={styles.sectionSubtitle}>
                        {activeOrderId === ALL_ORDERS_FILTER
                          ? 'Показана полная сводная таблица'
                          : 'Показаны только строки по выбранному заказу'}
                      </div>
                    </div>
                    <div className={styles.sectionBadge}>
                      {activeOrder ? `Заказ #${activeOrder.orderNumber}` : 'Все заказы'}
                    </div>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          {Object.entries(draft.columns)
                            .filter(([key]) => key !== 'lineTotal')
                            .map(([key, label]) => (
                              <th key={key}>{label}</th>
                            ))}
                          {visibleRows.some((r) => r.warehouseUnitPrice != null) && (
                            <th>{WAREHOUSE_PRICE_LABEL}</th>
                          )}
                          {draft.columns.lineTotal && <th>{draft.columns.lineTotal}</th>}
                        </tr>
                      </thead>

                      <tbody>
                        {visibleRows.map((row) => {
                          const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                          const isActive = row.id === activeRowId;
                          const showWarehousePrice = visibleRows.some((r) => r.warehouseUnitPrice != null);
                          return (
                            <tr
                              key={row.id}
                              className={`${styles.tableRow} ${isActive ? styles.tableRowActive : ''}`}
                              onClick={() => setActiveRowId(row.id)}
                            >
                              {TABLE_KEYS.map((key) => (
                                <td key={key}>
                                  {editing && (key === 'unitPrice' || key === 'quantity') ? (
                                    <input
                                      type="number"
                                      step="any"
                                      value={String(row[key] ?? '')}
                                      onChange={(event) => updateRow(row.id, key, event.target.value)}
                                      className={styles.cellInput}
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                  ) : key === 'orders' ? (
                                    <div className={styles.orderChipsCell}>
                                      {(row.sourceOrders ?? []).length > 0 ? (
                                        row.sourceOrders!.map((sourceOrder) => (
                                          <button
                                            key={sourceOrder.orderId}
                                            type="button"
                                            className={`${styles.orderChip} ${activeOrderId === sourceOrder.orderId ? styles.orderChipActive : ''}`}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setActiveOrderId(sourceOrder.orderId);
                                              setActiveRowId(row.id);
                                            }}
                                          >
                                            #{sourceOrder.orderNumber}
                                          </button>
                                        ))
                                      ) : (
                                        <div className={styles.readonlyCell}>{row.orders || formatSourceOrders(row.sourceOrders)}</div>
                                      )}
                                    </div>
                                  ) : (
                                    String(row[key] ?? '')
                                  )}
                                </td>
                              ))}
                              {showWarehousePrice && (
                                <td>
                                  {editing ? (
                                    <input
                                      type="number"
                                      step="any"
                                      value={row.warehouseUnitPrice != null ? String(row.warehouseUnitPrice) : ''}
                                      onChange={(event) => updateRow(row.id, 'warehouseUnitPrice', event.target.value)}
                                      className={styles.cellInput}
                                      placeholder="—"
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                  ) : (
                                    row.warehouseUnitPrice != null ? formatMoney(row.warehouseUnitPrice) : '—'
                                  )}
                                </td>
                              )}
                              <td className={styles.lineTotal}>{formatMoney(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </section>
            </div>
          )}
        </div>

        {footer && (
          <div className={styles.modalFooter}>
            {footer}
          </div>
        )}

        {confirmCloseOpen && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmDialog}>
              <div className={styles.confirmTitle}>Сохранить изменения?</div>
              <div className={styles.confirmText}>
                Вы закрываете preview с несохранёнными правками накладной.
              </div>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={async () => {
                    const ok = await handleSave();
                    if (!ok) return;
                    setConfirmCloseOpen(false);
                    onClose();
                  }}
                  disabled={saveDocument.isPending}
                >
                  Да
                </button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setConfirmCloseOpen(false);
                    setEditing(false);
                    onClose();
                  }}
                  disabled={saveDocument.isPending}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
