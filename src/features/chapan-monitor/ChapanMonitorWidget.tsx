import { useState } from 'react';
import { Activity } from 'lucide-react';
import { useChapanMonitor } from './useChapanMonitor';
import ChapanMonitorDrawer from './ChapanMonitorDrawer';
import styles from './ChapanMonitorWidget.module.css';

export default function ChapanMonitorWidget() {
  const [open, setOpen] = useState(false);
  const { anomalyCount } = useChapanMonitor();

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen(true)}
        title="Монитор Чапан"
      >
        <Activity size={20} />
        {anomalyCount > 0 && (
          <span className={styles.badge}>{anomalyCount > 99 ? '99+' : anomalyCount}</span>
        )}
      </button>

      <ChapanMonitorDrawer
        open={open}
        onClose={() => setOpen(false)}
        initialTab={anomalyCount > 0 ? 'alerts' : 'dashboard'}
      />
    </>
  );
}
