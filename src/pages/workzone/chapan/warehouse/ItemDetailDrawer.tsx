import { AlertTriangle, Plus, RotateCcw, X } from 'lucide-react';
import { useWarehouseMovements, useItemFormula } from '../../../../entities/warehouse/queries';
import type { WarehouseItem, WarehouseMovement } from '../../../../entities/warehouse/types';
import { localizeAttrSummary } from '../../../../shared/lib/attrLocalize';
import styles from '../../../warehouse/Warehouse.module.css';

const NUMBER_FORMATTER = new Intl.NumberFormat('ru-KZ');
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
function fmtNum(n: number) { return NUMBER_FORMATTER.format(n); }
function fmtDate(s: string) { return DATE_FORMATTER.format(new Date(s)); }

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormulaCell({ label, value, unit, color, bold }: {
  label: string; value: number; unit: string;
  color?: string; bold?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}>
      <span style={{
        fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600,
        letterSpacing: '.06em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: bold ? 17 : 14, fontWeight: bold ? 700 : 500,
        color: color ?? 'var(--text-primary)',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        lineHeight: 1,
      }}>
        {fmtNum(value)}
        <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2, opacity: .7 }}>{unit}</span>
      </span>
    </div>
  );
}

const MOVEMENT_LABEL: Record<string, string> = {
  in: 'Приход', out: 'Расход', adjustment: 'Корректировка',
  write_off: 'Списание', return: 'Возврат',
};
const MOVEMENT_SIGN: Record<string, string> = {
  in: '+', return: '+', out: '-', write_off: '-', adjustment: '±',
};
const MOVEMENT_COLOR: Record<string, string> = {
  in: 'var(--fill-positive)', return: 'var(--fill-info)',
  out: 'var(--fill-negative)', write_off: 'var(--fill-negative)',
  adjustment: 'var(--fill-warning)',
};

function MovementRow({ movement: m }: { movement: WarehouseMovement }) {
  const sign = MOVEMENT_SIGN[m.type] ?? '';
  const color = MOVEMENT_COLOR[m.type] ?? 'var(--text-secondary)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 12,
    }}>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 11, whiteSpace: 'nowrap', minWidth: 64 }}>
        {fmtDate(m.createdAt)}
      </span>
      <span style={{
        padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 500,
        background: `${color}18`, color, whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {MOVEMENT_LABEL[m.type] ?? m.type}
      </span>
      <span style={{
        flex: 1, color: 'var(--text-tertiary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {m.reason ?? m.sourceType ?? '—'}
      </span>
      <span style={{
        fontWeight: 600, color,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        flexShrink: 0,
      }}>
        {sign}{fmtNum(Math.abs(m.qty))}
      </span>
      {m.qtyBefore != null && m.qtyAfter != null && (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {fmtNum(m.qtyBefore)}→{fmtNum(m.qtyAfter)}
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  item: WarehouseItem;
  onClose: () => void;
  onAddMovement: () => void;
  onVerify?: () => void;
}

export function ItemDetailDrawer({ item, onClose, onAddMovement, onVerify }: Props) {
  const { data: movData, isLoading: movLoading } = useWarehouseMovements({ itemId: item.id });
  const movements = movData?.results ?? [];

  // ── Авторитетная разбивка формулы с сервера ───────────────────────────────
  // Использует computeFormulaBreakdown — точные суммы по всем движениям,
  // не ограниченным пагинацией. Fallback на поля item до загрузки.
  const { data: formula } = useItemFormula(item.id);

  const qtyBeginning = formula?.qtyBeginning ?? item.qtyBeginning;
  const totalIn      = formula?.totalIn      ?? 0;
  const totalOut     = formula?.totalOut     ?? 0;
  const qtyReserved  = formula?.qtyReserved  ?? item.qtyReserved;
  const qtyAvailable = formula?.qtyAvailable ?? (item.qty - item.qtyReserved);

  const needsVerify = formula?.verificationRequired ?? item.verificationRequired ?? (item.qty - item.qtyReserved < 0);
  const hasReserve  = qtyReserved > 0;

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>

        {/* Заголовок */}
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitle}>{item.name}</div>
            <div className={styles.drawerSubtitle}>
              {[localizeAttrSummary(item.attributesSummary) || null, item.sku, item.unit].filter(Boolean).join(' · ')}
              {item.category ? ` · ${item.category.name}` : ''}
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.drawerBody}>

          {/* Формула накопления: Начало + Приход − Расход [− Резерв] = Доступно */}
          <div className={styles.drawerCard}>
            <div className={styles.drawerCardLabel}>Формула накопления</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <FormulaCell label="Начало" value={qtyBeginning} unit={item.unit} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: 16, fontWeight: 300 }}>+</span>
              <FormulaCell label="Приход" value={totalIn} unit={item.unit} color="var(--fill-positive)" />
              <span style={{ color: 'var(--text-tertiary)', fontSize: 16, fontWeight: 300 }}>−</span>
              <FormulaCell label="Расход" value={totalOut} unit={item.unit} color="var(--fill-negative)" />
              {hasReserve && (
                <>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 16, fontWeight: 300 }}>−</span>
                  <FormulaCell label="Резерв" value={qtyReserved} unit={item.unit} color="var(--fill-warning)" />
                </>
              )}
              <span style={{ color: 'var(--text-tertiary)', fontSize: 16, fontWeight: 300 }}>=</span>
              <FormulaCell
                label="Доступно"
                value={qtyAvailable}
                unit={item.unit}
                color={qtyAvailable < 0 ? 'var(--fill-negative)' : 'var(--fill-positive)'}
                bold
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {hasReserve
                ? 'Начало + Приход − Расход − Резерв = Доступно'
                : 'Начало + Приход − Расход = Доступно'}
            </div>
          </div>

          {/* Алерт сверки */}
          {needsVerify && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 14px', borderRadius: 9,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
              color: 'var(--fill-negative)', fontSize: 12, lineHeight: 1.5,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {qtyAvailable < 0
                  ? `Доступный остаток отрицательный (${fmtNum(qtyAvailable)} ${item.unit}). Проведите физическую сверку.`
                  : 'Товар ещё не прошёл сверку. Введите фактический остаток.'}
              </span>
            </div>
          )}

          {/* История движений */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8,
            }}>
              История движений
            </div>
            {movLoading ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                Загрузка...
              </div>
            ) : movements.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                Нет движений
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {movements.map(m => <MovementRow key={m.id} movement={m} />)}
              </div>
            )}
          </div>
        </div>

        {/* Футер действий */}
        <div className={styles.drawerFooter}>
          <button className={`${styles.drawerActionBtn} ${styles.drawerActionBtnPrimary}`} onClick={onAddMovement}>
            <Plus size={15} /> Записать приход
          </button>
          <button className={styles.drawerSecondaryBtn} onClick={onVerify ?? onAddMovement}>
            <RotateCcw size={13} /> Провести сверку
          </button>
        </div>
      </div>
    </div>
  );
}
