import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDealsBoard, useCreateDeal } from '@/entities/deal/queries';
import type { Deal, DealStage, CreateDealDto } from '@/entities/deal/types';
import { DealDrawer } from './DealDrawer';
import { useViewportProfile } from '../../../shared/hooks/useViewportProfile';
import styles from './Deals.module.css';

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'new',          label: 'Новая',          color: 'var(--fill-info)' },
  { key: 'qualified',    label: 'Квалификация',   color: '#8B5CF6' },
  { key: 'proposal',     label: 'КП',             color: 'var(--fill-accent)' },
  { key: 'negotiation',  label: 'Переговоры',     color: '#F59E0B' },
  { key: 'won',          label: 'Выиграна',       color: 'var(--fill-positive)' },
  { key: 'lost',         label: 'Проиграна',      color: 'var(--fill-danger)' },
];

function fmt(n: number | null | undefined) {
  if (!n) return null;
  return new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(n);
}

export default function DealsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { isPhone } = useViewportProfile();
  const { data: board, isLoading, isError } = useDealsBoard();
  const createDeal = useCreateDeal();

  const getStageDeals = (stage: DealStage): Deal[] => (board as any)?.[stage] ?? [];
  const pipelineValue = STAGES
    .filter(s => s.key !== 'won' && s.key !== 'lost')
    .reduce((sum, s) => sum + getStageDeals(s.key).reduce((a, d) => a + (d.amount ?? 0), 0), 0);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const dto: CreateDealDto = { title: newTitle.trim() };
    await createDeal.mutateAsync(dto);
    setNewTitle(''); setCreating(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Сделки</h1>
          {pipelineValue > 0 && (
            <div className={styles.pipeline}>
              <span className={styles.pipelineLabel}>Воронка:</span>
              <span className={styles.pipelineValue}>{fmt(pipelineValue)}</span>
            </div>
          )}
        </div>
        <button className={styles.addBtn} onClick={() => setCreating(true)}><Plus size={14} />Новая сделка</button>
      </div>

      {creating && (
        <div className={styles.quickCreate}>
          <input className={styles.quickInput} value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Название сделки..." autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }} />
          <button className={styles.quickOk} onClick={handleCreate} disabled={createDeal.isPending}>Создать</button>
          <button className={styles.quickCancel} onClick={() => setCreating(false)}><X size={13} /></button>
        </div>
      )}

      {isLoading && (
        <div className={styles.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}
      {isError && <div className={styles.error}>Не удалось загрузить сделки</div>}

      {!isLoading && !isError && isPhone && (() => {
        const allDeals = STAGES.flatMap(({ key }) => getStageDeals(key));
        return (
          <div className={styles.mobileList}>
            {allDeals.map((deal) => {
              const stage = STAGES.find(s => s.key === deal.stage);
              return (
                <button key={deal.id} className={styles.mobileCard} onClick={() => setSelectedId(deal.id)}>
                  <div className={styles.mobileCardHead}>
                    <strong>{deal.title}</strong>
                    <span className={styles.mobileStagePill} style={{ ['--sc' as string]: stage?.color ?? 'var(--fill-info)' }}>
                      {stage?.label ?? deal.stage}
                    </span>
                  </div>
                  <div className={styles.mobileCardMeta}>
                    {deal.fullName && <span>{deal.fullName}</span>}
                    {deal.companyName && <span>{deal.companyName}</span>}
                    {deal.assignedName && <span>{deal.assignedName}</span>}
                  </div>
                  {deal.amount && <div className={styles.mobileCardAmount}>{fmt(deal.amount)}</div>}
                </button>
              );
            })}
            {allDeals.length === 0 && <div className={styles.colEmpty}>Сделки не найдены</div>}
          </div>
        );
      })()}

      {!isLoading && !isError && !isPhone && (
        <div className={styles.kanban}>
          {STAGES.map(({ key, label, color }) => {
            const deals = getStageDeals(key);
            const total = deals.reduce((s, d) => s + (d.amount ?? 0), 0);
            return (
              <div key={key} className={styles.column}>
                <div className={styles.columnHeader}>
                  <span className={styles.columnDot} style={{ background: color }} />
                  <span className={styles.columnLabel}>{label}</span>
                  <span className={styles.columnCount}>{deals.length}</span>
                </div>
                {total > 0 && <div className={styles.columnTotal}>{fmt(total)}</div>}
                <div className={styles.columnCards}>
                  {deals.map(deal => (
                    <button key={deal.id} className={styles.card} onClick={() => setSelectedId(deal.id)}>
                      <div className={styles.cardTitle}>{deal.title}</div>
                      {deal.fullName && <div className={styles.cardContact}>{deal.fullName}</div>}
                      {deal.companyName && <div className={styles.cardCompany}>{deal.companyName}</div>}
                      {(deal.amount || deal.assignedName) && (
                        <div className={styles.cardBottom}>
                          {deal.amount && <span className={styles.cardAmount}>{fmt(deal.amount)}</span>}
                          {deal.assignedName && <span className={styles.cardAssignee}>{deal.assignedName.split(' ')[0]}</span>}
                        </div>
                      )}
                    </button>
                  ))}
                  {deals.length === 0 && <div className={styles.colEmpty}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedId && <DealDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
