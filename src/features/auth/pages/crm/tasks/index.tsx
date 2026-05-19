import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTasks, useCreateTask, useUpdateTaskStatus } from '@/entities/task/queries';
import type { Task, TaskStatus, TaskPriority } from '@/entities/task/types';
import { TaskDrawer } from './TaskDrawer';
import { useViewportProfile } from '../../../shared/hooks/useViewportProfile';
import styles from './Tasks.module.css';

const COLS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'backlog',     label: 'Бэклог',    color: 'var(--text-tertiary)' },
  { key: 'in_progress', label: 'В работе',  color: 'var(--fill-info)' },
  { key: 'review',      label: 'Проверка',  color: '#F59E0B' },
  { key: 'done',        label: 'Готово',    color: 'var(--fill-positive)' },
];
// Backend: 'low' | 'medium' | 'high' | 'critical' (NOT 'urgent')
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'var(--text-tertiary)', medium: 'var(--fill-accent)',
  high: '#F59E0B', critical: 'var(--fill-danger)',
};
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий', critical: 'Критичный',
};

export default function TasksPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue'>('all');

  const { isPhone } = useViewportProfile();
  const params = { limit: 300, ...(filter === 'mine' ? { mine: true } : {}), ...(filter === 'overdue' ? { overdue: true } : {}) };
  const { data, isLoading, isError } = useTasks(params);
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();

  // Backend returns { count, page, limit, totalPages, results }
  const tasks: Task[] = (data as any)?.results ?? [];
  const byStatus = (s: TaskStatus) => tasks.filter(t => t.status === s);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    await createTask.mutateAsync({ title: newTitle.trim(), priority: 'medium' });
    setNewTitle(''); setCreating(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Задачи</h1>
        <div className={styles.headerRight}>
          <div className={styles.filterTabs}>
            {(['all', 'mine', 'overdue'] as const).map(f => (
              <button key={f} className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`} onClick={() => setFilter(f)}>
                {{ all: 'Все', mine: 'Мои', overdue: 'Просроченные' }[f]}
              </button>
            ))}
          </div>
          <button className={styles.addBtn} onClick={() => setCreating(true)}><Plus size={14} />Задача</button>
        </div>
      </div>

      {creating && (
        <div className={styles.quickCreate}>
          <input className={styles.quickInput} value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Название задачи..." autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }} />
          <button className={styles.quickOk} onClick={handleCreate} disabled={createTask.isPending}>Создать</button>
          <button className={styles.quickCancel} onClick={() => setCreating(false)}><X size={13} /></button>
        </div>
      )}

      {isLoading && (
        <div className={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}
      {isError && <div className={styles.error}>Не удалось загрузить задачи</div>}

      {!isLoading && !isError && isPhone && (
        <div className={styles.mobileList}>
          {tasks.map((task) => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
            return (
              <button key={task.id} className={styles.mobileCard} onClick={() => setSelectedId(task.id)}>
                <div className={styles.mobileCardHead}>
                  <span className={styles.mobileCardPrio} style={{ background: PRIORITY_COLOR[task.priority] }} />
                  <strong>{task.title}</strong>
                  <span className={styles.mobileStagePill} style={{ ['--sc' as string]: COLS.find(c => c.key === task.status)?.color ?? 'var(--text-tertiary)' }}>
                    {COLS.find(c => c.key === task.status)?.label ?? task.status}
                  </span>
                </div>
                <div className={styles.mobileCardMeta}>
                  {task.assignedName && <span>{task.assignedName}</span>}
                  {task.dueDate && (
                    <span style={{ color: isOverdue ? 'var(--fill-danger)' : 'var(--text-tertiary)' }}>
                      {new Date(task.dueDate).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {tasks.length === 0 && <div className={styles.colEmpty}>Задачи не найдены</div>}
        </div>
      )}

      {!isLoading && !isError && !isPhone && (
        <div className={styles.kanban}>
          {COLS.map(({ key, label, color }) => (
            <div key={key} className={styles.column}>
              <div className={styles.columnHeader}>
                <span className={styles.columnDot} style={{ background: color }} />
                <span className={styles.columnLabel}>{label}</span>
                <span className={styles.columnCount}>{byStatus(key).length}</span>
              </div>
              <div className={styles.columnCards}>
                {byStatus(key).map(task => (
                  <button key={task.id} className={styles.card} onClick={() => setSelectedId(task.id)}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardPrio} style={{ background: PRIORITY_COLOR[task.priority] }} />
                      <span className={styles.cardTitle}>{task.title}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      {task.assignedName && <span className={styles.cardAssignee}>{task.assignedName.split(' ')[0]}</span>}
                      {task.dueDate && (
                        <span className={styles.cardDue} style={{ color: new Date(task.dueDate) < new Date() && key !== 'done' ? 'var(--fill-danger)' : 'var(--text-tertiary)' }}>
                          {new Date(task.dueDate).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {byStatus(key).length === 0 && <div className={styles.colEmpty}>—</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedId && <TaskDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
