import { useState, useDeferredValue } from 'react';
import { Plus, LayoutList, Columns3, Search, AlertCircle } from 'lucide-react';
import { useLeads, useUpdateLead, useCreateLead } from '@/entities/lead/queries';
import type { Lead, LeadStage, LeadPipeline } from '@/entities/lead/types';
import { LeadDrawer } from './LeadDrawer';
import { CreateLeadModal } from './CreateLeadModal';
import { useViewportProfile } from '../../../shared/hooks/useViewportProfile';
import styles from './Leads.module.css';

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'new',         label: 'Новый',         color: 'var(--fill-info)' },
  { key: 'in_progress', label: 'В работе',       color: '#8B5CF6' },
  { key: 'won',         label: 'Выиграно',       color: 'var(--fill-positive)' },
  { key: 'lost',        label: 'Отказ',          color: 'var(--fill-danger)' },
];

export default function LeadsPage() {
  const [pipeline, setPipeline] = useState<LeadPipeline>('qualifier');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const { isPhone } = useViewportProfile();
  const { data, isLoading, isError } = useLeads({ pipeline, limit: 200 });
  const updateLead = useUpdateLead();

  // Backend returns { count, page, limit, totalPages, results }
  const leads: Lead[] = (data as any)?.results ?? [];

  const filtered = deferredSearch
    ? leads.filter(l =>
        l.fullName.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        l.phone?.includes(deferredSearch) ||
        l.source?.toLowerCase().includes(deferredSearch.toLowerCase())
      )
    : leads;

  const byStage = (stage: LeadStage) => filtered.filter(l => l.stage === stage);

  return (
    <div className={`${styles.root} kort-page-enter`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Лиды</h1>
          <div className={styles.pipelineTabs}>
            {(['qualifier', 'closer'] as LeadPipeline[]).map(p => (
              <button
                key={p}
                className={`${styles.pipelineTab} ${pipeline === p ? styles.pipelineTabActive : ''}`}
                onClick={() => setPipeline(p)}
              >
                {p === 'qualifier' ? 'Квалификация' : 'Переговоры'}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
            />
          </div>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`} onClick={() => setView('kanban')}><Columns3 size={14} /></button>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}><LayoutList size={14} /></button>
          </div>
          <button className={styles.addBtn} onClick={() => setCreateOpen(true)}>
            <Plus size={14} />Новый лид
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}
      {isError && (
        <div className="kort-inline-error">
          <AlertCircle size={16} />
          Не удалось загрузить лиды. Проверьте соединение и попробуйте обновить страницу.
        </div>
      )}

      {!isLoading && !isError && isPhone && (
        <div className={styles.mobileList}>
          {filtered.map((lead) => (
            <button
              key={lead.id}
              className={styles.mobileCard}
              onClick={() => setSelectedId(lead.id)}
            >
              <div className={styles.mobileCardHead}>
                <strong>{lead.fullName}</strong>
                <span
                  className={styles.mobileStagePill}
                  style={{ ['--sc' as string]: STAGES.find((s) => s.key === lead.stage)?.color ?? 'var(--fill-info)' }}
                >
                  {STAGES.find((s) => s.key === lead.stage)?.label ?? lead.stage}
                </span>
              </div>
              <div className={styles.mobileCardMeta}>
                {lead.phone && <span>{lead.phone}</span>}
                {lead.source && <span>{lead.source}</span>}
                {lead.assignedName && <span>{lead.assignedName}</span>}
              </div>
              {lead.budget && (
                <div className={styles.mobileCardBudget}>
                  {new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(lead.budget)} ₸
                </div>
              )}
            </button>
          ))}
          {filtered.length === 0 && <div className={styles.empty}>Лиды не найдены</div>}
        </div>
      )}

      {!isLoading && !isError && !isPhone && view === 'kanban' && (
        <div className={styles.kanban}>
          {STAGES.map(({ key, label, color }) => {
            const cards = byStage(key);
            return (
              <div key={key} className={styles.column}>
                <div className={styles.columnHeader}>
                  <span className={styles.columnDot} style={{ background: color }} />
                  <span className={styles.columnLabel}>{label}</span>
                  <span className={styles.columnCount}>{cards.length}</span>
                </div>
                <div className={styles.columnCards}>
                  {cards.map(lead => (
                    <button key={lead.id} className={styles.card} onClick={() => setSelectedId(lead.id)}>
                      <div className={styles.cardName}>{lead.fullName}</div>
                      {lead.phone && <div className={styles.cardPhone}>{lead.phone}</div>}
                      <div className={styles.cardMeta}>
                        {lead.source && <span className={styles.cardSource}>{lead.source}</span>}
                        {lead.assignedName && <span className={styles.cardAssignee}>{lead.assignedName.split(' ')[0]}</span>}
                        {lead.budget && <span className={styles.cardBudget}>{new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(lead.budget)} ₸</span>}
                      </div>
                    </button>
                  ))}
                  {cards.length === 0 && <div className={styles.colEmpty}>Нет лидов</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && !isPhone && view === 'list' && (
        <div className={styles.listWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Имя</th><th>Телефон</th><th>Источник</th><th>Стадия</th><th>Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} className={styles.tableRow} onClick={() => setSelectedId(lead.id)}>
                  <td className={styles.tdName}>{lead.fullName}</td>
                  <td className={styles.tdMono}>{lead.phone ?? '—'}</td>
                  <td>{lead.source ?? '—'}</td>
                  <td>
                    <span className={styles.stagePill} style={{ '--sc': STAGES.find(s => s.key === lead.stage)?.color ?? 'var(--fill-info)' } as React.CSSProperties}>
                      {STAGES.find(s => s.key === lead.stage)?.label ?? lead.stage}
                    </span>
                  </td>
                  <td>{lead.assignedName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className={styles.empty}>Лиды не найдены</div>}
        </div>
      )}

      {selectedId && <LeadDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
      {createOpen && <CreateLeadModal onClose={() => setCreateOpen(false)} pipeline={pipeline} />}
    </div>
  );
}
