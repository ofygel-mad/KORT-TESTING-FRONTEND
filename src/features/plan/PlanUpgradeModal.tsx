import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Factory, Users, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../shared/api/client';
import { useAuthStore } from '../../shared/stores/auth';
import { usePlan, PLAN_LABELS, type OrgMode } from '../../shared/hooks/usePlan';
import styles from './PlanUpgradeModal.module.css';

interface ModeCard {
  mode: OrgMode;
  title: string;
  subtitle: string;
  for: string;
  features: string[];
  modules: { label: string; color: string }[];
  icon: ReactNode;
  color: string;
  badge?: string;
  callout?: string;
}

const MODES: ModeCard[] = [
  {
    mode: 'basic',
    title: 'Базовый',
    subtitle: 'Для малого бизнеса',
    for: 'Команды до 20 человек, которые только начинают работать с CRM',
    features: ['Единая база клиентов и лидов', 'Управление складом', 'Настройка команды'],
    modules: [
      { label: 'Лиды', color: '#5C8DFF' },
      { label: 'Клиенты', color: '#5C8DFF' },
      { label: 'Склад', color: '#C9A84C' },
    ],
    icon: <Users size={20} />,
    color: '#5C8DFF',
  },
  {
    mode: 'advanced',
    title: 'Продвинутый',
    subtitle: 'Для растущей команды',
    for: 'Бизнес с активными продажами, аналитикой и разделением ролей',
    features: ['Воронки продаж и этапы сделок', 'Задачи и контроль исполнения', 'Финансы и аналитика', 'Управление сотрудниками'],
    modules: [
      { label: 'Лиды', color: '#5C8DFF' },
      { label: 'Сделки', color: '#D97706' },
      { label: 'Клиенты', color: '#5C8DFF' },
      { label: 'Задачи', color: '#2E9D84' },
      { label: 'Склад', color: '#C9A84C' },
      { label: 'Финансы', color: '#2E9D84' },
    ],
    icon: <Zap size={20} />,
    color: '#D97706',
    badge: 'Рекомендуем',
  },
  {
    mode: 'industrial',
    title: 'Промышленный',
    subtitle: 'Для сложных процессов',
    for: 'Производства и предприятия с уникальными операционными цепочками',
    features: ['Всё из «Продвинутого»', 'Кастомные рабочие зоны', 'Индивидуальные интеграции', 'API и расширенный аудит'],
    modules: [
      { label: 'Все модули', color: '#7C3AED' },
      { label: 'Кабинеты', color: '#7C3AED' },
    ],
    icon: <Factory size={20} />,
    color: '#7C3AED',
    callout: 'Индивидуальная интеграция',
  },
];

export function PlanUpgradeModal({ onClose }: { onClose: () => void }) {
  const plan = usePlan();
  const setOrg = useAuthStore((s) => s.setOrg);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSelect(mode: OrgMode) {
    if (mode === plan || loading) return;
    setLoading(true);
    try {
      await api.patch('/organization/', { mode });
      setOrg({ mode });
      toast.success(`Переход на план «${PLAN_LABELS[mode]}» выполнен`);
      onClose();
    } catch {
      toast.error('Не удалось сменить план, попробуйте позже');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <div>
              <div className={styles.headerTitle}>Выберите план</div>
              <div className={styles.headerSub}>Текущий план — <strong>{PLAN_LABELS[plan]}</strong></div>
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
              <X size={16} />
            </button>
          </div>

          <div className={styles.planGrid}>
            {MODES.map((mode) => {
              const isCurrent = plan === mode.mode;
              return (
                <div
                  key={mode.mode}
                  className={[styles.planCard, isCurrent ? styles.planCardCurrent : ''].join(' ')}
                  style={{ '--plan-color': mode.color } as CSSProperties}
                >
                  {mode.badge && <span className={styles.planBadgeTop}>{mode.badge}</span>}

                  <div className={styles.planCardIcon}>{mode.icon}</div>
                  <div className={styles.planCardTitle}>{mode.title}</div>
                  <div className={styles.planCardSubtitle}>{mode.subtitle}</div>
                  <div className={styles.planCardFor}>{mode.for}</div>

                  <ul className={styles.planFeatureList}>
                    {mode.features.map((f) => (
                      <li key={f} className={styles.planFeatureItem}>
                        <span className={styles.planFeatureDot} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {mode.callout && <div className={styles.planCallout}>{mode.callout}</div>}

                  <div className={styles.planModules}>
                    {mode.modules.map((mod) => (
                      <span
                        key={mod.label}
                        className={styles.planModuleTag}
                        style={{ '--mod-color': mod.color } as CSSProperties}
                      >
                        {mod.label}
                      </span>
                    ))}
                  </div>

                  <div className={styles.planActions}>
                    {isCurrent ? (
                      <div className={styles.currentLabel}>
                        <CheckCircle2 size={13} />
                        Текущий план
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.selectBtn}
                        onClick={() => handleSelect(mode.mode)}
                        disabled={loading}
                      >
                        {loading ? '...' : 'Перейти'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
