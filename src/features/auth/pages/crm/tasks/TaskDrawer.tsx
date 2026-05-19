import { useTask, useUpdateTaskStatus, useUpdateTask } from '@/entities/task/queries';
import type { TaskStatus, TaskPriority } from '@/entities/task/types';
import { Drawer } from '../../../shared/ui/Drawer';
import styles from './TaskDrawer.module.css';

const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: 'backlog', label: 'Бэклог' }, { key: 'in_progress', label: 'В работе' },
  { key: 'review', label: 'Проверка' }, { key: 'done', label: 'Готово' },
];

const PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: 'low', label: 'Низкий' }, { key: 'medium', label: 'Средний' },
  { key: 'high', label: 'Высокий' }, { key: 'critical', label: 'Критичный' },
];

export function TaskDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: task, isLoading } = useTask(id);
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={task?.title ?? 'Задача'}
      size="md"
    >
      {isLoading && <div className={styles.loading}>Загрузка...</div>}
      {task && (
        <div className={styles.body}>
          <div>
            <div className={styles.sectionTitle}>Статус</div>
            <div className={styles.pillRow}>
              {STATUSES.map(s => (
                <button key={s.key} className={`${styles.pill} ${task.status === s.key ? styles.pillActive : ''}`}
                  onClick={() => updateStatus.mutate({ id, status: s.key })}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className={styles.sectionTitle}>Приоритет</div>
            <div className={styles.pillRow}>
              {PRIORITIES.map(p => (
                <button key={p.key} className={`${styles.pill} ${task.priority === p.key ? styles.pillActive : ''}`}
                  onClick={() => updateTask.mutate({ id, dto: { priority: p.key } })}>{p.label}</button>
              ))}
            </div>
          </div>
          {task.description && <p className={styles.desc}>{task.description}</p>}
          <div className={styles.metaList}>
            {task.assignedName && <div className={styles.metaRow}><span>Ответственный:</span><strong>{task.assignedName}</strong></div>}
            {task.dueDate && <div className={styles.metaRow}><span>Дедлайн:</span><strong>{new Date(task.dueDate).toLocaleDateString('ru-KZ')}</strong></div>}
            {task.dealId && <div className={styles.metaRow}><span>Сделка:</span><strong>{task.dealId}</strong></div>}
          </div>
          {(task.subtasks ?? []).length > 0 && (
            <div>
              <div className={styles.sectionTitle}>Подзадачи</div>
              {(task.subtasks ?? []).map(st => (
                <div key={st.id} className={`${styles.subtask} ${st.done ? styles.subtaskDone : ''}`}>
                  <span>{st.done ? '✓' : '○'}</span><span>{st.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
