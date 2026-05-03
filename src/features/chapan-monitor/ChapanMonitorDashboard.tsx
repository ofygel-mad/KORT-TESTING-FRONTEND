import type { ManagerActivity, StatusBucket } from './chapanMonitor.utils';
import { sectionLabel, nextStepLabel } from './chapanMonitor.utils';
import type { ChapanOrder } from '@/entities/order/types';
import styles from './ChapanMonitorDrawer.module.css';

const BUCKET_LABELS: Record<StatusBucket, string> = {
  in_production: 'В цехе',
  ready:         'Готово',
  on_warehouse:  'На складе',
  shipped:       'Отправлено',
};

interface Props {
  managerGroups: ManagerActivity[];
  statusCounts: Record<StatusBucket, number>;
  isLoading: boolean;
}

function OrderMiniCard({ order }: { order: ChapanOrder }) {
  const items = order.items?.length ?? 0;
  const total = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(order.totalAmount);
  return (
    <div className={styles.miniCard}>
      <span className={styles.miniCardNum}>#{order.orderNumber}</span>
      <span className={styles.miniCardItems}>{items} изд.</span>
      <span className={styles.miniCardAmount}>{total} ₸</span>
      <span className={styles.miniCardSection}>{sectionLabel(order)}</span>
      <span className={styles.miniCardNext}>{nextStepLabel(order)}</span>
    </div>
  );
}

export default function ChapanMonitorDashboard({ managerGroups, statusCounts, isLoading }: Props) {
  if (isLoading) return <div className={styles.loadingText}>Загрузка...</div>;

  const totalActive = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  return (
    <div className={styles.dashPanel}>
      <div className={styles.statusRow}>
        {(Object.entries(BUCKET_LABELS) as [StatusBucket, string][]).map(([key, label]) => (
          <div key={key} className={styles.statusChip}>
            <span className={styles.statusChipCount}>{statusCounts[key]}</span>
            <span className={styles.statusChipLabel}>{label}</span>
          </div>
        ))}
      </div>

      {totalActive === 0 && (
        <div className={styles.emptyNote}>Нет активных заказов прямо сейчас</div>
      )}

      {managerGroups.map((mg) => (
        <div key={mg.managerId} className={styles.managerBlock}>
          <div className={styles.managerHeader}>
            <span className={styles.managerName}>{mg.managerName}</span>
            <span className={styles.managerCount}>{mg.orders.length} заказов</span>
          </div>
          {mg.orders.map((order) => (
            <OrderMiniCard key={order.id} order={order} />
          ))}
        </div>
      ))}
    </div>
  );
}
