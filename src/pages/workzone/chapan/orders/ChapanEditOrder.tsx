import { useEffect, useId, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Calculator, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useOrder, useUpdateOrder, useChapanCatalogs, useChapanProfile, useRequestItemChange, useUpdateBankCommission } from '../../../../entities/order/queries';
import type { Urgency } from '../../../../entities/order/types';
import { formatPersonNameInput } from '../../../../shared/utils/person';
import { formatKazakhPhoneInput, isKazakhPhoneComplete } from '../../../../shared/utils/kz';
import {
  buildDeliveryOptions,
  buildMixedBreakdownRows,
  buildPaymentMethodOptions,
  buildSizeCatalog,
} from '../../../../shared/lib/chapanCatalogDefaults';
import styles from './ChapanNewOrder.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

type PaymentMethodValue = 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'mixed';

const CITIES   = ['Алматы', 'Астана', 'Шымкент', 'Атырау', 'Актобе', 'Тараз', 'Павлодар', 'Другой город'];
const SOURCES  = ['Instagram', 'WhatsApp', 'Telegram', 'Звонок', 'Рекомендация', 'Сайт', 'Другое'];

// ── SelectOrText ──────────────────────────────────────────────────────────────

function SelectOrText({ options, placeholder, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { options: string[] }) {
  const id = useId();
  return (
    <>
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      <input {...props} list={id} placeholder={placeholder} className={className} autoComplete="off" />
    </>
  );
}

function SearchableSelect({ options, placeholder, className, value, onChange, onBlur, disabled }: {
  options: string[];
  placeholder?: string;
  className?: string;
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  const [inputText, setInputText] = useState(value || '');
  const [open, setOpen] = useState(false);

  useEffect(() => { setInputText(value || ''); }, [value]);

  const filtered = !inputText
    ? options
    : options.filter(o => o.toLowerCase().includes(inputText.toLowerCase()));

  const commit = (opt: string) => {
    setInputText(opt);
    onChange(opt);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={inputText}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setInputText(e.target.value); setOpen(true); }}
        onBlur={() => {
          setTimeout(() => {
            setOpen(false);
            if (inputText !== value) onChange(inputText);
            onBlur?.();
          }, 150);
        }}
      />
      {open && filtered.length > 0 && (
        <ul className={styles.searchableDropdown}>
          {filtered.map((opt) => (
            <li
              key={opt}
              className={`${styles.searchableDropdownItem}${opt === value ? ` ${styles.searchableDropdownItemSelected}` : ''}`}
              onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function parseOptionalAmount(value: string) {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}


const DELIVERY = ['Самовывоз', 'Курьер по городу', 'Казпочта', 'СДЭК', 'Другое'];

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productName: z.string().min(1, 'Укажите модель'),
  size:        z.string().min(1, 'Укажите размер'),
  quantity:    z.coerce.number().int().min(1),
  unitPrice:   z.coerce.number().min(0).default(0),
  color:        z.string().optional(),
  gender:       z.string().optional(),
  length:       z.string().optional(),
  workshopNotes: z.string().optional(),
});

const schema = z.object({
  clientName:  z.string().min(2, 'Минимум 2 символа'),
  clientPhone: z.string().optional().default(''),
  clientPhoneForeign: z.string().optional(),
  dueDate:     z.string().optional(),
  city:         z.string().optional(),
  streetAddress: z.string().optional(),
  postalCode:   z.string().optional(),
  deliveryType: z.string().optional(),
  source:       z.string().optional(),
  orderDate:    z.string().optional(),
  urgency:     z.enum(['normal', 'urgent']).default('normal'),
  isDemandingClient: z.boolean().default(false),
  orderDiscount: z.coerce.number().min(0).optional(),
  deliveryFee:   z.coerce.number().min(0).optional(),
  bankCommissionPercent: z.coerce.number().min(0).max(100).optional(),
  prepayment:   z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'kaspi_qr', 'kaspi_terminal', 'transfer', 'halyk', 'mixed']).optional(),
  expectedPaymentMethod: z.string().optional(),
  paymentBreakdown: z.record(z.string(), z.coerce.number().min(0)).optional(),
  items:       z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
}).superRefine((data, ctx) => {
  const hasKzPhone = isKazakhPhoneComplete(data.clientPhone ?? '');
  const hasForeignPhone = !!(data.clientPhoneForeign?.trim());
  if (!hasKzPhone && !hasForeignPhone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите казахстанский или иностранный номер', path: ['clientPhone'] });
  } else if ((data.clientPhone ?? '') && !hasKzPhone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Введите номер в формате +7 (777)-777-77-77', path: ['clientPhone'] });
  }

  const itemsTotal = (data.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const orderDiscount = Number(data.orderDiscount) || 0;
  const deliveryFee   = Number(data.deliveryFee)   || 0;
  const bankCommPct   = Number(data.bankCommissionPercent) || 0;
  const subtotal      = Math.max(0, itemsTotal - orderDiscount);
  const bankComm      = Math.round(subtotal * bankCommPct / 100);
  const finalTotal    = Math.max(0, subtotal + deliveryFee + bankComm);

  if ((data.prepayment ?? 0) > 0 && !data.paymentMethod) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите способ оплаты', path: ['paymentMethod'] });
  }
  if ((data.prepayment ?? 0) > finalTotal) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Предоплата не может превышать итоговую сумму', path: ['prepayment'] });
  }
  if (data.paymentMethod === 'mixed' && (data.prepayment ?? 0) > 0) {
    const mixedSum = Object.values(data.paymentBreakdown ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
    if (mixedSum > 0 && Math.abs(mixedSum - (data.prepayment ?? 0)) > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Сумма разбивки не совпадает с предоплатой', path: ['paymentBreakdown'] });
    }
  }
});

type FormData = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChapanEditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading, isError } = useOrder(id!);
  const updateOrder = useUpdateOrder();
  const requestItemChange = useRequestItemChange();
  const updateBankCommission = useUpdateBankCommission();
  const { data: catalogs } = useChapanCatalogs();
  const { data: profile } = useChapanProfile();

  const products             = catalogs?.productCatalog ?? [];
  const catalogPaymentMethods = catalogs?.paymentMethodCatalog ?? [];
  const activePaymentMethods  = buildPaymentMethodOptions(catalogPaymentMethods);
  const mixedBreakdownRows    = buildMixedBreakdownRows(catalogPaymentMethods);
  const sizeOptions           = buildSizeCatalog(catalogs?.sizeCatalog ?? []);
  const deliveryOptions       = buildDeliveryOptions();

  // Change request modal state (for in_production orders)
  const [changeRequestModal, setChangeRequestModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [managerNote, setManagerNote] = useState('');

  const {
    register, control, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { urgency: 'normal', isDemandingClient: false, items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const urgency           = watch('urgency');
  const isDemandingClient = watch('isDemandingClient');
  const items             = watch('items');
  const deliveryType      = watch('deliveryType');
  const orderDiscountRaw  = watch('orderDiscount');
  const deliveryFeeRaw    = watch('deliveryFee');
  const bankCommPctRaw    = watch('bankCommissionPercent');
  const paymentMethod    = watch('paymentMethod');
  const prepaymentRaw    = watch('prepayment');
  const paymentBreakdownWatch = watch('paymentBreakdown');
  const [discountPercent, setDiscountPercent] = useState('');
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');

  const deliveryFeeMap: Record<string, number> = {
    'Казпочта': profile?.kazpostDeliveryFee ?? 2000,
    'Жд':       profile?.railDeliveryFee    ?? 3000,
    'Авиа':     profile?.airDeliveryFee     ?? 5000,
  };

  // F3: auto-fill delivery fee when delivery type changes
  useEffect(() => {
    const autoFee = deliveryFeeMap[deliveryType ?? ''];
    if (autoFee !== undefined) setValue('deliveryFee', autoFee);
  }, [deliveryType, profile?.kazpostDeliveryFee, profile?.railDeliveryFee, profile?.airDeliveryFee]);

  const itemsTotal            = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const orderDiscount         = Number.isFinite(orderDiscountRaw)  ? (orderDiscountRaw  ?? 0) : 0;
  const deliveryFee           = Number.isFinite(deliveryFeeRaw)    ? (deliveryFeeRaw    ?? 0) : 0;
  const bankCommPct           = Number.isFinite(bankCommPctRaw)    ? (bankCommPctRaw    ?? 0) : 0;
  const subtotalAfterDiscount = Math.max(0, itemsTotal - orderDiscount);
  const bankCommAmount        = Math.round(subtotalAfterDiscount * bankCommPct / 100);
  const finalTotal            = Math.max(0, subtotalAfterDiscount + deliveryFee + bankCommAmount);
  const prepayment            = Number.isFinite(prepaymentRaw) ? (prepaymentRaw ?? 0) : 0;
  const debt                  = Math.max(0, finalTotal - prepayment);
  const mixedSum = Object.values(paymentBreakdownWatch ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);

  // to avoid wiping user's in-progress edits (React Query refetchOnMount reuses the same
  // component instance but may deliver a new object reference for the same data).
  const formPopulated = useRef(false);
  useEffect(() => {
    if (!order || formPopulated.current) return;
    formPopulated.current = true;
    reset({
      clientName:  formatPersonNameInput(order.clientName),
      clientPhone: order.clientPhone ? formatKazakhPhoneInput(order.clientPhone) : '',
      clientPhoneForeign: order.clientPhoneForeign ?? '',
      dueDate:     order.dueDate ? order.dueDate.slice(0, 10) : '',
      urgency:     (order.urgency ?? (order.priority === 'urgent' ? 'urgent' : 'normal')) as Urgency,
      isDemandingClient: order.isDemandingClient ?? (order.priority === 'vip'),
      city:          order.city ?? '',
      streetAddress: order.streetAddress ?? '',
      postalCode:    order.postalCode ?? '',
      deliveryType:  order.deliveryType ?? '',
      source:        order.source ?? '',
      orderDate:     order.orderDate ? order.orderDate.slice(0, 10) : '',
      orderDiscount: order.orderDiscount > 0 ? order.orderDiscount : undefined,
      deliveryFee:   order.deliveryFee   > 0 ? order.deliveryFee   : undefined,
      bankCommissionPercent: order.bankCommissionPercent > 0 ? order.bankCommissionPercent : undefined,
      // Shows current paidAmount so manager can see what was already paid
      prepayment:    order.paidAmount   > 0 ? order.paidAmount   : undefined,
      paymentMethod: undefined,  // payment method for THIS edit session, not inherited
      expectedPaymentMethod: order.expectedPaymentMethod ?? undefined,
      paymentBreakdown: undefined,
      items: (order.items ?? []).map(item => ({
        productName:   item.productName,
        size:          item.size,
        quantity:      item.quantity,
        unitPrice:     item.unitPrice,
        color:         item.color ?? '',
        gender:        item.gender ?? '',
        length:        item.length ?? '',
        workshopNotes: item.workshopNotes ?? '',
      })),
    });
  }, [order, reset]);

  const canEditItems = ['new', 'confirmed'].includes(order?.status ?? '');
  const isInProduction = order?.status === 'in_production';

  function fmt(n: number) {
    return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
  }


  async function onSubmit(data: FormData) {
    if (!id) return;

    // For in_production orders with item changes — show confirmation modal first
    if (isInProduction) {
      setPendingFormData(data);
      setChangeRequestModal(true);
      return;
    }

    await updateOrder.mutateAsync({
      id,
      dto: {
        clientName:  formatPersonNameInput(data.clientName).trim(),
        clientPhone: data.clientPhone ? formatKazakhPhoneInput(data.clientPhone) : '',
        clientPhoneForeign: data.clientPhoneForeign?.trim() || undefined,
        dueDate:     data.dueDate || null,
        priority:    data.urgency === 'urgent' ? 'urgent' : data.isDemandingClient ? 'vip' : 'normal',
        urgency:     data.urgency as Urgency,
        isDemandingClient: data.isDemandingClient,
        city:          data.city?.trim() || undefined,
        streetAddress: data.streetAddress?.trim() || undefined,
        postalCode:    data.postalCode?.trim() || undefined,
        deliveryType:  data.deliveryType?.trim() || undefined,
        source:        data.source?.trim() || undefined,
        orderDate:     data.orderDate || undefined,
        orderDiscount: orderDiscount > 0 ? orderDiscount : 0,
        deliveryFee:   deliveryFee   > 0 ? deliveryFee   : 0,
        bankCommissionPercent: bankCommPct > 0 ? bankCommPct : 0,
        bankCommissionAmount:  bankCommAmount > 0 ? bankCommAmount : 0,
        prepayment:       prepayment > 0 ? prepayment : 0,
        paymentMethod:    prepayment > 0 ? (data.paymentMethod ?? undefined) : undefined,
        paymentBreakdown: data.paymentMethod === 'mixed'
          ? Object.fromEntries(Object.entries(data.paymentBreakdown ?? {}).filter(([, v]) => Number(v) > 0))
          : undefined,
        items:       canEditItems ? data.items.map(item => ({
          productName:   item.productName,
          size:          item.size,
          quantity:      item.quantity,
          unitPrice:     item.unitPrice,
          color:         item.color?.trim() || undefined,
          gender:        item.gender?.trim() || undefined,
          length:        item.length?.trim() || undefined,
          workshopNotes: item.workshopNotes || undefined,
        })) : undefined,
      },
    });
    navigate(`/workzone/chapan/orders/${id}`);
  }

  async function handleSubmitChangeRequest() {
    if (!id || !pendingFormData) return;

    function itemKey(productName: string, size: string) {
      return `${productName}|${size}`;
    }
    const existingKeys = new Set((order!.items ?? []).map(i => itemKey(i.productName, i.size)));
    const newItems = pendingFormData.items.filter(i => !existingKeys.has(itemKey(i.productName, i.size)));
    const changedItems = pendingFormData.items.filter(i => {
      if (!existingKeys.has(itemKey(i.productName, i.size))) return false;
      const orig = order!.items.find(o => itemKey(o.productName, o.size) === itemKey(i.productName, i.size));
      return orig && (orig.quantity !== i.quantity || orig.unitPrice !== i.unitPrice);
    });
    const hasItemChanges = newItems.length > 0 || changedItems.length > 0;

    // Always save non-item fields directly (no approval needed)
    await updateOrder.mutateAsync({
      id,
      dto: {
        clientName:  formatPersonNameInput(pendingFormData.clientName).trim(),
        clientPhone: pendingFormData.clientPhone ? formatKazakhPhoneInput(pendingFormData.clientPhone) : '',
        clientPhoneForeign: pendingFormData.clientPhoneForeign?.trim() || undefined,
        dueDate:     pendingFormData.dueDate || null,
        priority:    pendingFormData.urgency === 'urgent' ? 'urgent' : pendingFormData.isDemandingClient ? 'vip' : 'normal',
        urgency:     pendingFormData.urgency as Urgency,
        isDemandingClient: pendingFormData.isDemandingClient,
        city:          pendingFormData.city?.trim() || undefined,
        streetAddress: pendingFormData.streetAddress?.trim() || undefined,
        postalCode:    pendingFormData.postalCode?.trim() || undefined,
        deliveryType:  pendingFormData.deliveryType?.trim() || undefined,
        source:        pendingFormData.source?.trim() || undefined,
        orderDate:     pendingFormData.orderDate || undefined,
        orderDiscount: orderDiscount > 0 ? orderDiscount : 0,
        deliveryFee:   deliveryFee   > 0 ? deliveryFee   : 0,
        bankCommissionPercent: bankCommPct > 0 ? bankCommPct : 0,
        bankCommissionAmount:  bankCommAmount > 0 ? bankCommAmount : 0,
        prepayment:       prepayment > 0 ? prepayment : 0,
        paymentMethod:    prepayment > 0 ? (pendingFormData.paymentMethod ?? undefined) : undefined,
        paymentBreakdown: pendingFormData.paymentMethod === 'mixed'
          ? Object.fromEntries(Object.entries(pendingFormData.paymentBreakdown ?? {}).filter(([, v]) => Number(v) > 0))
          : undefined,
      },
    });

    // Only send change request to workshop if items actually changed
    if (hasItemChanges) {
      await requestItemChange.mutateAsync({
        id,
        items: pendingFormData.items.map(item => ({
          productName:   item.productName,
          size:          item.size,
          quantity:      item.quantity,
          unitPrice:     item.unitPrice,
          color:         item.color?.trim() || undefined,
          gender:        item.gender?.trim() || undefined,
          length:        item.length?.trim() || undefined,
          workshopNotes: item.workshopNotes || undefined,
        })),
        managerNote: managerNote.trim() || undefined,
      });
    }

    setChangeRequestModal(false);
    navigate(`/workzone/chapan/orders/${id}`);
  }

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div style={{ padding: 40, color: 'var(--ch-text-muted)' }}>Загрузка...</div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className={styles.root}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 20px', color: 'var(--ch-text-muted)' }}>
          <AlertTriangle size={24} />
          <p>Заказ не найден</p>
          <button onClick={() => navigate('/workzone/chapan/orders')} style={{ padding: '8px 18px', background: 'var(--ch-surface)', border: '1px solid var(--ch-border)', borderRadius: 7, color: 'var(--ch-plat-bright)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            ← Назад к заказам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Редактировать заказ</h1>
      </div>

      {isInProduction && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
          background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.25)',
          borderRadius: 10, marginBottom: 4, color: '#D94F4F',
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            <strong>Заказ уже в производстве.</strong> Изменения позиций потребуют согласования цеха —
            швея получит уведомление и сможет одобрить или отклонить запрос.
            Данные клиента и приоритет сохраняются без согласования.
          </span>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>

        {/* ── 01 Данные клиента ──────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>01</span>
            <span className={styles.sectionTitle}>Данные клиента</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>ФИО клиента <span className={styles.req}>*</span></label>
                <Controller
                  control={control}
                  name="clientName"
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(formatPersonNameInput(event.target.value))}
                      className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`}
                      placeholder="Аскаров Аскар Аскарович"
                    />
                  )}
                />
                {errors.clientName && <span className={styles.fieldError}>{errors.clientName.message}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Телефон KZ <span className={styles.req}>*</span></label>
                <Controller
                  control={control}
                  name="clientPhone"
                  render={({ field }) => (
                    <input
                      {...field}
                      type="tel"
                      inputMode="tel"
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(formatKazakhPhoneInput(event.target.value))}
                      className={`${styles.input} ${errors.clientPhone ? styles.inputError : ''}`}
                      placeholder="+7 (701)-234-56-78"
                    />
                  )}
                />
                {errors.clientPhone && <span className={styles.fieldError}>{errors.clientPhone.message}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Для иностранных номеров</label>
                <Controller
                  control={control}
                  name="clientPhoneForeign"
                  render={({ field }) => (
                    <input
                      {...field}
                      type="tel"
                      inputMode="tel"
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                      className={styles.input}
                      placeholder="+44 7700 900123"
                    />
                  )}
                />
              </div>
            </div>

            {/* Адрес и доставка */}
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Город</label>
                <Controller control={control} name="city" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={CITIES} placeholder="Алматы" className={styles.input} />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Почтовый индекс</label>
                <input {...register('postalCode')} className={styles.input} placeholder="050000" maxLength={10} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Доставка</label>
                <Controller control={control} name="deliveryType" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={deliveryOptions} placeholder="Выберите или введите" className={styles.input} />
                )} />
              </div>
            </div>
            <div className={styles.rowFull}>
              <div className={styles.field}>
                <label className={styles.label}>Адрес доставки</label>
                <input {...register('streetAddress')} className={styles.input} placeholder="ул. Абая 10, кв. 5 / ориентир" />
              </div>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Источник</label>
                <Controller control={control} name="source" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={SOURCES} placeholder="Instagram, звонок..." className={styles.input} />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Дата заказа</label>
                <input {...register('orderDate')} type="date" className={styles.input} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 Позиции заказа ──────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>02</span>
            <span className={styles.sectionTitle}>
              Позиции заказа
              {isInProduction && (
                <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 400, color: '#D94F4F', textTransform: 'none', letterSpacing: 0 }}>
                  (потребует согласования цеха)
                </span>
              )}
              {!canEditItems && !isInProduction && (
                <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 400, color: 'var(--ch-text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (недоступно после начала производства)
                </span>
              )}
            </span>
          </div>
          <div className={styles.sectionBody}>
            {fields.map((field, idx) => {
              const lineTotal = (Number(items[idx]?.quantity) || 0) * (Number(items[idx]?.unitPrice) || 0);
              const editable = canEditItems || isInProduction;

              return (
                <div key={field.id} className={styles.itemCard}>
                  <div className={styles.itemCardHeader}>
                    <span className={styles.itemCardLabel}>Позиция {idx + 1}</span>
                    {editable && fields.length > 1 && (
                      <button type="button" className={styles.itemRemoveBtn} onClick={() => remove(idx)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Модель + Размер */}
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Модель <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                        <SearchableSelect
                          options={products}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                          disabled={!editable}
                          placeholder="Назар — жуп шапан"
                          className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}
                        />
                      )} />
                      {errors.items?.[idx]?.productName && <span className={styles.fieldError}>{errors.items[idx]?.productName?.message}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Размер <span className={styles.req}>*</span></label>
                      <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => (
                        <SearchableSelect
                          options={sizeOptions}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                          disabled={!editable}
                          placeholder="48"
                          className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}
                        />
                      )} />
                      {errors.items?.[idx]?.size && <span className={styles.fieldError}>{errors.items[idx]?.size?.message}</span>}
                    </div>
                  </div>

                  {/* Кол-во + Цена */}
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Кол-во</label>
                      <input
                        {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                        type="number" min="1"
                        disabled={!editable}
                        className={styles.input}
                        onWheel={e => e.currentTarget.blur()}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Цена за ед. (₸)</label>
                      <input
                        {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })}
                        type="number" min="0"
                        disabled={!editable}
                        className={styles.input}
                        placeholder="0"
                        onWheel={e => e.currentTarget.blur()}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                  </div>

                  {lineTotal > 0 && (
                    <div className={styles.lineTotalRow}>
                      <span className={styles.lineTotalFinal}>{fmt(lineTotal)}</span>
                    </div>
                  )}

                  {/* Цвет + Пол + Длина */}
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Цвет</label>
                      <input
                        {...register(`items.${idx}.color`)}
                        disabled={!editable}
                        className={styles.input}
                        placeholder="Тёмно-синий, бордо..."
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Пол</label>
                      <Controller control={control} name={`items.${idx}.gender`} render={({ field: f }) => (
                        <select {...f} disabled={!editable} className={styles.select}>
                          <option value="">— не указан —</option>
                          <option value="муж">Мужской</option>
                          <option value="жен">Женский</option>
                          <option value="унисекс">Унисекс</option>
                        </select>
                      )} />
                    </div>
                  </div>
                  <div className={styles.itemRow2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Длина</label>
                      <input
                        {...register(`items.${idx}.length`)}
                        disabled={!editable}
                        className={styles.input}
                        placeholder="Макси, 120 см..."
                      />
                    </div>
                    <div className={styles.field} />
                  </div>

                  <div className={styles.itemNoteField}>
                    <input
                      {...register(`items.${idx}.workshopNotes`)}
                      disabled={!editable}
                      className={styles.itemNoteInput}
                      placeholder="Комментарий для цеха (необязательно)..."
                    />
                  </div>
                </div>
              );
            })}

            {(canEditItems || isInProduction) && (
              <div className={styles.itemsFooter}>
                <button
                  type="button"
                  className={styles.addItemBtn}
                  onClick={() => append({ productName: '', size: '', quantity: 1, unitPrice: 0, color: '', gender: '', length: '', workshopNotes: '' })}
                >
                  <Plus size={13} />
                  Добавить позицию
                </button>
                {itemsTotal > 0 && (
                  <div className={styles.itemsTotal}>
                    <span>Итого по позициям:</span>
                    <strong>{fmt(itemsTotal)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── 03 Сроки и приоритет ──────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>03</span>
            <span className={styles.sectionTitle}>Сроки и приоритет</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Срок готовности</label>
                <input {...register('dueDate')} type="date" className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Приоритет</label>
                <div className={styles.priorityGroup}>
                  <button
                    type="button"
                    className={`${styles.priorityBtn} ${urgency === 'normal' ? styles.priorityBtnActive : ''}`}
                    onClick={() => setValue('urgency', 'normal')}
                  >
                    Обычный
                  </button>
                  <button
                    type="button"
                    className={`${styles.priorityBtn} ${styles.priorityBtnUrgent} ${urgency === 'urgent' ? styles.priorityBtnActive : ''}`}
                    onClick={() => setValue('urgency', 'urgent')}
                  >
                    🔴 Срочно
                  </button>
                </div>
                <label className={styles.demandingToggle}>
                  <input
                    type="checkbox"
                    checked={isDemandingClient}
                    onChange={e => setValue('isDemandingClient', e.target.checked)}
                    className={styles.demandingCheckbox}
                  />
                  <span>⭐ Требовательный клиент</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* ── 04 Финансы ────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>04</span>
            <span className={styles.sectionTitle}>Финансы</span>
          </div>
          <div className={styles.sectionBody}>

            {/* Доставка */}
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Способ доставки</label>
                <Controller control={control} name="deliveryType" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={deliveryOptions} placeholder="Выберите или введите" className={styles.input} />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Сумма доставки (₸)</label>
                <Controller control={control} name="deliveryFee" render={({ field }) => (
                  <input
                    type="number" min="0" inputMode="numeric"
                    className={styles.input}
                    placeholder="0 ₸"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(parseOptionalAmount(e.target.value))}
                    onWheel={e => e.currentTarget.blur()}
                    onFocus={e => e.target.select()}
                  />
                )} />
              </div>
            </div>

            {/* Финансовый пайплайн */}
            <div className={styles.finPipeline}>

              {/* Сумма по позициям */}
              <div className={styles.finRow}>
                <div>
                  <span className={styles.finLabel}>Сумма по позициям</span>
                  {items.length > 0 && (
                    <div className={styles.finLabelSub}>
                      {items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}
                      {' · '}
                      {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} шт.
                    </div>
                  )}
                </div>
                <span className={styles.finValue}>{itemsTotal > 0 ? fmt(itemsTotal) : '—'}</span>
              </div>

              {/* Скидка */}
              <div className={styles.finRow}>
                <span className={styles.finLabel}>Скидка</span>
                <div className={styles.discountCompound}>
                  <Controller control={control} name="orderDiscount" render={({ field }) => (
                    <input
                      type="number" min="0" inputMode="numeric"
                      className={`${styles.finInput} ${styles.discountAmtInput}`}
                      placeholder="0 ₸"
                      value={field.value ?? ''}
                      onChange={e => {
                        const amt = parseOptionalAmount(e.target.value);
                        field.onChange(amt);
                        if (itemsTotal > 0 && Number.isFinite(amt) && (amt ?? 0) > 0) {
                          setDiscountPercent(((amt! / itemsTotal) * 100).toFixed(1));
                        } else { setDiscountPercent(''); }
                      }}
                      onWheel={e => e.currentTarget.blur()}
                      onFocus={e => e.target.select()}
                    />
                  )} />
                  <div className={styles.discountPctWrap}>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      className={styles.discountPctInput}
                      placeholder="0"
                      value={discountPercent}
                      onChange={e => {
                        setDiscountPercent(e.target.value);
                        const pct = parseFloat(e.target.value);
                        if (Number.isFinite(pct) && itemsTotal > 0) {
                          setValue('orderDiscount', Math.round(itemsTotal * pct / 100));
                        } else if (!e.target.value) { setValue('orderDiscount', 0); }
                      }}
                      onWheel={e => e.currentTarget.blur()}
                      onFocus={e => e.target.select()}
                    />
                    <span className={styles.discountPctSymbol}>%</span>
                  </div>
                </div>
              </div>

              {/* Банковская комиссия */}
              <div className={styles.finRow}>
                <span className={styles.finLabel}>Комиссия банка</span>
                <div className={styles.discountCompound}>
                  <div className={styles.finValue} style={{ minWidth: 80 }}>
                    {bankCommAmount > 0 ? fmt(bankCommAmount) : '—'}
                  </div>
                  {editingRate ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div className={styles.discountPctWrap}>
                        <input
                          type="number" min="0" max="100" step="0.1"
                          className={styles.discountPctInput}
                          placeholder="0"
                          value={rateInput}
                          autoFocus
                          onChange={e => {
                            setRateInput(e.target.value);
                            const v = parseFloat(e.target.value);
                            setValue('bankCommissionPercent', isNaN(v) ? undefined : Math.min(100, Math.max(0, v)));
                          }}
                          onWheel={e => e.currentTarget.blur()}
                          onFocus={e => e.target.select()}
                        />
                        <span className={styles.discountPctSymbol}>%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const v = parseFloat(rateInput);
                          const safe = isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
                          setValue('bankCommissionPercent', safe || undefined);
                          updateBankCommission.mutate(safe);
                          setEditingRate(false);
                        }}
                        style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, background: 'var(--fill-accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >Сохранить</button>
                      <button
                        type="button"
                        onClick={() => setEditingRate(false)}
                        style={{ padding: '4px 8px', fontSize: 12, background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                      >Отмена</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: (bankCommPctRaw ?? 0) > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {(bankCommPctRaw ?? 0) > 0 ? `${bankCommPctRaw}%` : '—'}
                      </span>
                      <button
                        type="button"
                        title="Изменить ставку комиссии"
                        onClick={() => { setRateInput((bankCommPctRaw ?? 0) > 0 ? String(bankCommPctRaw) : ''); setEditingRate(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', color: 'var(--text-tertiary)', borderRadius: 4 }}
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Итого к оплате */}
              <div className={`${styles.finRow} ${styles.finRowTotal}`}>
                <span className={styles.finLabel}>Итого к оплате</span>
                <span className={styles.finValueBold}>{itemsTotal > 0 ? fmt(finalTotal) : '—'}</span>
              </div>

              {/* Предоплата */}
              <div className={styles.finRow}>
                <span className={styles.finLabel}>Предоплата</span>
                <Controller control={control} name="prepayment" render={({ field }) => (
                  <input
                    type="number" min="0" max={finalTotal || undefined} inputMode="numeric"
                    className={`${styles.finInput} ${errors.prepayment ? styles.inputError : ''}`}
                    placeholder="0 ₸"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                  />
                )} />
                {errors.prepayment && <span className={styles.fieldError}>{errors.prepayment.message}</span>}
              </div>
              <div className={`${styles.finRow} ${styles.finRowBalance}`}>
                <span className={styles.finLabel}>Остаток</span>
                <span className={finalTotal > 0 && debt > 0 ? styles.finValueDebt : styles.finValue}>
                  {finalTotal > 0 ? fmt(debt) : '—'}
                </span>
              </div>

            </div>

            {/* Способ оплаты */}
            <div className={styles.field}>
              <label className={styles.label}>
                Способ оплаты
                {prepayment > 0 && <span className={styles.req}> *</span>}
              </label>
              <div className={styles.payMethodBtns}>
                {activePaymentMethods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={[
                      styles.payMethodBtn,
                      paymentMethod === m.value ? styles.payMethodBtnActive : '',
                      m.value === 'mixed' ? styles.payMethodBtnMixed : '',
                    ].join(' ')}
                    onClick={() => setValue('paymentMethod', paymentMethod === m.value ? undefined : m.value as typeof paymentMethod)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {errors.paymentMethod && <span className={styles.fieldError}>{errors.paymentMethod.message}</span>}
            </div>

            {/* Ожидаемый способ доплаты */}
            <div className={styles.field}>
              <label className={styles.label}>Ожидаемый способ доплаты</label>
              <Controller control={control} name="expectedPaymentMethod" render={({ field }) => (
                <SelectOrText
                  {...field}
                  value={field.value ?? ''}
                  options={activePaymentMethods.map(m => m.label)}
                  placeholder="Как клиент заплатит остаток..."
                  className={styles.input}
                />
              )} />
            </div>

            {/* Смешанный — разбивка */}
            {paymentMethod === 'mixed' && (
              <div className={styles.mixedBreakdown}>
                <div className={styles.mixedBreakdownTitle}>Разбивка по способам оплаты</div>
                {mixedBreakdownRows.map((m) => (
                  <div key={m.value} className={styles.mixedRow}>
                    <span className={styles.mixedLabel}>{m.label}</span>
                    <Controller control={control} name={`paymentBreakdown.${m.value}`} render={({ field }) => (
                      <input
                        type="number" min="0" inputMode="numeric"
                        className={styles.mixedInput}
                        placeholder="0 ₸"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        onFocus={(e) => e.target.select()}
                      />
                    )} />
                  </div>
                ))}
                {mixedSum > 0 && (
                  <div className={styles.mixedTotal}>
                    Итого в разбивке: <strong>{fmt(mixedSum)}</strong>
                    {prepayment > 0 && Math.abs(mixedSum - prepayment) > 1 && (
                      <span className={styles.mixedMismatch}> ≠ предоплата {fmt(prepayment)}</span>
                    )}
                  </div>
                )}
                {(errors as any).paymentBreakdown?.message && <span className={styles.fieldError}>{(errors as any).paymentBreakdown.message}</span>}
              </div>
            )}

          </div>
        </section>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate(`/workzone/chapan/orders/${id}`)}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || updateOrder.isPending || requestItemChange.isPending}
          >
            {updateOrder.isPending || requestItemChange.isPending
              ? 'Сохранение...'
              : isInProduction
                ? 'Сохранить / Запросить изменения'
                : 'Сохранить изменения'}
          </button>
        </div>

      </form>

      {/* ── Change Request Confirmation Modal ──────────────────────────────── */}
      {changeRequestModal && pendingFormData && (() => {
        // Compute diff: which items are new vs existing
        function itemKey(productName: string, size: string) {
          return `${productName}|${size}`;
        }
        const existingKeys = new Set((order.items ?? []).map(i => itemKey(i.productName, i.size)));
        const newItems = pendingFormData.items.filter(i => !existingKeys.has(itemKey(i.productName, i.size)));
        const changedItems = pendingFormData.items.filter(i => {
          if (!existingKeys.has(itemKey(i.productName, i.size))) return false;
          const orig = order.items.find(o => itemKey(o.productName, o.size) === itemKey(i.productName, i.size));
          return orig && (orig.quantity !== i.quantity || orig.unitPrice !== i.unitPrice);
        });

        return (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
            onClick={() => setChangeRequestModal(false)}
          >
            <div
              style={{
                background: 'var(--ch-surface)', border: '1px solid var(--ch-border)',
                borderRadius: 14, width: '100%', maxWidth: 460, padding: 24,
                display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D94F4F', fontWeight: 600, fontSize: 15 }}>
                  <AlertTriangle size={18} />
                  Запрос на изменение позиций
                </div>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ch-text-muted)', padding: 4 }}
                  onClick={() => setChangeRequestModal(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--ch-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Заказ уже в производстве. Данные клиента и приоритет сохранятся сразу.
                Изменения <strong>позиций</strong> уйдут на согласование в цех — швея продолжит работу,
                новые задания появятся автоматически после одобрения.
              </p>

              {/* Diff summary */}
              {(newItems.length > 0 || changedItems.length > 0) && (
                <div style={{
                  background: 'var(--ch-surface-inset)', borderRadius: 9,
                  border: '1px solid var(--ch-border)', padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ch-text-muted)', marginBottom: 2 }}>
                    Что изменится
                  </div>
                  {newItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ch-text)' }}>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>+</span>
                      <span>{item.productName} / {item.size} × {item.quantity}</span>
                      <span style={{ color: 'var(--ch-text-muted)', marginLeft: 'auto' }}>новая</span>
                    </div>
                  ))}
                  {changedItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ch-text)' }}>
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>~</span>
                      <span>{item.productName} / {item.size} × {item.quantity}</span>
                      <span style={{ color: 'var(--ch-text-muted)', marginLeft: 'auto' }}>цена/кол-во</span>
                    </div>
                  ))}
                </div>
              )}

              {newItems.length === 0 && changedItems.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ch-text-muted)', background: 'var(--ch-surface-inset)', borderRadius: 8, padding: '10px 12px' }}>
                  Позиции не изменились — будут сохранены только данные клиента и приоритет без запроса в цех.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ch-text-muted)' }}>
                  Пояснение для цеха (необязательно)
                </label>
                <input
                  value={managerNote}
                  onChange={e => setManagerNote(e.target.value)}
                  placeholder="Например: клиент добавил жилет..."
                  autoFocus
                  style={{
                    background: 'var(--ch-surface-inset)', border: '1px solid var(--ch-border)',
                    borderRadius: 8, color: 'var(--ch-text)', fontFamily: 'inherit',
                    fontSize: 13, padding: '9px 12px', outline: 'none',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitChangeRequest()}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    flex: 1, padding: '9px 0', background: 'var(--ch-surface-inset)',
                    border: '1px solid var(--ch-border)', borderRadius: 8,
                    color: 'var(--ch-text-secondary)', fontFamily: 'inherit',
                    fontSize: 13, cursor: 'pointer',
                  }}
                  onClick={() => setChangeRequestModal(false)}
                >
                  Отмена
                </button>
                <button
                  style={{
                    flex: 2, padding: '9px 0',
                    background: newItems.length > 0 || changedItems.length > 0 ? '#D94F4F' : 'var(--ch-accent)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    fontWeight: 600, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                    opacity: requestItemChange.isPending || updateOrder.isPending ? .6 : 1,
                  }}
                  onClick={handleSubmitChangeRequest}
                  disabled={requestItemChange.isPending || updateOrder.isPending}
                >
                  {requestItemChange.isPending || updateOrder.isPending
                    ? 'Отправка...'
                    : newItems.length > 0 || changedItems.length > 0
                      ? 'Отправить запрос в цех'
                      : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
