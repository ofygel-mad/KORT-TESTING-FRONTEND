import React from 'react';
import styles from './StatusChip.module.css';

export type ChipStatus = 'ok' | 'warn' | 'err' | 'info';

interface StatusChipProps {
  status: ChipStatus;
  label?: string;
  size?: 'sm' | 'md';
}

const DEFAULT_LABELS: Record<ChipStatus, string> = {
  ok: 'В наличии',
  warn: 'Мало',
  err: 'Нет',
  info: 'Резерв',
};

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const text = label || DEFAULT_LABELS[status];

  return (
    <span className={`${styles.chip} ${styles[`status-${status}`]} ${styles[`size-${size}`]}`}>
      {text}
    </span>
  );
};
