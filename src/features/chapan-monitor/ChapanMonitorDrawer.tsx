import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useChapanMonitor } from './useChapanMonitor';
import ChapanMonitorDashboard from './ChapanMonitorDashboard';
import ChapanMonitorAlerts from './ChapanMonitorAlerts';
import ChapanMonitorGuide from './ChapanMonitorGuide';
import styles from './ChapanMonitorDrawer.module.css';

type Tab = 'dashboard' | 'alerts' | 'guide';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Панель' },
  { key: 'alerts',    label: 'Аномалии' },
  { key: 'guide',     label: 'Справка' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

export default function ChapanMonitorDrawer({ open, onClose, initialTab = 'dashboard' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { orders, isLoading, anomalies, managerGroups, statusCounts } = useChapanMonitor();
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} ref={backdropRef} onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}>
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Монитор Чапан</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.tabBar}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`${styles.tabBtn} ${tab === key ? styles.tabBtnActive : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
              {key === 'alerts' && anomalies.length > 0 && (
                <span className={styles.tabBadge}>{anomalies.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.drawerBody}>
          {tab === 'dashboard' && (
            <ChapanMonitorDashboard
              managerGroups={managerGroups}
              statusCounts={statusCounts}
              isLoading={isLoading}
            />
          )}
          {tab === 'alerts' && (
            <ChapanMonitorAlerts
              anomalies={anomalies}
              isLoading={isLoading}
              onClose={onClose}
            />
          )}
          {tab === 'guide' && (
            <ChapanMonitorGuide onClose={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
