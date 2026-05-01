import { useDeferredValue, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, CalendarDays, Factory, MessageCircle, Search, Star, X, XCircle } from 'lucide-react';
import {
  useAssignWorker,
  useClaimProductionTask,
  useFlagTask,
  useUnflagTask,
  usePendingChangeRequests,
  useApproveChangeRequest,
  useRejectChangeRequest,
  useUpdateProductionStatus,
  useWorkshopTasks,
} from '../../../../entities/order/queries';
import type { ChapanChangeRequest, ProductionStatus, ProductionTask } from '../../../../entities/order/types';
import { useAuthStore } from '@/shared/stores/auth';
import { useChapanPermissions } from '@/shared/hooks/useChapanPermissions';
import { buildItemLine } from '../../../../shared/utils/itemLine';
import WorkshopTaskCard from './WorkshopTaskCard';
import { sortWorkshopTasks } from './workshopSort';
import styles from './ChapanProduction.module.css';

function applySearch(tasks: ProductionTask[], q: string): ProductionTask[] {
  if (!q.trim()) return tasks;
  const lower = q.toLowerCase();
  return tasks.filter(
    (t) =>
      t.order.orderNumber.toLowerCase().includes(lower) ||
      (t.productName?.toLowerCase() ?? '').includes(lower),
  );
}

function applyDueDateFilter(tasks: ProductionTask[], date: string | null): ProductionTask[] {
  if (!date) return tasks;
  return tasks.filter((t) => t.order.dueDate?.slice(0, 10) === date);
}

function applyAcceptedFilter(tasks: ProductionTask[], date: string | null): ProductionTask[] {
  if (!date) return tasks;
  return tasks.filter((t) => t.startedAt?.slice(0, 10) === date);
}

const DatePickerPopover = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (date: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button className={styles.filterBtn} onClick={() => setOpen(!open)}>
        <CalendarDays size={13} />
        {label}
        {value && <span style={{ marginLeft: 4, fontSize: 11 }}>({value})</span>}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 50,
            marginTop: 4,
            background: 'var(--ch-card)',
            border: '1px solid var(--ch-border)',
            borderRadius: 6,
            padding: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <input
            type="date"
            title={`Выбрать дату: ${label}`}
            value={value ?? ''}
            onChange={(e) => {
              onChange(e.target.value || null);
              setOpen(false);
            }}
            style={{
              padding: 6,
              border: '1px solid var(--ch-border)',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
          {value && (
            <button
              onClick={() => onChange(null)}
              style={{
                display: 'block',
                marginTop: 6,
                fontSize: 11,
                color: 'var(--ch-text-dim)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Сбросить
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default function ChapanProductionPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const currentWorkerName = useAuthStore((state) => state.user?.full_name ?? null);
  const membershipRole = useAuthStore((state) => state.membership.role);
  const employeePermissions = useAuthStore((state) => state.user?.employee_permissions ?? []);

  const { canManageProduction } = useChapanPermissions();

  // Data queries
  const { data: workshopData, isLoading } = useWorkshopTasks();
  const { data: changeRequests } = usePendingChangeRequests();

  // Mutations
  const updateStatus = useUpdateProductionStatus();
  const claimTask = useClaimProductionTask();
  const assignWorker = useAssignWorker();
  const flagTask = useFlagTask();
  const unflagTask = useUnflagTask();
  const approveChangeRequest = useApproveChangeRequest();
  const rejectChangeRequest = useRejectChangeRequest();

  // State
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [dueDateFilter, setDueDateFilter] = useState<string | null>(null);
  const [acceptedFilter, setAcceptedFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [pendingDoneIds, setPendingDoneIds] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ crId: string; orderNumber: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowOnlySelected(false);
  };

  const handleMarkDone = async (taskId: string, currentStatus: ProductionStatus) => {
    setPendingDoneIds((prev) => new Set([...prev, taskId]));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(taskId);
      return n;
    });

    try {
      if (currentStatus === 'queued') {
        await claimTask.mutateAsync(taskId);
      }
      await updateStatus.mutateAsync({ taskId, status: 'done' });
    } catch (err) {
      setPendingDoneIds((prev) => {
        const n = new Set(prev);
        n.delete(taskId);
        return n;
      });
    }
  };

  const handleFlagTask = async (taskId: string, reason: string) => {
    await flagTask.mutateAsync({ taskId, reason });
  };

  const handleReturnToQueue = async (taskId: string) => {
    await assignWorker.mutateAsync({ taskId, worker: null });
    await updateStatus.mutateAsync({ taskId, status: 'queued' });
  };

  const handleRejectChangeRequest = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    await rejectChangeRequest.mutateAsync({
      crId: rejectModal.crId,
      rejectReason: rejectReason.trim(),
    });
    setRejectModal(null);
    setRejectReason('');
  };

  // Filtering pipeline
  const visibleTasks = useMemo(() => {
    let result = workshopData?.results ?? [];
    result = result.filter((t) => !pendingDoneIds.has(t.id));
    result = applySearch(result, deferredSearch);
    result = applyDueDateFilter(result, dueDateFilter);
    result = applyAcceptedFilter(result, acceptedFilter);
    result = sortWorkshopTasks(result);
    if (showOnlySelected && selectedIds.size > 0) {
      result = result.filter((t) => selectedIds.has(t.id));
    }
    return result;
  }, [workshopData, pendingDoneIds, deferredSearch, dueDateFilter, acceptedFilter, showOnlySelected, selectedIds]);

  return (
    <div className={styles.root}>
      {/* ── Change Request Alerts ──────────────────────────────────────── */}
      {canManageProduction && changeRequests && changeRequests.length > 0 && (
        <div className={styles.alertsContainer}>
          {changeRequests.map((cr: ChapanChangeRequest) => (
            <div key={cr.id} className={styles.alertBanner}>
              <AlertTriangle size={18} className={styles.alertIcon} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>Запрос на изменение позиций — #{cr.order.orderNumber}</div>
                <div>
                  Менеджер <strong>{cr.requestedBy}</strong> просит изменить позиции заказа.
                  {cr.managerNote && (
                    <span className={styles.alertNote}>Пояснение: «{cr.managerNote}»</span>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ch-text-muted)' }}>
                  Новые позиции:{' '}
                  {(cr.proposedItems ?? [])
                    .map((item) => `${buildItemLine(item)} - ${item.size} × ${item.quantity}`)
                    .join(', ')}
                </div>
              </div>
              <div className={styles.alertActions}>
                <button
                  className={styles.alertBtn}
                  onClick={() => approveChangeRequest.mutate(cr.id)}
                >
                  Принять
                </button>
                <button
                  className={`${styles.alertBtn} ${styles.alertBtnSecondary}`}
                  onClick={() => setRejectModal({ crId: cr.id, orderNumber: cr.order.orderNumber })}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Reject Modal ────────────────────────────────────────────────── */}
      {rejectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setRejectModal(null)}
        >
          <div
            style={{
              background: 'var(--ch-card)',
              borderRadius: 12,
              padding: 20,
              minWidth: 300,
              maxWidth: 500,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
              Отклонить запрос на изменение #{rejectModal.orderNumber}
            </h3>
            <textarea
              title="Введите причину отклонения запроса"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отклонения..."
              rows={3}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid var(--ch-border)',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'inherit',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRejectModal(null)}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid var(--ch-border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleRejectChangeRequest}
                disabled={!rejectReason.trim()}
                style={{
                  padding: '6px 12px',
                  background: '#d94f4f',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: rejectReason.trim() ? 1 : 0.5,
                }}
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>
          <Factory size={18} />
          Цех
          <span className={styles.count}>{visibleTasks.length} позиций</span>
        </h1>
        <div className={styles.controls}>
          <div className={styles.searchInput}>
            <Search size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Заказ или товар..."
              type="text"
            />
          </div>
          <DatePickerPopover label="Срок сдачи" value={dueDateFilter} onChange={setDueDateFilter} />
          <DatePickerPopover label="Принят" value={acceptedFilter} onChange={setAcceptedFilter} />
          {selectedIds.size > 0 && (
            <button
              className={`${styles.onlySelBtn} ${showOnlySelected ? styles.active : ''}`}
              onClick={() => setShowOnlySelected(!showOnlySelected)}
            >
              Только выбранные
            </button>
          )}
        </div>
      </header>

      {/* ── Selection Bar ──────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className={styles.selectionBar}>
          <input
            type="checkbox"
            checked={true}
            onChange={clearSelection}
            className={styles.selectionCheckbox}
          />
          <span>{selectedIds.size} выбрано</span>
          <button className={styles.selectionClear} onClick={clearSelection} title="Очистить выбор">
            ✕
          </button>
        </div>
      )}

      {/* ── Shared horizontal scroll wrapper ──────────────────────────── */}
      <div className={styles.tableScrollWrap}>
        {/* ── Table Header ────────────────────────────────────────────────── */}
        <div className={styles.tableHeader}>
          <div className={styles.tableHeaderCol}>✓</div>
          <div className={styles.tableHeaderCol}>!</div>
          <div className={styles.tableHeaderCol}>№</div>
          <div className={styles.tableHeaderCol}>Товар</div>
          <div className={styles.tableHeaderCol}>Пол</div>
          <div className={styles.tableHeaderCol}>Длина</div>
          <div className={styles.tableHeaderCol}>Цвет</div>
          <div className={styles.tableHeaderCol}>Кол.во</div>
          <div className={styles.tableHeaderCol}>Разм.</div>
          <div className={styles.tableHeaderCol}>Принят</div>
          <div className={styles.tableHeaderCol}>Срок</div>
          <div className={styles.tableHeaderCol}>Действие</div>
        </div>

        {/* ── Card List ──────────────────────────────────────────────────── */}
        <div className={styles.cardList}>
        {isLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyText}>Загрузка...</div>
          </div>
        )}
        {!isLoading && visibleTasks.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <div className={styles.emptyText}>Нет заданий</div>
            <div className={styles.emptySubtext}>Все позиции выполнены или отфильтрованы</div>
          </div>
        )}
        {visibleTasks.map((task) => (
          <WorkshopTaskCard
            key={task.id}
            task={task}
            isSelected={selectedIds.has(task.id)}
            onToggleSelect={toggleSelect}
            onMarkDone={handleMarkDone}
            isPending={pendingDoneIds.has(task.id)}
            {...(canManageProduction
              ? {
                  onFlag: handleFlagTask,
                  onReturnToQueue: handleReturnToQueue,
                }
              : {})}
          />
        ))}
        </div>
      </div>
    </div>
  );
}
