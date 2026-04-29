import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCreateManualInvoice } from '../../../../entities/purchase/queries';
import { useCatalogDefinitions, useOrderFormCatalog } from '../../../../entities/warehouse/queries';
import type { PurchaseType } from '../../../../entities/purchase/types';
import { SearchableSelect } from '../../../../shared/ui/SearchableSelect';
import {
  buildPurchaseProductFieldMap,
  getGlobalWarehouseOptions,
  resolvePurchaseFieldOptions,
} from './catalog';
import styles from './ManualInvoiceForm.module.css';

interface ItemRow {
  productName: string;
  gender: string;
  length: string;
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
}

interface Props {
  type: PurchaseType;
  onClose: () => void;
}

const TYPE_LABELS: Record<PurchaseType, string> = {
  workshop: 'Цех',
  market: 'Базар',
};

function emptyRow(): ItemRow {
  return {
    productName: '',
    gender: '',
    length: '',
    color: '',
    size: '',
    quantity: '1',
    unitPrice: '',
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}

export default function ManualInvoiceForm({ type, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const createInvoice = useCreateManualInvoice();
  const { data: fieldDefinitions } = useCatalogDefinitions();
  const { data: orderFormCatalog } = useOrderFormCatalog();

  const productMap = buildPurchaseProductFieldMap(orderFormCatalog);
  const productOptions = Object.keys(productMap);
  const globalGenderOptions = getGlobalWarehouseOptions(fieldDefinitions, 'gender');
  const globalLengthOptions = getGlobalWarehouseOptions(fieldDefinitions, 'length');
  const globalColorOptions = getGlobalWarehouseOptions(fieldDefinitions, 'color');
  const globalSizeOptions = getGlobalWarehouseOptions(fieldDefinitions, 'size');

  const total = rows.reduce((sum, row) => {
    const quantity = parseFloat(row.quantity) || 0;
    const unitPrice = parseFloat(row.unitPrice) || 0;
    return sum + quantity * unitPrice;
  }, 0);

  function updateRow(index: number, field: keyof ItemRow, value: string) {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev));
  }

  async function handleSave() {
    const validRows = rows.filter((row) => row.productName.trim());
    if (!title.trim() || validRows.length === 0) return;

    await createInvoice.mutateAsync({
      type,
      title: title.trim(),
      notes: notes.trim() || undefined,
      items: validRows.map((row) => ({
        productName: row.productName.trim(),
        gender: row.gender.trim() || undefined,
        length: row.length.trim() || undefined,
        color: row.color.trim() || undefined,
        size: row.size.trim() || undefined,
        quantity: parseFloat(row.quantity) || 1,
        unitPrice: parseFloat(row.unitPrice) || 0,
      })),
    });
    onClose();
  }

  const canSave = title.trim().length > 0 && rows.some((row) => row.productName.trim());

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>Новая накладная - {TYPE_LABELS[type]}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.field}>
            <label className={styles.label}>Название</label>
            <input
              className={styles.input}
              placeholder="Например: Закуп ткани, апрель"
              aria-label="Название накладной"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Примечание (необязательно)</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="Дополнительная информация..."
              aria-label="Примечание накладной"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className={styles.itemsSection}>
            <div className={styles.itemsHeader}>
              <span className={styles.itemsLabel}>Позиции</span>
              <button type="button" className={styles.addRowBtn} onClick={() => setRows((prev) => [...prev, emptyRow()])}>
                <Plus size={12} />
                Добавить строку
              </button>
            </div>

            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Наименование</th>
                  <th style={{ width: '10%' }}>Пол</th>
                  <th style={{ width: '11%' }}>Длина</th>
                  <th style={{ width: '12%' }}>Цвет</th>
                  <th style={{ width: '11%' }}>Размер</th>
                  <th style={{ width: '8%' }}>Кол-во</th>
                  <th style={{ width: '12%' }}>Цена, ₸</th>
                  <th style={{ width: '8%' }}>Сумма</th>
                  <th style={{ width: '4%' }} aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0);
                  const genderOptions = resolvePurchaseFieldOptions({
                    productMap,
                    productName: row.productName,
                    code: 'gender',
                    globalOptions: globalGenderOptions,
                  });
                  const lengthOptions = resolvePurchaseFieldOptions({
                    productMap,
                    productName: row.productName,
                    code: 'length',
                    globalOptions: globalLengthOptions,
                  });
                  const colorOptions = resolvePurchaseFieldOptions({
                    productMap,
                    productName: row.productName,
                    code: 'color',
                    globalOptions: globalColorOptions,
                  });
                  const sizeOptions = resolvePurchaseFieldOptions({
                    productMap,
                    productName: row.productName,
                    code: 'size',
                    globalOptions: globalSizeOptions,
                  });

                  return (
                    <tr key={index}>
                      <td>
                        <SearchableSelect
                          className={styles.cellInput}
                          placeholder="Название товара"
                          ariaLabel={`Товар для позиции ${index + 1}`}
                          options={productOptions}
                          value={row.productName}
                          onChange={(value) => updateRow(index, 'productName', value)}
                        />
                      </td>
                      <td>
                        <SearchableSelect
                          className={styles.cellInput}
                          placeholder="-"
                          ariaLabel={`Пол для позиции ${index + 1}`}
                          options={genderOptions}
                          value={row.gender}
                          onChange={(value) => updateRow(index, 'gender', value)}
                        />
                      </td>
                      <td>
                        <SearchableSelect
                          className={styles.cellInput}
                          placeholder="-"
                          ariaLabel={`Длина для позиции ${index + 1}`}
                          options={lengthOptions}
                          value={row.length}
                          onChange={(value) => updateRow(index, 'length', value)}
                        />
                      </td>
                      <td>
                        <SearchableSelect
                          className={styles.cellInput}
                          placeholder="-"
                          ariaLabel={`Цвет для позиции ${index + 1}`}
                          options={colorOptions}
                          value={row.color}
                          onChange={(value) => updateRow(index, 'color', value)}
                        />
                      </td>
                      <td>
                        <SearchableSelect
                          className={styles.cellInput}
                          placeholder="-"
                          ariaLabel={`Размер для позиции ${index + 1}`}
                          options={sizeOptions}
                          value={row.size}
                          onChange={(value) => updateRow(index, 'size', value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInput}
                          type="number"
                          min="1"
                          placeholder="1"
                          value={row.quantity}
                          aria-label={`Количество для позиции ${index + 1}`}
                          onChange={(event) => updateRow(index, 'quantity', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInput}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={row.unitPrice}
                          aria-label={`Цена для позиции ${index + 1}`}
                          onChange={(event) => updateRow(index, 'unitPrice', event.target.value)}
                        />
                      </td>
                      <td style={{ paddingLeft: 8, color: 'var(--ch-text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {rowTotal > 0 ? fmt(rowTotal) : '-'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.removeRow}
                          title="Удалить строку"
                          aria-label={`Удалить позицию ${index + 1}`}
                          onClick={() => removeRow(index)}
                        >
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Итого:</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            disabled={!canSave || createInvoice.isPending}
            onClick={handleSave}
          >
            {createInvoice.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
