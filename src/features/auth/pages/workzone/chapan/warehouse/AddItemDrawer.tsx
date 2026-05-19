import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { useCreateItem, useOrderFormCatalog } from '@/entities/warehouse/queries';
import type { CreateItemDto } from '@/entities/warehouse/types';
import styles from '../../../warehouse/Warehouse.module.css';

interface Props {
  onClose: () => void;
}

const INITIAL_FORM: CreateItemDto = {
  name: '',
  unit: 'шт',
  qty: 0,
  qtyMin: 0,
};

export function AddItemDrawer({ onClose }: Props) {
  const createItem = useCreateItem();
  const { data: catalog } = useOrderFormCatalog();
  const [form, setForm] = useState<CreateItemDto>(INITIAL_FORM);

  const productNames = useMemo(
    () => catalog?.products.map((p) => p.name) ?? [],
    [catalog],
  );

  const selectedProduct = useMemo(
    () => catalog?.products.find((p) => p.name === form.name),
    [catalog, form.name],
  );

  const getFieldOpts = (code: string): string[] =>
    selectedProduct?.fields.find((f) => f.code === code)?.options.map((o) => o.value) ?? [];

  const globalColors = useMemo(
    () => [...new Set(catalog?.products.flatMap((p) =>
      p.fields.find((f) => f.code === 'color')?.options.map((o) => o.value) ?? []) ?? [])],
    [catalog],
  );
  const globalSizes = useMemo(
    () => [...new Set(catalog?.products.flatMap((p) =>
      p.fields.find((f) => f.code === 'size')?.options.map((o) => o.value) ?? []) ?? [])],
    [catalog],
  );
  const globalLengths = useMemo(
    () => [...new Set(catalog?.products.flatMap((p) =>
      p.fields.find((f) => f.code === 'length')?.options.map((o) => o.value) ?? []) ?? [])],
    [catalog],
  );

  const colorOpts = getFieldOpts('color').length > 0 ? getFieldOpts('color') : globalColors;
  const sizeOpts = getFieldOpts('size').length > 0 ? getFieldOpts('size') : globalSizes;
  const lengthOpts = getFieldOpts('length').length > 0 ? getFieldOpts('length') : globalLengths;

  const setField = (field: keyof CreateItemDto, value: string) =>
    setForm((cur) => ({ ...cur, [field]: value }));

  const handleNameChange = (value: string) =>
    setForm((cur) => ({ ...cur, name: value, color: '', size: '', gender: '', length: '' }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const rawCostPrice = String(form.costPrice ?? '').trim();
    await createItem.mutateAsync({
      ...form,
      name: form.name.trim(),
      unit: 'шт',
      color: form.color?.trim() || undefined,
      gender: form.gender?.trim() || undefined,
      size: form.size?.trim() || undefined,
      length: form.length?.trim() || undefined,
      qty: Number(form.qty ?? 0),
      qtyMin: Number(form.qtyMin ?? 0),
      costPrice: rawCostPrice === '' ? undefined : Number(rawCostPrice),
    });
    onClose();
  };

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Добавить позицию</span>
          <button type="button" className={styles.drawerClose} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>
              Название <span className={styles.req}>*</span>
            </label>
            {productNames.length > 0 ? (
              <select
                className={styles.input}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus
                aria-label="Название"
              >
                <option value="">— выбрать модель —</option>
                {productNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : (
              <input
                className={styles.input}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Чапан классик"
                required
                autoFocus
              />
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Размер</label>
            {sizeOpts.length > 0 ? (
              <select
                className={styles.input}
                value={form.size ?? ''}
                onChange={(e) => setField('size', e.target.value)}
                aria-label="Размер"
              >
                <option value="">— выбрать —</option>
                {sizeOpts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                className={styles.input}
                value={form.size ?? ''}
                onChange={(e) => setField('size', e.target.value)}
                placeholder="48, XL, 42–60..."
              />
            )}
          </div>

          {lengthOpts.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Длина изделия</label>
              <select
                className={styles.input}
                value={form.length ?? ''}
                onChange={(e) => setField('length', e.target.value)}
                aria-label="Длина изделия"
              >
                <option value="">— не указана —</option>
                {lengthOpts.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Цвет</label>
              {colorOpts.length > 0 ? (
                <select
                  className={styles.input}
                  value={form.color ?? ''}
                  onChange={(e) => setField('color', e.target.value)}
                  aria-label="Цвет"
                >
                  <option value="">— выбрать —</option>
                  {colorOpts.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={styles.input}
                  value={form.color ?? ''}
                  onChange={(e) => setField('color', e.target.value)}
                  placeholder="Синий"
                />
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Пол</label>
              <select
                className={styles.input}
                value={form.gender ?? ''}
                onChange={(e) => setField('gender', e.target.value)}
                aria-label="Пол"
              >
                <option value="">— не указан —</option>
                <option value="муж">Мужской</option>
                <option value="жен">Женский</option>
              </select>
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Остаток</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.qty ?? 0}
                onChange={(e) => setField('qty', e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Минимум (алерт)</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.qtyMin ?? 0}
                onChange={(e) => setField('qtyMin', e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Цена (₸)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={form.costPrice ?? ''}
              onChange={(e) => setField('costPrice', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className={styles.submitBtn} disabled={createItem.isPending}>
              {createItem.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
