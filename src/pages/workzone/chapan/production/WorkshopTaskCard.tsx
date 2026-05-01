import React from 'react';
import { Check, MessageSquare, AlertCircle, Star } from 'lucide-react';
import type { ProductionTask, ProductionStatus } from '@/entities/order/types';
import styles from './ChapanProduction.module.css';

interface WorkshopTaskCardProps {
  task: ProductionTask;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onMarkDone: (taskId: string, currentStatus: ProductionStatus) => void;
  isPending: boolean;
  onFlag?: (taskId: string, reason: string) => void;
  onReturnToQueue?: (taskId: string) => void;
}

const DATE_TOKEN_RE = /\d{4}-\d{2}-\d{2}/;
const DASH = '\u2014';
const SHORT_RU_DATE = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const TITLE_URGENT = '\u0421\u0440\u043e\u0447\u043d\u043e';
const TITLE_VIP = 'VIP \u043a\u043b\u0438\u0435\u043d\u0442';
const TITLE_DONE = '\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u043a\u0430\u043a \u0433\u043e\u0442\u043e\u0432\u043e';
const LABEL_DONE = '\u0413\u043e\u0442\u043e\u0432\u043e';

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
  if (!dateStr || typeof dateStr !== 'string') return DASH;
  const dateToken = dateStr.match(DATE_TOKEN_RE)?.[0];
  if (!dateToken) return DASH;

  try {
    const date = new Date(`${dateToken}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return DASH;
    return SHORT_RU_DATE.format(date).replace(',', '');
  } catch {
    return DASH;
  }
};

const hasNotes = (task: ProductionTask): boolean => Boolean(task.notes || task.workshopNotes);

const getOrderPositionLabel = (task: ProductionTask): string => {
  const rawOrderNumber = String(task.order.orderNumber ?? '');
  const normalizedOrderNumber = rawOrderNumber.replace(/^ORD-/i, '');
  const position = task.id.split('-').pop() || '1';
  return `${normalizedOrderNumber}-${position}`;
};

export default function WorkshopTaskCard({
  task,
  isSelected,
  onToggleSelect,
  onMarkDone,
  isPending,
}: WorkshopTaskCardProps) {
  const urgency = task.order.urgency ?? task.order.priority;
  const isUrgent = urgency === 'urgent';
  const isVIP = task.order.isDemandingClient && !isUrgent;
  const noteText = task.workshopNotes || task.notes;
  const showsNoteRow = hasNotes(task);

  return (
    <div
      className={`${styles.card} ${
        isSelected ? styles.cardSelected : ''
      } ${isUrgent ? styles.cardUrgent : ''} ${
        isVIP ? styles.cardVip : ''
      }`}
      style={{ borderLeftColor: getBorderColor(task) }}
    >
      <div className={styles.cell}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(task.id)}
          className={styles.checkbox}
          disabled={isPending}
        />
      </div>

      <div className={styles.cell}>
        {isUrgent && (
          <div className={styles.badge} title={TITLE_URGENT}>
            <AlertCircle size={14} className={styles.badgeIcon} />
          </div>
        )}
        {isVIP && !isUrgent && (
          <div className={styles.badgeVip} title={TITLE_VIP}>
            <Star size={14} className={styles.badgeIconVip} />
          </div>
        )}
      </div>

      <div className={styles.cell}>
        <span className={styles.orderNum}>{`\u2116${getOrderPositionLabel(task)}`}</span>
      </div>

      <div className={`${styles.cell} ${styles.productCell}`}>
        <div className={styles.productStack}>
          <span className={styles.productName}>{task.productName}</span>
        </div>
      </div>

      <div className={styles.cell}>
        <span className={styles.gender}>{task.gender || DASH}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.length}>{task.length || DASH}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.color}>{task.color || DASH}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.quantity}>{task.quantity}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.size}>{task.size}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.date}>{formatDate(task.startedAt)}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.date}>{formatDate(task.order.dueDate)}</span>
      </div>

      {showsNoteRow && (
        <>
          <div className={styles.notesStub} aria-hidden="true">
            <span className={styles.notesStubCell} />
            <span className={styles.notesStubCell} />
            <span className={styles.notesStubCell} />
          </div>
          <div className={styles.notesRow}>
            <div className={styles.notePanel}>
              <MessageSquare size={13} className={styles.noteIcon} />
              <span className={styles.noteInlineText}>{noteText}</span>
            </div>
          </div>
        </>
      )}

      <div className={`${styles.cellAction} ${showsNoteRow ? styles.cellActionWithNotes : ''}`}>
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.doneBtn}
            onClick={() => onMarkDone(task.id, task.status)}
            disabled={isPending}
            title={TITLE_DONE}
          >
            <Check size={12} />
            <span className={styles.doneBtnLabel}>{LABEL_DONE}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
