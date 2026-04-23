import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckSquare,
  Clock,
  Phone,
  Plus,
  RotateCcw,
  Square,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { useTasksStore } from '../../../../tasks-spa/model/tasks.store';
import { useTileTasksUI } from '../../../../tasks-spa/model/tile-ui.store';
import { PRIORITY_META_MAP, TASK_TYPE_LABEL, type PriorityTone } from './tasksMeta';
import { useSharedBus } from '../../../../shared-bus';
import type { TaskPriority, TaskType } from '../../../../tasks-spa/api/types';
import s from './TasksSPA.module.css';

let tickCount = 0;
let tickListeners: Set<() => void> = new Set();
let tickInterval: ReturnType<typeof setInterval> | null = null;

const TASK_TYPE_ICON: Record<TaskType, ({ size }: { size?: number }) => ReactNode> = {
  call: Phone,
  callback: RotateCcw,
  manual: CheckSquare,
};

const PRIORITY_CLASS: Record<PriorityTone, string> = {
  muted: s.toneMuted,
  info: s.toneInfo,
  warning: s.toneWarning,
  danger: s.toneDanger,
};

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

function subscribeToTick(callback: () => void) {
  tickListeners.add(callback);
  if (!tickInterval) {
    tickInterval = setInterval(() => {
      tickCount += 1;
      tickListeners.forEach((listener) => listener());
    }, 1000);
  }

  return () => {
    tickListeners.delete(callback);
    if (tickListeners.size === 0 && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

function getTickSnapshot() {
  return tickCount;
}

function formatCountdown(deadline: string): { label: string; overdue: boolean } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { label: 'Просрочено', overdue: true };

  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);

  if (hours > 0) return { label: `${hours}ч ${minutes}м`, overdue: false };
  if (minutes > 0) return { label: `${minutes}м ${seconds}с`, overdue: false };
  return { label: `${seconds}с`, overdue: false };
}

function TimerBadge({ deadline, warning }: { deadline: string; warning: boolean }) {
  useSyncExternalStore(subscribeToTick, getTickSnapshot);
  const { label, overdue } = formatCountdown(deadline);

  return (
    <span className={`${s.timerBadge} ${overdue ? s.timerOverdue : ''} ${warning && overdue ? s.timerPulse : ''}`}>
      <Timer size={10} />
      {label}
    </span>
  );
}

function CreateModal({ onClose, preset }: { onClose: () => void; preset?: any }) {
  const createTask = useTasksStore((state) => state.createTask);
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('manual');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDeadline, setTimerDeadline] = useState('');
  const [timerWarning, setTimerWarning] = useState(false);
  const [assignee, setAssignee] = useState('');

  useEffect(() => {
    if (!preset) return;
    if (preset.title) setTitle(preset.title);
    if (preset.priority) setPriority(preset.priority);
    if (preset.assignedName) setAssignee(preset.assignedName);
    if (preset.dueAt) setDueAt(new Date(preset.dueAt).toISOString().slice(0, 16));
  }, [preset]);

  async function handleSubmit() {
    if (!title.trim()) return;

    await createTask({
      title: title.trim(),
      taskType,
      priority,
      status: 'todo',
      tags: [],
      createdBy: 'Менеджер',
      note: note.trim() || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      assignedName: assignee || undefined,
      timerEnabled,
      timerDeadline: timerEnabled && timerDeadline ? new Date(timerDeadline).toISOString() : undefined,
      timerWarning,
      subtasks: [],
    });

    onClose();
  }

  return (
    <div className={s.modalOverlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.modalHeader}>
          <div>
            <div className={s.modalTitle}>Новая задача</div>
            <div className={s.modalSubtitle}>Соберите задачу, срок и таймер в одном сценарии.</div>
          </div>
          <button className={s.modalClose} onClick={onClose} aria-label="Закрыть">
            <X size={15} />
          </button>
        </div>

        <div className={s.typeRow}>
          {(['call', 'callback', 'manual'] as TaskType[]).map((type) => {
            const Icon = TASK_TYPE_ICON[type];
            return (
              <button
                key={type}
                className={`${s.typeBtn} ${taskType === type ? s.typeBtnActive : ''}`}
                onClick={() => setTaskType(type)}
              >
                <span className={s.typeIconWrap}>
                  <Icon size={14} />
                </span>
                <span>{TASK_TYPE_LABEL[type]}</span>
              </button>
            );
          })}
        </div>

        <div className={s.formGroup}>
          <label className={s.formLabel}>Название</label>
          <input
            className={s.formInput}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              taskType === 'call'
                ? 'Кому позвонить?'
                : taskType === 'callback'
                  ? 'Кому перезвонить?'
                  : 'Что нужно сделать?'
            }
            autoFocus
            onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div className={s.formRow}>
          <div className={s.formGroup}>
            <label className={s.formLabel}>Исполнитель</label>
            <input
              className={s.formInput}
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="Имя сотрудника"
            />
          </div>
          <div className={s.formGroup}>
            <label className={s.formLabel}>Срок
              <input
                type="datetime-local"
                className={s.formInput}
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className={s.formGroup}>
          <label className={s.formLabel}>Приоритет
            <select
              className={s.formSelect}
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PRIORITY_META_MAP[option].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {taskType === 'manual' && (
          <div className={s.formGroup}>
            <label className={s.formLabel}>Комментарий</label>
            <textarea
              className={s.formTextarea}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Заметка, контекст или следующий шаг"
              rows={4}
            />
          </div>
        )}

        <div className={s.timerSection}>
          <button
            className={`${s.timerToggle} ${timerEnabled ? s.timerToggleOn : ''}`}
            onClick={() => setTimerEnabled((value) => !value)}
          >
            {timerEnabled ? <Bell size={13} /> : <BellOff size={13} />}
            {timerEnabled ? 'Таймер включён' : 'Включить таймер'}
          </button>

          {timerEnabled && (
            <div className={s.timerOptions}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Дедлайн таймера
                  <input
                    type="datetime-local"
                    className={s.formInput}
                    value={timerDeadline}
                    onChange={(event) => setTimerDeadline(event.target.value)}
                  />
                </label>
              </div>

              <button
                className={`${s.warningToggle} ${timerWarning ? s.warningToggleOn : ''}`}
                onClick={() => setTimerWarning((value) => !value)}
              >
                <AlertTriangle size={12} />
                {timerWarning ? 'Критичное предупреждение' : 'Обычное уведомление'}
              </button>

              <p className={s.timerHint}>
                {timerWarning
                  ? 'После дедлайна карточка перейдёт в критичное состояние и продолжит напоминать.'
                  : 'После дедлайна придёт одно спокойное уведомление без повторов.'}
              </p>
            </div>
          )}
        </div>

        <div className={s.modalFooter}>
          <button className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={s.submitBtn} onClick={handleSubmit} disabled={!title.trim()}>
            Создать задачу
          </button>
        </div>
      </div>
    </div>
  );
}

type Filter = 'all' | 'todo' | 'in_progress' | 'done';

export function TasksSPA({ tileId }: { tileId: string }) {
  const { tasks, loading, load, moveStatus, deleteTask } = useTasksStore();
  const { filter, setFilter, createModalOpen, openCreateModal, closeCreateModal, createPreset } = useTileTasksUI(tileId);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      const requests = useSharedBus.getState().consumeTaskRequests();
      for (const request of requests) {
        openCreateModal({
          linkedEntity: request.linkedEntityId
            ? {
                type: request.linkedEntityType ?? 'standalone',
                id: request.linkedEntityId,
                title: request.linkedEntityTitle ?? '',
              }
            : undefined,
          title: request.suggestedTitle ?? '',
          assignedName: request.suggestedAssignee,
          dueAt: request.suggestedDueAt,
          priority: request.priority ?? 'medium',
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [openCreateModal]);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    const interval = setInterval(() => {
      for (const task of tasksRef.current) {
        if (
          task.timerEnabled &&
          task.timerDeadline &&
          !task.timerFired &&
          task.status !== 'done' &&
          new Date(task.timerDeadline).getTime() <= Date.now() &&
          !notifiedRef.current.has(task.id)
        ) {
          notifiedRef.current.add(task.id);

          const fire = () => {
            new Notification(task.timerWarning ? `Критично: ${task.title}` : `Таймер: ${task.title}`, {
              body: task.timerWarning
                ? 'Задача не выполнена и требует срочного внимания.'
                : 'Время на задачу истекло.',
            });
          };

          if (Notification.permission === 'granted') {
            fire();
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((permission) => {
              if (permission === 'granted') fire();
            });
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const filtered = tasks.filter((task) => {
    if (filter === 'all') return task.status !== 'done';
    if (filter === 'done') return task.status === 'done';
    if (filter === 'todo') return task.status === 'todo';
    if (filter === 'in_progress') return task.status === 'in_progress' || task.status === 'review';
    return true;
  });

  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const overdueCount = tasks.filter(
    (task) => task.status !== 'done' && task.dueAt && new Date(task.dueAt).getTime() < Date.now(),
  ).length;

  const filterLabels: Record<Filter, string> = {
    all: 'Все активные',
    todo: 'К выполнению',
    in_progress: 'В работе',
    done: 'Выполнено',
  };

  if (loading) {
    return (
      <div className={s.root}>
        <div className={`${s.emptyState} ${s.loadingState}`}>
          <div className={s.emptyTitle}>Загружаем задачи</div>
          <div className={s.emptyText}>Собираем текущие карточки и таймеры.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <div className={s.headingBlock}>
          <span className={s.eyebrow}>Task Flow</span>
          <div className={s.headingRow}>
            <span className={s.heading}>Задачи</span>
            {overdueCount > 0 && <span className={s.overdueChip}>{overdueCount} просрочено</span>}
          </div>
        </div>

        <button className={s.addBtn} onClick={() => openCreateModal()}>
          <Plus size={14} />
          <span>Создать</span>
        </button>
      </div>

      <div className={s.filters}>
        {(['all', 'todo', 'in_progress', 'done'] as Filter[]).map((value) => (
          <button
            key={value}
            className={`${s.filterChip} ${filter === value ? s.filterChipActive : ''}`}
            onClick={() => setFilter(value)}
          >
            {filterLabels[value]}
          </button>
        ))}
        <span className={s.filterCount}>{filtered.length}</span>
      </div>

      <div className={s.list}>
        {filtered.length === 0 ? (
          <div className={s.emptyState}>
            <div className={s.emptyTitle}>{filter === 'done' ? 'Нет выполненных задач' : 'Очередь свободна'}</div>
            <div className={s.emptyText}>
              {filter === 'done'
                ? 'Как только задачи будут закрыты, они появятся в этом разделе.'
                : 'Создайте первую задачу, чтобы раздать следующий шаг команде.'}
            </div>
          </div>
        ) : (
          filtered.map((task) => {
            const isDone = task.status === 'done';
            const isOverdue = !isDone && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();
            const priorityMeta = PRIORITY_META_MAP[task.priority] ?? PRIORITY_META_MAP.medium;
            const TaskTypeIcon = TASK_TYPE_ICON[task.taskType ?? 'manual'];

            return (
              <div key={task.id} className={`${s.item} ${isDone ? s.itemDone : ''} ${isOverdue ? s.itemOverdue : ''}`}>
                <button
                  className={s.check}
                  onClick={() => moveStatus(task.id, isDone ? 'todo' : 'done')}
                  title={isDone ? 'Вернуть в работу' : 'Отметить выполненной'}
                >
                  {isDone ? (
                    <CheckSquare size={18} className={s.checkIconActive} />
                  ) : (
                    <Square size={18} className={s.checkIconInactive} />
                  )}
                </button>

                <div className={s.itemBody}>
                  <div className={s.itemTitleRow}>
                    <span className={s.taskTypeBadge} title={TASK_TYPE_LABEL[task.taskType ?? 'manual']}>
                      <TaskTypeIcon size={12} />
                    </span>
                    <span className={s.itemTitle}>{task.title}</span>
                  </div>

                  {task.note && <span className={s.itemNote}>{task.note}</span>}

                  <div className={s.itemMeta}>
                    {task.assignedName && <span className={s.metaTag}>{task.assignedName}</span>}
                    {task.dueAt && (
                      <span className={`${s.metaTime} ${isOverdue ? s.metaTimeOverdue : ''}`}>
                        <Clock size={10} />
                        {new Date(task.dueAt).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {task.timerEnabled && task.timerDeadline && !isDone && (
                      <TimerBadge deadline={task.timerDeadline} warning={task.timerWarning} />
                    )}
                  </div>
                </div>

                <div className={s.itemRight}>
                  <span className={`${s.priorityBadge} ${PRIORITY_CLASS[priorityMeta.tone]}`}>{priorityMeta.label}</span>
                  <button className={s.deleteBtn} onClick={() => deleteTask(task.id)} title="Удалить задачу">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={s.footer}>
        <span className={s.footerLabel}>
          Выполнено {doneCount} из {tasks.length}
        </span>
        <div className={s.progress}>
          <div className={s.progressFill} style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }} />
        </div>
      </div>

      {createModalOpen && <CreateModal onClose={closeCreateModal} preset={createPreset} />}
    </div>
  );
}
