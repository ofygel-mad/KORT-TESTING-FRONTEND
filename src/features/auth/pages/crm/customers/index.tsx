import { useState, useDeferredValue } from 'react';
import { Plus, Search, X, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { useCustomers, useCreateCustomer } from '@/entities/customer/queries';
import { api } from '../../../shared/api/client';
import { useQuery } from '@tanstack/react-query';
import { PhoneInput } from '../../../shared/ui/PhoneInput';
import { Skeleton } from '../../../shared/ui/Skeleton';
import styles from './Customers.module.css';

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Customer Profile Drawer ────────────────────────────────────────────────────

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: customer } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => api.get<any>(`/customers/${id}`),
    enabled: Boolean(id),
  });

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>{customer?.fullName ?? customer?.full_name ?? 'Клиент'}</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        {!customer && (
          <div className={styles.drawerBody}><Skeleton height={120} radius={8} /></div>
        )}
        {customer && (
          <div className={styles.drawerBody}>
            <div className={styles.profileSection}>
              <div className={styles.profileInitials}>
                {(customer.fullName ?? customer.full_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className={styles.profileName}>{customer.fullName ?? customer.full_name}</div>
                {customer.companyName && <div className={styles.profileCompany}>{customer.companyName}</div>}
              </div>
            </div>
            <div className={styles.infoList}>
              {(customer.phone) && (
                <div className={styles.infoRow}>
                  <Phone size={13} className={styles.infoIcon} />
                  <a href={`tel:${customer.phone}`} className={styles.infoLink}>{customer.phone}</a>
                </div>
              )}
              {(customer.email) && (
                <div className={styles.infoRow}>
                  <Mail size={13} className={styles.infoIcon} />
                  <a href={`mailto:${customer.email}`} className={styles.infoLink}>{customer.email}</a>
                </div>
              )}
              {(customer.city) && (
                <div className={styles.infoRow}>
                  <MapPin size={13} className={styles.infoIcon} />
                  <span>{customer.city}</span>
                </div>
              )}
              {(customer.createdAt) && (
                <div className={styles.infoRow}>
                  <Calendar size={13} className={styles.infoIcon} />
                  <span>Клиент с {fmtDate(customer.createdAt)}</span>
                </div>
              )}
              {(customer.source) && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Источник:</span>
                  <span>{customer.source}</span>
                </div>
              )}
            </div>
            {customer.notes && (
              <div className={styles.notesSection}>
                <div className={styles.notesSectionTitle}>Заметки</div>
                <p className={styles.notesText}>{customer.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });
  const deferredQ = useDeferredValue(q);
  const { data, isLoading, isError } = useCustomers({ q: deferredQ || undefined, limit: 100 });
  const createCustomer = useCreateCustomer();
  const customers = (data as any)?.results ?? [];
  const sf = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    await createCustomer.mutateAsync({ fullName: form.fullName.trim(), phone: form.phone || undefined, email: form.email || undefined });
    setForm({ fullName: '', phone: '', email: '' }); setCreating(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Клиенты</h1>
        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input className={styles.search} value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск..." />
          </div>
          <button className={styles.addBtn} onClick={() => setCreating(true)}><Plus size={14} />Добавить</button>
        </div>
      </div>

      {creating && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input className={styles.fi} value={form.fullName} onChange={sf('fullName')} placeholder="Имя *" required autoFocus />
          <PhoneInput className={styles.fi} value={form.phone} onChange={sf('phone')} />
          <input className={styles.fi} value={form.email} onChange={sf('email')} placeholder="Email" type="email" />
          <button type="submit" className={styles.quickOk} disabled={createCustomer.isPending}>Создать</button>
          <button type="button" className={styles.quickCancel} onClick={() => setCreating(false)}><X size={13} /></button>
        </form>
      )}

      {isLoading && (
        <div className={styles.skeletons}>{[...Array(6)].map((_,i) => <Skeleton key={i} height={48} radius={8} />)}</div>
      )}
      {isError && <div className={styles.error}>Ошибка загрузки</div>}

      {!isLoading && !isError && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Имя</th><th>Телефон</th><th>Email</th><th>Город</th><th>Источник</th><th>Дата</th></tr>
            </thead>
            <tbody>
              {customers.map((c: any) => (
                <tr key={c.id} className={`${styles.row} ${styles.rowClickable}`} onClick={() => setSelectedId(c.id)}>
                  <td className={styles.tdName}>{c.fullName}</td>
                  <td className={styles.tdMono}>{c.phone ?? '—'}</td>
                  <td>{c.email ?? '—'}</td>
                  <td>{c.city ?? '—'}</td>
                  <td>{c.source ?? '—'}</td>
                  <td className={styles.tdDate}>{new Date(c.createdAt).toLocaleDateString('ru-KZ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className={styles.empty}>
              Клиентов пока нет
              <button className={styles.emptyBtn} onClick={() => setCreating(true)}>Добавить клиента</button>
            </div>
          )}
        </div>
      )}

      {selectedId && <CustomerDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
