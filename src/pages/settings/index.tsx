import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Copy,
  Edit2,
  Globe,
  Key,
  MessageSquare,
  Monitor,
  MonitorCog,
  Moon,
  Plus,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  User,
  UserX,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../shared/api/client';
import { useCompanyAccess } from '../../shared/hooks/useCompanyAccess';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import { useRole } from '../../shared/hooks/useRole';
import { useTabsKeyboardNav } from '../../shared/hooks/useTabsKeyboardNav';
import { copyToClipboard } from '../../shared/lib/browser';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { getDeviceId, usePinStore } from '../../shared/stores/pin';
import { useAuthStore } from '../../shared/stores/auth';
import { useUIStore, type Theme, type ThemePack } from '../../shared/stores/ui';
import { useProfileStore, ONLINE_STATUSES } from '../../shared/stores/profile';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { CompanyAccessGate } from '../../shared/ui/CompanyAccessGate';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Skeleton } from '../../shared/ui/Skeleton';
import type { Employee, EmployeePermission, CreateEmployeeDto, UpdateEmployeeDto } from '../../entities/employee/types';
import { PERMISSION_LABEL, PERMISSION_DESCRIPTION, BASE_PERMISSIONS, CHAPAN_PERMISSIONS } from '../../entities/employee/types';
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDismissEmployee, useResetPassword, useRemoveEmployee } from '../../entities/employee/queries';
import { isKazakhPhoneComplete, normalizeKazakhPhone } from '../../shared/utils/kz';
import { PhoneInput } from '../../shared/ui/PhoneInput';
import s from './Settings.module.css';

interface OrgData {
  id: string;
  name: string;
  slug?: string;
  mode?: string;
  // Extended profile fields — all optional, null from server = not set
  legal_name?: string;
  bin?: string;
  iin?: string;
  legal_form?: string;
  director?: string;
  accountant?: string;
  shipment_responsible_name?: string;
  shipment_responsible_position?: string;
  transport_organization?: string;
  attorney_number?: string;
  attorney_date?: string;
  attorney_issued_by?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_account?: string;
  currency: string;
  industry?: string;
  onboarding_completed?: boolean;
}

type SectionKey =
  | 'profile'
  | 'organization'
  | 'company-access'
  | 'appearance'
  | 'security'
  | 'integrations'
  | 'webhooks'
  | 'templates'
  | 'api';

type SectionAlias = SectionKey | 'team';

function normalizeSectionKey(section: SectionAlias | undefined): SectionKey {
  if (section === 'team') return 'company-access';
  return section ?? 'company-access';
}

const ACCESS_LABELS: Record<string, string> = {
  active: 'Активен',
  pending: 'Ожидает подтверждения',
  rejected: 'Отклонён',
  no_company: 'Без компании',
  anonymous: 'Без авторизации',
};

const SECTIONS: Array<{ key: SectionKey; label: string; icon: JSX.Element }> = [
  { key: 'profile', label: 'Профиль', icon: <User size={15} /> },
  { key: 'organization', label: 'Организация', icon: <Building2 size={15} /> },
  { key: 'company-access', label: 'Компания и доступ', icon: <Users size={15} /> },
  { key: 'appearance', label: 'Оформление', icon: <MonitorCog size={15} /> },
  { key: 'security', label: 'Безопасность', icon: <ShieldCheck size={15} /> },
  { key: 'integrations', label: 'Интеграции', icon: <Globe size={15} /> },
  { key: 'webhooks', label: 'Webhooks', icon: <Zap size={15} /> },
  { key: 'templates', label: 'Шаблоны', icon: <MessageSquare size={15} /> },
  { key: 'api', label: 'API токены', icon: <Key size={15} /> },
];

const THEME_PACKS: Array<{ value: ThemePack; title: string; subtitle: string }> = [
  { value: 'neutral', title: 'Neutral Premium', subtitle: 'Сдержанный базовый стиль интерфейса' },
  { value: 'graphite', title: 'Graphite', subtitle: 'Холодный строгий визуальный пакет' },
  { value: 'sand', title: 'Sand', subtitle: 'Тёплый спокойный рабочий стиль' },
  { value: 'obsidian', title: 'Obsidian', subtitle: 'Контрастная ночная палитра' },
  { value: 'enterprise', title: 'Enterprise Hybrid', subtitle: 'Собранный business-режим для команд' },
];

const KZ_LEGAL_FORMS = [
  { value: '', label: 'Выберите форму' },
  { value: 'ТОО', label: 'ТОО — Товарищество с ограниченной ответственностью' },
  { value: 'АО', label: 'АО — Акционерное общество' },
  { value: 'ИП', label: 'ИП — Индивидуальный предприниматель' },
  { value: 'КФ', label: 'КФ — Крестьянское (фермерское) хозяйство' },
  { value: 'ГКП', label: 'ГКП — Государственное казённое предприятие' },
  { value: 'РГП', label: 'РГП — Республиканское государственное предприятие' },
  { value: 'НКО', label: 'НКО — Некоммерческая организация' },
];

function extractInviteToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('token')?.trim() ?? '';
  } catch {
    const matched = trimmed.match(/[?&]token=([^&]+)/);
    return matched ? decodeURIComponent(matched[1]) : trimmed;
  }
}

function OrgSection() {
  const queryClient = useQueryClient();
  const setOrg = useAuthStore((state) => state.setOrg);
  const { data: org } = useQuery<OrgData>({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization/'),
  });
  const { register, handleSubmit } = useForm<Partial<OrgData>>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<OrgData>) => api.patch<OrgData>('/organization/', payload),
    onSuccess: (updated) => {
      if (updated) setOrg(updated as any);
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Организация обновлена');
    },
  });

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Данные организации</div>
          <div className={s.sectionSubtitle}>Реквизиты используются при формировании счётов, накладных и документов</div>
        </div>
        <Button size="sm" loading={mutation.isPending} onClick={handleSubmit((payload) => mutation.mutate(payload))}>
          Сохранить
        </Button>
      </div>
      <div className={s.sectionBody}>

        {/* — Блок 1: Основные данные — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Основное</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Название компании <span className={s.fieldRequired}>*</span></label>
              <input {...register('name')} defaultValue={org?.name ?? ''} className="kort-input" placeholder="ТОО «Моя Компания»" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Юридическое наименование</label>
              <input {...register('legal_name')} defaultValue={org?.legal_name ?? ''} className="kort-input" placeholder="Полное официальное наименование" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Организационно-правовая форма</label>
              <select {...register('legal_form')} defaultValue={org?.legal_form ?? ''} className={`kort-input ${s.selectInput}`}>
                {KZ_LEGAL_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Отрасль</label>
              <input {...register('industry')} defaultValue={org?.industry ?? ''} className="kort-input" placeholder="Производство / Торговля / Услуги" />
            </div>
          </div>
        </div>

        {/* — Блок 2: Регистрационные данные — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Регистрация и налоги</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>БИН <span className={s.fieldHint}>(12 цифр, для юр. лиц)</span></label>
              <input {...register('bin')} defaultValue={org?.bin ?? ''} className="kort-input" placeholder="000000000000" maxLength={12} inputMode="numeric" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>ИИН <span className={s.fieldHint}>(12 цифр, для ИП)</span></label>
              <input {...register('iin')} defaultValue={org?.iin ?? ''} className="kort-input" placeholder="000000000000" maxLength={12} inputMode="numeric" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Валюта расчётов</label>
              <select {...register('currency')} defaultValue={org?.currency ?? 'KZT'} className={`kort-input ${s.selectInput}`}>
                <option value="KZT">KZT — Казахстанский тенге ₸</option>
                <option value="USD">USD — Доллар США $</option>
                <option value="EUR">EUR — Евро €</option>
              </select>
            </div>
          </div>
        </div>

        {/* — Блок 3: Руководство — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Руководство</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Директор / Руководитель</label>
              <input {...register('director')} defaultValue={org?.director ?? ''} className="kort-input" placeholder="ФИО полностью" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Главный бухгалтер</label>
              <input {...register('accountant')} defaultValue={org?.accountant ?? ''} className="kort-input" placeholder="ФИО или «Без бухгалтера»" />
            </div>
          </div>
        </div>

        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Документы и подписи</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Ответственный за отпуск</label>
              <input
                {...register('shipment_responsible_name')}
                defaultValue={org?.shipment_responsible_name ?? ''}
                className="kort-input"
                placeholder="ФИО сотрудника, который разрешает отпуск"
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Должность ответственного</label>
              <input
                {...register('shipment_responsible_position')}
                defaultValue={org?.shipment_responsible_position ?? ''}
                className="kort-input"
                placeholder="Руководитель / Зав. складом / Менеджер"
              />
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label className={s.fieldLabel}>Транспортная организация</label>
              <input
                {...register('transport_organization')}
                defaultValue={org?.transport_organization ?? ''}
                className="kort-input"
                placeholder="Если есть постоянный перевозчик, укажите здесь"
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Номер доверенности</label>
              <input
                {...register('attorney_number')}
                defaultValue={org?.attorney_number ?? ''}
                className="kort-input"
                placeholder="15/ДОВ-2026"
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Дата доверенности</label>
              <input
                {...register('attorney_date')}
                defaultValue={org?.attorney_date ?? ''}
                className="kort-input"
                type="date"
              />
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label className={s.fieldLabel}>Кем выдана доверенность</label>
              <input
                {...register('attorney_issued_by')}
                defaultValue={org?.attorney_issued_by ?? ''}
                className="kort-input"
                placeholder="ТОО «Компания» / ИП Иванов И.И."
              />
            </div>
          </div>
        </div>

        {/* — Блок 4: Контакты и адрес — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Контакты и адрес</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Город</label>
              <input {...register('city')} defaultValue={org?.city ?? ''} className="kort-input" placeholder="Алматы" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Юридический адрес</label>
              <input {...register('address')} defaultValue={org?.address ?? ''} className="kort-input" placeholder="ул. Абая, 1, офис 100" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Телефон</label>
              <PhoneInput {...register('phone')} defaultValue={org?.phone ?? ''} className="kort-input" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Электронная почта</label>
              <input {...register('email')} defaultValue={org?.email ?? ''} className="kort-input" placeholder="info@company.kz" inputMode="email" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Веб-сайт</label>
              <input {...register('website')} defaultValue={org?.website ?? ''} className="kort-input" placeholder="https://company.kz" />
            </div>
          </div>
        </div>

        {/* — Блок 5: Банковские реквизиты — */}
        <div className={s.orgGroup}>
          <div className={s.orgGroupLabel}>Банковские реквизиты</div>
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Банк</label>
              <input {...register('bank_name')} defaultValue={org?.bank_name ?? ''} className="kort-input" placeholder="БанкЦентрКредит / Халык Банк" />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>БИК банка</label>
              <input {...register('bank_bik')} defaultValue={org?.bank_bik ?? ''} className="kort-input" placeholder="HSBKKZKX" maxLength={11} />
            </div>
            <div className={`${s.field} ${s.fieldWide}`}>
              <label className={s.fieldLabel}>Расчётный счёт (ИИК)</label>
              <input {...register('bank_account')} defaultValue={org?.bank_account ?? ''} className="kort-input" placeholder="KZ00 0000 0000 0000 0000" maxLength={24} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const EMP_DEPT_PRESETS = ['Менеджмент', 'Продажи', 'Производство', 'Склад', 'Финансы', 'IT'];

function AddEmpDrawer({ onClose }: { onClose: () => void }) {
  const createEmployee = useCreateEmployee();
  const [form, setForm] = useState<CreateEmployeeDto>({
    phone: '', full_name: '', department: '', permissions: ['sales'],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function togglePerm(p: EmployeePermission) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = 'Введите имя';
    if (!form.phone.trim()) errs.phone = 'Введите телефон';
    if (!isKazakhPhoneComplete(form.phone)) errs.phone = 'Введите полный номер: +7 (XXX) XXX-XX-XX';
    if (!form.department.trim()) errs.department = 'Введите отдел';
    if (!form.permissions.length) errs.permissions = 'Выберите хотя бы одно право';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    await createEmployee.mutateAsync({ ...form, phone: normalizeKazakhPhone(form.phone) ?? form.phone });
    onClose();
  }

  return (
    <div className={s.empDrawerOverlay} onClick={onClose}>
      <div className={s.empDrawer} onClick={e => e.stopPropagation()}>
        <div className={s.empDrawerHeader}>
          <span className={s.empDrawerTitle}>Добавить сотрудника</span>
          <button className={s.empDrawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={s.empDrawerBody} onSubmit={handleSubmit}>
          <div className={s.empField}>
            <label className={s.empLabel}>Имя <span className={s.empReq}>*</span></label>
            <input className={`${s.empInput} ${errors.full_name ? s.empInputErr : ''}`}
              value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Новый сотрудник" autoFocus />
            {errors.full_name && <span className={s.empErrMsg}>{errors.full_name}</span>}
          </div>
          <div className={s.empField}>
            <label className={s.empLabel}>Телефон <span className={s.empReq}>*</span></label>
            <PhoneInput className={`${s.empInput} ${errors.phone ? s.empInputErr : ''}`}
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            {errors.phone && <span className={s.empErrMsg}>{errors.phone}</span>}
          </div>
          <div className={s.empField}>
            <label className={s.empLabel}>Отдел <span className={s.empReq}>*</span></label>
            <input className={`${s.empInput} ${errors.department ? s.empInputErr : ''}`} list="emp-dept-list"
              value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="Продажи" />
            <datalist id="emp-dept-list">{EMP_DEPT_PRESETS.map(d => <option key={d} value={d} />)}</datalist>
            {errors.department && <span className={s.empErrMsg}>{errors.department}</span>}
          </div>
          <div className={s.empField}>
            <div className={s.empPermSectionLabel}><ShieldCheck size={12} />Права доступа <span className={s.empReq}>*</span></div>
            <div className={s.empPermChecklist}>
              {BASE_PERMISSIONS.map(p => {
                const checked = form.permissions.includes(p);
                return (
                  <label key={p} className={`${s.empPermCheckItem} ${checked ? s.empPermCheckItemActive : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => togglePerm(p)} className={s.empPermCheckbox} />
                    <div>
                      <span className={s.empPermCheckLabel}>{PERMISSION_LABEL[p]}</span>
                      <span className={s.empPermCheckDesc}>{PERMISSION_DESCRIPTION[p]}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.permissions && <span className={s.empErrMsg}>{errors.permissions}</span>}
          </div>
          <div className={s.empField}>
            <div className={s.empPermModuleDivider}>Модуль Чапан</div>
            <div className={s.empPermChecklist}>
              {CHAPAN_PERMISSIONS.map(p => {
                const checked = form.permissions.includes(p);
                return (
                  <label key={p} className={`${s.empPermCheckItem} ${checked ? s.empPermCheckItemActive : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => togglePerm(p)} className={s.empPermCheckbox} />
                    <div>
                      <span className={s.empPermCheckLabel}>{PERMISSION_LABEL[p]}</span>
                      <span className={s.empPermCheckDesc}>{PERMISSION_DESCRIPTION[p]}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className={s.empDrawerNote}>
            Система создаст учётную запись. Временный пароль будет показан после создания.
          </div>
          <div className={s.empDrawerActions}>
            <button type="button" className={s.empCancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={s.empSubmitBtn} disabled={createEmployee.isPending}>
              {createEmployee.isPending ? 'Создание...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditEmpDrawer({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const updateEmployee = useUpdateEmployee();
  const dismissEmployee = useDismissEmployee();
  const resetPassword = useResetPassword();
  const [perms, setPerms] = useState<EmployeePermission[]>([...employee.permissions]);
  const [dept, setDept] = useState(employee.department);
  const [permsDirty, setPermsDirty] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const isDismissed = employee.status === 'dismissed';

  function togglePerm(p: EmployeePermission) {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    setPermsDirty(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateEmployee.mutateAsync({ id: employee.id, dto: { department: dept, permissions: perms } });
    setPermsDirty(false);
    onClose();
  }

  return (
    <div className={s.empDrawerOverlay} onClick={onClose}>
      <div className={s.empDrawer} onClick={e => e.stopPropagation()}>
        <div className={s.empDrawerHeader}>
          <div className={s.empDrawerAvatar}>{employee.full_name.charAt(0)}</div>
          <div className={s.empDrawerHeaderInfo}>
            <span className={s.empDrawerTitle}>{employee.full_name}</span>
            <span className={s.empDrawerStatus} style={{ color: isDismissed ? 'var(--fill-negative)' : 'var(--fill-positive, #22c55e)' }}>
              {isDismissed ? 'Деактивирован' : 'Активен'}
            </span>
          </div>
          <button className={s.empDrawerClose} onClick={onClose}><X size={16} /></button>
        </div>
        <form className={s.empDrawerBody} onSubmit={handleSave}>
          {/* Department */}
          <div className={s.empField}>
            <label className={s.empLabel}>Отдел</label>
            <input className={s.empInput} list="emp-dept-list2"
              value={dept} onChange={e => setDept(e.target.value)} />
            <datalist id="emp-dept-list2">{EMP_DEPT_PRESETS.map(d => <option key={d} value={d} />)}</datalist>
          </div>

          {/* Base permissions */}
          <div className={s.empField}>
            <div className={s.empPermSectionLabel}><ShieldCheck size={12} />Права доступа</div>
            <div className={s.empPermChecklist}>
              {BASE_PERMISSIONS.map(p => {
                const checked = perms.includes(p);
                return (
                  <label key={p} className={`${s.empPermCheckItem} ${checked ? s.empPermCheckItemActive : ''} ${isDismissed ? s.empPermCheckItemDisabled : ''}`}>
                    <input type="checkbox" checked={checked} disabled={isDismissed}
                      onChange={() => togglePerm(p)} className={s.empPermCheckbox} />
                    <div>
                      <span className={s.empPermCheckLabel}>{PERMISSION_LABEL[p]}</span>
                      <span className={s.empPermCheckDesc}>{PERMISSION_DESCRIPTION[p]}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Chapan module permissions */}
          <div className={s.empField}>
            <div className={s.empPermModuleDivider}>Модуль Чапан</div>
            <div className={s.empPermChecklist}>
              {CHAPAN_PERMISSIONS.map(p => {
                const checked = perms.includes(p);
                return (
                  <label key={p} className={`${s.empPermCheckItem} ${checked ? s.empPermCheckItemActive : ''} ${isDismissed ? s.empPermCheckItemDisabled : ''}`}>
                    <input type="checkbox" checked={checked} disabled={isDismissed}
                      onChange={() => togglePerm(p)} className={s.empPermCheckbox} />
                    <div>
                      <span className={s.empPermCheckLabel}>{PERMISSION_LABEL[p]}</span>
                      <span className={s.empPermCheckDesc}>{PERMISSION_DESCRIPTION[p]}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Save */}
          {!isDismissed && (
            <div className={s.empDrawerActions}>
              <button type="button" className={s.empCancelBtn} onClick={onClose}>Отмена</button>
              <button type="submit" className={s.empSubmitBtn} disabled={updateEmployee.isPending || (!permsDirty && dept === employee.department)}>
                {updateEmployee.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          )}

          {/* Управление аккаунтом */}
          {!isDismissed && (
            <div className={s.empDangerZone}>
              <div className={s.empDangerLabel}>Управление аккаунтом</div>

              {!confirmReset ? (
                <button type="button" className={s.empDangerBtn} onClick={() => setConfirmReset(true)}>
                  <Key size={13} />Сбросить пароль
                </button>
              ) : (
                <div className={s.empConfirmCard}>
                  <div className={s.empConfirmText}>Сотрудник получит временный пароль и должен будет сменить его при следующем входе.</div>
                  <div className={s.empConfirmBtns}>
                    <button type="button" className={s.empConfirmCancel} onClick={() => setConfirmReset(false)}>Отмена</button>
                    <button type="button" className={s.empConfirmOk} onClick={() => { resetPassword.mutate(employee.id); setConfirmReset(false); onClose(); }}>Сбросить</button>
                  </div>
                </div>
              )}

              {!confirmDismiss ? (
                <button type="button" className={`${s.empDangerBtn} ${s.empDangerBtnRed}`} onClick={() => setConfirmDismiss(true)}>
                  <UserX size={13} />Деактивировать сотрудника
                </button>
              ) : (
                <div className={`${s.empConfirmCard} ${s.empConfirmCardDanger}`}>
                  <div className={s.empConfirmText}>Сотрудник <strong>{employee.full_name}</strong> потеряет доступ к системе. Данные сохранятся.</div>
                  <div className={s.empConfirmBtns}>
                    <button type="button" className={s.empConfirmCancel} onClick={() => setConfirmDismiss(false)}>Отмена</button>
                    <button type="button" className={`${s.empConfirmOk} ${s.empConfirmOkDanger}`}
                      onClick={() => { dismissEmployee.mutate(employee.id); setConfirmDismiss(false); onClose(); }}>
                      Деактивировать
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function CompanyAccessSection() {
  const access = useCompanyAccess();
  const { data, isLoading } = useEmployees();
  const dismissEmployee = useDismissEmployee();
  const resetPassword = useResetPassword();
  const removeEmployee = useRemoveEmployee();
  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const employees = data?.results ?? [];
  const active = employees.filter(e => e.status === 'active');
  const dismissed = employees.filter(e => e.status === 'dismissed');

  return (
    <>
      {/* ── Статус доступа ── */}
      <div className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <div className={s.sectionTitle}>Статус доступа</div>
            <div className={s.sectionSubtitle}>Компания, роль и текущее состояние участия</div>
          </div>
          <Badge bg="var(--bg-surface-inset)" color="var(--text-secondary)">
            {ACCESS_LABELS[access.state] ?? access.state}
          </Badge>
        </div>
        <div className={s.sectionBody}>
          {access.isAdmin ? (
            <div className={s.adminGateCard}>
              <Building2 size={18} />
              <div>
                <div className={s.adminGateTitle}>Компания активна</div>
                <div className={s.adminGateText}>
                  Вы управляете компанией «{access.companyName ?? 'Текущая организация'}».
                </div>
              </div>
            </div>
          ) : (
            <CompanyAccessGate compact />
          )}
          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>Текущая компания</label>
              <div className={s.apiKeyField}>{access.companyName ?? 'Не выбрана'}</div>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Роль</label>
              <div className={s.apiKeyField}>{access.role ?? 'viewer'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Сотрудники (только для admin/owner) ── */}
      {access.isAdmin && (
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <div>
              <div className={s.sectionTitle}>Сотрудники</div>
              <div className={s.sectionSubtitle}>Добавление, права доступа и управление аккаунтами</div>
            </div>
            <button className={s.empAddBtn} onClick={() => setAddOpen(true)}>
              <Plus size={13} /> Добавить
            </button>
          </div>

          <div className={s.teamTableWrap}>
            {isLoading ? (
              <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} height={52} radius={6} />)}
              </div>
            ) : (
              <table className={s.teamTable}>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Отдел</th>
                    <th>Права</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div className={s.memberCell}>
                          <div className={s.memberAvatar}>{emp.full_name.charAt(0)}</div>
                          <div>
                            <div className={s.memberName}>
                              {emp.full_name}
                              {emp.isPendingFirstLogin && (
                                <span className={s.empPendingBadge} style={{ marginLeft: 6 }}>Не входил(а)</span>
                              )}
                            </div>
                            {emp.phone && <div className={s.memberEmail}>{emp.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{emp.department}</td>
                      <td>
                        <div className={s.empPermTags}>
                          {emp.permissions.map(p => (
                            <span key={p} className={s.empPermTag}>{PERMISSION_LABEL[p]}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className={s.empActGroup}>
                          <button className={s.empActBtn} title="Редактировать" onClick={() => setEditEmployee(emp)}>
                            <Edit2 size={12} />
                          </button>
                          <button className={s.empActBtn} title="Сбросить пароль" onClick={() => resetPassword.mutate(emp.id)}>
                            <Key size={12} />
                          </button>
                          <button className={`${s.empActBtn} ${s.empActBtnDanger}`} title="Деактивировать"
                            onClick={() => { if (confirm(`Деактивировать ${emp.full_name}?`)) dismissEmployee.mutate(emp.id); }}>
                            <UserX size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {active.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 12px', fontSize: 13 }}>
                        Нет активных сотрудников
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {dismissed.length > 0 && (
            <>
              <div className={s.empSectionLabel}>Деактивированные</div>
              <div className={s.teamTableWrap}>
                <table className={s.teamTable}>
                  <tbody>
                    {dismissed.map(emp => (
                      <tr key={emp.id} className={s.empDimmed}>
                        <td>
                          <div className={s.memberCell}>
                            <div className={s.memberAvatar}>{emp.full_name.charAt(0)}</div>
                            <div className={s.memberName}>{emp.full_name}</div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{emp.department}</td>
                        <td><span className={s.empDismissedBadge}>Деактивирован</span></td>
                        <td>
                          <div className={s.empActGroup}>
                            <button className={`${s.empActBtn} ${s.empActBtnDanger}`} title="Удалить"
                              onClick={() => { if (confirm(`Удалить ${emp.full_name}?`)) removeEmployee.mutate(emp.id); }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {addOpen && <AddEmpDrawer onClose={() => setAddOpen(false)} />}
      {editEmployee && <EditEmpDrawer employee={editEmployee} onClose={() => setEditEmployee(null)} />}
    </>
  );
}

const THEME_MODES: Array<{ value: Theme; label: string; icon: JSX.Element }> = [
  { value: 'light', label: 'Светлая', icon: <Sun size={15} /> },
  { value: 'dark', label: 'Тёмная', icon: <Moon size={15} /> },
  { value: 'system', label: 'Системная', icon: <Monitor size={15} /> },
];

function AppearanceSection() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const themePack = useUIStore((state) => state.themePack);
  const setThemePack = useUIStore((state) => state.setThemePack);

  return (
    <>
      <div className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <div className={s.sectionTitle}>Цветовая схема</div>
            <div className={s.sectionSubtitle}>Применяется глобально ко всему интерфейсу</div>
          </div>
        </div>
        <div className={s.sectionBody}>
          <div className={s.themeToggleRow}>
            {THEME_MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${s.themeToggleBtn} ${theme === item.value ? s.themeToggleBtnActive : ''}`}
                onClick={() => setTheme(item.value)}
              >
                {item.icon}
                {item.label}
                {theme === item.value && <Check size={13} className={s.themeToggleCheck} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <div className={s.sectionTitle}>Визуальный пакет</div>
            <div className={s.sectionSubtitle}>Цветовая палитра и стиль компонентов</div>
          </div>
        </div>
        <div className={s.sectionBody}>
          <div className={s.themePackGrid}>
            {THEME_PACKS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${s.themePackCard} ${themePack === item.value ? s.themePackCardActive : ''}`}
                onClick={() => setThemePack(item.value)}
              >
                <div className={s.themePackCardInner}>
                  <div className={s.themePackName}>{item.title}</div>
                  <div className={s.themePackSub}>{item.subtitle}</div>
                </div>
                {themePack === item.value && (
                  <div className={s.themePackCheck}><Check size={12} /></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function OwnerCredentialsCard() {
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleChangeEmail() {
    if (!newEmail.trim() || !emailCurrentPassword.trim()) {
      toast.error('Заполните все поля.');
      return;
    }
    setEmailLoading(true);
    try {
      await api.post('/users/me/change-email/', {
        new_email: newEmail.trim().toLowerCase(),
        current_password: emailCurrentPassword,
      });
      toast.success('Email изменён. Войдите заново с новым адресом.');
      clearAuth();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Не удалось изменить email.');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword.trim() || !newPassword.trim() || !newPasswordConfirm.trim()) {
      toast.error('Заполните все поля.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('Пароли не совпадают.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Пароль должен содержать не менее 6 символов.');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Пароль изменён. Войдите заново.');
      clearAuth();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Не удалось изменить пароль.');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Учётная запись руководителя</div>
          <div className={s.sectionSubtitle}>
            После смены данных сессия владельца завершится. Сотрудники не будут выброшены из системы.
          </div>
        </div>
      </div>
      <div className={s.sectionBody}>
        {/* ── Смена email ── */}
        <div className={s.securityCard}>
          <div className={s.securityCardBody}>
            <div className={s.securityCardTitle}>Email</div>
            <div className={s.securityCardMeta}>{user?.email ?? '—'}</div>
            <div className={s.securityActions}>
              <button className={s.securityBtn} onClick={() => { setShowEmailForm((v) => !v); setShowPasswordForm(false); }}>
                Изменить email
              </button>
            </div>
          </div>
        </div>
        {showEmailForm && (
          <div className={s.pinSetupCard}>
            <div className={s.pinSetupFields}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Новый email</label>
                <input
                  className="kort-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="новый@email.com"
                  autoComplete="email"
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>Текущий пароль для подтверждения</label>
                <input
                  className="kort-input"
                  type="password"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  placeholder="Введите текущий пароль"
                  autoComplete="current-password"
                />
              </div>
            </div>
            <div className={s.pinSetupActions}>
              <button className={s.securityBtn} disabled={emailLoading} onClick={() => void handleChangeEmail()}>
                {emailLoading ? 'Сохраняем...' : 'Сохранить email'}
              </button>
            </div>
          </div>
        )}

        {/* ── Смена пароля ── */}
        <div className={s.securityCard}>
          <div className={s.securityCardBody}>
            <div className={s.securityCardTitle}>Пароль</div>
            <div className={s.securityCardMeta}>••••••••</div>
            <div className={s.securityActions}>
              <button className={s.securityBtn} onClick={() => { setShowPasswordForm((v) => !v); setShowEmailForm(false); }}>
                Изменить пароль
              </button>
            </div>
          </div>
        </div>
        {showPasswordForm && (
          <div className={s.pinSetupCard}>
            <div className={s.pinSetupFields}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Текущий пароль</label>
                <input
                  className="kort-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Текущий пароль"
                  autoComplete="current-password"
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>Новый пароль</label>
                <input
                  className="kort-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  autoComplete="new-password"
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>Повторите новый пароль</label>
                <input
                  className="kort-input"
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className={s.pinSetupActions}>
              <button className={s.securityBtn} disabled={passwordLoading} onClick={() => void handleChangePassword()}>
                {passwordLoading ? 'Сохраняем...' : 'Сохранить пароль'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileSection() {
  const userAuth = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const { onlineStatus, setOnlineStatus } = useProfileStore();

  const [fullName, setFullName] = useState(userAuth?.full_name ?? '');
  const [phone, setPhone] = useState(userAuth?.phone ?? '');

  const { data: meData } = useQuery<{
    id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null;
  }>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me/'),
    staleTime: 30000,
  });

  useEffect(() => {
    if (meData) {
      setFullName(meData.full_name ?? '');
      setPhone(meData.phone ?? '');
    }
  }, [meData]);

  const mutation = useMutation({
    mutationFn: (payload: { full_name?: string; phone?: string | null }) =>
      api.patch('/users/me/', payload),
    onSuccess: (data: any) => {
      if (data?.user) setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Профиль обновлён');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(msg ?? 'Не удалось сохранить изменения');
    },
  });

  const initials = (fullName || userAuth?.full_name || '?')
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Профиль</div>
          <div className={s.sectionSubtitle}>Личная информация и статус</div>
        </div>
        <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({ full_name: fullName.trim() || undefined, phone: phone.trim() || null })}>
          Сохранить
        </Button>
      </div>
      <div className={s.sectionBody}>
        <div className={s.profileAvatarRow}>
          <div className={s.profileAvatar}>{initials}</div>
          <div className={s.profileAvatarMeta}>
            <div className={s.profileAvatarName}>{fullName || userAuth?.full_name}</div>
            <div className={s.profileAvatarEmail}>{meData?.email ?? userAuth?.email ?? ''}</div>
          </div>
        </div>

        <div className={s.fieldGrid}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Имя</label>
            <input
              className="kort-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ваше имя"
              autoComplete="name"
            />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Телефон</label>
            <PhoneInput
              className="kort-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
        </div>

        <div>
          <div className={s.fieldLabel} style={{ marginBottom: 8 }}>Статус онлайн</div>
          <div className={s.onlineStatusGrid}>
            {ONLINE_STATUSES.map((s_item) => (
              <button
                key={s_item.key}
                type="button"
                className={[s.onlineStatusItem, onlineStatus === s_item.key ? s.onlineStatusItemActive : ''].join(' ')}
                onClick={() => setOnlineStatus(s_item.key)}
                title={s_item.label}
              >
                <span className={s.onlineStatusDot} style={{ background: s_item.color }} />
                <span className={s.onlineStatusLabel}>{s_item.label}</span>
              </button>
            ))}
          </div>
          <div className={s.fieldHint}>
            Онлайн: активно используете приложение · Отошёл: неактивны 15+ минут · Офлайн: неактивны 60+ минут
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  const { isOwner } = useRole();
  const pin = usePinStore((state) => state.pin);
  const isTrustedDevice = usePinStore((state) => state.isTrustedDevice);
  const setPin = usePinStore((state) => state.setPin);
  const clearPin = usePinStore((state) => state.clearPin);
  const [nextPin, setNextPin] = useState('');
  const [showForm, setShowForm] = useState(false);

  return (
    <>
    {isOwner && <OwnerCredentialsCard />}
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>Безопасность входа</div>
          <div className={s.sectionSubtitle}>PIN-код и доверенное устройство</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.securityCard}>
          <div className={s.securityCardIcon}><Smartphone size={18} /></div>
          <div className={s.securityCardBody}>
            <div className={s.securityCardTitle}>Устройство</div>
            <div className={s.securityCardMeta}>ID: {getDeviceId().slice(0, 18)}...</div>
            <div className={s.securityCardStatus}>
              {isTrustedDevice
                ? <span className={s.statusTrusted}>Доверенное устройство</span>
                : <span className={s.statusUntrusted}>Сначала выполните обычный вход</span>}
            </div>
          </div>
        </div>

        <div className={s.securityCard}>
          <div className={s.securityCardIcon}><ShieldCheck size={18} /></div>
          <div className={s.securityCardBody}>
            <div className={s.securityCardTitle}>PIN-код</div>
            <div className={s.securityCardMeta}>{pin ? 'PIN установлен' : 'PIN не установлен'}</div>
            <div className={s.securityActions}>
              <button className={s.securityBtn} onClick={() => setShowForm((state) => !state)}>
                {pin ? 'Изменить PIN' : 'Установить PIN'}
              </button>
              {pin && (
                <button
                  className={`${s.securityBtn} ${s.securityBtnDanger}`}
                  onClick={() => {
                    clearPin();
                    toast.success('PIN удалён');
                  }}
                >
                  Удалить PIN
                </button>
              )}
            </div>
          </div>
        </div>

        {showForm && (
          <div className={s.pinSetupCard}>
            <div className={s.pinSetupFields}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Новый PIN</label>
                <input
                  className="kort-input"
                  inputMode="numeric"
                  maxLength={4}
                  value={nextPin}
                  onChange={(event) => setNextPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>
            </div>
            <div className={s.pinSetupActions}>
              <button
                className={s.securityBtn}
                onClick={() => {
                  if (nextPin.length !== 4) {
                    toast.error('PIN должен содержать 4 цифры');
                    return;
                  }
                  setPin(nextPin);
                  setShowForm(false);
                  setNextPin('');
                  toast.success('PIN сохранён');
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function ApiSection() {
  const org = useAuthStore((state) => state.org);
  const token = `kort_${org?.slug ?? 'workspace'}_${(org?.id ?? 'org').replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase()}_demo`;

  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>API токен</div>
          <div className={s.sectionSubtitle}>Mock-контракт для будущего backend</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.apiKeyRow}>
          <div className={s.apiKeyField}>{token}</div>
          <Button
            size="sm"
            icon={<Copy size={13} />}
            onClick={async () => {
              const copied = await copyToClipboard(token);
              toast[copied ? 'success' : 'error'](copied ? 'Токен скопирован' : 'Не удалось скопировать токен');
            }}
          >
            Копировать
          </Button>
        </div>
      </div>
    </div>
  );
}

function StubSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={s.section}>
      <div className={s.sectionHeader}>
        <div>
          <div className={s.sectionTitle}>{title}</div>
          <div className={s.sectionSubtitle}>{subtitle}</div>
        </div>
      </div>
      <div className={s.sectionBody}>
        <div className={s.adminGateCard}>
          <MessageSquare size={18} />
          <div>
            <div className={s.adminGateTitle}>Каркас секции сохранён</div>
            <div className={s.adminGateText}>
              Базовая структура уже подготовлена и ждёт подключения полноценного backend API для этой области.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Настройки');
  const params = useParams();
  const navigate = useNavigate();
  const access = useCompanyAccess();
  const capabilities = useCapabilities();

  const visibleSections = useMemo(() => SECTIONS.filter((item) => {
    switch (item.key) {
      case 'profile':
      case 'company-access':
      case 'appearance':
      case 'security':
        return true;
      case 'organization':
        return access.isAdmin && access.hasCompanyAccess;
      case 'templates':
        return access.hasCompanyAccess;
      case 'integrations':
        return capabilities.canManageIntegrations;
      case 'webhooks':
        return capabilities.canRunAutomations;
      case 'api':
        return capabilities.canViewAudit;
      default:
        return false;
    }
  }), [access.hasCompanyAccess, access.isAdmin, capabilities.canManageIntegrations, capabilities.canRunAutomations, capabilities.canViewAudit]);

  const requestedSection = normalizeSectionKey(params.section as SectionAlias | undefined);
  const defaultSection = visibleSections[0]?.key ?? 'company-access';
  const section = visibleSections.some((item) => item.key === requestedSection) ? requestedSection : defaultSection;
  const sectionKeys = visibleSections.map((item) => item.key);
  const onTabKeyDown = useTabsKeyboardNav(sectionKeys, section, (next) => navigate(next === 'company-access' ? '/settings' : `/settings/${next}`));

  useEffect(() => {
    const expectedPath = section === 'company-access' ? '/settings' : `/settings/${section}`;
    if (`/${params.section ?? ''}` === `/${section}` && params.section) return;
    if (!params.section && section === 'company-access') return;
    navigate(expectedPath, { replace: true });
  }, [navigate, params.section, section]);

  return (
    <div className={s.page}>
      <div className={s.layout}>
        <nav className={s.sidebar} role="tablist" aria-label="Разделы настроек" onKeyDown={onTabKeyDown}>
          {visibleSections.map((item) => (
            <button
              key={item.key}
              role="tab"
              tabIndex={section === item.key ? 0 : -1}
              aria-selected={section === item.key}
              className={`${s.sidebarItem} ${section === item.key ? s.sidebarItemActive : ''}`}
              onClick={() => navigate(item.key === 'company-access' ? '/settings' : `/settings/${item.key}`)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className={s.mainContent}>
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.13 }}
            >
              {section === 'profile' && <ProfileSection />}
              {section === 'organization' && <OrgSection />}
              {section === 'company-access' && <CompanyAccessSection />}
              {section === 'appearance' && <AppearanceSection />}
              {section === 'security' && <SecuritySection />}
              {section === 'api' && <ApiSection />}
              {section === 'integrations' && <StubSection title="Интеграции" subtitle="Каталог внешних подключений и ключей" />}
              {section === 'webhooks' && <StubSection title="Webhooks" subtitle="Доставка событий и автоматизации" />}
              {section === 'templates' && <StubSection title="Шаблоны сообщений" subtitle="Повторно используемые тексты и follow-up сценарии" />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
