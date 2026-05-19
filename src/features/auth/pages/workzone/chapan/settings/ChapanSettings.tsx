import { useState } from 'react';
import { useAuthStore } from '../../../../shared/stores/auth';
import { useEmployeePermissions } from '../../../../shared/hooks/useEmployeePermissions';
import { useChapanCatalogs, useChapanProfile, useSaveCatalogs, useSaveProfile, useChapanClients, useChangeEmail } from '@/entities/order/queries';
import { AlertCircle, Plus, RefreshCw, Save, X } from 'lucide-react';
import type { ChapanCatalogs } from '@/entities/order/types';
import {
  buildSizeCatalog,
  normalizePaymentCatalog,
  normalizePaymentMethodLabel,
  normalizeSizeCatalog,
  normalizeSizeValue,
} from '../../../../shared/lib/chapanCatalogDefaults';
import styles from './ChapanSettings.module.css';

type CatalogKey = 'productCatalog' | 'sizeCatalog' | 'workers' | 'paymentMethodCatalog';
type SettingsTab = 'catalogs' | 'profile' | 'clients' | 'account';

export default function ChapanSettingsPage() {
  const { isAbsolute } = useEmployeePermissions();
  const defaultTab = isAbsolute ? 'catalogs' : 'account';
  const [activeTab, setActiveTab] = useState<'profile' | 'catalogs' | 'clients' | 'account'>(defaultTab);

  const allTabs = [
    { key: 'catalogs' as const, label: 'Каталоги',  ownerOnly: true  },
    { key: 'profile'  as const, label: 'Профиль',   ownerOnly: true  },
    { key: 'clients'  as const, label: 'Клиенты',   ownerOnly: true  },
    { key: 'account'  as const, label: 'Аккаунт',   ownerOnly: false },
  ];
  const visibleTabs = allTabs.filter(t => !t.ownerOnly || isAbsolute);

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Настройки</h1>
        <div className={styles.tabs}>
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'catalogs' && <CatalogsTab />}
      {activeTab === 'profile'  && <ProfileTab />}
      {activeTab === 'clients'  && <ClientsTab />}
      {activeTab === 'account'  && <AccountTab isOwner={isAbsolute} />}
    </div>
  );
}

// ── Catalogs tab ──────────────────────────────────────────────────────────────

function emptyDraft(): ChapanCatalogs {
  return { productCatalog: [], sizeCatalog: [], workers: [], paymentMethodCatalog: [] };
}

function CatalogsTab() {
  const { data: catalogs, isLoading } = useChapanCatalogs();
  const saveCatalogs = useSaveCatalogs();

  const [draft, setDraft] = useState<ChapanCatalogs | null>(null);
  const current = draft ?? catalogs;

  function getList(key: CatalogKey): string[] {
    return current?.[key] ?? [];
  }

  function setList(key: CatalogKey, list: string[]) {
    setDraft({ ...(current ?? emptyDraft()), [key]: list });
  }

  function addItem(key: CatalogKey, value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    const prepared =
      key === 'sizeCatalog'          ? normalizeSizeValue(trimmed) :
      key === 'paymentMethodCatalog' ? normalizePaymentMethodLabel(trimmed) :
      trimmed;

    if (getList(key).map(v => v.toLowerCase()).includes(prepared.toLowerCase())) return false;
    setList(key, [...getList(key), prepared]);
    return true;
  }

  function removeItem(key: CatalogKey, value: string) {
    setList(key, getList(key).filter(v => v !== value));
  }

  function normalizeSizes() {
    setList('sizeCatalog', normalizeSizeCatalog(getList('sizeCatalog')));
  }

  const hasLetterSizes = getList('sizeCatalog').some(v => normalizeSizeValue(v) !== v.trim());

  function applySizePreset() {
    setList('sizeCatalog', buildSizeCatalog(getList('sizeCatalog')));
  }

  function loadPaymentDefaults() {
    setList('paymentMethodCatalog', normalizePaymentCatalog(getList('paymentMethodCatalog')));
  }

  async function handleSave() {
    if (!draft) return;
    await saveCatalogs.mutateAsync({
      ...draft,
      sizeCatalog:           normalizeSizeCatalog(draft.sizeCatalog),
      paymentMethodCatalog:  normalizePaymentCatalog(draft.paymentMethodCatalog),
    });
    setDraft(null);
  }

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <div className={styles.tabContent}>
      {draft && (
        <div className={styles.saveBar}>
          <span>Есть несохранённые изменения</span>
          <div className={styles.saveBarActions}>
            <button className={styles.saveBarDiscard} onClick={() => setDraft(null)}>
              Отменить
            </button>
            <button className={styles.saveBarSave} onClick={handleSave} disabled={saveCatalogs.isPending}>
              <Save size={13} />
              {saveCatalogs.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.catalogGrid}>
        <CatalogSection
          title="Модели продуктов"
          items={getList('productCatalog')}
          placeholder="Назар — жұп шапан..."
          onAdd={v => addItem('productCatalog', v)}
          onRemove={v => removeItem('productCatalog', v)}
        />

        <CatalogSection
          title="Размеры"
          items={getList('sizeCatalog')}
          placeholder="44, 46, 48..."
          onAdd={v => addItem('sizeCatalog', v)}
          onRemove={v => removeItem('sizeCatalog', v)}
          actions={
            <div className={styles.catalogActions}>
              <button type="button" className={styles.catalogActionBtn} onClick={applySizePreset}>
                <Plus size={11} />Пресет 38–60
              </button>
              {hasLetterSizes && (
                <button type="button" className={`${styles.catalogActionBtn} ${styles.catalogActionBtnWarn}`} onClick={normalizeSizes}>
                  <RefreshCw size={11} />XS→число
                </button>
              )}
            </div>
          }
        />

        <CatalogSection
          title="Работники цеха"
          items={getList('workers')}
          placeholder="Имя работника..."
          onAdd={v => addItem('workers', v)}
          onRemove={v => removeItem('workers', v)}
        />

        <CatalogSection
          title="Способы оплаты"
          items={getList('paymentMethodCatalog')}
          placeholder="Наличные, Kaspi QR..."
          onAdd={v => addItem('paymentMethodCatalog', v)}
          onRemove={v => removeItem('paymentMethodCatalog', v)}
          actions={
            <div className={styles.catalogActions}>
              <button type="button" className={styles.catalogActionBtn} onClick={loadPaymentDefaults}>
                <Plus size={11} />Нормализовать методы оплаты
              </button>
            </div>
          }
          hint={
            <div className={styles.catalogHint}>
              <AlertCircle size={11} />
              Используется в форме создания/редактирования заказа
            </div>
          }
        />
      </div>
    </div>
  );
}

// ── Catalog section ───────────────────────────────────────────────────────────

function CatalogSection({
  title, items, placeholder, onAdd, onRemove, actions, hint,
}: {
  title: string;
  items: string[];
  placeholder: string;
  onAdd: (v: string) => boolean;
  onRemove: (v: string) => void;
  actions?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const [input, setInput] = useState('');
  const [dupError, setDupError] = useState(false);

  function handleAdd() {
    if (!input.trim()) return;
    const added = onAdd(input.trim());
    if (added) {
      setInput('');
      setDupError(false);
    } else {
      setDupError(true);
      setTimeout(() => setDupError(false), 2000);
    }
  }

  return (
    <div className={styles.catalogSection}>
      <div className={styles.catalogTitleRow}>
        <span className={styles.catalogTitle}>{title}</span>
        {items.length > 0 && <span className={styles.catalogCount}>{items.length}</span>}
      </div>
      {actions && actions}
      <div className={styles.catalogAddRow}>
        <input
          className={`${styles.catalogInput} ${dupError ? styles.catalogInputError : ''}`}
          value={input}
          onChange={e => { setInput(e.target.value); setDupError(false); }}
          placeholder={dupError ? 'Уже есть в списке' : placeholder}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className={styles.catalogAddBtn} onClick={handleAdd} disabled={!input.trim()}>
          <Plus size={14} />
        </button>
      </div>
      <div className={styles.catalogList}>
        {items.map(item => (
          <div key={item} className={styles.catalogItem}>
            <span className={styles.catalogItemName}>{item}</span>
            <button className={styles.catalogItemRemove} onClick={() => onRemove(item)}>
              <X size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className={styles.catalogEmpty}>Список пуст</div>}
      </div>
      {hint && hint}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading } = useChapanProfile();
  const saveProfile = useSaveProfile();
  const [form, setForm] = useState<{
    displayName: string;
    orderPrefix: string;
    publicIntakeEnabled: boolean;
    kazpostDeliveryFee: number;
    railDeliveryFee: number;
    airDeliveryFee: number;
  } | null>(null);

  const current = form ?? {
    displayName: profile?.displayName ?? '',
    orderPrefix: profile?.orderPrefix ?? 'ЧП',
    publicIntakeEnabled: profile?.publicIntakeEnabled ?? false,
    kazpostDeliveryFee: profile?.kazpostDeliveryFee ?? 2000,
    railDeliveryFee: profile?.railDeliveryFee ?? 3000,
    airDeliveryFee: profile?.airDeliveryFee ?? 5000,
  };

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>;

  async function handleSave() {
    await saveProfile.mutateAsync(current);
    setForm(null);
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.profileForm}>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Название мастерской</label>
          <input
            className={styles.profileInput}
            value={current.displayName}
            onChange={e => setForm({ ...current, displayName: e.target.value })}
            placeholder="Чапан Ателье"
          />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Префикс номеров заказов</label>
          <input
            className={styles.profileInput}
            value={current.orderPrefix}
            onChange={e => setForm({ ...current, orderPrefix: e.target.value.toUpperCase().slice(0, 6) })}
            placeholder="ЧП"
            maxLength={6}
          />
          <span className={styles.profileHint}>
            Пример: #{current.orderPrefix || 'ЧП'}-042
          </span>
        </div>
        <label className={styles.profileCheckbox}>
          <input
            type="checkbox"
            checked={current.publicIntakeEnabled}
            onChange={e => setForm({ ...current, publicIntakeEnabled: e.target.checked })}
          />
          <span>Включить публичную форму заявок</span>
        </label>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Казпочта (₸)</label>
          <input
            type="number"
            min={0}
            className={styles.profileInput}
            value={current.kazpostDeliveryFee}
            onChange={e => setForm({ ...current, kazpostDeliveryFee: Number(e.target.value) || 0 })}
          />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Жд (₸)</label>
          <input
            type="number"
            min={0}
            className={styles.profileInput}
            value={current.railDeliveryFee}
            onChange={e => setForm({ ...current, railDeliveryFee: Number(e.target.value) || 0 })}
          />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Авиа (₸)</label>
          <input
            type="number"
            min={0}
            className={styles.profileInput}
            value={current.airDeliveryFee}
            onChange={e => setForm({ ...current, airDeliveryFee: Number(e.target.value) || 0 })}
          />
        </div>
        <button
          className={styles.profileSaveBtn}
          onClick={handleSave}
          disabled={saveProfile.isPending}
        >
          <Save size={14} />
          {saveProfile.isPending ? 'Сохранение...' : 'Сохранить профиль'}
        </button>
      </div>
    </div>
  );
}

// ── Clients tab ───────────────────────────────────────────────────────────────

function ClientsTab() {
  const { data, isLoading } = useChapanClients();
  const clients = data?.results ?? [];

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <div className={styles.tabContent}>
      <div className={styles.clientsInfo}>
        Всего клиентов мастерской: {data?.count ?? 0}
      </div>
      <div className={styles.clientsTable}>
        <div className={styles.clientsHeader}>
          <span>Имя</span>
          <span>Телефон</span>
          <span>Email</span>
        </div>
        {clients.map(c => (
          <div key={c.id} className={styles.clientRow}>
            <span className={styles.clientName}>{c.fullName}</span>
            <a href={`tel:${c.phone}`} className={styles.clientPhone}>{c.phone}</a>
            <span className={styles.clientEmail}>{c.email ?? '—'}</span>
          </div>
        ))}
        {clients.length === 0 && (
          <div className={styles.noClients}>
            Клиенты появятся здесь после создания первого заказа
          </div>
        )}
      </div>
    </div>
  );
}

// ── Account tab ───────────────────────────────────────────────────────────────
// Visible to ALL users (employees included). Owner sees email-change section too.

function AccountTab({ isOwner }: { isOwner: boolean }) {
  const authStore = useAuthStore();
  const user = authStore.user;
  const changeEmailMutation = useChangeEmail();

  // Change password state (for employees)
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Change email state (owner only)
  const [emailStep, setEmailStep] = useState<'idle' | 'form'>('idle');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  async function handleChangePassword() {
    setPwError(''); setPwSuccess('');
    if (!pwCurrent) { setPwError('Введите текущий пароль.'); return; }
    if (pwNew.length < 6) { setPwError('Новый пароль — минимум 6 символов.'); return; }
    if (pwNew !== pwConfirm) { setPwError('Пароли не совпадают.'); return; }
    setPwLoading(true);
    try {
      const { api } = await import('../../../../shared/api/client');
      await (api as { post: (url: string, data: object) => Promise<unknown> })
        .post('/auth/change-password', { current_password: pwCurrent, new_password: pwNew });
      setPwSuccess('Пароль успешно изменён.');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch {
      setPwError('Не удалось изменить пароль. Проверьте текущий пароль.');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleChangeEmail() {
    setEmailError(''); setEmailSuccess('');
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) {
      setEmailError('Введите корректный email.'); return;
    }
    if (!emailPassword) { setEmailError('Введите текущий пароль.'); return; }
    try {
      await changeEmailMutation.mutateAsync({ new_email: newEmail.trim(), current_password: emailPassword });
      setEmailSuccess('Email изменён. Вы будете выведены из аккаунта для повторного входа.');
      setTimeout(() => authStore.clearAuth(), 2500);
    } catch {
      setEmailError('Не удалось изменить email. Проверьте пароль или попробуйте другой адрес.');
    }
  }

  return (
    <div className={styles.accountTab}>
      <div className={styles.accountSection}>
        <h3 className={styles.accountSectionTitle}>Данные аккаунта</h3>
        <div className={styles.accountInfo}>
          <div className={styles.accountInfoRow}>
            <span className={styles.accountInfoLabel}>Имя</span>
            <span className={styles.accountInfoValue}>{user?.full_name ?? '—'}</span>
          </div>
          {user?.phone && (
            <div className={styles.accountInfoRow}>
              <span className={styles.accountInfoLabel}>Телефон</span>
              <span className={styles.accountInfoValue}>{user.phone}</span>
            </div>
          )}
          {user?.email && (
            <div className={styles.accountInfoRow}>
              <span className={styles.accountInfoLabel}>Email</span>
              <span className={styles.accountInfoValue}>{user.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change password — all users */}
      <div className={styles.accountSection}>
        <h3 className={styles.accountSectionTitle}>Сменить пароль</h3>
        <div className={styles.accountForm}>
          <input
            className={styles.accountInput}
            type="password"
            placeholder="Текущий пароль"
            value={pwCurrent}
            onChange={e => { setPwCurrent(e.target.value); setPwError(''); setPwSuccess(''); }}
          />
          <input
            className={styles.accountInput}
            type="password"
            placeholder="Новый пароль (мин. 6 символов)"
            value={pwNew}
            onChange={e => { setPwNew(e.target.value); setPwError(''); }}
          />
          <input
            className={styles.accountInput}
            type="password"
            placeholder="Повторите новый пароль"
            value={pwConfirm}
            onChange={e => { setPwConfirm(e.target.value); setPwError(''); }}
          />
          {pwError && <p className={styles.accountError}>{pwError}</p>}
          {pwSuccess && <p className={styles.accountSuccess}>{pwSuccess}</p>}
          <button
            className={styles.accountBtn}
            onClick={handleChangePassword}
            disabled={pwLoading}
          >
            {pwLoading ? 'Сохранение...' : 'Сменить пароль'}
          </button>
        </div>
      </div>

      {/* Change email — owner / full_access only */}
      {isOwner && (
        <div className={styles.accountSection}>
          <h3 className={styles.accountSectionTitle}>Сменить email</h3>

          {emailStep === 'idle' && !emailSuccess && (
            <div>
              <p className={styles.accountHint}>
                Текущий email: <strong>{user?.email ?? '—'}</strong>
              </p>
              <div className={styles.accountWarningBox}>
                <strong>Важно:</strong> после смены email вы будете автоматически выведены
                из аккаунта и должны войти заново с новым адресом.
              </div>
              <button
                className={styles.accountBtn}
                onClick={() => setEmailStep('form')}
              >
                Сменить email
              </button>
            </div>
          )}

          {emailStep === 'form' && !emailSuccess && (
            <div className={styles.accountForm}>
              <input
                className={styles.accountInput}
                type="email"
                placeholder="Новый email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                autoComplete="email"
              />
              <input
                className={styles.accountInput}
                type="password"
                placeholder="Подтвердите текущий пароль"
                value={emailPassword}
                onChange={e => { setEmailPassword(e.target.value); setEmailError(''); }}
              />
              {emailError && <p className={styles.accountError}>{emailError}</p>}
              <div className={styles.accountFormRow}>
                <button
                  className={styles.accountBtnSecondary}
                  onClick={() => { setEmailStep('idle'); setEmailError(''); setNewEmail(''); setEmailPassword(''); }}
                >
                  Отмена
                </button>
                <button
                  className={styles.accountBtn}
                  onClick={handleChangeEmail}
                  disabled={changeEmailMutation.isPending}
                >
                  {changeEmailMutation.isPending ? 'Сохранение...' : 'Подтвердить смену'}
                </button>
              </div>
            </div>
          )}

          {emailSuccess && (
            <p className={styles.accountSuccess}>{emailSuccess}</p>
          )}
        </div>
      )}
    </div>
  );
}
