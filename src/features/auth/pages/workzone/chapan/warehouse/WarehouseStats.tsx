import React from 'react';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import type { WarehouseSummary } from '@/entities/warehouse/types';
import styles from './WarehouseStats.module.css';

interface WarehouseStatsProps {
  summary: WarehouseSummary;
}

export const WarehouseStats: React.FC<WarehouseStatsProps> = ({ summary }) => {
  const stats = [
    { label: 'Всего позиций', value: summary.totalItems ?? 0, isLoading: false },
    { label: 'Открытые алерты', value: summary.openAlerts ?? 0, isLoading: false },
    { label: 'Мало остатков', value: summary.lowStockCount ?? 0, isLoading: false },
    { label: 'Движений сегодня', value: summary.totalMovementsToday ?? 0, isLoading: false },
  ];

  return (
    <div className={styles.statsBar}>
      {stats.map((stat, idx) => (
        <div key={idx} className={styles.statTile}>
          {stat.isLoading ? (
            <>
              <Skeleton width="60%" height={24} />
              <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <div className={styles.statValue}>{stat.value.toLocaleString('ru-KZ')}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
