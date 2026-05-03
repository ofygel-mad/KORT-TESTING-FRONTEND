import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, FileX, Package, Truck, DollarSign, ChevronRight } from 'lucide-react';
import type { Anomaly, AnomalyKind } from './chapanMonitor.utils';
import styles from './ChapanMonitorDrawer.module.css';

const KIND_ICON: Record<AnomalyKind, React.ElementType> = {
  overdue:             AlertTriangle,
  unpaid_in_production: DollarSign,
  invoice_rejected:    FileX,
  invoice_stale:       Clock,
  stuck_warehouse:     Package,
  stuck_production:    Clock,
  partial_shipped:     Truck,
};

const KIND_COLOR: Record<AnomalyKind, string> = {
  overdue:              '#D94F4F',
  unpaid_in_production: '#E5922A',
  invoice_rejected:     '#D94F4F',
  invoice_stale:        '#E5922A',
  stuck_warehouse:      '#8B5CF6',
  stuck_production:     '#8B5CF6',
  partial_shipped:      '#E5922A',
};

interface Props {
  anomalies: Anomaly[];
  isLoading: boolean;
  onClose: () => void;
}

export default function ChapanMonitorAlerts({ anomalies, isLoading, onClose }: Props) {
  const navigate = useNavigate();

  if (isLoading) return <div className={styles.loadingText}>Загрузка...</div>;

  if (anomalies.length === 0) {
    return (
      <div className={styles.alertsEmpty}>
        <span className={styles.alertsEmptyIcon}>✓</span>
        <span>Всё в порядке — аномалий не обнаружено</span>
      </div>
    );
  }

  function handleClick(anomaly: Anomaly) {
    navigate(anomaly.route);
    onClose();
  }

  return (
    <div className={styles.alertsList}>
      {anomalies.map((a, i) => {
        const Icon = KIND_ICON[a.kind];
        const color = KIND_COLOR[a.kind];
        return (
          <button
            key={i}
            type="button"
            className={styles.alertRow}
            onClick={() => handleClick(a)}
          >
            <span className={styles.alertIcon} style={{ color }}>
              <Icon size={15} />
            </span>
            <span className={styles.alertText}>
              <span className={styles.alertMessage}>{a.message}</span>
              <span className={styles.alertHint}>{a.hint}</span>
            </span>
            <ChevronRight size={14} className={styles.alertArrow} />
          </button>
        );
      })}
    </div>
  );
}
