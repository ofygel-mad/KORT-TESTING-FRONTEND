import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Phone, Mail, Building2, User, Edit3,
  Plus, MessageSquare, CheckSquare, Briefcase, Tag,
  Send, MessageCircle, FileText, PhoneCall,
} from 'lucide-react';
import { api } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { Badge } from '../../../shared/ui/Badge';
import { PageLoader } from '../../../shared/ui/PageLoader';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Drawer } from '../../../shared/ui/Drawer';
import { FormErrorSummary } from '../../../shared/ui/FormErrorSummary';
import { Input, Textarea } from '../../../shared/ui/Input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatMoney } from '../../../shared/utils/format';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useUIStore } from '../../../shared/stores/ui';
import styles from './CustomerProfile.module.css';
import { setProductMoment } from '../../../shared/utils/productMoment';
import { openExternal } from '../../../shared/lib/browser';
import { useCapabilities } from '../../../shared/hooks/useCapabilities';
import { useTabsKeyboardNav } from '../../../shared/hooks/useTabsKeyboardNav';

interface CustomerDetail {
  id: string; full_name: string; company_name: string;
  phone: string; email: string; source: string; status: string;
  owner: { id: string; full_name: string } | null;
  tags: string[]; notes: string;
  created_at: string; updated_at: string;
  last_contact_at?: string | null; follow_up_due_at?: string | null;
  response_state?: string; next_action_note?: string;
}
interface Activity {
  id: string; type: string;
  payload: Record<string, unknown>;
  actor: { full_name: string } | null;
  created_at: string;
}
interface Deal {
  id: string; title: string; amount: number | null;
  currency: string; status: string;
  stage: { name: string; type: string }; created_at: string;
}
interface Task {
  id: string; title: string; priority: string;
  status: string; due_at: string | null;
  assigned_to: { full_name: string } | null;
}

const TABS = [
  { key: 'overview',  label: 'Обзор',      icon: <User size={13} /> },
  { key: 'activity',  label: 'Активность', icon: <MessageSquare size={13} /> },
  { key: 'deals',     label: 'Сделки',     icon: <Briefcase size={13} /> },
  { key: 'tasks',     label: 'Задачи',     icon: <CheckSquare size={13} /> },
];

const STATUS_MAP: Record<string, { variant: 'success' | 'info' | 'default' | 'warning'; label: string }> = {
  new:      { variant: 'info',    label: 'Новый' },
  active:   { variant: 'success', label: 'Активный' },
  inactive: { variant: 'default', label: 'Неактивный' },
  archived: { variant: 'default', label: 'Архив' },
};

const ACTIVITY_ICONS: Record<string, ReactNode> = {
  call:       <PhoneCall size={13} />,
  message:    <MessageCircle size={13} />,
  email:      <Mail size={13} />,
  note:       <FileText size={13} />,
  whatsapp:   <Send size={13} />,
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

export default function CustomerProfilePage() {
  const { id }     = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const openCreateDeal = useUIStore(s => s.openCreateDeal);
  const openCreateTask = useUIStore(s => s.openCreateTask);
  const openAssistantPrompt = useUIStore(s => s.openAssistantPrompt);
  const { can } = useCapabilities();
  const canEditCustomer = can('customers:write');
  const canCreateDeal = can('deals:write');
  const canCreateTask = can('tasks:write');
  const [tab, setTab]         = useState<typeof TABS[number]['key']>('overview');
  const [editDrawer, setEditDrawer] = useState(false);
  const tabKeys = TABS.map((item) => item.key);
  const handleTabKeyDown = useTabsKeyboardNav(tabKeys, tab, setTab);

  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['customer', id],
    queryFn:  () => api.get(`/customers/${id}/`),
  });
  useDocumentTitle(customer?.full_name);

  const { data: activities } = useQuery<{ results: Activity[] }>({
    queryKey: ['customer-activities', id],
    queryFn:  () => api.get(`/customers/${id}/activities/`),
    enabled:  tab === 'activity' || tab === 'overview',
  });
  const { data: deals } = useQuery<{ results: Deal[] }>({
    queryKey: ['customer-deals', id],
    queryFn:  () => api.get(`/customers/${id}/deals/`),
    enabled:  tab === 'deals' || tab === 'overview',
  });
  const { data: tasks } = useQuery<{ results: Task[] }>({
    queryKey: ['customer-tasks', id],
    queryFn:  () => api.get(`/customers/${id}/tasks/`),
    enabled:  tab === 'tasks',
  });

  const { register, handleSubmit, reset: resetEdit, formState: { isSubmitting: editSubmitting, errors } } =
    useForm<Partial<CustomerDetail>>();

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CustomerDetail>) => api.patch(`/customers/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Клиент обновлён');
      setEditDrawer(false);
    },
  });

  if (isLoading) return <PageLoader />;
  if (!customer) return <EmptyState icon={<User size={22} />} title="Клиент не найден" />;

  const sm = STATUS_MAP[customer.status] ?? STATUS_MAP.new;
  const activeDeals = deals?.results.filter(d => d.status === 'open') ?? [];

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Back ────────────────────────────────────────────── */}
      <button className={styles.backBtn} onClick={() => navigate('/customers')}>
        <ChevronLeft size={15} />
        Все клиенты
      </button>

      {/* ── Profile header ──────────────────────────────────── */}
      <div className={styles.profileHeader}>
        <div className={styles.profileHeaderInner}>
          <div className={styles.avatarLarge}>{initials(customer.full_name)}</div>

          <div className={styles.profileMeta}>
            <h1 className={styles.profileName}>{customer.full_name}</h1>
            {customer.company_name && (
              <div className={styles.profileCompany}>
                <Building2 size={13} />
                {customer.company_name}
              </div>
            )}
            <div className={styles.profileContacts}>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className={styles.contactLink}>
                  <Phone size={13} className={styles.contactLinkIcon} />
                  {customer.phone}
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className={styles.contactLink}>
                  <Mail size={13} className={styles.contactLinkIcon} />
                  {customer.email}
                </a>
              )}
            </div>
          </div>

          <div className={styles.profileActions}>
            <Badge variant={sm.variant}>{sm.label}</Badge>
            {canEditCustomer && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit3 size={13} />}
                onClick={() => {
                  resetEdit(customer);
                  setEditDrawer(true);
                }}
              >
                Изменить
              </Button>
            )}
            {customer.phone && (
              <Button
                size="sm"
                icon={<MessageSquare size={13} />}
                onClick={() => openExternal(`https://wa.me/${customer.phone.replace(/\D/g, '')}`)}
              >
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        <div className={styles.quickFacts}>
          <div className={styles.quickFact}>
            <span className={styles.quickFactLabel}>Источник</span>
            <span className={styles.quickFactValue}>{customer.source || <span className={styles.quickFactMuted}>—</span>}</span>
          </div>
          <div className={styles.quickFact}>
            <span className={styles.quickFactLabel}>Владелец</span>
            <span className={styles.quickFactValue}>{customer.owner?.full_name || <span className={styles.quickFactMuted}>—</span>}</span>
          </div>
          <div className={styles.quickFact}>
            <span className={styles.quickFactLabel}>Создан</span>
            <span className={styles.quickFactValue}>{format(new Date(customer.created_at), 'd MMM yyyy', { locale: ru })}</span>
          </div>
          {customer.last_contact_at && (
            <div className={styles.quickFact}>
              <span className={styles.quickFactLabel}>Контакт</span>
              <span className={styles.quickFactValue}>
                {formatDistanceToNow(new Date(customer.last_contact_at), { addSuffix: true, locale: ru })}
              </span>
            </div>
          )}
          <div className={styles.quickFact}>
            <span className={styles.quickFactLabel}>Сделок</span>
            <span className={styles.quickFactValue}>{activeDeals.length} активных</span>
          </div>
        </div>

        <div className={styles.nextActionSurface}>
          <div className={styles.nextActionCopy}>
            <span className={styles.nextActionEyebrow}>Дальше по клиенту</span>
            <strong className={styles.nextActionTitle}>Не оставляйте клиента просто карточкой</strong>
            <span className={styles.nextActionText}>Свяжитесь, поставьте задачу или создайте сделку, пока по клиенту ещё понятен следующий шаг.</span>
          </div>
          <div className={styles.nextActionButtons}>
            {can('deals:write') && <button className={styles.nextActionBtn} onClick={() => { setProductMoment(`Клиент «${customer.full_name}» открыт. Следующий логичный шаг - создать сделку или закрепить follow-up.`); openCreateDeal({ customerId: customer.id }); }}>Создать сделку</button>}
            <button className={styles.nextActionBtn} onClick={() => openAssistantPrompt(`Какой следующий шаг по клиенту ${customer.full_name}?`)}>Подсказать следующий шаг</button>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className={styles.tabs} role="tablist" aria-label="Разделы карточки клиента" aria-orientation="horizontal" onKeyDown={handleTabKeyDown}>
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            id={`customer-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`customer-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={`${styles.tab}${tab === t.key ? ' ' + styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className={styles.bodyGrid}>
        <div>
          {/* Overview */}
          {tab === 'overview' && (
            <div id="customer-panel-overview" role="tabpanel" aria-labelledby="customer-tab-overview" tabIndex={0} className={styles.overviewStack}>
              {/* Core info */}
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Основные данные</span>
                </div>
                <div className={styles.infoGrid}>
                  {[
                    { label: 'Имя', value: customer.full_name },
                    { label: 'Компания', value: customer.company_name || '—' },
                    { label: 'Телефон', value: customer.phone || '—' },
                    { label: 'Email', value: customer.email || '—' },
                    { label: 'Статус', value: sm.label },
                    { label: 'Источник', value: customer.source || '—' },
                    { label: 'Владелец', value: customer.owner?.full_name || '—' },
                    { label: 'Создан', value: format(new Date(customer.created_at), 'd MMM yyyy', { locale: ru }) },
                  ].map((f) => (
                    <div key={f.label} className={styles.infoField}>
                      <div className={styles.infoFieldLabel}>{f.label}</div>
                      <div className={styles.infoFieldValue}>{f.value}</div>
                    </div>
                  ))}
                </div>
                {customer.notes && (
                  <div className={styles.notesArea}>
                    <div className={`${styles.infoFieldLabel} ${styles.notesLabel}`}>Заметки</div>
                    <p className={styles.notesText}>
                      {customer.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Recent activity */}
              {(activities?.results ?? []).length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <span className={styles.panelTitle}>Последняя активность</span>
                    <button className={styles.panelAction} onClick={() => setTab('activity')}>Все</button>
                  </div>
                  <div className={styles.activityList}>
                    {(activities?.results ?? []).slice(0, 4).map((act) => (
                      <div key={act.id} className={styles.activityItem}>
                        <div className={styles.activityIconWrap}>
                          {ACTIVITY_ICONS[act.type] ?? <MessageSquare size={13} />}
                        </div>
                        <div className={styles.activityBody}>
                          <div className={styles.activityText}>
                            {(act.payload as any)?.body ?? act.type}
                          </div>
                          <div className={styles.activityMeta}>
                            {act.actor?.full_name && <>{act.actor.full_name} · </>}
                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ru })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active deals */}
              {activeDeals.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <span className={styles.panelTitle}>Активные сделки</span>
                    <button className={styles.panelAction} onClick={() => setTab('deals')}>Все</button>
                  </div>
                  {activeDeals.slice(0, 3).map((deal) => (
                    <div key={deal.id} className={styles.dealRow} onClick={() => navigate(`/deals/${deal.id}`)}>
                      <div>
                        <div className={styles.dealTitle}>{deal.title}</div>
                        <div className={styles.dealStage}>{deal.stage.name}</div>
                      </div>
                      {deal.amount && (
                        <div className={styles.dealAmount}>{formatMoney(deal.amount, deal.currency)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity tab */}
          {tab === 'activity' && (
            <div id="customer-panel-activity" role="tabpanel" aria-labelledby="customer-tab-activity" tabIndex={0} className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>История активности</span>
              </div>
              {(activities?.results ?? []).length === 0
                ? <div className={styles.panelEmpty}>Активностей пока нет</div>
                : (
                  <div className={styles.activityList}>
                    {(activities?.results ?? []).map((act) => (
                      <div key={act.id} className={styles.activityItem}>
                        <div className={styles.activityIconWrap}>
                          {ACTIVITY_ICONS[act.type] ?? <MessageSquare size={13} />}
                        </div>
                        <div className={styles.activityBody}>
                          <div className={styles.activityText}>
                            {(act.payload as any)?.body ?? act.type}
                          </div>
                          <div className={styles.activityMeta}>
                            {act.actor?.full_name && <>{act.actor.full_name} · </>}
                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ru })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* Deals tab */}
          {tab === 'deals' && (
            <div id="customer-panel-deals" role="tabpanel" aria-labelledby="customer-tab-deals" tabIndex={0} className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Сделки</span>
                {can('deals:write') && <button className={styles.panelAction} onClick={() => openCreateDeal({ customerId: customer.id })}>
                  + Создать
                </button>}
              </div>
              {(deals?.results ?? []).length === 0
                ? <div className={styles.panelEmpty}>Сделок нет. Создайте первую.</div>
                : (deals?.results ?? []).map((deal) => (
                    <div key={deal.id} className={styles.dealRow} onClick={() => navigate(`/deals/${deal.id}`)}>
                      <div>
                        <div className={styles.dealTitle}>{deal.title}</div>
                        <div className={styles.dealStage}>{deal.stage.name}</div>
                      </div>
                      {deal.amount && (
                        <div className={styles.dealAmount}>{formatMoney(deal.amount, deal.currency)}</div>
                      )}
                    </div>
                  ))
              }
            </div>
          )}

          {/* Tasks tab */}
          {tab === 'tasks' && (
            <div id="customer-panel-tasks" role="tabpanel" aria-labelledby="customer-tab-tasks" tabIndex={0} className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Задачи</span>
                {can('tasks:write') && <button className={styles.panelAction} onClick={() => openCreateTask({ customerId: customer.id })}>
                  + Добавить
                </button>}
              </div>
              {(tasks?.results ?? []).length === 0
                ? <div className={styles.panelEmpty}>Задач нет</div>
                : (tasks?.results ?? []).map((t) => (
                    <div key={t.id} className={styles.taskRow}>
                      <div className={styles.taskHeader}>
                        <CheckSquare size={14} className={styles.taskIcon} />
                        <span className={`${styles.taskTitle} ${t.status === 'done' ? styles.taskTitleDone : ''}`}>
                          {t.title}
                        </span>
                        {t.priority === 'high' && <Badge variant="danger" size="sm">Важно</Badge>}
                      </div>
                      {(t.due_at || t.assigned_to) && (
                        <div className={styles.taskMeta}>
                          {t.due_at && <span>{format(new Date(t.due_at), 'd MMM', { locale: ru })}</span>}
                          {t.assigned_to && <span>{t.assigned_to.full_name}</span>}
                        </div>
                      )}
                    </div>
                  ))
              }
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Tags */}
          {(customer.tags ?? []).length > 0 && (
            <div className={styles.sideSection}>
              <div className={styles.sideSectionHeader}>Теги</div>
              <div className={styles.tagList}>
                {customer.tags.map(tag => (
                  <span key={tag} className={styles.tag}>
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit drawer ─────────────────────────────────────── */}
      <Drawer
        open={editDrawer}
        onClose={() => setEditDrawer(false)}
        title="Редактировать клиента"
        subtitle="Исправьте ключевые данные контакта, чтобы карточка оставалась пригодной для работы."
        size="sm"
        footer={
          <div className={styles.drawerFooter}>
            <Button type="button" variant="secondary" onClick={() => setEditDrawer(false)}>Отмена</Button>
            <Button type="submit" form="customer-edit-form" loading={editSubmitting || updateMutation.isPending}>Сохранить</Button>
          </div>
        }
      >
        <form id="customer-edit-form" onSubmit={handleSubmit(data => updateMutation.mutate(data))} className={styles.editForm} noValidate>
          <FormErrorSummary errors={errors} title="Проверьте поля клиента" />
          <Input label="Имя и фамилия" required defaultValue={customer.full_name} error={errors.full_name?.message} {...register('full_name', { required: 'Укажите имя клиента', validate: (v) => (String(v ?? '').trim().length >= 2) || 'Имя слишком короткое' })} />
          <Input label="Компания" defaultValue={customer.company_name} error={errors.company_name?.message} {...register('company_name', { validate: (v) => !v || String(v).trim().length >= 2 || 'Название компании слишком короткое' })} />
          <Input label="Телефон" defaultValue={customer.phone} error={errors.phone?.message} {...register('phone', { validate: (v) => !v || String(v).replace(/\D/g, '').length >= 10 || 'Введите корректный телефон' })} />
          <Input label="Email" type="email" defaultValue={customer.email} error={errors.email?.message} {...register('email', { validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) || 'Введите корректный email' })} />
          <Input label="Источник" defaultValue={customer.source} {...register('source')} />
          <Textarea label="Заметки" rows={4} defaultValue={customer.notes} {...register('notes')} />
        </form>
      </Drawer>
    </motion.div>
  );
}
