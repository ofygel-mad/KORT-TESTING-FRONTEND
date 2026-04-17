import { useState, useRef } from 'react';
import { Upload, CheckCircle2, ChevronDown, ChevronRight, Plus, Trash2, Package, Settings2, Pencil, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import {
  useSmartImportProducts, useSmartImportColors,
  useCatalogDefinitions, useCatalogProducts,
  useCreateDefinition, useDeleteDefinition, useUpdateDefinition,
  useAddFieldOption, useUpdateFieldOption, useDeleteFieldOption,
  useCreateProduct, useUpdateProduct, useDeleteProduct, useSetProductFields,
} from '../../entities/warehouse/queries';
import type { WarehouseFieldDefinition, WarehouseProductCatalog } from '../../entities/warehouse/types';
import styles from './WarehouseCatalog.module.css';

// ── Inline edit helper ─────────────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  isPending,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  isPending?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const cancel = () => setEditing(false);
  const save = () => {
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className={styles.inlineEditRow}>
        <input
          ref={inputRef}
          className={styles.inlineInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') cancel(); }}
          autoFocus
        />
        <button className={styles.inlineSave} onClick={save} disabled={!draft.trim() || isPending}><Check size={11} /></button>
        <button className={styles.inlineCancel} onClick={cancel}><X size={11} /></button>
      </span>
    );
  }

  return (
    <span className={`${styles.inlineViewRow} ${className ?? ''}`}>
      <span>{value}</span>
      <button className={styles.inlinePencil} onClick={(e) => { e.stopPropagation(); open(); }}><Pencil size={11} /></button>
    </span>
  );
}

// ── Upload Zone ────────────────────────────────────────────────────────────────

function UploadZone({
  title,
  description,
  hint,
  accept,
  isPending,
  isDone,
  isError,
  doneText,
  onFile,
}: {
  title: string;
  description: string;
  hint: string;
  accept: string;
  isPending: boolean;
  isDone: boolean;
  isError?: boolean;
  doneText?: string;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (isPending) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  const zoneClass = [
    styles.uploadZone,
    isDone ? styles.uploadZoneDone : '',
    isError ? styles.uploadZoneError : '',
    isPending ? styles.uploadZoneLoading : '',
    isDragging ? styles.uploadZoneDragging : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={zoneClass}
      onClick={() => !isPending && ref.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); if (!isPending) setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); if (!isPending) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <div className={styles.uploadIcon}>
        {isPending ? <Loader2 size={32} className={styles.spinner} /> : isError ? <AlertCircle size={32} /> : isDone ? <CheckCircle2 size={32} /> : <Upload size={32} />}
      </div>
      <div className={styles.uploadTitle}>{title}</div>
      {!isPending && !isError && <div className={styles.uploadDescription}>{description}</div>}
      {isError ? (
        <div className={styles.uploadErrorText}>Ошибка загрузки. Попробуйте снова</div>
      ) : isDone && doneText ? (
        <>
          <div className={styles.uploadDoneText}>{doneText}</div>
          <div className={styles.uploadReplace}>Заменить файл →</div>
        </>
      ) : (
        <div className={styles.uploadHint}>{isPending ? 'Загружаю...' : isDragging ? 'Отпустите файл' : hint}</div>
      )}
    </div>
  );
}

// ── Field Definitions Row ──────────────────────────────────────────────────────

function FieldDefinitionRow({ def }: { def: WarehouseFieldDefinition }) {
  const [expanded, setExpanded] = useState(false);
  const [newVal, setNewVal] = useState('');
  const updateDef = useUpdateDefinition();
  const addOption = useAddFieldOption();
  const updateOption = useUpdateFieldOption();
  const deleteOption = useDeleteFieldOption();
  const deleteDef = useDeleteDefinition();

  const INPUT_TYPE_LABEL: Record<string, string> = {
    select: 'Список', multiselect: 'Мультисписок', text: 'Текст', number: 'Число', boolean: 'Да/Нет',
  };

  return (
    <div className={styles.defRow}>
      <div className={styles.defHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.defChevron}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className={styles.defLabel} onClick={(e) => e.stopPropagation()}>
          <InlineEdit
            value={def.label}
            onSave={(label) => updateDef.mutate({ id: def.id, data: { label } })}
            isPending={updateDef.isPending}
          />
        </span>
        <span className={styles.defType}>{INPUT_TYPE_LABEL[def.inputType] ?? def.inputType}</span>
        <span className={styles.defBadges}>
          {def.affectsAvailability && <span className={`${styles.badge} ${styles.badgeGreen}`}>наличие</span>}
          {def.showInOrderForm && <span className={`${styles.badge} ${styles.badgeBlue}`}>в заказе</span>}
          {def.isSystem && <span className={`${styles.badge} ${styles.badgeGray}`}>системное</span>}
        </span>
        <span className={styles.defOptionCount}>{def.options.length} зн.</span>
        {!def.isSystem && (
          <button
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить поле "${def.label}"?`)) deleteDef.mutate(def.id); }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {expanded && (
        <div className={styles.defBody}>
          <div className={styles.optionsList}>
            {def.options.map((opt) => (
              <div key={opt.id} className={styles.optionItem}>
                <InlineEdit
                  value={opt.label}
                  onSave={(label) => updateOption.mutate({ defId: def.id, optId: opt.id, data: { label } })}
                  isPending={updateOption.isPending}
                  className={styles.optionInlineEdit}
                />
                <button className={styles.optionDelete} onClick={() => deleteOption.mutate({ defId: def.id, optId: opt.id })}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          {(def.inputType === 'select' || def.inputType === 'multiselect') && (
            <div className={styles.addOptionRow}>
              <input
                className={styles.addOptionInput}
                placeholder="Новое значение..."
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = newVal.trim();
                    if (v) { addOption.mutate({ defId: def.id, value: v, label: v }); setNewVal(''); }
                  }
                }}
              />
              <button
                className={styles.addOptionBtn}
                onClick={() => { const v = newVal.trim(); if (v) { addOption.mutate({ defId: def.id, value: v, label: v }); setNewVal(''); } }}
                disabled={!newVal.trim()}
              >
                <Plus size={13} /> Добавить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Product Row ────────────────────────────────────────────────────────────────

function ProductRow({ product, definitions }: { product: WarehouseProductCatalog; definitions: WarehouseFieldDefinition[] }) {
  const [expanded, setExpanded] = useState(false);
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const setFields = useSetProductFields();
  const linkedIds = new Set(product.fieldLinks.map((fl) => fl.definitionId));

  const toggle = (defId: string) => {
    const current = product.fieldLinks.map((fl) => ({ definitionId: fl.definitionId, isRequired: fl.isRequired, sortOrder: fl.sortOrder }));
    const alreadyLinked = current.find((f) => f.definitionId === defId);
    const newFields = alreadyLinked
      ? current.filter((f) => f.definitionId !== defId)
      : [...current, { definitionId: defId, isRequired: false, sortOrder: current.length }];
    setFields.mutate({ productId: product.id, fields: newFields });
  };

  return (
    <div className={styles.productRow}>
      <div className={styles.productHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.defChevron}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <Package size={14} className={styles.productIcon} />
        <span className={styles.productName} onClick={(e) => e.stopPropagation()}>
          <InlineEdit
            value={product.name}
            onSave={(name) => updateProduct.mutate({ id: product.id, name })}
            isPending={updateProduct.isPending}
          />
        </span>
        <span className={styles.defOptionCount}>{product.fieldLinks.length} пол.</span>
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить товар "${product.name}"?`)) deleteProduct.mutate(product.id); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && (
        <div className={styles.defBody}>
          <div className={styles.fieldsGrid}>
            {definitions.map((def) => (
              <label key={def.id} className={styles.fieldToggle}>
                <input type="checkbox" checked={linkedIds.has(def.id)} onChange={() => toggle(def.id)} />
                <span>{def.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function WarehouseCatalog() {
  const smartImportProducts = useSmartImportProducts();
  const smartImportColors = useSmartImportColors();
  const { data: definitions = [] } = useCatalogDefinitions();
  const { data: products = [] } = useCatalogProducts();
  const createDef = useCreateDefinition();
  const createProduct = useCreateProduct();

  const [showAdvanced, setShowAdvanced] = useState<boolean | null>(null);
  const [productsDone, setProductsDone] = useState<string | null>(null);
  const [colorsDone, setColorsDone] = useState<string | null>(null);
  const [newDefLabel, setNewDefLabel] = useState('');
  const [newDefType, setNewDefType] = useState<'select' | 'text' | 'number' | 'boolean'>('select');
  const [newProdName, setNewProdName] = useState('');

  const hasData = products.length > 0 || definitions.length > 0;
  const isOpen = showAdvanced === null ? hasData : showAdvanced;

  return (
    <div className={styles.root}>

      {/* ── Заголовок ── */}
      <div className={styles.importHeader}>
        <h2 className={styles.importTitle}>Загрузка базы склада</h2>
        <p className={styles.importSubtitle}>
          Загрузите таблицы — система сама создаст поля, заполнит значения и свяжет всё с формой заказа.
        </p>
      </div>

      {/* ── Две зоны загрузки ── */}
      <div className={styles.uploadGrid}>
        <UploadZone
          title="Таблица товаров"
          description="Файл «Название товаров.xlsx» — список моделей, которые шьёте"
          hint="Нажмите или перетащите файл"
          accept=".xlsx,.xls"
          isPending={smartImportProducts.isPending}
          isDone={!!productsDone}
          isError={smartImportProducts.isError}
          doneText={productsDone ?? undefined}
          onFile={(file) => {
            smartImportProducts.reset();
            setProductsDone(null);
            smartImportProducts.mutate(file, {
              onSuccess: (data) => setProductsDone(`Загружено ${data.products.created} товаров`),
            });
          }}
        />
        <UploadZone
          title="Таблица цветов"
          description="Файл «Название Цветов.xlsx» — варианты цветов и материалов"
          hint="Нажмите или перетащите файл"
          accept=".xlsx,.xls"
          isPending={smartImportColors.isPending}
          isDone={!!colorsDone}
          isError={smartImportColors.isError}
          doneText={colorsDone ?? undefined}
          onFile={(file) => {
            smartImportColors.reset();
            setColorsDone(null);
            smartImportColors.mutate(file, {
              onSuccess: (data) => setColorsDone(`Загружено ${data.created} цветов`),
            });
          }}
        />
      </div>

      {/* ── Статус ── */}
      {(products.length > 0 || definitions.length > 0) && (
        <div className={styles.statusRow}>
          <span className={styles.statusItem}><CheckCircle2 size={13} /> {products.length} товаров в базе</span>
          <span className={styles.statusItem}><CheckCircle2 size={13} /> {definitions.length} полей настроено</span>
          <span className={styles.statusItem}>
            <CheckCircle2 size={13} />
            {definitions.find(d => d.code === 'color')?.options.length ?? 0} цветов
          </span>
        </div>
      )}

      {/* ── Расширенные настройки (свёрнуто по умолчанию) ── */}
      <button className={styles.advancedToggle} onClick={() => setShowAdvanced(!isOpen)}>
        <Settings2 size={14} />
        Редактировать каталог
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className={styles.advancedPanel}>

          {/* Поля */}
          <div className={styles.advancedSection}>
            <div className={styles.advancedSectionTitle}>Поля товара</div>
            <div className={styles.addRow}>
              <input
                className={styles.addInput}
                placeholder="Название поля (напр. Сезон)"
                value={newDefLabel}
                onChange={(e) => setNewDefLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const label = newDefLabel.trim();
                    if (!label) return;
                    const code = label.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_').replace(/__+/g, '_');
                    createDef.mutate({ code, label, inputType: newDefType });
                    setNewDefLabel('');
                  }
                }}
              />
              <select className={styles.typeSelect} value={newDefType} onChange={(e) => setNewDefType(e.target.value as any)}>
                <option value="select">Список (выбор)</option>
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="boolean">Да / Нет</option>
              </select>
              <button
                className={styles.addBtn}
                onClick={() => {
                  const label = newDefLabel.trim();
                  if (!label) return;
                  const code = label.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_').replace(/__+/g, '_');
                  createDef.mutate({ code, label, inputType: newDefType });
                  setNewDefLabel('');
                }}
                disabled={!newDefLabel.trim()}
              >
                <Plus size={13} /> Добавить поле
              </button>
            </div>
            <div className={styles.list}>
              {definitions.map((def) => <FieldDefinitionRow key={def.id} def={def} />)}
            </div>
          </div>

          {/* Товары */}
          <div className={styles.advancedSection}>
            <div className={styles.advancedSectionTitle}>Каталог товаров</div>
            <div className={styles.addRow}>
              <input
                className={styles.addInput}
                placeholder="Название товара"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newProdName.trim()) { createProduct.mutate(newProdName.trim()); setNewProdName(''); }
                  }
                }}
              />
              <button
                className={styles.addBtn}
                onClick={() => { if (newProdName.trim()) { createProduct.mutate(newProdName.trim()); setNewProdName(''); } }}
                disabled={!newProdName.trim()}
              >
                <Plus size={13} /> Добавить
              </button>
            </div>
            <div className={styles.list}>
              {products.map((p) => <ProductRow key={p.id} product={p} definitions={definitions} />)}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
