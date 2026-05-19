import { useState, useRef } from 'react';
import {
  Upload, CheckCircle2, AlertCircle, Loader2,
  Plus, Trash2, ChevronDown, ChevronRight,
  Pencil, Check, X, Package, Image, Boxes,
} from 'lucide-react';
import {
  useSmartImportProducts, useSmartImportColors,
  useCatalogDefinitions, useCatalogProducts,
  useCreateDefinition, useUpdateDefinition, useDeleteDefinition,
  useAddFieldOption, useUpdateFieldOption, useDeleteFieldOption,
  useCreateProduct, useUpdateProduct, useDeleteProduct, useSetProductFields,
  useProductPhotos, useUploadProductPhoto, useDeleteProductPhoto,
} from '@/entities/warehouse/queries';
import { productPhotosApi } from '@/entities/warehouse/api';
import type { WarehouseFieldDefinition, WarehouseProductCatalog } from '@/entities/warehouse/types';
import { SearchInput } from '../../../../shared/ui/SearchInput';
import styles from './ChapanCatalog.module.css';
import s from '../../../warehouse/WarehouseCatalog.module.css';

type Tab = 'catalog' | 'fields';
type DefType = 'select' | 'text' | 'number' | 'boolean';

// ── InlineEdit ─────────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave, isPending, className }: {
  value: string; onSave: (v: string) => void; isPending?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const cancel = () => setEditing(false);
  const save = () => { const v = draft.trim(); if (v && v !== value) onSave(v); setEditing(false); };

  if (editing) {
    return (
      <span className={s.inlineEditRow}>
        <input ref={inputRef} className={s.inlineInput} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') cancel(); }}
          autoFocus
        />
        <button type="button" className={s.inlineSave} title="Сохранить" onClick={save} disabled={!draft.trim() || isPending}><Check size={11} /></button>
        <button type="button" className={s.inlineCancel} title="Отмена" onClick={cancel}><X size={11} /></button>
      </span>
    );
  }

  return (
    <span className={`${s.inlineViewRow} ${className ?? ''}`}>
      <span>{value}</span>
      <button type="button" className={s.inlinePencil} title="Редактировать" onClick={(e) => { e.stopPropagation(); open(); }}><Pencil size={11} /></button>
    </span>
  );
}

// ── FieldDefinitionRow ─────────────────────────────────────────────────────────

function FieldDefinitionRow({ def }: { def: WarehouseFieldDefinition }) {
  const [expanded, setExpanded] = useState(true);
  const [newVal, setNewVal] = useState('');
  const updateDef = useUpdateDefinition();
  const addOption = useAddFieldOption();
  const updateOption = useUpdateFieldOption();
  const deleteOption = useDeleteFieldOption();
  const deleteDef = useDeleteDefinition();

  return (
    <div className={s.defRow}>
      <div className={s.defHeader} onClick={() => setExpanded(!expanded)}>
        <span className={s.defChevron}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className={s.defLabel} onClick={(e) => e.stopPropagation()}>
          <InlineEdit value={def.label}
            onSave={(label) => updateDef.mutate({ id: def.id, data: { label } })}
            isPending={updateDef.isPending}
          />
        </span>
        <span className={s.defOptionCount}>{def.options.length} зн.</span>
        {!def.isSystem && (
          <button type="button" className={s.deleteBtn} title="Удалить поле"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить поле "${def.label}"?`)) deleteDef.mutate(def.id); }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {expanded && (
        <div className={s.defBody}>
          <div className={s.optionsList}>
            {def.options.map((opt) => (
              <div key={opt.id} className={s.optionItem}>
                <InlineEdit value={opt.label}
                  onSave={(label) => updateOption.mutate({ defId: def.id, optId: opt.id, data: { label } })}
                  isPending={updateOption.isPending}
                  className={s.optionInlineEdit}
                />
                <button type="button" className={s.optionDelete} title="Удалить значение" onClick={() => deleteOption.mutate({ defId: def.id, optId: opt.id })}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          {(def.inputType === 'select' || def.inputType === 'multiselect') && (
            <div className={s.addOptionRow}>
              <input className={s.addOptionInput} placeholder="Новое значение..." value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = newVal.trim();
                    if (v) { addOption.mutate({ defId: def.id, value: v, label: v }); setNewVal(''); }
                  }
                }}
              />
              <button type="button" className={s.addOptionBtn}
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

// ── ProductPhotoSection ────────────────────────────────────────────────────────

function ProductPhotoSection({ productId }: { productId: string }) {
  const { data: photos = [] } = useProductPhotos(productId);
  const upload = useUploadProductPhoto(productId);
  const deletePhoto = useDeleteProductPhoto(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <div className={styles.photoSection}>
        {photos.map((photo) => {
          const photoUrl = photo.fileUrl ?? productPhotosApi.fileUrl(productId, photo.id);
          return (
            <div key={photo.id} className={styles.photoThumb}>
              <img
                src={photoUrl}
                alt={photo.fileName}
                onClick={() => setLightboxSrc(photoUrl)}
              />
              <button
                type="button"
                className={styles.photoThumbDelete}
                title="Удалить фото"
                onClick={(e) => { e.stopPropagation(); deletePhoto.mutate(photo.id); }}
              >
                <Trash2 size={14} color="#fff" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={styles.photoAddBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? <Loader2 size={13} className={styles.spin} /> : <Image size={13} />}
          <span>Фото</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.hidden}
          aria-label="Загрузить фото товара"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
      {lightboxSrc && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightboxSrc(null)}>
          <img
            src={lightboxSrc}
            className={styles.lightboxImg}
            alt="Просмотр фото"
            onClick={(e) => e.stopPropagation()}
          />
          <button type="button" className={styles.lightboxClose} aria-label="Закрыть" onClick={() => setLightboxSrc(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

// ── ProductRow ─────────────────────────────────────────────────────────────────

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
    <div className={s.productRow}>
      <div className={s.productHeader} onClick={() => setExpanded(!expanded)}>
        <span className={s.defChevron}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <Package size={14} className={s.productIcon} />
        <span className={s.productName} onClick={(e) => e.stopPropagation()}>
          <InlineEdit value={product.name}
            onSave={(name) => updateProduct.mutate({ id: product.id, name })}
            isPending={updateProduct.isPending}
          />
        </span>
        <span className={s.defOptionCount}>{product.fieldLinks.length} пол.</span>
        <button type="button" className={s.deleteBtn} title="Удалить товар"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить товар "${product.name}"?`)) deleteProduct.mutate(product.id); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && (
        <div className={s.defBody}>
          <div className={s.fieldsGrid}>
            {definitions.map((def) => (
              <label key={def.id} className={s.fieldToggle}>
                <input type="checkbox" checked={linkedIds.has(def.id)} onChange={() => toggle(def.id)} />
                <span>{def.label}</span>
              </label>
            ))}
          </div>
          <ProductPhotoSection productId={product.id} />
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ChapanCatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [productsDone, setProductsDone] = useState<string | null>(null);
  const [colorsDone, setColorsDone] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newDefLabel, setNewDefLabel] = useState('');
  const [newDefType, setNewDefType] = useState<DefType>('select');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const productsRef = useRef<HTMLInputElement>(null);
  const colorsRef = useRef<HTMLInputElement>(null);

  const smartImportProducts = useSmartImportProducts();
  const smartImportColors = useSmartImportColors();
  const { data: definitions = [] } = useCatalogDefinitions();
  const { data: products = [] } = useCatalogProducts();
  const createProduct = useCreateProduct();
  const createDef = useCreateDefinition();

  const colorCount = definitions.find((d) => d.code === 'color')?.options.length ?? 0;

  const q = search.trim().toLowerCase();
  const filteredProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q))
    : products;
  const filteredDefinitions = q
    ? definitions.filter((d) => d.label.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
    : definitions;

  const submitNewDef = () => {
    const label = newDefLabel.trim();
    if (!label) return;
    const code = label.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_').replace(/__+/g, '_');
    createDef.mutate({ code, label, inputType: newDefType });
    setNewDefLabel('');
    setAddOpen(false);
  };

  const submitNewProduct = () => {
    const name = newProdName.trim();
    if (!name) return;
    createProduct.mutate(name);
    setNewProdName('');
    setAddOpen(false);
  };

  const openAddForm = () => {
    setAddOpen(true);
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const closeAddForm = () => {
    setAddOpen(false);
    setNewProdName('');
    setNewDefLabel('');
  };

  const addBtnLabel = activeTab === 'catalog' ? 'Добавить товар' : 'Добавить поле';

  return (
    <div className={styles.root}>
      {/* Hidden file inputs */}
      <input ref={productsRef} type="file" accept=".xlsx,.xls" className={styles.hidden} aria-label="Загрузить таблицу товаров"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            smartImportProducts.reset();
            setProductsDone(null);
            smartImportProducts.mutate(f, { onSuccess: (data) => setProductsDone(`${data.products.created}`) });
          }
          e.target.value = '';
        }}
      />
      <input ref={colorsRef} type="file" accept=".xlsx,.xls" className={styles.hidden} aria-label="Загрузить таблицу цветов"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            smartImportColors.reset();
            setColorsDone(null);
            smartImportColors.mutate(f, { onSuccess: (data) => setColorsDone(`${data.created}`) });
          }
          e.target.value = '';
        }}
      />

      {/* ── Page header ── */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Boxes size={18} />
          <span>Каталог</span>
        </div>
        <div className={styles.headerSub}>Товары, поля и значения для складского каталога</div>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.uploadGroup}>
          <button
            type="button"
            className={[styles.uploadBtn, productsDone ? styles.uploadBtnDone : '', smartImportProducts.isError ? styles.uploadBtnError : ''].filter(Boolean).join(' ')}
            onClick={() => productsRef.current?.click()}
            disabled={smartImportProducts.isPending}
            title="Загрузить таблицу товаров (.xlsx)"
          >
            {smartImportProducts.isPending
              ? <Loader2 size={13} className={styles.spin} />
              : productsDone ? <CheckCircle2 size={13} />
              : smartImportProducts.isError ? <AlertCircle size={13} />
              : <Upload size={13} />}
            Таблица товаров
            {productsDone && <span className={styles.doneCount}>+{productsDone}</span>}
          </button>

          <button
            type="button"
            className={[styles.uploadBtn, colorsDone ? styles.uploadBtnDone : '', smartImportColors.isError ? styles.uploadBtnError : ''].filter(Boolean).join(' ')}
            onClick={() => colorsRef.current?.click()}
            disabled={smartImportColors.isPending}
            title="Загрузить таблицу цветов (.xlsx)"
          >
            {smartImportColors.isPending
              ? <Loader2 size={13} className={styles.spin} />
              : colorsDone ? <CheckCircle2 size={13} />
              : smartImportColors.isError ? <AlertCircle size={13} />
              : <Upload size={13} />}
            Таблица цветов
            {colorsDone && <span className={styles.doneCount}>+{colorsDone}</span>}
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.tabGroup}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'catalog' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            Каталог товаров
            {products.length > 0 && (
              <span className={styles.tabBadge}>{products.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'fields' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('fields')}
          >
            Поля товара
            {definitions.length > 0 && (
              <span className={styles.tabBadge}>{definitions.length}</span>
            )}
          </button>
        </div>

        <div className={styles.toolbarSpacer} />

        <button
          type="button"
          className={`${styles.addBtn} ${addOpen ? styles.addBtnActive : ''}`}
          onClick={addOpen ? closeAddForm : openAddForm}
          title={addOpen ? 'Закрыть форму' : addBtnLabel}
        >
          {addOpen ? <X size={13} /> : <Plus size={13} />}
          {addBtnLabel}
        </button>

        <div className={styles.searchWrap}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={activeTab === 'catalog' ? 'Поиск товара...' : 'Поиск поля...'}
          />
        </div>
      </div>

      {/* ── Add form (только при открытии) ── */}
      {addOpen && (
        <div className={styles.addBar}>
          {activeTab === 'catalog' ? (
            <>
              <input
                ref={addInputRef}
                className={styles.addInput}
                placeholder="Название нового товара..."
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitNewProduct(); }
                  if (e.key === 'Escape') { e.preventDefault(); closeAddForm(); }
                }}
              />
              <button
                type="button"
                className={styles.addSaveBtn}
                onClick={submitNewProduct}
                disabled={!newProdName.trim() || createProduct.isPending}
              >
                <Check size={13} /> Сохранить
              </button>
              <button type="button" className={styles.addCancelBtn} onClick={closeAddForm}>
                Отмена
              </button>
            </>
          ) : (
            <>
              <input
                ref={addInputRef}
                className={styles.addInput}
                placeholder="Название поля (напр. Сезон)"
                value={newDefLabel}
                onChange={(e) => setNewDefLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitNewDef(); }
                  if (e.key === 'Escape') { e.preventDefault(); closeAddForm(); }
                }}
              />
              <select
                className={styles.typeSelect}
                value={newDefType}
                onChange={(e) => setNewDefType(e.target.value as DefType)}
                aria-label="Тип поля"
              >
                <option value="select">Список (выбор)</option>
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="boolean">Да / Нет</option>
              </select>
              <button
                type="button"
                className={styles.addSaveBtn}
                onClick={submitNewDef}
                disabled={!newDefLabel.trim() || createDef.isPending}
              >
                <Check size={13} /> Сохранить
              </button>
              <button type="button" className={styles.addCancelBtn} onClick={closeAddForm}>
                Отмена
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <div className={styles.content}>
        {activeTab === 'catalog' && (
          <div className={styles.list}>
            {filteredProducts.map((p) => (
              <ProductRow key={p.id} product={p} definitions={definitions} />
            ))}
            {products.length === 0 && (
              <div className={styles.empty}>Загрузите таблицу товаров или добавьте вручную</div>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
              <div className={styles.empty}>По запросу «{search}» ничего не найдено</div>
            )}
          </div>
        )}

        {activeTab === 'fields' && (
          <div className={styles.list}>
            {filteredDefinitions.map((def) => (
              <FieldDefinitionRow key={def.id} def={def} />
            ))}
            {definitions.length === 0 && (
              <div className={styles.empty}>Загрузите таблицу цветов или добавьте поле вручную</div>
            )}
            {definitions.length > 0 && filteredDefinitions.length === 0 && (
              <div className={styles.empty}>По запросу «{search}» ничего не найдено</div>
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {(products.length > 0 || definitions.length > 0) && (
        <div className={styles.statusBar}>
          <span><CheckCircle2 size={13} /> {products.length} товаров в базе</span>
          <span><CheckCircle2 size={13} /> {definitions.length} полей настроено</span>
          <span><CheckCircle2 size={13} /> {colorCount} цветов</span>
        </div>
      )}
    </div>
  );
}
