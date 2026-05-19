import { Wrench } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import styles from './Finance.module.css';

export default function FinancePage() {
  return (
    <div className={styles.root}>
      <EmptyState
        icon={<Wrench size={32} />}
        title="Раздел в разработке"
        description="Мы готовим новую версию финансового учёта. Возвращайтесь позже."
      />
    </div>
  );
}
