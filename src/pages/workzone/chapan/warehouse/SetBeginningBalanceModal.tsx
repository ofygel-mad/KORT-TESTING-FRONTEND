import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useItemFormula, useSetBeginningBalance } from '../../../../entities/warehouse/queries';
import type { WarehouseItem } from '../../../../entities/warehouse/types';
import { localizeAttrSummary } from '../../../../shared/lib/attrLocalize';
import styles from '../../../warehouse/Warehouse.module.css';

interface Props {
  item: WarehouseItem;
  onClose(): void;
}

export function SetBeginningBalanceModal({ item, onClose }: Props) {
  const { data: formula, isLoading } = useItemFormula(item.id);
  const setBalance = useSetBeginningBalance();
  const [inputQty, setInputQty] = useState('');
  const [note, setNote] = useState('');

  const parsedQty = parseFloat(inputQty);
  const isValidQty = !isNaN(parsedQty) && parsedQty >= 0;

  // Preview: new beginning = parsedQty; reservations are unchanged
  // Доступно = новоеНачало + Приход − Расход − Резерв
  const previewAvailable = isValidQty && formula
    ? parsedQty + formula.totalIn - formula.totalOut - formula.qtyReserved
    : null;

  const hasReserve = (formula?.qtyReserved ?? 0) > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidQty) return;
    setBalance.mutate(
      { id: item.id, qty: parsedQty, note: note.trim() || undefined },
      { onSuccess: onClose },
    );
  }

  const content = (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>Сверка остатка</div>
            <div className={styles.drawerSubtitle}>
              {item.name}
              {item.attributesSummary ? ` — ${localizeAttrSummary(item.attributesSummary)}` : ''}
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.drawerBody}>
          {/* Current formula state */}
          <div style={{
            background: 'var(--bg-surface-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Текущее состояние
            </div>
            {isLoading ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Загрузка...</div>
            ) : formula ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 14, fontWeight: 600 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{formula.qtyBeginning}</span>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>+</span>
                <span style={{ color: 'var(--fill-positive)' }}>{formula.totalIn}</span>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>−</span>
                <span style={{ color: 'var(--fill-negative)' }}>{formula.totalOut}</span>
                {hasReserve && (
                  <>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>−</span>
                    <span style={{ color: 'var(--fill-warning)' }}>{formula.qtyReserved}</span>
                  </>
                )}
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>=</span>
                <span style={{ color: formula.qtyAvailable < 0 ? 'var(--fill-negative)' : 'var(--text-primary)' }}>
                  {formula.qtyAvailable} {item.unit}
                </span>
                {formula.verificationRequired && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--fill-negative)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '2px 7px' }}>
                    <AlertTriangle size={10} /> Требует сверки
                  </span>
                )}
              </div>
            ) : null}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {hasReserve
                ? 'Начало + Приход − Расход − Резерв = Доступно'
                : 'Начало + Приход − Расход = Доступно'}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className={styles.field}>
              <label className={styles.label}>
                Фактическое кол-во на складе <span className={styles.req}>*</span>
              </label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="any"
                value={inputQty}
                onChange={(e) => setInputQty(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Введите количество..."
                autoFocus
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Пересчитайте товар физически и введите фактическое количество
              </div>
            </div>

            {/* Live preview */}
            {isValidQty && formula && previewAvailable !== null && (
              <div style={{
                background: 'rgba(79,201,153,0.08)',
                border: '1px solid rgba(79,201,153,0.25)',
                borderRadius: 10,
                padding: '10px 14px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#4FC999', marginBottom: 6 }}>
                  После сверки
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 14, fontWeight: 600 }}>
                  <span style={{ color: '#4FC999' }}>{parsedQty}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>+</span>
                  <span style={{ color: 'var(--fill-positive)' }}>{formula.totalIn}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>−</span>
                  <span style={{ color: 'var(--fill-negative)' }}>{formula.totalOut}</span>
                  {hasReserve && (
                    <>
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>−</span>
                      <span style={{ color: 'var(--fill-warning)' }}>{formula.qtyReserved}</span>
                    </>
                  )}
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>=</span>
                  <span style={{ color: previewAvailable < 0 ? 'var(--fill-negative)' : 'var(--text-primary)' }}>
                    {previewAvailable} {item.unit}
                  </span>
                  {previewAvailable >= 0 && <CheckCircle2 size={14} style={{ color: '#4FC999' }} />}
                  {previewAvailable < 0 && <AlertTriangle size={14} style={{ color: 'var(--fill-negative)' }} />}
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Комментарий (необязательно)</label>
              <input
                className={styles.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: сверка после прихода 16.04"
              />
            </div>

            <div className={styles.drawerActions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isValidQty || setBalance.isPending}
              >
                {setBalance.isPending ? 'Сохранение...' : 'Сохранить и закрыть сверку'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
