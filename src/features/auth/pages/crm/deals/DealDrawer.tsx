import { useState } from 'react';
import { useDeal, useUpdateDeal, useDealActivities, useAddDealActivity } from '@/entities/deal/queries';
import type { DealStage } from '@/entities/deal/types';
import { Drawer } from '../../../shared/ui/Drawer';
import styles from './DealDrawer.module.css';

const STAGES: { key: DealStage; label: string }[] = [
  { key: 'new', label: 'Новая' }, { key: 'qualified', label: 'Квалификация' },
  { key: 'proposal', label: 'КП' }, { key: 'negotiation', label: 'Переговоры' },
  { key: 'won', label: 'Выиграна' }, { key: 'lost', label: 'Проиграна' },
];

export function DealDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: deal, isLoading } = useDeal(id);
  const { data: activitiesData } = useDealActivities(id);
  const updateDeal = useUpdateDeal();
  const addActivity = useAddDealActivity();
  const [comment, setComment] = useState('');

  const activities = activitiesData?.results ?? [];

  async function handleComment() {
    if (!comment.trim()) return;
    await addActivity.mutateAsync({ id, dto: { type: 'comment', content: comment.trim() } });
    setComment('');
  }

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={deal?.title ?? 'Сделка'}
      subtitle={deal?.companyName ?? deal?.fullName ?? undefined}
      size="md"
    >
      {isLoading && <div className={styles.loading}>Загрузка...</div>}
      {deal && (
        <div className={styles.body}>
          <div className={styles.stageRow}>
            {STAGES.map(s => (
              <button key={s.key} className={`${styles.stageBtn} ${deal.stage === s.key ? styles.stageBtnActive : ''}`}
                onClick={() => updateDeal.mutate({ id, dto: { stage: s.key } })}
              >{s.label}</button>
            ))}
          </div>
          <div className={styles.metaGrid}>
            {deal.amount != null && <div className={styles.metaItem}><span>Сумма</span><strong>{new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(deal.amount)} ₸</strong></div>}
            {deal.fullName && <div className={styles.metaItem}><span>Контакт</span><strong>{deal.fullName}</strong></div>}
            {deal.companyName && <div className={styles.metaItem}><span>Компания</span><strong>{deal.companyName}</strong></div>}
            {deal.phone && <div className={styles.metaItem}><span>Телефон</span><a href={`tel:${deal.phone}`} className={styles.phone}>{deal.phone}</a></div>}
            {deal.assignedName && <div className={styles.metaItem}><span>Ответственный</span><strong>{deal.assignedName}</strong></div>}
          </div>
          <div className={styles.activities}>
            {activities.map(a => (
              <div key={a.id} className={styles.actItem}>
                <div className={styles.actMeta}><span>{a.authorName}</span><span>{new Date(a.createdAt).toLocaleDateString('ru-KZ')}</span></div>
                {a.content && <div className={styles.actContent}>{a.content}</div>}
              </div>
            ))}
            {activities.length === 0 && <div className={styles.noActivities}>Нет активностей</div>}
          </div>
          <div className={styles.commentBox}>
            <input className={styles.commentInput} value={comment} onChange={e => setComment(e.target.value)} placeholder="Добавить комментарий..." onKeyDown={e => e.key === 'Enter' && handleComment()} />
            <button className={styles.commentBtn} onClick={handleComment} disabled={!comment.trim() || addActivity.isPending}>→</button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
