import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, CheckCircle2, Factory, Flag, Layers, MessageSquare, Search, User, X } from 'lucide-react';
import {
  useAssignWorker,
  useChapanCatalogs,
  useClaimProductionTask,
  useFlagTask,
  usePendingChangeRequests,
  useApproveChangeRequest,
  useRejectChangeRequest,
  useProductionTasks,
  useUnflagTask,
  useUpdateProductionStatus,
  useWorkshopTasks,
} from '../../../../entities/order/queries';
import type { ChapanChangeRequest, Priority, ProductionStatus, ProductionTask, Urgency } from '../../../../entities/order/types';
import { useAuthStore } from '@/shared/stores/auth';
import { buildItemLine, buildTaskMetaLine } from '../../../../shared/utils/itemLine';
import styles from './ChapanProduction.module.css';

type ProductionMode = 'manager' | 'workshop';
type ColumnKey = Extract<ProductionStatus, 'queued' | 'in_progress'>;

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'queued', label: 'Новые заказы' },
  { key: 'in_progress', label: 'Выполнение' },
];

// Left-border colour on task card — driven by urgency (new) with priority fallback
function getUrgencyDot(task: ProductionTask): string {
  const urgency = task.order.urgency ?? task.order.priority;
  if (urgency === 'urgent') return '#D94F4F';
  if (task.order.isDemandingClient ?? task.order.priority === 'vip') return '#C9A84C';
  return 'rgba(180,192,210,.32)';
}

const BATCH_WINDOW_DAYS = 2;

type TaskDisplayGroup =
  | { kind: 'single'; task: ProductionTask }
  | { kind: 'batch'; tasks: ProductionTask[] };

function groupStorageKey(userId?: string) {
  return `chapan_prod_grouped_${userId ?? 'guest'}`;
}

function taskBatchKey(task: ProductionTask): string {
  return [
    task.productName?.toLowerCase().trim() ?? '',
    task.fabric?.toLowerCase().trim() ?? '',
    task.size?.toLowerCase().trim() ?? '',
    task.order.urgency ?? task.order.priority,
    String(task.order.isDemandingClient ?? (task.order.priority === 'vip')),
    task.status,
  ].join('|');
}

function buildTaskGroups(tasks: ProductionTask[]): TaskDisplayGroup[] {
  const buckets = new Map<string, ProductionTask[]>();

  for (const task of tasks) {
    const key = taskBatchKey(task);
    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }

  const result: TaskDisplayGroup[] = [];

  for (const [, bucket] of buckets) {
    if (bucket.length === 1) {
      result.push({ kind: 'single', task: bucket[0] });
      continue;
    }

    const withDate = bucket
      .filter((task) => task.order.dueDate)
      .sort((a, b) => +new Date(a.order.dueDate!) - +new Date(b.order.dueDate!));
    const withoutDate = bucket.filter((task) => !task.order.dueDate);
    const clusters: ProductionTask[][] = [];
    let current: ProductionTask[] = [];

    for (const task of withDate) {
      if (!current.length) {
        current.push(task);
        continue;
      }

      const diffDays = (+new Date(task.order.dueDate!) - +new Date(current[0].order.dueDate!)) / 86_400_000;
      if (diffDays <= BATCH_WINDOW_DAYS) current.push(task);
      else {
        clusters.push(current);
        current = [task];
      }
    }

    if (current.length) clusters.push(current);
    if (withoutDate.length) clusters.push(withoutDate);

    for (const cluster of clusters) {
      if (cluster.length === 1) result.push({ kind: 'single', task: cluster[0] });
      else result.push({ kind: 'batch', tasks: cluster });
    }
  }

  return result;
}


function getTaskBatchColor(task: ProductionTask) {
  const urgency = task.order.urgency ?? task.order.priority;
  if (urgency === 'urgent') return '#D94F4F';
  if (task.order.isDemandingClient ?? task.order.priority === 'vip') return '#C9A84C';
  return 'rgba(180,192,210,.4)';
}

function formatDeadline(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' });
}

function filterWorkshopTasks(tasks: ProductionTask[], currentWorkerName: string | null) {
  if (!currentWorkerName) return tasks;

  return tasks.filter((task) => {
    if (task.status === 'queued') {
      return !task.assignedTo || task.assignedTo === currentWorkerName;
    }

    return task.assignedTo === currentWorkerName;
  });
}

export default function ChapanProductionPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const currentWorkerName = useAuthStore((state) => state.user?.full_name ?? null);
  const membershipRole = useAuthStore((state) => state.membership.role);
  const employeePermissions = useAuthStore((state) => state.user?.employee_permissions ?? []);

  const workshopDefault =
    (employeePermissions.includes('production') || employeePermissions.includes('chapan_access_production'))
    && !employeePermissions.includes('chapan_full_access')
    && !employeePermissions.includes('full_access')
    && membershipRole !== 'owner'
    && membershipRole !== 'admin';

  const [view, setView] = useState<ProductionMode>(workshopDefault ? 'workshop' : 'manager');
  const [grouped, setGroupedState] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [flagModal, setFlagModal] = useState<{ taskId: string } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [rejectModal, setRejectModal] = useState<{ crId: string; orderNumber: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    setView(workshopDefault ? 'workshop' : 'manager');
  }, [workshopDefault, userId]);

  useEffect(() => {
    const saved = localStorage.getItem(groupStorageKey(userId));
    if (saved !== null) {
      setGroupedState(saved !== 'false');
    }
  }, [userId]);

  const toggleGrouped = () => {
    setGroupedState((value) => {
      localStorage.setItem(groupStorageKey(userId), String(!value));
      return !value;
    });
  };

  const { data: managerData, isLoading: managerLoading } = useProductionTasks();
  const { data: workshopData, isLoading: workshopLoading } = useWorkshopTasks();
  const { data: catalogs } = useChapanCatalogs();
  const { data: changeRequests } = usePendingChangeRequests();

  const claimTask = useClaimProductionTask();
  const updateStatus = useUpdateProductionStatus();
  const assignWorker = useAssignWorker();
  const flagTask = useFlagTask();
  const unflagTask = useUnflagTask();
  const approveChangeRequest = useApproveChangeRequest();
  const rejectChangeRequest = useRejectChangeRequest();


  const rawTasks = view === 'manager' ? (managerData?.results ?? []) : (workshopData?.results ?? []);
  const filteredByView = useMemo(
    () => view === 'workshop' ? filterWorkshopTasks(rawTasks, currentWorkerName) : rawTasks,
    [currentWorkerName, rawTasks, view],
  );
  const tasks = useMemo(() => {
    if (!deferredSearch.trim()) return filteredByView;
    const q = deferredSearch.toLowerCase().trim();
    return filteredByView.filter((task) =>
      task.order.orderNumber.toLowerCase().includes(q) ||
      (task.productName?.toLowerCase() ?? '').includes(q) ||
      (task.fabric?.toLowerCase() ?? '').includes(q) ||
      (task.size?.toLowerCase() ?? '').includes(q),
    );
  }, [deferredSearch, filteredByView]);

  const isLoading = view === 'manager' ? managerLoading : workshopLoading;
  const workers = catalogs?.workers ?? [];

  const queuedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => task.status === 'queued');
    // E1: срочные задачи всегда наверху колонки
    return [...filtered].sort((a, b) => {
      const ua = (a.order.urgency ?? a.order.priority) === 'urgent' ? 0 : 1;
      const ub = (b.order.urgency ?? b.order.priority) === 'urgent' ? 0 : 1;
      return ua - ub;
    });
  }, [tasks]);
  const runningTasks = useMemo(() => {
    const filtered = tasks.filter((task) => task.status === 'in_progress');
    // E1: срочные задачи всегда наверху колонки
    return [...filtered].sort((a, b) => {
      const ua = (a.order.urgency ?? a.order.priority) === 'urgent' ? 0 : 1;
      const ub = (b.order.urgency ?? b.order.priority) === 'urgent' ? 0 : 1;
      return ua - ub;
    });
  }, [tasks]);

  async function handleFlag() {
    if (!flagModal || !flagReason.trim()) return;
    await flagTask.mutateAsync({ taskId: flagModal.taskId, reason: flagReason.trim() });
    setFlagModal(null);
    setFlagReason('');
  }

  async function handleClaim(taskId: string) {
    await claimTask.mutateAsync(taskId);
  }

  async function handleMarkDone(taskId: string) {
    await updateStatus.mutateAsync({ taskId, status: 'done' });
  }

  async function handleReturnToQueue(taskId: string) {
    await assignWorker.mutateAsync({ taskId, worker: null });
    await updateStatus.mutateAsync({ taskId, status: 'queued' });
  }

  async function handleRejectChangeRequest() {
    if (!rejectModal || !rejectReason.trim()) return;
    await rejectChangeRequest.mutateAsync({ crId: rejectModal.crId, rejectReason: rejectReason.trim() });
    setRejectModal(null);
    setRejectReason('');
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <Factory size={18} />
            <span>Производство</span>
          </div>
          <div className={styles.headerSub}>Пошив и контроль выполнения</div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchFieldWrap}>
            <Search size={13} className={styles.searchFieldIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ЧП-номер или товар..."
            />
          </div>
          <button
            className={`${styles.groupToggle} ${grouped ? styles.groupToggleActive : ''}`}
            onClick={toggleGrouped}
            title={grouped ? 'Отключить группировку' : 'Сгруппировать похожие задания'}
          >
            <Layers size={13} />
            <span>Группировать</span>
          </button>

          {!workshopDefault && (
            <div className={styles.viewSwitch}>
              <button
                className={`${styles.switchBtn} ${view === 'manager' ? styles.switchActive : ''}`}
                onClick={() => setView('manager')}
              >
                Управление
              </button>
              <button
                className={`${styles.switchBtn} ${view === 'workshop' ? styles.switchActive : ''}`}
                onClick={() => setView('workshop')}
              >
                Швея
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Change Request Alerts ──────────────────────────────────────── */}
      {changeRequests && changeRequests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {changeRequests.map((cr: ChapanChangeRequest) => (
            <div
              key={cr.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px',
                background: 'rgba(217,79,79,.09)', border: '1.5px solid rgba(217,79,79,.35)',
                borderRadius: 12, flexWrap: 'wrap',
              }}
            >
              <AlertTriangle size={18} style={{ color: '#D94F4F', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#D94F4F', marginBottom: 3 }}>
                  Запрос на изменение позиций — #{cr.order.orderNumber}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Менеджер <strong>{cr.requestedBy}</strong> просит изменить позиции заказа.
                  {cr.managerNote && (
                    <span style={{ marginLeft: 4, color: 'var(--text-tertiary)' }}>
                      Пояснение: «{cr.managerNote}»
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Новые позиции: {(cr.proposedItems ?? []).map((item) =>
                    `${buildItemLine(item)} - ${item.size} × ${item.quantity}`
                  ).join(', ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                <button
                  style={{
                    padding: '7px 14px', background: 'rgba(16,185,129,.12)',
                    border: '1px solid rgba(16,185,129,.3)', borderRadius: 8,
                    color: 'var(--fill-positive, #10b981)', fontSize: 12, fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer',
                    opacity: approveChangeRequest.isPending ? .6 : 1,
                  }}
                  onClick={() => approveChangeRequest.mutate(cr.id)}
                  disabled={approveChangeRequest.isPending}
                >
                  Одобрить
                </button>
                <button
                  style={{
                    padding: '7px 14px', background: 'rgba(239,68,68,.08)',
                    border: '1px solid rgba(239,68,68,.25)', borderRadius: 8,
                    color: '#D94F4F', fontSize: 12, fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                  onClick={() => {
                    setRejectModal({ crId: cr.id, orderNumber: cr.order.orderNumber });
                    setRejectReason('');
                  }}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.skeleton} />
          ))}
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Активных производственных карточек нет</div>
          <div className={styles.emptyText}>
            Новые подтвержденные заказы появятся здесь автоматически.
          </div>
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className={styles.board}>
          {COLUMNS.map((column) => {
            const columnTasks = column.key === 'queued' ? queuedTasks : runningTasks;
            const displayGroups = grouped
              ? buildTaskGroups(columnTasks)
              : columnTasks.map((task) => ({ kind: 'single' as const, task }));

            return (
              <section key={column.key} className={styles.column}>
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>{column.label}</div>
                  <span className={styles.columnCount}>{displayGroups.length}</span>
                </div>

                <div className={styles.columnCards}>
                  {displayGroups.map((group, index) => (
                    group.kind === 'single' ? (
                      <TaskCard
                        key={group.task.id}
                        task={group.task}
                        column={column.key}
                        mode={view}
                        currentWorkerName={currentWorkerName}
                        onClaim={handleClaim}
                        onDone={handleMarkDone}
                        onReturnToQueue={handleReturnToQueue}
                        onFlag={(task) => {
                          setFlagModal({ taskId: task.id });
                          setFlagReason('');
                        }}
                        onUnflag={(task) => unflagTask.mutate(task.id)}
                      />
                    ) : (
                      <BatchTaskCard
                        key={`${column.key}-${index}`}
                        tasks={group.tasks}
                        column={column.key}
                        mode={view}
                        currentWorkerName={currentWorkerName}
                        onClaim={handleClaim}
                        onDone={handleMarkDone}
                        onReturnToQueue={handleReturnToQueue}
                        onFlag={(task) => {
                          setFlagModal({ taskId: task.id });
                          setFlagReason('');
                        }}
                        onUnflag={(task) => unflagTask.mutate(task.id)}
                      />
                    )
                  ))}

                  {displayGroups.length === 0 && (
                    <div className={styles.columnEmpty}>Пока пусто</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {flagModal && (
        <div className={styles.modalOverlay} onClick={() => setFlagModal(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Заблокировать карточку</span>
              <button className={styles.modalClose} onClick={() => setFlagModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Причина</label>
              <input
                className={styles.modalInput}
                value={flagReason}
                onChange={(event) => setFlagReason(event.target.value)}
                placeholder="Например: не хватает ткани или найден дефект"
                autoFocus
                onKeyDown={(event) => event.key === 'Enter' && handleFlag()}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setFlagModal(null)}>
                Отмена
              </button>
              <button
                className={styles.modalSubmit}
                onClick={handleFlag}
                disabled={!flagReason.trim() || flagTask.isPending}
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}


      {rejectModal && (
        <div className={styles.modalOverlay} onClick={() => setRejectModal(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Отклонить запрос — #{rejectModal.orderNumber}</span>
              <button className={styles.modalClose} onClick={() => setRejectModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Причина отказа</label>
              <input
                className={styles.modalInput}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Например: изделие уже раскроено, нельзя изменить размер"
                autoFocus
                onKeyDown={(event) => event.key === 'Enter' && handleRejectChangeRequest()}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setRejectModal(null)}>
                Отмена
              </button>
              <button
                className={styles.modalSubmit}
                onClick={handleRejectChangeRequest}
                disabled={!rejectReason.trim() || rejectChangeRequest.isPending}
              >
                Отклонить запрос
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function TaskDetailPanel({ task }: { task: ProductionTask }) {
  const deadline = formatDeadline(task.order.dueDate);

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailSection}>
        <div className={styles.detailSectionLabel}>Изделие</div>
        <div className={styles.detailGrid}>
          <span className={styles.detailLabel}>Товар:</span>
          <span className={styles.detailValue}>{task.productName}</span>

          {task.color && (
            <>
              <span className={styles.detailLabel}>Цвет:</span>
              <span className={styles.detailValue}>{task.color}</span>
            </>
          )}

          {task.gender && (
            <>
              <span className={styles.detailLabel}>Пол:</span>
              <span className={styles.detailValue}>{task.gender}</span>
            </>
          )}

          {task.fabric && (
            <>
              <span className={styles.detailLabel}>Ткань:</span>
              <span className={styles.detailValue}>{task.fabric}</span>
            </>
          )}

          <span className={styles.detailLabel}>Размер:</span>
          <span className={styles.detailValue}>{task.size}</span>

          {task.length && (
            <>
              <span className={styles.detailLabel}>Длина:</span>
              <span className={styles.detailValue}>{task.length}</span>
            </>
          )}

          <span className={styles.detailLabel}>Кол-во:</span>
          <span className={styles.detailValue}>{task.quantity} шт.</span>
        </div>
      </div>

      {(task.notes || task.workshopNotes) && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionLabel}>Примечания</div>
          {task.notes && (
            <div className={styles.noteItem}>
              <span className={styles.noteLabel}>К заданию:</span>
              <span className={styles.noteText}>{task.notes}</span>
            </div>
          )}
          {task.workshopNotes && (
            <div className={styles.noteItem}>
              <span className={styles.noteLabel}>К позиции:</span>
              <span className={styles.noteText}>{task.workshopNotes}</span>
            </div>
          )}
        </div>
      )}

      {task.defects && (
        <div className={`${styles.detailSection} ${styles.defectSection}`}>
          <div className={styles.detailSectionLabel}>Дефекты</div>
          <div className={styles.defectNote}>{task.defects}</div>
        </div>
      )}

      <div className={styles.detailSection}>
        <div className={styles.detailSectionLabel}>Детали заказа</div>
        <div className={styles.detailGrid}>
          <span className={styles.detailLabel}>Заказ:</span>
          <span className={styles.detailValue}>#{task.order.orderNumber}</span>

          {deadline && (
            <>
              <span className={styles.detailLabel}>Срок:</span>
              <span className={styles.detailValue}>{deadline}</span>
            </>
          )}

          {task.assignedTo && (
            <>
              <span className={styles.detailLabel}>Исполнитель:</span>
              <span className={styles.detailValue}>{task.assignedTo}</span>
            </>
          )}

          <span className={styles.detailLabel}>Статус:</span>
          <span className={styles.detailValue}>
            {task.status === 'queued' ? 'В очереди' : task.status === 'in_progress' ? 'В работе' : 'Готово'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: ProductionTask;
  column: ColumnKey;
  mode: ProductionMode;
  currentWorkerName: string | null;
  onClaim: (taskId: string) => Promise<void>;
  onDone: (taskId: string) => Promise<void>;
  onReturnToQueue: (taskId: string) => Promise<void>;
  onFlag: (task: ProductionTask) => void;
  onUnflag: (task: ProductionTask) => void;
}

function TaskCard({
  task,
  column,
  mode,
  currentWorkerName,
  onClaim,
  onDone,
  onReturnToQueue,
  onFlag,
  onUnflag,
}: TaskCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const deadline = formatDeadline(task.order.dueDate);
  const canClaim = !task.isBlocked && (!task.assignedTo || task.assignedTo === currentWorkerName);
  const isUrgent = (task.order.urgency ?? task.order.priority) === 'urgent';
  const isDemanding = task.order.isDemandingClient ?? (task.order.priority === 'vip');

  return (
    <article className={`${styles.card} ${task.isBlocked ? styles.cardBlocked : ''} ${isUrgent ? styles.cardUrgent : ''} ${isDemanding && !isUrgent ? styles.cardDemanding : ''}`}>
      {isUrgent && !task.isBlocked && (
        <div className={styles.urgentBanner}>
          <AlertTriangle size={11} />
          <span>Срочно</span>
        </div>
      )}
      {isDemanding && !isUrgent && !task.isBlocked && (
        <div className={styles.demandBanner}>
          <span>⭐ Требовательный клиент</span>
        </div>
      )}
      {isUrgent && isDemanding && !task.isBlocked && (
        <div className={styles.demandBanner} style={{ marginTop: 2 }}>
          <span>⭐ Требовательный</span>
        </div>
      )}
      {task.isBlocked && task.blockReason && (
        <div className={styles.blockBanner}>
          <AlertTriangle size={12} />
          <span>{task.blockReason}</span>
        </div>
      )}

      {/* E3: compact head — номер + клиент в одну строку */}
      <div className={styles.cardHead}>
        <span
          className={styles.orderNumber}
          style={{ borderLeftColor: getUrgencyDot(task) }}
        >
          #{task.order.orderNumber}
        </span>
        <div className={styles.cardHeadRight}>
          {deadline && <span className={styles.deadline}>{deadline}</span>}
          {mode === 'manager' && task.order.clientName && (
            <span className={styles.clientName}>{task.order.clientName.split(' ')[0]}</span>
          )}
        </div>
      </div>

      <div className={styles.productName}>
        {buildItemLine({ productName: task.productName, color: task.color, gender: task.gender }) || task.productName}
      </div>
      <div className={styles.metaLine}>{buildTaskMetaLine(task)}</div>

      {task.notes && (
        <div className={styles.workshopNote}>
          <MessageSquare size={11} className={styles.workshopNoteIcon} />
          <span>{task.notes}</span>
        </div>
      )}

      {task.assignedTo && (
        <div className={styles.infoRow}>
          <span className={styles.workerChip}>
            <User size={11} />
            {task.assignedTo}
          </span>
        </div>
      )}

      <div className={styles.cardActions}>
        {column === 'queued' && mode === 'workshop' && (
          <button
            className={styles.primaryAction}
            onClick={() => onClaim(task.id)}
            disabled={!canClaim}
          >
            Взять в работу
          </button>
        )}

        {column === 'in_progress' && (
          <>
            <button
              className={styles.successAction}
              onClick={() => onDone(task.id)}
              disabled={task.isBlocked}
            >
              <CheckCircle2 size={13} />
              Готово
            </button>
            {mode === 'manager' && (
              <button className={styles.secondaryAction} onClick={() => onReturnToQueue(task.id)}>
                Вернуть
              </button>
            )}
          </>
        )}

        {mode === 'manager' && (
          task.isBlocked ? (
            <button className={styles.ghostAction} onClick={() => onUnflag(task)}>
              Снять блок
            </button>
          ) : (
            <button className={styles.iconAction} onClick={() => onFlag(task)} title="Заблокировать">
              <Flag size={12} />
            </button>
          )
        )}

        {mode === 'workshop' && (
          <button
            className={styles.ghostAction}
            onClick={() => setDetailOpen((v) => !v)}
            aria-expanded={detailOpen}
            style={{ marginLeft: 'auto', fontSize: 11 }}
          >
            {detailOpen ? 'Скрыть' : 'Детали'}
          </button>
        )}
      </div>

      {mode === 'workshop' && detailOpen && <TaskDetailPanel task={task} />}
    </article>
  );
}

interface BatchTaskCardProps {
  tasks: ProductionTask[];
  column: ColumnKey;
  mode: ProductionMode;
  currentWorkerName: string | null;
  onClaim: (taskId: string) => Promise<void>;
  onDone: (taskId: string) => Promise<void>;
  onReturnToQueue: (taskId: string) => Promise<void>;
  onFlag: (task: ProductionTask) => void;
  onUnflag: (task: ProductionTask) => void;
}

function BatchTaskCard({
  tasks,
  column,
  mode,
  currentWorkerName,
  onClaim,
  onDone,
  onReturnToQueue,
  onFlag,
  onUnflag,
}: BatchTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const firstTask = tasks[0];
  const batchColor = getTaskBatchColor(firstTask);
  const totalQty = tasks.reduce((sum, task) => sum + task.quantity, 0);
  const blockedCount = tasks.filter((task) => task.isBlocked).length;

  const dateRange = useMemo(() => {
    const dated = tasks
      .filter((task) => task.order.dueDate)
      .sort((a, b) => +new Date(a.order.dueDate!) - +new Date(b.order.dueDate!));

    if (!dated.length) return null;

    const first = formatDeadline(dated[0].order.dueDate);
    const last = formatDeadline(dated[dated.length - 1].order.dueDate);

    return first === last ? first : `${first} – ${last}`;
  }, [tasks]);

  async function handleClaimAll() {
    for (const task of tasks) {
      const canClaim = !task.isBlocked && (!task.assignedTo || task.assignedTo === currentWorkerName);
      if (canClaim) {
        await onClaim(task.id);
      }
    }
  }

  async function handleDoneAll() {
    for (const task of tasks) {
      if (!task.isBlocked) {
        await onDone(task.id);
      }
    }
  }

  const cardStyle = { '--batch-color': batchColor } as CSSProperties;

  return (
    <div className={styles.batchWrap} style={cardStyle}>
      <div className={`${styles.batchCard} ${expanded ? styles.batchOpen : ''}`}>
        <div className={styles.batchHead}>
          <span className={styles.batchBadge}>{tasks.length}</span>
          <span className={styles.batchLabel}>карточки</span>
          {blockedCount > 0 && (
            <span className={styles.batchBlocked}>
              <AlertTriangle size={10} />
              {blockedCount}
            </span>
          )}
          <button className={styles.batchExpand} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Скрыть' : 'Открыть'}
          </button>
        </div>

        <div className={styles.productName}>
          {buildItemLine({ productName: firstTask.productName, color: firstTask.color, gender: firstTask.gender }) || firstTask.productName}
        </div>
        <div className={styles.metaLine}>
          {buildTaskMetaLine({ ...firstTask, quantity: undefined })} · {totalQty} шт.
        </div>

        <div className={styles.batchMeta}>
          {dateRange && <span>{dateRange}</span>}
        </div>

        {column === 'queued' && mode === 'workshop' && (
          <button className={styles.primaryAction} onClick={handleClaimAll}>
            Взять все
          </button>
        )}

        {column === 'in_progress' && (
          <button className={styles.successAction} onClick={handleDoneAll}>
            <CheckCircle2 size={13} />
            Готово ×{tasks.filter((task) => !task.isBlocked).length}
          </button>
        )}
      </div>

      {expanded && (
        <div className={styles.batchList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              column={column}
              mode={mode}
              currentWorkerName={currentWorkerName}
              onClaim={onClaim}
              onDone={onDone}
              onReturnToQueue={onReturnToQueue}
              onFlag={onFlag}
              onUnflag={onUnflag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
