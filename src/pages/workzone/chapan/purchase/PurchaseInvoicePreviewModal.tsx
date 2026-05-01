import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Download, Eye, PencilLine, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import {
  useArchiveManualInvoice,
  useDeleteManualInvoice,
  useManualInvoice,
  useRestoreManualInvoice,
  useUpdateManualInvoice,
} from '../../../../entities/purchase/queries';
import type { ManualInvoice, PurchaseType } from '../../../../entities/purchase/types';
import { purchaseApi } from '../../../../entities/purchase/api';
import { useCatalogDefinitions, useOrderFormCatalog } from '../../../../entities/warehouse/queries';
import { useCurrency } from '../../../../shared/hooks/useCurrency';
import { getFilenameFromContentDisposition, triggerBrowserDownload } from '../../../../shared/lib/browserDownload';
import { SearchableSelect } from '../../../../shared/ui/SearchableSelect';
import { formatMoney } from '../../../../shared/utils/format';
import {
  buildPurchaseProductFieldMap,
  getGlobalWarehouseOptions,
  resolvePurchaseFieldOptions,
} from './catalog';
import styles from './PurchaseInvoicePreviewModal.module.css';

type DraftItem = {
  id: string;
  productName: string;
  gender: string;
  length: string;
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
};

type InvoiceDraft = {
  title: string;
  notes: string;
  items: DraftItem[];
};

const TYPE_LABELS: Record<PurchaseType, string> = {
  workshop: '\u0426\u0435\u0445',
  market: '\u0411\u0430\u0437\u0430\u0440',
};

const COLUMN_LABELS = {
  productName: '\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435',
  gender: '\u041f\u043e\u043b',
  length: '\u0414\u043b\u0438\u043d\u0430',
  color: '\u0426\u0432\u0435\u0442',
  size: '\u0420\u0430\u0437\u043c\u0435\u0440',
  quantity: '\u041a\u043e\u043b-\u0432\u043e',
  unitPrice: '\u0426\u0435\u043d\u0430',
  total: '\u0421\u0443\u043c\u043c\u0430',
};

function formatDate(value?: string | null) {
  if (!value) return '\u2014';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '\u2014';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function emptyDraftRow(): DraftItem {
  return {
    id: nanoid(),
    productName: '',
    gender: '',
    length: '',
    color: '',
    size: '',
    quantity: '1',
    unitPrice: '',
  };
}

function toDraft(invoice: ManualInvoice): InvoiceDraft {
  return {
    title: invoice.title,
    notes: invoice.notes ?? '',
    items: invoice.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      gender: item.gender ?? '',
      length: item.length ?? '',
      color: item.color ?? '',
      size: item.size ?? '',
      quantity: String(item.quantity),
      unitPrice: item.unitPrice ? String(item.unitPrice) : '',
    })),
  };
}

function serializeDraft(draft: InvoiceDraft | null) {
  return draft ? JSON.stringify(draft) : '';
}

function calculateRowTotal(item: DraftItem) {
  return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
}

function buildPayload(draft: InvoiceDraft) {
  return {
    title: draft.title.trim(),
    notes: draft.notes.trim() || undefined,
    items: draft.items
      .filter((item) => item.productName.trim())
      .map((item) => ({
        productName: item.productName.trim(),
        gender: item.gender.trim() || undefined,
        length: item.length.trim() || undefined,
        color: item.color.trim() || undefined,
        size: item.size.trim() || undefined,
        quantity: Math.max(1, Math.round(Number(item.quantity) || 0)),
        unitPrice: Number(item.unitPrice) || 0,
      })),
  };
}

interface Props {
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
  onRemoved?: () => void;
}

export default function PurchaseInvoicePreviewModal({
  invoiceId,
  open,
  onClose,
  onRemoved,
}: Props) {
  const currency = useCurrency();
  const { data: invoice, isLoading, isError } = useManualInvoice(invoiceId ?? '');
  const updateInvoice = useUpdateManualInvoice();
  const archiveInvoice = useArchiveManualInvoice();
  const restoreInvoice = useRestoreManualInvoice();
  const deleteInvoice = useDeleteManualInvoice();
  const { data: fieldDefinitions } = useCatalogDefinitions();
  const { data: orderFormCatalog } = useOrderFormCatalog();

  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const productMap = useMemo(() => buildPurchaseProductFieldMap(orderFormCatalog), [orderFormCatalog]);
  const productOptions = useMemo(() => Object.keys(productMap), [productMap]);
  const globalGenderOptions = useMemo(() => getGlobalWarehouseOptions(fieldDefinitions, 'gender'), [fieldDefinitions]);
  const globalLengthOptions = useMemo(() => getGlobalWarehouseOptions(fieldDefinitions, 'length'), [fieldDefinitions]);
  const globalColorOptions = useMemo(() => getGlobalWarehouseOptions(fieldDefinitions, 'color'), [fieldDefinitions]);
  const globalSizeOptions = useMemo(() => getGlobalWarehouseOptions(fieldDefinitions, 'size'), [fieldDefinitions]);
  const dirty = draft !== null && serializeDraft(draft) !== savedSnapshot;

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setSavedSnapshot('');
      setEditing(false);
      setConfirmCloseOpen(false);
      return;
    }
    if (!invoice) return;
    const nextDraft = toDraft(invoice);
    setDraft(nextDraft);
    setSavedSnapshot(serializeDraft(nextDraft));
    setEditing(false);
    setConfirmCloseOpen(false);
  }, [invoice, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      void attemptClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dirty, onClose, open, updateInvoice.isPending]);

  const totals = (draft?.items ?? []).reduce(
    (acc, item) => {
      acc.quantity += Number(item.quantity) || 0;
      acc.amount += calculateRowTotal(item);
      return acc;
    },
    { quantity: 0, amount: 0 },
  );
  const canEdit = Boolean(invoice && !invoice.archivedAt);
  const canSave = Boolean(
    draft
    && draft.title.trim()
    && buildPayload(draft).items.length > 0,
  );

  async function handleDownload() {
    if (!invoice || downloading) return;
    try {
      setDownloading(true);
      const response = await purchaseApi.download(invoice.id, currency);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const filename = getFilenameFromContentDisposition(
        response.headers['content-disposition'],
        `zakup_${invoice.invoiceNum}.xlsx`,
      );
      triggerBrowserDownload(blob, filename);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSave() {
    if (!invoice || !draft || !canSave) return false;
    const saved = await updateInvoice.mutateAsync({
      id: invoice.id,
      dto: buildPayload(draft),
    });
    const nextDraft = toDraft(saved);
    setDraft(nextDraft);
    setSavedSnapshot(serializeDraft(nextDraft));
    setEditing(false);
    return true;
  }

  async function attemptClose() {
    if (updateInvoice.isPending) return;
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }
    setEditing(false);
    onClose();
  }

  function resetDraft() {
    if (!invoice) return;
    const nextDraft = toDraft(invoice);
    setDraft(nextDraft);
    setSavedSnapshot(serializeDraft(nextDraft));
    setEditing(false);
  }

  function updateField<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateRow(index: number, key: keyof DraftItem, value: string) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item, itemIndex) => (
          itemIndex === index ? { ...item, [key]: value } : item
        )),
      };
    });
  }

  function addRow() {
    setDraft((current) => (
      current
        ? { ...current, items: [...current.items, emptyDraftRow()] }
        : current
    ));
  }

  function removeRow(index: number) {
    setDraft((current) => {
      if (!current) return current;
      if (current.items.length === 1) return current;
      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  async function handleArchive() {
    if (!invoice) return;
    await archiveInvoice.mutateAsync(invoice.id);
    setEditing(false);
  }

  async function handleRestore() {
    if (!invoice) return;
    await restoreInvoice.mutateAsync(invoice.id);
  }

  async function handleDelete() {
    if (!invoice) return;
    await deleteInvoice.mutateAsync(invoice.id);
    onRemoved?.();
    onClose();
  }

  const content = !open ? null : (
    <div className={styles.overlay} onClick={() => void attemptClose()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}>
              <Eye size={18} />
            </div>
            <div>
              <div id="purchase-preview-title" className={styles.titleText}>{'\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u043e\u0439'}</div>
              <div className={styles.subtitle}>
                {invoice ? `${invoice.invoiceNum} \u00b7 ${TYPE_LABELS[invoice.type]}` : '\u2014'}
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              title={'\u0421\u043a\u0430\u0447\u0430\u0442\u044c XLSX'}
              aria-label={'\u0421\u043a\u0430\u0447\u0430\u0442\u044c XLSX'}
              onClick={() => void handleDownload()}
              disabled={!invoice || downloading}
            >
              <Download size={14} />
              {downloading ? '\u0421\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u0435...' : '\u0421\u043a\u0430\u0447\u0430\u0442\u044c XLSX'}
            </button>
            {canEdit && !editing && (
              <button type="button" className={styles.secondaryBtn} onClick={() => setEditing(true)} disabled={!draft}>
                <PencilLine size={14} />
                {'\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c'}
              </button>
            )}
            {canEdit && editing && (
              <>
                <button type="button" className={styles.ghostBtn} onClick={resetDraft}>
                  {'\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c'}
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void handleSave()}
                  disabled={!dirty || !canSave || updateInvoice.isPending}
                >
                  <Save size={14} />
                  {updateInvoice.isPending ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...' : '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c'}
                </button>
              </>
            )}
            <button type="button" className={styles.iconBtn} onClick={() => void attemptClose()}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {invoice?.archivedAt && (
            <div className={styles.archiveBanner}>
              <div>
                <strong>{'\u041d\u0430\u043a\u043b\u0430\u0434\u043d\u0430\u044f \u0432 \u0430\u0440\u0445\u0438\u0432\u0435'}</strong>
                <span>{`\u0410\u0440\u0445\u0438\u0432: ${formatDateTime(invoice.archivedAt)}`}</span>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => void handleRestore()}
                disabled={restoreInvoice.isPending}
              >
                <RotateCcw size={14} />
                {restoreInvoice.isPending ? '\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435...' : '\u0412\u0435\u0440\u043d\u0443\u0442\u044c \u0432 \u0440\u0430\u0431\u043e\u0442\u0443'}
              </button>
            </div>
          )}

          {isLoading && <div className={styles.state}>{'\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e...'}</div>}
          {isError && <div className={styles.state}>{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e'}</div>}

          {!isLoading && !isError && invoice && draft && (
            <div className={styles.workspace}>
              <section className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>{'\u0422\u0438\u043f'}</span>
                  <strong>{TYPE_LABELS[invoice.type]}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>{'\u0421\u043e\u0437\u0434\u0430\u043d\u0430'}</span>
                  <strong>{formatDate(invoice.createdAt)}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>{'\u041f\u043e\u0437\u0438\u0446\u0438\u0439'}</span>
                  <strong>{draft.items.length}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>{'\u0418\u0442\u043e\u0433\u043e'}</span>
                  <strong>{formatMoney(totals.amount, currency)}</strong>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>{'\u0428\u0430\u043f\u043a\u0430 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430'}</div>
                    <div className={styles.panelSubtitle}>
                      {'\u0417\u0434\u0435\u0441\u044c \u043c\u043e\u0436\u043d\u043e \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435, \u043f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435 \u0438 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u043e\u0439.'}
                    </div>
                  </div>
                  {!invoice.archivedAt && (
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.warningBtn}
                        onClick={() => void handleArchive()}
                        disabled={archiveInvoice.isPending || editing}
                      >
                        <Archive size={14} />
                        {archiveInvoice.isPending ? '\u0410\u0440\u0445\u0438\u0432\u0430\u0446\u0438\u044f...' : '\u0412 \u0430\u0440\u0445\u0438\u0432'}
                      </button>
                    </div>
                  )}
                  {invoice.archivedAt && (
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => void handleDelete()}
                        disabled={deleteInvoice.isPending || editing}
                      >
                        <Trash2 size={14} />
                        {deleteInvoice.isPending ? '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435...' : '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0430\u0432\u0441\u0435\u0433\u0434\u0430'}
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>{'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435'}</span>
                    {editing ? (
                      <input
                        className={styles.input}
                        value={draft.title}
                        onChange={(event) => updateField('title', event.target.value)}
                      />
                    ) : (
                      <div className={styles.readonlyValue}>{draft.title || '\u2014'}</div>
                    )}
                  </label>

                  <label className={`${styles.field} ${styles.fieldWide}`}>
                    <span>{'\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435'}</span>
                    {editing ? (
                      <textarea
                        className={`${styles.input} ${styles.textarea}`}
                        value={draft.notes}
                        onChange={(event) => updateField('notes', event.target.value)}
                      />
                    ) : (
                      <div className={styles.readonlyValue}>{draft.notes || '\u2014'}</div>
                    )}
                  </label>

                  <div className={styles.metaStrip}>
                    <span>{`${'\u0421\u043e\u0437\u0434\u0430\u043b'}: ${invoice.createdByName}`}</span>
                    <span>{`${'\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430'}: ${formatDateTime(invoice.updatedAt)}`}</span>
                    <span>{`${'\u0421\u0443\u043c\u043c\u0430 \u043f\u043e\u0437\u0438\u0446\u0438\u0439'}: ${totals.quantity}`}</span>
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelTitle}>{'\u0421\u0442\u0440\u043e\u043a\u0438 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u043e\u0439'}</div>
                    <div className={styles.panelSubtitle}>
                      {'\u041c\u043e\u0436\u043d\u043e \u0438\u0441\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0434\u0435\u0442\u0430\u043b\u0438 \u0438\u043b\u0438 \u0446\u0435\u043b\u0438\u043a\u043e\u043c \u0443\u0431\u0440\u0430\u0442\u044c \u043b\u0438\u0448\u043d\u044e\u044e \u0441\u0442\u0440\u043e\u043a\u0443 \u0431\u0435\u0437 \u043f\u0435\u0440\u0435\u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0432\u0441\u0435\u0439 \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u043e\u0439.'}
                    </div>
                  </div>
                  {editing && (
                    <button type="button" className={styles.secondaryBtn} onClick={addRow}>
                      <Plus size={14} />
                      {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443'}
                    </button>
                  )}
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{COLUMN_LABELS.productName}</th>
                        <th>{COLUMN_LABELS.gender}</th>
                        <th>{COLUMN_LABELS.length}</th>
                        <th>{COLUMN_LABELS.color}</th>
                        <th>{COLUMN_LABELS.size}</th>
                        <th>{COLUMN_LABELS.quantity}</th>
                        <th>{COLUMN_LABELS.unitPrice}</th>
                        <th>{COLUMN_LABELS.total}</th>
                        {editing && <th>{'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435'}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {draft.items.map((item, index) => {
                        const genderOptions = resolvePurchaseFieldOptions({
                          productMap,
                          productName: item.productName,
                          code: 'gender',
                          globalOptions: globalGenderOptions,
                        });
                        const lengthOptions = resolvePurchaseFieldOptions({
                          productMap,
                          productName: item.productName,
                          code: 'length',
                          globalOptions: globalLengthOptions,
                        });
                        const colorOptions = resolvePurchaseFieldOptions({
                          productMap,
                          productName: item.productName,
                          code: 'color',
                          globalOptions: globalColorOptions,
                        });
                        const sizeOptions = resolvePurchaseFieldOptions({
                          productMap,
                          productName: item.productName,
                          code: 'size',
                          globalOptions: globalSizeOptions,
                        });

                        return (
                          <tr key={item.id}>
                            <td>
                              {editing ? (
                                <SearchableSelect
                                  className={styles.cellInput}
                                  placeholder={'\u0422\u043e\u0432\u0430\u0440'}
                                  ariaLabel={`item-product-${index + 1}`}
                                  options={productOptions}
                                  value={item.productName}
                                  onChange={(value) => updateRow(index, 'productName', value)}
                                />
                              ) : (
                                item.productName || '\u2014'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <SearchableSelect
                                  className={styles.cellInput}
                                  placeholder={'\u2014'}
                                  ariaLabel={`item-gender-${index + 1}`}
                                  options={genderOptions}
                                  value={item.gender}
                                  onChange={(value) => updateRow(index, 'gender', value)}
                                />
                              ) : (
                                item.gender || '\u2014'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <SearchableSelect
                                  className={styles.cellInput}
                                  placeholder={'\u2014'}
                                  ariaLabel={`item-length-${index + 1}`}
                                  options={lengthOptions}
                                  value={item.length}
                                  onChange={(value) => updateRow(index, 'length', value)}
                                />
                              ) : (
                                item.length || '\u2014'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <SearchableSelect
                                  className={styles.cellInput}
                                  placeholder={'\u2014'}
                                  ariaLabel={`item-color-${index + 1}`}
                                  options={colorOptions}
                                  value={item.color}
                                  onChange={(value) => updateRow(index, 'color', value)}
                                />
                              ) : (
                                item.color || '\u2014'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <SearchableSelect
                                  className={styles.cellInput}
                                  placeholder={'\u2014'}
                                  ariaLabel={`item-size-${index + 1}`}
                                  options={sizeOptions}
                                  value={item.size}
                                  onChange={(value) => updateRow(index, 'size', value)}
                                />
                              ) : (
                                item.size || '\u2014'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <input
                                  type="number"
                                  min="1"
                                  className={styles.cellInput}
                                  value={item.quantity}
                                  onChange={(event) => updateRow(index, 'quantity', event.target.value)}
                                />
                              ) : (
                                item.quantity || '\u2014'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={styles.cellInput}
                                  value={item.unitPrice}
                                  onChange={(event) => updateRow(index, 'unitPrice', event.target.value)}
                                />
                              ) : (
                                formatMoney(Number(item.unitPrice) || 0, currency)
                              )}
                            </td>
                            <td className={styles.lineTotal}>{formatMoney(calculateRowTotal(item), currency)}</td>
                            {editing && (
                              <td>
                                <button
                                  type="button"
                                  className={styles.rowDeleteBtn}
                                  onClick={() => removeRow(index)}
                                  disabled={draft.items.length === 1}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>

        {confirmCloseOpen && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmDialog}>
              <div className={styles.confirmTitle}>{'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u0430\u0432\u043a\u0438?'}</div>
              <div className={styles.confirmText}>
                {'\u0415\u0441\u043b\u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u044c \u043e\u043a\u043d\u043e \u0441\u0435\u0439\u0447\u0430\u0441, \u043d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043f\u0440\u043e\u043f\u0430\u0434\u0443\u0442.'}
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
                  disabled={updateInvoice.isPending}
                >
                  {'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c'}
                </button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setConfirmCloseOpen(false);
                    setEditing(false);
                    onClose();
                  }}
                >
                  {'\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0431\u0435\u0437 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
