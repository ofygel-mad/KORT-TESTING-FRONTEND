import { useState } from 'react';
import { Phone, Mail, Tag, User, MessageSquare, ArrowRight } from 'lucide-react';
import { useLead, useUpdateLead, useAddLeadHistory } from '@/entities/lead/queries';
import { useCreateDeal } from '@/entities/deal/queries';
import type { LeadStage } from '@/entities/lead/types';
import { toast } from 'sonner';
import { Drawer } from '../../../shared/ui/Drawer';
import styles from './LeadDrawer.module.css';

const STAGES: { key: LeadStage; label: string }[] = [
  { key: 'new', label: 'Новый' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'won', label: 'Выиграно' },
  { key: 'lost', label: 'Отказ' },
];

export function LeadDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: lead, isLoading } = useLead(id);
  const updateLead = useUpdateLead();
  const addHistory = useAddLeadHistory();
  const createDeal = useCreateDeal();
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  async function handleComment() {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await addHistory.mutateAsync({ id, type: 'comment', content: comment.trim() });
      setComment('');
    } finally { setSaving(false); }
  }

  async function handleConvertToDeal() {
    if (!lead) return;
    setConverting(true);
    try {
      await createDeal.mutateAsync({
        title: lead.fullName,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email ?? undefined,
        source: lead.source,
        assignedTo: lead.assignedTo ?? undefined,
        assignedName: lead.assignedName ?? undefined,
        leadId: lead.id,
      });
      await updateLead.mutateAsync({ id, dto: { stage: 'won' } });
      toast.success('Лид конвертирован в сделку');
      onClose();
    } catch {
      toast.error('Не удалось конвертировать');
    } finally { setConverting(false); }
  }

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={lead?.fullName ?? 'Лид'}
      subtitle={lead?.phone ?? lead?.source ?? undefined}
      size="md"
    >
      {isLoading && <div className={styles.loading}>Загрузка...</div>}
      {lead && (
        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.stageRow}>
              {STAGES.map(s => (
                <button key={s.key}
                  className={`${styles.stageBtn} ${lead.stage === s.key ? styles.stageBtnActive : ''}`}
                  onClick={() => updateLead.mutate({ id, dto: { stage: s.key } })}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {lead.stage !== 'won' && lead.stage !== 'lost' && (
            <div className={styles.section}>
              <button className={styles.convertBtn} onClick={handleConvertToDeal} disabled={converting}>
                <ArrowRight size={14} />
                {converting ? 'Создание сделки...' : 'Конвертировать в сделку'}
              </button>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Контакт</div>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}><Phone size={13} /><a href={`tel:${lead.phone}`} className={styles.infoLink}>{lead.phone}</a></div>
              {lead.email && <div className={styles.infoRow}><Mail size={13} /><span>{lead.email}</span></div>}
              {lead.source && <div className={styles.infoRow}><Tag size={13} /><span>{lead.source}</span></div>}
              {lead.assignedName && <div className={styles.infoRow}><User size={13} /><span>{lead.assignedName}</span></div>}
              {lead.budget && <div className={styles.infoRow}><span className={styles.budgetLabel}>Бюджет:</span><span className={styles.budgetValue}>{new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(lead.budget)} ₸</span></div>}
            </div>
          </div>
          {lead.comment && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Комментарий</div>
              <p className={styles.notes}>{lead.comment}</p>
            </div>
          )}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>История</div>
            <div className={styles.historyList}>
              {(lead.history ?? []).map(h => (
                <div key={h.id} className={styles.historyItem}>
                  <div className={styles.historyMeta}>
                    <span className={styles.historyAuthor}>{h.authorName}</span>
                    <span className={styles.historyDate}>{new Date(h.createdAt).toLocaleString('ru-KZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {h.content && <div className={styles.historyContent}>{h.content}</div>}
                </div>
              ))}
              {(lead.history ?? []).length === 0 && <div className={styles.historyEmpty}>Нет записей</div>}
            </div>
          </div>
          <div className={styles.commentBox}>
            <textarea className={styles.commentInput} placeholder="Добавить комментарий..." value={comment} onChange={e => setComment(e.target.value)} rows={2} />
            <button className={styles.commentBtn} onClick={handleComment} disabled={saving || !comment.trim()}>
              <MessageSquare size={13} /> Добавить
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
