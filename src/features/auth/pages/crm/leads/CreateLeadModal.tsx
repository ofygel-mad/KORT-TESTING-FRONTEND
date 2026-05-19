import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useCreateLead } from '@/entities/lead/queries';
import type { LeadPipeline } from '@/entities/lead/types';
import { PhoneInput } from '../../../shared/ui/PhoneInput';
import styles from './CreateLeadModal.module.css';

const schema = z.object({
  fullName: z.string().min(2, 'Введите имя'),
  phone: z.string().min(1, 'Телефон обязателен'),
  source: z.string().min(1, 'Укажите источник'),
});
type Form = z.infer<typeof schema>;

const SOURCES = ['Instagram', 'WhatsApp', 'Звонок', 'Сайт', 'Рекомендация', 'Другое'];

export function CreateLeadModal({ onClose, pipeline }: { onClose: () => void; pipeline: LeadPipeline }) {
  const createLead = useCreateLead();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    await createLead.mutateAsync({ ...data, pipeline });
    onClose();
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>Новый лид</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={styles.body} onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.field}>
            <label>Имя <span className={styles.req}>*</span></label>
            <input {...register('fullName')} className={`${styles.input} ${errors.fullName ? styles.err : ''}`} placeholder="Иванов Иван" autoFocus />
            {errors.fullName && <span className={styles.errMsg}>{errors.fullName.message}</span>}
          </div>
          <div className={styles.field}>
            <label>Телефон <span className={styles.req}>*</span></label>
            <PhoneInput {...register('phone')} className={`${styles.input} ${errors.phone ? styles.err : ''}`} />
            {errors.phone && <span className={styles.errMsg}>{errors.phone.message}</span>}
          </div>
          <div className={styles.field}>
            <label>Источник <span className={styles.req}>*</span></label>
            <select {...register('source')} className={`${styles.input} ${errors.source ? styles.err : ''}`}>
              <option value="">Выберите источник</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
            {errors.source && <span className={styles.errMsg}>{errors.source.message}</span>}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={createLead.isPending}>
              {createLead.isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
