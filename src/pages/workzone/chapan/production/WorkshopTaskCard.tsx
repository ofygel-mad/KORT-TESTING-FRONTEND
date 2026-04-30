import React, { useState } from 'react';
import { Check, MessageSquare, MoreVertical, AlertCircle, Star } from 'lucide-react';
import type { ProductionTask, ProductionStatus } from '@/entities/order/types';
import styles from './ChapanProduction.module.css';

interface WorkshopTaskCardProps {
  task: ProductionTask;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onMarkDone: (taskId: string, currentStatus: ProductionStatus) => void;
  isPending: boolean;
  // Manager-only actions
  onAssign?: (taskId: string, worker: string) => void;
  onFlag?: (taskId: string, reason: string) => void;
  onReturnToQueue?: (taskId: string) => void;
  workers?: string[];
}

const getBorderColor = (task: ProductionTask): string => {
  const urgency = task.order.urgency ?? task.order.priority;
  if (urgency === 'urgent') {
    return 'rgba(239, 68, 68, 0.35)';
  }
  if (task.order.isDemandingClient) {
    return '#6E8EF0';
  }
  return 'var(--ch-border)';
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    const day = date.getUTCDate();
    const monthShort = date.toLocaleString('ru-RU', { month: 'short', timeZone: 'UTC' });
    return `${day} ${monthShort}.`;
  } catch {
    return dateStr.slice(0, 10);
  }
};

const hasNotes = (task: ProductionTask): boolean => !!(task.notes || task.workshopNotes);

export default function WorkshopTaskCard({
  task,
  isSelected,
  onToggleSelect,
  onMarkDone,
  isPending,
  onAssign,
  onFlag,
  onReturnToQueue,
  workers = [],
}: WorkshopTaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagOpen, setFlagOpen] = useState(false);

  const urgency = task.order.urgency ?? task.order.priority;
  const isUrgent = urgency === 'urgent';
  const isVIP = task.order.isDemandingClient && !isUrgent;
  const noteText = task.workshopNotes || task.notes;

  return (
    <div
      className={`${styles.card} ${
        isSelected ? styles.cardSelected : ''
      } ${isUrgent ? styles.cardUrgent : ''} ${
        isVIP ? styles.cardVip : ''
      }`}
      style={{ borderLeftColor: getBorderColor(task) }}
    >
      {/* Col 1: Checkbox */}
      <div className={styles.cell}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(task.id)}
          className={styles.checkbox}
          disabled={isPending}
        />
      </div>

      {/* Col 2: Badge (! or ★) */}
      <div className={styles.cell}>
        {isUrgent && (
          <div className={styles.badge} title="Срочно">
            <AlertCircle size={14} className={styles.badgeIcon} />
          </div>
        )}
        {isVIP && !isUrgent && (
          <div className={styles.badgeVip} title="VIP клиент">
            <Star size={14} className={styles.badgeIconVip} />
          </div>
        )}
      </div>

      {/* Col 3: Order number (e.g. №256-1) */}
      <div className={styles.cell}>
        <span className={styles.orderNum}>
          №{task.order.orderNumber}-{task.id.split('-').pop() || '1'}
        </span>
      </div>

      {/* Col 4: Product name */}
      <div className={styles.cell}>
        <span className={styles.productName}>{task.productName}</span>
      </div>

      {/* Col 5: Gender */}
      <div className={styles.cell}>
        <span className={styles.gender}>{task.gender || '—'}</span>
      </div>

      {/* Col 6: Length */}
      <div className={styles.cell}>
        <span className={styles.length}>{task.length || '—'}</span>
      </div>

      {/* Col 7: Color (omitted if notes present) */}
      {!hasNotes(task) && (
        <div className={styles.cell}>
          <span className={styles.color}>{task.color || '—'}</span>
        </div>
      )}

      {/* Col 8: Quantity */}
      <div className={styles.cell}>
        <span className={styles.quantity}>{task.quantity}</span>
      </div>

      {/* Col 9: Size */}
      <div className={styles.cell}>
        <span className={styles.size}>{task.size}</span>
      </div>

      {/* Col 10: Received date */}
      <div className={styles.cell}>
        <span className={styles.date}>{formatDate(task.startedAt)}</span>
      </div>

      {/* Col 11: Due date */}
      <div className={styles.cell}>
        <span className={styles.date}>{formatDate(task.order.dueDate)}</span>
      </div>

      {/* Col 12: Action button + manager menu */}
      <div className={styles.cellAction}>
        <div className={styles.actionGroup}>
          <button
            className={styles.doneBtn}
            onClick={() => onMarkDone(task.id, task.status)}
            disabled={isPending}
            title="Отметить как готово"
          >
            <Check size={12} />
            Готово
          </button>

          {/* Manager overflow menu */}
          {(onAssign || onFlag || onReturnToQueue) && (
            <div className={styles.managerMenu}>
              <button
                className={styles.moreBtn}
                onClick={() => setMenuOpen(!menuOpen)}
                disabled={isPending}
              >
                <MoreVertical size={14} />
              </button>

              {menuOpen && (
                <div className={styles.dropdownMenu}>
                  {onAssign && (
                    <div className={styles.menuItem}>
                      <button
                        className={styles.menuAction}
                        onClick={() => setAssignOpen(!assignOpen)}
                      >
                        Назначить швею
                      </button>
                      {assignOpen && (
                        <div className={styles.submenu}>
                          {workers.map((worker) => (
                            <button
                              key={worker}
                              className={styles.submenuItem}
                              onClick={() => {
                                onAssign(task.id, worker);
                                setAssignOpen(false);
                                setMenuOpen(false);
                              }}
                            >
                              {worker}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {onFlag && (
                    <div className={styles.menuItem}>
                      <button
                        className={styles.menuAction}
                        onClick={() => setFlagOpen(!flagOpen)}
                      >
                        Заблокировать
                      </button>
                      {flagOpen && (
                        <div className={styles.submenu}>
                          <textarea
                            className={styles.flagInput}
                            placeholder="Причина блокировки..."
                            value={flagReason}
                            onChange={(e) => setFlagReason(e.target.value)}
                            rows={2}
                          />
                          <button
                            className={styles.flagConfirm}
                            onClick={() => {
                              if (flagReason.trim()) {
                                onFlag(task.id, flagReason);
                                setFlagReason('');
                                setFlagOpen(false);
                                setMenuOpen(false);
                              }
                            }}
                          >
                            Заблокировать
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {onReturnToQueue && (
                    <button
                      className={styles.menuAction}
                      onClick={() => {
                        onReturnToQueue(task.id);
                        setMenuOpen(false);
                      }}
                    >
                      Вернуть в очередь
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notes row (second grid row, cols 4-8) */}
      {hasNotes(task) && (
        <div className={styles.notesRow}>
          <MessageSquare size={11} className={styles.noteIcon} />
          <span className={styles.noteText}>{noteText}</span>
        </div>
      )}
    </div>
  );
}
