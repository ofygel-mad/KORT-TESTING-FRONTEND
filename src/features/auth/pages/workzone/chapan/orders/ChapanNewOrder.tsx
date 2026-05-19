import type { InputHTMLAttributes } from 'react';
import { forwardRef, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, AlertTriangle, ImagePlus, Pencil, Plus, Star, Trash2, Calculator, Paperclip, X } from 'lucide-react';
import { useId } from 'react';
import { useCreateOrder, useChapanCatalogs, useChapanProfile, useUpdateBankCommission } from '@/entities/order/queries';
import { useAuthStore } from '../../../../shared/stores/auth';
import { useProductsAvailability, useVariantAvailability, useOrderFormCatalog, useCatalogDefinitions } from '@/entities/warehouse/queries';
import type { OrderFormField } from '@/entities/warehouse/types';
import { attachmentsApi } from '@/entities/order/api';
import type { Urgency } from '@/entities/order/types';
import {
  buildDeliveryOptions,
  buildMixedBreakdownRows,
  buildPaymentMethodOptions,
  buildSizeCatalog,
} from '../../../../shared/lib/chapanCatalogDefaults';
import { calculateChapanOrderFinancials } from '@/shared/lib/chapanFinancials';
import { SearchableSelect, type SearchableSelectOption } from '../../../../shared/ui/SearchableSelect';
import { formatPersonNameInput } from '../../../../shared/utils/person';
import { formatKazakhPhoneInput, isKazakhPhoneComplete } from '../../../../shared/utils/kz';
import { buildVariantAvailabilityInput, buildVariantLookupKey, type VariantAvailabilityInput } from '../../../../shared/utils/variantAvailability';
import styles from './ChapanNewOrder.module.css';

// ─── Draft autosave ───────────────────────────────────────────────────────────
function draftKey(userId?: string) {
  return `chapan_new_order_draft_${userId ?? 'guest'}`;
}

function loadDraft(userId?: string): Partial<FormData> | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? sanitizeDraft(JSON.parse(raw) as Partial<FormData>) : null;
  } catch {
    return null;
  }
}

function saveDraft(data: Partial<FormData>, userId?: string) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(sanitizeDraft(data)));
  } catch { /* ignore */ }
}

function clearDraft(userId?: string) {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch { /* ignore */ }
}

// ─── Payment methods ──────────────────────────────────────────────────────────
type PaymentMethodValue = 'cash' | 'kaspi_terminal' | 'transfer' | 'halyk' | 'mixed';

// ─── Schemas ──────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  productName:  z.string().min(1, 'Укажите модель'),
  gender:       z.enum(['муж', 'жен', '']).optional(),
  length:       z.string().optional(),
  color:        z.string().optional(),
  size:         z.string().min(1, 'Укажите размер'),
  quantity:     z.coerce.number().int().min(1).max(10000, 'Подозрительно большое количество'),
  // Hard cap on unit price catches typo'd extra zeros (50000 → 5000000 → 50000000).
  // 5М ₸/ед is well above any plausible chapan price; if a real product needs
  // more, raise the cap deliberately.
  unitPrice:    z.coerce.number().min(0).max(5_000_000, 'Цена слишком большая — проверьте, нет ли лишних нулей').optional().default(0),
  itemDiscount: z.coerce.number().min(0).optional().default(0),
  workshopNotes: z.string().optional(),
});

const schema = z
  .object({
    clientName:   z.string().min(2, 'Минимум 2 символа'),
    clientPhone:  z.string().optional().default(''),
    clientPhoneForeign: z.string().optional(),
    city:          z.string().optional(),
    streetAddress: z.string().optional(),
    postalCode:    z.string().optional(),
    deliveryType:  z.string().optional(),
    source:       z.string().optional(),
    urgency:      z.enum(['normal', 'urgent']).default('normal'),
    isDemandingClient: z.boolean().default(false),
    orderDate:    z.string(),
    dueDate:      z.string().optional(),
    orderDiscount: z.coerce.number().min(0).optional(),
    deliveryFee:   z.coerce.number().min(0).optional(),
    bankCommissionPercent: z.coerce.number().min(0).max(100).optional(),
    prepayment:   z.coerce.number().min(0).optional(),
    paymentMethod: z.enum(['cash', 'kaspi_terminal', 'transfer', 'halyk', 'mixed']).optional(),
    // Tolerate empty inputs / partial typing: drop blank keys before coercion so
    // RHF-registered Controllers that hold "" don't blow up zod with "received nan".
    paymentBreakdown: z
      .record(z.string(), z.union([z.string(), z.number(), z.null(), z.undefined()]))
      .optional()
      .transform((raw) => {
        if (!raw) return undefined;
        const cleaned: Record<string, number> = {};
        for (const [key, value] of Object.entries(raw)) {
          if (value === undefined || value === null || value === '') continue;
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) continue;
          cleaned[key] = n;
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
      }),
    expectedPaymentMethod: z.string().optional(),
    items:        z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
    managerNote:  z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasKzPhone = isKazakhPhoneComplete(data.clientPhone ?? '');
    const hasForeignPhone = !!(data.clientPhoneForeign?.trim());
    if (!hasKzPhone && !hasForeignPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите казахстанский или иностранный номер', path: ['clientPhone'] });
    } else if ((data.clientPhone ?? '') && !hasKzPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Введите номер в формате +7 (777)-777-77-77', path: ['clientPhone'] });
    }

    const itemsSubtotal = data.items.reduce((sum, item) => {
      return sum + Math.max(0,
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.itemDiscount) || 0),
      );
    }, 0);
    const financials = calculateChapanOrderFinancials({
      itemsSubtotal,
      orderDiscount: data.orderDiscount,
      deliveryFee: data.deliveryFee,
      bankCommissionPercent: data.bankCommissionPercent,
    });
    const finalTotal = financials.totalDue;

    if ((data.prepayment ?? 0) > 0 && !data.paymentMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите способ оплаты', path: ['paymentMethod'] });
    }

    if ((data.prepayment ?? 0) > finalTotal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Предоплата не может превышать итоговую сумму', path: ['prepayment'] });
    }

    if (data.paymentMethod === 'mixed' && (data.prepayment ?? 0) > 0) {
      const mixedSum = Object.values(data.paymentBreakdown ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
      if (mixedSum > 0 && Math.abs(mixedSum - (data.prepayment ?? 0)) > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Сумма разбивки должна совпадать с предоплатой', path: ['paymentBreakdown'] });
      }
    }
  });

type FormData = z.infer<typeof schema>;

export function sanitizeDraft(data: Partial<FormData>): Partial<FormData> {
  return {
    ...data,
    items: (data.items ?? []).map((item) => ({
      ...item,
      workshopNotes: '',
    })),
  };
}

function createEmptyItem(): FormData['items'][number] {
  return {
    productName: '',
    gender: '',
    length: '',
    color: '',
    size: '',
    quantity: 1,
    unitPrice: undefined,
    itemDiscount: undefined,
    workshopNotes: '',
  } as unknown as FormData['items'][number];
}

function createEmptyFormDefaults(): Partial<FormData> {
  return {
    clientName: '',
    clientPhone: '',
    clientPhoneForeign: '',
    city: '',
    streetAddress: '',
    postalCode: '',
    deliveryType: '',
    source: '',
    urgency: 'normal',
    isDemandingClient: false,
    orderDate: todayIso(),
    dueDate: '',
    orderDiscount: undefined,
    deliveryFee: undefined,
    bankCommissionPercent: undefined,
    prepayment: undefined,
    paymentMethod: undefined,
    paymentBreakdown: undefined,
    expectedPaymentMethod: '',
    items: [createEmptyItem()],
    managerNote: '',
  } as unknown as Partial<FormData>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CITIES   = ['Алматы', 'Астана', 'Шымкент', 'Атырау', 'Актобе', 'Тараз', 'Павлодар', 'Другой город'];
const SOURCES  = ['Instagram', 'WhatsApp', 'Telegram', 'Звонок', 'Рекомендация', 'Сайт', 'Другое'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalAmount(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function buildPayloadItems(items: FormData['items']) {
  return items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = quantity * unitPrice;
    // Keep order-level discount separate; only per-item discount is baked into item price.
    const itemDiscount = Math.min(Number(item.itemDiscount) || 0, lineTotal);
    const finalLineTotal = Math.max(0, lineTotal - itemDiscount);
    const effectiveUnitPrice = quantity > 0
      ? Number((finalLineTotal / quantity).toFixed(4))
      : 0;

    return {
      productName: item.productName,
      color: item.color?.trim() || undefined,
      gender: item.gender?.trim() || undefined,
      length: item.length?.trim() || undefined,
      size: item.size,
      quantity,
      unitPrice: effectiveUnitPrice,
      workshopNotes: item.workshopNotes || undefined,
    };
  });
}

const SelectOrText = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { options: string[] }>(
  function SelectOrText({ options, placeholder, className, ...props }, ref) {
    const id = useId();
    return (
      <>
        <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
        <input {...props} ref={ref} list={id} placeholder={placeholder} className={className} autoComplete="off" />
      </>
    );
  },
);



// ─── Component ────────────────────────────────────────────────────────────────
export default function ChapanNewOrderPage() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const isWholesale = searchParams.get('type') === 'wholesale';
  const createOrder = useCreateOrder();
  const { data: catalogs } = useChapanCatalogs();
  const { data: profile } = useChapanProfile();
  const updateBankCommission = useUpdateBankCommission();

  const [discountPercent, setDiscountPercent] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [bankCommissionPrefilled, setBankCommissionPrefilled] = useState(false);

  // File state — UI selection only; server upload endpoint not yet implemented.
  // receiptFileNames sends file names to order metadata; actual bytes are not persisted yet.
  const [itemPhotos, setItemPhotos] = useState<Record<number, File | null>>({});
  const [receipts, setReceipts]     = useState<File[]>([]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const savedDraft = useRef(loadDraft(userId));

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: savedDraft.current ?? createEmptyFormDefaults(),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Draft autosave — дебаунс 800 мс, не сохраняем пустой стартовый стейт
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveEnabledRef = useRef(true);
  // Autosave: subscribe to form changes via watch callback (RHF v7 pattern)
  // Avoids JSON.stringify(watch()) in dep array which re-renders on every keystroke
  useEffect(() => {
    const { unsubscribe } = watch((snapshot) => {
      if (!autosaveEnabledRef.current) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        const isEmpty =
          !snapshot.clientName &&
          !snapshot.clientPhone &&
          (snapshot.items ?? []).every((i) => !i.productName && !i.size);
        if (!isEmpty) saveDraft(snapshot as Partial<FormData>, userId);
      }, 800);
    });
    return () => {
      unsubscribe();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [watch, userId]);

  const deliveryType          = watch('deliveryType');
  const deliveryFeeRaw        = watch('deliveryFee');
  const bankCommissionPctRaw  = watch('bankCommissionPercent');

  const deliveryFeeMap: Record<string, number> = {
    'Казпочта': profile?.kazpostDeliveryFee ?? 2000,
    'Жд':       profile?.railDeliveryFee    ?? 3000,
    'Авиа':     profile?.airDeliveryFee     ?? 5000,
  };

  // F3: Автоматически проставляем сумму доставки при выборе типа
  useEffect(() => {
    const autoFee = deliveryFeeMap[deliveryType ?? ''];
    if (autoFee !== undefined && deliveryFeeRaw == null && !dirtyFields.deliveryFee) {
      setValue('deliveryFee', autoFee, { shouldDirty: false, shouldTouch: false });
    }
  }, [deliveryType, deliveryFeeRaw, dirtyFields.deliveryFee, profile?.kazpostDeliveryFee, profile?.railDeliveryFee, profile?.airDeliveryFee, setValue]);

  // Авто-подстановка глобальной ставки комиссии если поле пустое
  useEffect(() => {
    if (
      profile?.bankCommissionPercent != null
      && bankCommissionPctRaw == null
      && !dirtyFields.bankCommissionPercent
      && !bankCommissionPrefilled
    ) {
      setValue('bankCommissionPercent', profile.bankCommissionPercent, { shouldDirty: false, shouldTouch: false });
      setBankCommissionPrefilled(true);
    }
  }, [bankCommissionPctRaw, bankCommissionPrefilled, dirtyFields.bankCommissionPercent, profile?.bankCommissionPercent, setValue]);

  // Показываем тост один раз, если черновик был восстановлен
  useEffect(() => {
    if (savedDraft.current && !draftRestored) {
      setDraftRestored(true);
    }
  }, []);

  // Derived values
  const items            = watch('items');
  const urgency          = watch('urgency');
  const isDemandingClient = watch('isDemandingClient');
  const { data: orderFormCatalog } = useOrderFormCatalog();
  const { data: fieldDefinitions } = useCatalogDefinitions();
  const warehouseProductMap = useMemo<Record<string, OrderFormField[]>>(() => {
    const map: Record<string, OrderFormField[]> = {};
    for (const product of orderFormCatalog?.products ?? []) {
      map[product.name] = product.fields;
    }
    return map;
  }, [orderFormCatalog]);
  const deferredProductNames = useDeferredValue(
    items.map((i) => i.productName).filter(Boolean),
  );
  const availabilityVariants = items
    .map((item) => buildVariantAvailabilityInput(
      item.productName?.trim() ?? '',
      item,
      getEffectiveFields(item.productName?.trim() ?? ''),
    ))
    .filter((variant): variant is VariantAvailabilityInput => Boolean(variant));
  const { data: stockMap } = useProductsAvailability(deferredProductNames);
  const { data: variantMap } = useVariantAvailability(availabilityVariants);

  // True if any catalog-registered item with variant axes hasn't filled them all —
  // submit must wait. Free-text product names (not in warehouseProductMap) are skipped:
  // the warehouse can't validate them, so the manager keeps full agency.
  const hasIncompleteVariantLines = useMemo(() => {
    for (const item of items) {
      if (!item?.productName?.trim()) continue;
      const fields = warehouseProductMap[item.productName.trim()];
      if (!fields) continue;
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) continue;
      const incomplete = required.some((f) => {
        const value = (item as Record<string, unknown>)[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
      if (incomplete) return true;
    }
    return false;
  }, [items, warehouseProductMap]);
  const paymentMethod    = watch('paymentMethod');
  const orderDiscountRaw = watch('orderDiscount');
  const prepaymentRaw    = watch('prepayment');
  const paymentBreakdownWatch = watch('paymentBreakdown');

  const itemsTotal = items.reduce((sum, item) => {
    const line = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    return sum + Math.max(0, line - (Number(item.itemDiscount) || 0));
  }, 0);

  const orderDiscount       = Number.isFinite(orderDiscountRaw)       ? (orderDiscountRaw       ?? 0) : 0;
  const prepayment          = Number.isFinite(prepaymentRaw)          ? (prepaymentRaw          ?? 0) : 0;
  const deliveryFee         = Number.isFinite(deliveryFeeRaw)         ? (deliveryFeeRaw         ?? 0) : 0;
  const bankCommissionPct   = Number.isFinite(bankCommissionPctRaw)   ? (bankCommissionPctRaw   ?? 0) : 0;

  // F1: правильный порядок вычислений
  const financials = calculateChapanOrderFinancials({
    itemsSubtotal: itemsTotal,
    orderDiscount,
    deliveryFee,
    bankCommissionPercent: bankCommissionPct,
  });
  const bankCommissionAmount  = financials.bankCommissionAmount;
  const finalTotal            = financials.totalDue;
  const debt                  = Math.max(0, finalTotal - prepayment);
  const mixedSum = Object.values(paymentBreakdownWatch ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);

  function fmt(n: number) {
    return `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n)} ₸`;
  }

  // Stable idempotency key: generated once per form mount, reused on retries,
  // rotated only after a successful submission to allow creating another order.
  const idemKeyRef = useRef(crypto.randomUUID());

  function stopDraftAutosave() {
    autosaveEnabledRef.current = false;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }

  function resetDraftState() {
    stopDraftAutosave();
    clearDraft(userId);
    savedDraft.current = null;
    reset(createEmptyFormDefaults());
    // Explicitly clear nested paymentBreakdown subkeys: reset() with paymentBreakdown=undefined
    // does NOT walk into already-registered child fields like paymentBreakdown.cash.
    setValue('paymentBreakdown', {} as FormData['paymentBreakdown']);
    setDiscountPercent('');
    setEditingRate(false);
    setRateInput('');
    setItemPhotos({});
    setReceipts([]);
    if (receiptInputRef.current) {
      receiptInputRef.current.value = '';
    }
    setDraftRestored(false);
    // Keep prefill flag TRUE so the bankCommissionPercent autoeffect doesn't
    // immediately repopulate the field from profile after the user explicitly
    // asked to clear the draft. Same goes for the deliveryFee autoeffect —
    // it depends on deliveryType which is now '' so it's already inert.
    setBankCommissionPrefilled(true);
    autosaveEnabledRef.current = true;
  }

  // Surface zod/RHF validation failures so a "dead" submit button always tells
  // the user (and the console) what's wrong instead of silently doing nothing.
  function onValidationError(formErrors: Record<string, unknown>) {
    const flat: string[] = [];
    const walk = (node: unknown, path: string[]) => {
      if (!node || typeof node !== 'object') return;
      if ('message' in (node as Record<string, unknown>) && typeof (node as { message?: unknown }).message === 'string') {
        flat.push(`${path.join('.') || '(form)'}: ${(node as { message: string }).message}`);
      }
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (key === 'message' || key === 'type' || key === 'ref') continue;
        walk(val, [...path, key]);
      }
    };
    walk(formErrors, []);
    console.warn('[ChapanNewOrder] form validation failed:', formErrors);
    if (flat.length > 0) {
      toast.error(`Проверьте поля: ${flat.slice(0, 3).join('; ')}${flat.length > 3 ? `; +${flat.length - 3} ещё` : ''}`);
    } else {
      toast.error('Форма заполнена некорректно');
    }
  }

  async function onSubmit(data: FormData) {
    // Block creation only when a CATALOG-REGISTERED variant-bearing line has incomplete axes.
    // Free-text product names are not validated here — warehouse has no SKU to match against.
    const incompleteLines: number[] = [];
    for (let i = 0; i < data.items.length; i += 1) {
      const item = data.items[i];
      if (!item?.productName?.trim()) continue;
      const fields = warehouseProductMap[item.productName.trim()];
      if (!fields) continue;
      const required = fields.filter((f) => f.affectsAvailability);
      if (required.length === 0) continue;
      const missing = required.filter((f) => {
        const value = (item as Record<string, unknown>)[f.code];
        return !value || (typeof value === 'string' && !value.trim());
      });
      if (missing.length > 0) incompleteLines.push(i + 1);
    }
    if (incompleteLines.length > 0) {
      toast.error(`Заполните параметры (цвет, размер, длина, пол) для позиций: ${incompleteLines.join(', ')}`);
      return;
    }

    const hasPrepayment = (data.prepayment ?? 0) > 0;
    const isMixed = data.paymentMethod === 'mixed';
    const payloadItems = buildPayloadItems(data.items);

    let created;
    try {
      created = await createOrder.mutateAsync({
        idempotencyKey: idemKeyRef.current,
        clientName:    formatPersonNameInput(data.clientName).trim(),
        clientPhone:   data.clientPhone ? formatKazakhPhoneInput(data.clientPhone) : '',
        clientPhoneForeign: data.clientPhoneForeign?.trim() || undefined,
        streetAddress: data.streetAddress?.trim() || undefined,
        city:          data.city?.trim() || undefined,
        deliveryType:  data.deliveryType?.trim() || undefined,
        source:        data.source?.trim() || undefined,
        expectedPaymentMethod: data.expectedPaymentMethod?.trim() || undefined,
        priority:      data.urgency === 'urgent' ? 'urgent' : data.isDemandingClient ? 'vip' : 'normal',
        urgency:       data.urgency as Urgency,
        isDemandingClient: data.isDemandingClient,
        postalCode:    data.postalCode?.trim() || undefined,
        orderDate:     data.orderDate || undefined,
        orderDiscount: orderDiscount > 0 ? orderDiscount : undefined,
        deliveryFee:   deliveryFee > 0 ? deliveryFee : undefined,
        bankCommissionPercent: bankCommissionPct > 0 ? bankCommissionPct : undefined,
        bankCommissionAmount:  bankCommissionAmount > 0 ? bankCommissionAmount : undefined,
        dueDate:       data.dueDate   || undefined,
        prepayment:       hasPrepayment ? data.prepayment : undefined,
        paymentMethod:    hasPrepayment ? data.paymentMethod : undefined,
        paymentBreakdown: hasPrepayment && isMixed
          ? Object.fromEntries(Object.entries(data.paymentBreakdown ?? {}).filter(([, v]) => Number(v) > 0))
          : undefined,
        items: payloadItems,
        managerNote: data.managerNote?.trim() || undefined,
        customerType: isWholesale ? 'wholesale' : 'retail',
      });
    } catch {
      return;
    }

    if (receipts.length > 0 && created?.id) {
      for (const file of receipts) {
        try {
          await attachmentsApi.upload(created.id, file);
        } catch {
          // non-blocking: order already saved, file upload failure is recoverable
        }
      }
    }

    // Rotate the key so the next order from this session gets its own unique key
    idemKeyRef.current = crypto.randomUUID();
    resetDraftState();
    navigate('/workzone/chapan/orders');
  }

  const products             = catalogs?.productCatalog ?? [];
  const catalogPaymentMethods = catalogs?.paymentMethodCatalog ?? [];
  const activePaymentMethods  = buildPaymentMethodOptions(catalogPaymentMethods)
    .filter((method) => method.value !== 'kaspi_qr');
  const mixedBreakdownRows    = buildMixedBreakdownRows(catalogPaymentMethods)
    .filter((method) => method.value !== 'kaspi_qr');
  const sizeOptions           = buildSizeCatalog(catalogs?.sizeCatalog ?? []);
  const deliveryOptions       = buildDeliveryOptions();

  useEffect(() => {
    // Guard against stale local drafts created before Kaspi QR was removed.
    if ((paymentMethod as string | undefined) === 'kaspi_qr') {
      setValue('paymentMethod', undefined);
    }
    if (paymentBreakdownWatch?.kaspi_qr !== undefined) {
      setValue('paymentBreakdown.kaspi_qr', undefined);
    }
  }, [paymentMethod, paymentBreakdownWatch?.kaspi_qr, setValue]);

  const warehouseProductNames = Object.keys(warehouseProductMap);
  // Merged product list: chapan catalog + warehouse catalog (deduped)
  const allProductNames = [...new Set([...products, ...warehouseProductNames])];
  const enrichedProductOptions: SearchableSelectOption[] = allProductNames.map(name => ({ value: name }));

  // Global color options from warehouse field definitions (fallback when product has no linked color field)
  const globalWarehouseColors = fieldDefinitions?.find(d => d.code === 'color')?.options.map(o => o.label) ?? [];
  // Global length options from warehouse field definitions (single source of truth)
  const globalWarehouseLengths = fieldDefinitions?.find(d => d.code === 'length')?.options.map(o => o.label) ?? [];

  // When a product has no per-product order form config, fall back to global field definitions
  // so that non-axis fields like gender are correctly excluded from the variant lookup key.
  function getEffectiveFields(productName: string) {
    return warehouseProductMap[productName?.trim() ?? '']
      ?? fieldDefinitions?.map(def => ({
          code: def.code,
          label: def.label,
          inputType: def.inputType,
          isRequired: false as const,
          affectsAvailability: def.affectsAvailability,
          options: [] as Array<{ value: string; label: string }>,
        }));
  }

  function getAvailabilityInput(item?: FormData['items'][number]) {
    if (!item?.productName?.trim()) return null;
    return buildVariantAvailabilityInput(
      item.productName.trim(),
      item,
      getEffectiveFields(item.productName.trim()),
    );
  }

  function getMissingAxes(item?: FormData['items'][number]): OrderFormField[] {
    if (!item?.productName?.trim()) return [];
    // Submit-gate only applies to products registered in the warehouse catalog.
    // Free-text product names (not in warehouseProductMap) skip variant validation —
    // there's nothing to look up against, so the manager owns the choice.
    const fields = warehouseProductMap[item.productName.trim()];
    if (!fields) return [];
    const required = fields.filter((f) => f.affectsAvailability);
    return required.filter((f) => {
      const value = (item as Record<string, unknown>)[f.code];
      return !value || (typeof value === 'string' && !value.trim());
    });
  }
  // Helper: get catalog options for a field code given current productName
  function getCatalogOptions(productName: string, code: string): string[] {
    const fields = warehouseProductMap[productName];
    if (!fields) return [];
    const field = fields.find((f) => f.code === code);
    return field?.options.map((o) => o.label) ?? [];
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{isWholesale ? 'Новый оптовый заказ' : 'Новый заказ'}</h1>
      </div>

      {draftRestored && (
        <div className={styles.draftBanner}>
          <span>Восстановлен незавершённый черновик</span>
          <button
            type="button"
            className={styles.draftClear}
            onClick={() => {
              resetDraftState();
            }}
          >
            Сбросить
          </button>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit, onValidationError)}>

        {/* ── 01 Данные клиента ─────────────────────────────────────────────── */}
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
                      aria-label="ФИО клиента"
                      className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`}
                      placeholder="Аскаров Аскар Аскарович"
                      autoFocus
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
                      aria-label="Телефон KZ"
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
                      aria-label="Иностранный телефон"
                      className={styles.input}
                      placeholder="+44 7700 900123"
                    />
                  )}
                />
              </div>
            </div>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Город</label>
                <Controller control={control} name="city" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={CITIES} placeholder="Алматы" className={styles.input} aria-label="Город" />
                )} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Почтовый индекс</label>
                <input {...register('postalCode')} className={styles.input} placeholder="050000" maxLength={10} aria-label="Почтовый индекс" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Доставка</label>
                <Controller control={control} name="deliveryType" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={deliveryOptions} placeholder="Выберите или введите" className={styles.input} aria-label="Доставка" />
                )} />
              </div>
            </div>
            <div className={styles.rowFull}>
              <div className={styles.field}>
                <label className={styles.label}>Адрес доставки</label>
                <input
                  {...register('streetAddress')}
                  className={styles.input}
                  placeholder="ул. Абая 10, кв. 5 / ориентир"
                  aria-label="Адрес доставки"
                />
              </div>
            </div>
            <div className={styles.rowHalf}>
              <div className={styles.field}>
                <label className={styles.label}>Источник</label>
                <Controller control={control} name="source" render={({ field }) => (
                  <SelectOrText {...field} value={field.value ?? ''} options={SOURCES} placeholder="Instagram, звонок..." className={styles.input} aria-label="Источник" />
                )} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 Позиции заказа ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>02</span>
            <span className={styles.sectionTitle}>Позиции заказа</span>
          </div>
          <div className={styles.sectionBody}>
          {isWholesale ? (
            <>
              <div className={styles.wtable}>
                <div className={styles.wtableHead}>
                  <span>Наименование</span>
                  <span>Пол</span>
                  <span>Длина</span>
                  <span>Цвет</span>
                  <span>Размер</span>
                  <span>Кол-во</span>
                  <span>Цена, ₸</span>
                  <span>Скидка</span>
                  <span>Сумма</span>
                  <span>Наличие</span>
                  <span></span>
                </div>
                {fields.map((field, idx) => {
                  const _item = items[idx];
                  const linePrice = (Number(_item?.quantity) || 0) * (Number(_item?.unitPrice) || 0);
                  const lineDisc = Number(_item?.itemDiscount) || 0;
                  const lineTotal = Math.max(0, linePrice - lineDisc);
                  const availabilityInput = getAvailabilityInput(_item);
                  const productFields = getEffectiveFields(_item?.productName?.trim() ?? '');
                  const requiredAxes = (productFields ?? []).filter(f => f.affectsAvailability);
                  const missingAxes = getMissingAxes(_item);
                  const allAxesFilled = requiredAxes.length > 0 && missingAxes.length === 0;
                  const isCommodity = requiredAxes.length === 0;
                  const variantStock = availabilityInput && variantMap && allAxesFilled
                    ? variantMap[buildVariantLookupKey(availabilityInput.name, availabilityInput, productFields)]
                    : undefined;
                  const productStock = _item?.productName && stockMap ? stockMap[_item.productName] : undefined;
                  const itemStock = variantStock
                    ? { available: variantStock.available > 0, qty: variantStock.available, status: variantStock.status, missing: false as const }
                    : isCommodity && productStock
                      ? { available: productStock.available, qty: productStock.qty, status: undefined as undefined, missing: false as const }
                      : !isCommodity && !allAxesFilled
                        ? { available: false, qty: 0, status: undefined as undefined, missing: true as const, missingAxes }
                        : undefined;
                  const catalogLengths = getCatalogOptions(_item?.productName ?? '', 'length');
                  const lengthOpts = catalogLengths.length > 0 ? catalogLengths : globalWarehouseLengths;
                  return (
                    <div key={field.id} className={styles.wtableRow}>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                          <SearchableSelect options={enrichedProductOptions} value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder="Модель…" className={`${styles.wtableInput} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`} />
                        )} />
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.gender`} render={({ field: f }) => (
                          <select className={styles.wtableSel} value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} aria-label={`Пол для позиции ${idx + 1}`}>
                            <option value="">—</option>
                            <option value="муж">муж</option>
                            <option value="жен">жен</option>
                          </select>
                        )} />
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.length`} render={({ field: f }) => (
                          <select className={styles.wtableSel} value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} aria-label={`Длина для позиции ${idx + 1}`}>
                            <option value="">—</option>
                            {lengthOpts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )} />
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.color`} render={({ field: f }) => {
                          const catalogColors = getCatalogOptions(_item?.productName ?? '', 'color');
                          const colorOpts = catalogColors.length > 0 ? catalogColors : globalWarehouseColors.length > 0 ? globalWarehouseColors : [];
                          return (
                            <SearchableSelect options={colorOpts} value={f.value ?? ''} onChange={f.onChange} onBlur={f.onBlur} placeholder="—" className={styles.wtableInput} />
                          );
                        }} />
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => {
                          const catalogSizes = getCatalogOptions(_item?.productName ?? '', 'size');
                          const opts = catalogSizes.length > 0 ? catalogSizes : sizeOptions;
                          return (
                            <SearchableSelect options={opts} value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder="—" className={styles.wtableInput} />
                          );
                        }} />
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.quantity`} render={({ field: f }) => (
                          <input
                            type="number"
                            min="1"
                            className={styles.wtableNum}
                            value={f.value ?? ''}
                            onChange={e => f.onChange(parseOptionalInteger(e.target.value))}
                            onBlur={f.onBlur}
                          />
                        )} />
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.unitPrice`} render={({ field: f }) => (
                          <input
                            type="number"
                            min="0"
                            className={styles.wtableNum}
                            value={f.value ?? ''}
                            onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                            onBlur={f.onBlur}
                          />
                        )} />
                        {Number(_item?.unitPrice) > 1_000_000 && (
                          <span className={styles.fieldError} title="Сумма больше миллиона — проверьте, нет ли лишних нулей">
                            ⚠ Лишние нули?
                          </span>
                        )}
                      </div>
                      <div className={styles.wtableCell}>
                        <Controller control={control} name={`items.${idx}.itemDiscount`} render={({ field: f }) => (
                          <input
                            type="number"
                            min="0"
                            className={styles.wtableNum}
                            value={f.value ?? ''}
                            onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                            onBlur={f.onBlur}
                          />
                        )} />
                      </div>
                      <div className={`${styles.wtableCell} ${styles.wtableTotalCell}`}>{fmt(lineTotal)}</div>
                      <div className={styles.wtableCell}>
                        {itemStock !== undefined && (
                          itemStock.missing ? (
                            <span className={styles.stockBadgeHint} title={`Укажите: ${itemStock.missingAxes.map(f => f.label.toLowerCase()).join(', ')}`}>
                              укажите параметры
                            </span>
                          ) : (
                            <span className={itemStock.status === 'low' ? styles.stockBadgeLow : itemStock.available ? styles.stockBadgeIn : styles.stockBadgeOut}>
                              {itemStock.status === 'low' ? `мало (${itemStock.qty})` : itemStock.available ? `${itemStock.qty} шт.` : 'Нет'}
                            </span>
                          )
                        )}
                      </div>
                      <div className={styles.wtableCell}>
                        {fields.length > 1 && (
                          <button type="button" className={styles.itemRemoveBtn} aria-label={`Удалить позицию ${idx + 1}`} onClick={() => remove(idx)}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {errors.items && typeof errors.items.message === 'string' && (
                <div className={styles.formError}><AlertCircle size={13} />{errors.items.message}</div>
              )}
              <div className={styles.itemsFooter}>
                <button type="button" className={styles.addItemBtn} onClick={() => append(createEmptyItem())}>
                  <Plus size={13} /> Добавить строку
                </button>
                {itemsTotal > 0 && (
                  <div className={styles.itemsTotal}>
                    <Calculator size={13} />
                    <span>Итого по позициям:</span>
                    <strong>{fmt(itemsTotal)}</strong>
                    <span className={styles.itemsTotalMeta}>{items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'} · {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} шт.</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {fields.map((field, idx) => {
                const _item = items[idx];
                const linePrice = (Number(_item?.quantity) || 0) * (Number(_item?.unitPrice) || 0);
                const lineDisc = Number(_item?.itemDiscount) || 0;
                const lineTotal = Math.max(0, linePrice - lineDisc);
                const availabilityInput = getAvailabilityInput(_item);
                const variantStock = availabilityInput && variantMap
                  ? variantMap[buildVariantLookupKey(availabilityInput.name, availabilityInput, getEffectiveFields(_item?.productName?.trim() ?? ''))]
                  : undefined;
                const productStock = _item?.productName && stockMap ? stockMap[_item.productName] : undefined;
                const productFields = getEffectiveFields(_item?.productName?.trim() ?? '');
                const requiredAxes = (productFields ?? []).filter(f => f.affectsAvailability);
                const missingAxes = getMissingAxes(_item);
                const allAxesFilled = requiredAxes.length > 0 && missingAxes.length === 0;
                const isCommodity = requiredAxes.length === 0;
                const catalogLengths = getCatalogOptions(_item?.productName ?? '', 'length');
                const lengthOpts = catalogLengths.length > 0 ? catalogLengths : globalWarehouseLengths;

                return (
                  <div key={field.id} className={styles.itemCard}>
                    <div className={styles.itemCardHeader}>
                      <span className={styles.itemCardLabel}>Позиция {idx + 1}</span>
                      {fields.length > 1 && (
                        <button type="button" className={styles.itemRemoveBtn} aria-label={`Удалить позицию ${idx + 1}`} onClick={() => remove(idx)}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    <div className={styles.itemRow2}>
                      <div className={styles.field}>
                        <label className={styles.label}>Модель <span className={styles.req}>*</span></label>
                        <Controller control={control} name={`items.${idx}.productName`} render={({ field: f }) => (
                          <SearchableSelect
                            options={enrichedProductOptions}
                            value={f.value}
                            onChange={f.onChange}
                            onBlur={f.onBlur}
                            placeholder="Назар — жуп шапан"
                            className={`${styles.input} ${errors.items?.[idx]?.productName ? styles.inputError : ''}`}
                            ariaLabel={`Модель позиции ${idx + 1}`}
                          />
                        )} />
                        {errors.items?.[idx]?.productName && <span className={styles.fieldError}>{errors.items[idx]?.productName?.message}</span>}
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Размер <span className={styles.req}>*</span></label>
                        <Controller control={control} name={`items.${idx}.size`} render={({ field: f }) => {
                          const catalogSizes = getCatalogOptions(_item?.productName ?? '', 'size');
                          const opts = catalogSizes.length > 0 ? catalogSizes : sizeOptions;
                          return (
                          <SearchableSelect options={opts} value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder="48"
                              className={`${styles.input} ${errors.items?.[idx]?.size ? styles.inputError : ''}`}
                              ariaLabel={`Размер позиции ${idx + 1}`}
                            />
                          );
                        }} />
                      </div>
                    </div>

                    <div className={styles.itemRow2}>
                      <div className={styles.field}>
                        <label className={styles.label}>Пол</label>
                        <Controller control={control} name={`items.${idx}.gender`} render={({ field: f }) => (
                          <div className={styles.genderBtns}>
                            {(['муж', 'жен'] as const).map((g) => (
                              <button key={g} type="button"
                                className={`${styles.genderBtn} ${f.value === g ? styles.genderBtnActive : ''}`}
                                onClick={() => f.onChange(f.value === g ? '' : g)}
                              >
                                {g === 'муж' ? 'Мужской' : 'Женский'}
                              </button>
                            ))}
                          </div>
                        )} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Длина изделия</label>
                        <Controller control={control} name={`items.${idx}.length`} render={({ field: f }) => (
                          <select value={f.value ?? ''} onChange={e => f.onChange(e.target.value)} onBlur={f.onBlur}
                            className={styles.input} disabled={lengthOpts.length === 0} aria-label={`Длина изделия для позиции ${idx + 1}`}>
                            <option value="">— выбрать —</option>
                            {lengthOpts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )} />
                      </div>
                    </div>

                    <div className={styles.itemRow4}>
                      <div className={styles.field}>
                        <label className={styles.label}>Цвет / материал</label>
                        <Controller control={control} name={`items.${idx}.color`} render={({ field: f }) => {
                          const catalogColors = getCatalogOptions(_item?.productName ?? '', 'color');
                          const colorOpts = catalogColors.length > 0
                            ? catalogColors
                            : globalWarehouseColors.length > 0
                              ? globalWarehouseColors
                              : [];
                          return (
                            <SearchableSelect options={colorOpts} value={f.value ?? ''} onChange={f.onChange} onBlur={f.onBlur}
                              placeholder="Тёмно-синий, бордо..." className={styles.input} />
                          );
                        }} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Кол-во</label>
                        <Controller control={control} name={`items.${idx}.quantity`} render={({ field: f }) => (
                          <input
                            type="number"
                            min="1"
                            className={styles.input}
                            value={f.value ?? ''}
                            onChange={(e) => f.onChange(parseOptionalInteger(e.target.value))}
                            onBlur={f.onBlur}
                            onWheel={e => e.currentTarget.blur()}
                            onFocus={e => e.target.select()}
                            aria-label={`Кол-во позиции ${idx + 1}`}
                          />
                        )} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Цена за ед. (₸)</label>
                        <Controller control={control} name={`items.${idx}.unitPrice`} render={({ field: f }) => (
                          <input type="text" inputMode="numeric" className={styles.input} placeholder="0"
                            aria-label={`Цена за ед. позиции ${idx + 1}`}
                            value={f.value ?? ''} onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                            onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} />
                        )} />
                        {Number(_item?.unitPrice) > 1_000_000 && (
                          <span className={styles.fieldError} title="Сумма больше миллиона — проверьте, нет ли лишних нулей">
                            ⚠ Проверьте сумму — возможно, лишние нули
                          </span>
                        )}
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Скидка (₸)</label>
                        <Controller control={control} name={`items.${idx}.itemDiscount`} render={({ field: f }) => (
                          <input type="text" inputMode="numeric" className={styles.input} placeholder="0"
                            aria-label={`Скидка позиции ${idx + 1}`}
                            value={f.value ?? ''} onChange={e => f.onChange(parseOptionalAmount(e.target.value))}
                            onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} />
                        )} />
                      </div>
                    </div>

                    {_item?.productName?.trim() && (
                      isCommodity ? (
                        productStock ? (
                          productStock.available ? (
                            <div className={styles.variantStockIn}>Остаток: {productStock.qty} шт.</div>
                          ) : (
                            <div className={styles.variantStockOut}>Нет на складе</div>
                          )
                        ) : stockMap !== undefined ? (
                          <div className={styles.variantStockHint}>Нет данных по складу</div>
                        ) : null
                      ) : !allAxesFilled ? (
                        <div className={styles.variantStockHint}>
                          Укажите параметры ({missingAxes.map(f => f.label.toLowerCase()).join(', ')}) для проверки остатка
                        </div>
                      ) : variantStock ? (
                        variantStock.available > 0 ? (
                          <div className={variantStock.status === 'low' ? styles.variantStockLow : styles.variantStockIn}>
                            Остаток: {variantStock.available} шт.{variantStock.status === 'low' ? ' — мало' : ''}
                          </div>
                        ) : (
                          <div className={styles.variantStockOut}>Нет на складе</div>
                        )
                      ) : variantMap !== undefined ? (
                        <div className={styles.variantStockHint}>Нет данных по складу</div>
                      ) : null
                    )}

                    {linePrice > 0 && (
                      <div className={styles.lineTotalRow}>
                        {lineDisc > 0 ? (
                          <><span className={styles.lineTotalOld}>{fmt(linePrice)}</span><span className={styles.lineTotalFinal}>{fmt(lineTotal)}</span></>
                        ) : (
                          <span className={styles.lineTotalFinal}>{fmt(linePrice)}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.itemNoteField}>
                      <input {...register(`items.${idx}.workshopNotes`)} className={styles.itemNoteInput}
                        placeholder="Комментарий для цеха (необязательно)..." />
                    </div>

                    <div className={styles.itemPhotoRow}>
                      {itemPhotos[idx] ? (
                        <div className={styles.itemPhotoPreview}>
                          <img src={URL.createObjectURL(itemPhotos[idx]!)} alt="" className={styles.itemPhotoThumb} />
                          <span className={styles.itemPhotoName}>{itemPhotos[idx]!.name}</span>
                          <button type="button" className={styles.fileRemoveBtn} aria-label={`Удалить фото для позиции ${idx + 1}`} onClick={() => setItemPhotos(p => ({ ...p, [idx]: null }))}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label className={styles.itemPhotoUpload}>
                          <ImagePlus size={14} />
                          <span>Прикрепить фото / эскиз</span>
                          <input type="file" accept="image/*" className={styles.hiddenInput}
                            onChange={e => { const file = e.target.files?.[0]; if (file) setItemPhotos(prev => ({ ...prev, [idx]: file })); }} />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}

              {errors.items && typeof errors.items.message === 'string' && (
                <div className={styles.formError}><AlertCircle size={13} />{errors.items.message}</div>
              )}
              <div className={styles.itemsFooter}>
                <button type="button" className={styles.addItemBtn}
                  onClick={() => append(createEmptyItem())}>
                  <Plus size={13} /> Добавить позицию
                </button>
                {itemsTotal > 0 && (
                  <div className={styles.itemsTotal}>
                    <Calculator size={13} />
                    <span>Итого по позициям:</span>
                    <strong>{fmt(itemsTotal)}</strong>
                    <span className={styles.itemsTotalMeta}>{items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'} · {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} шт.</span>
                  </div>
                )}
              </div>
            </>
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
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Дата принятия заказа</label>
                <input {...register('orderDate')} type="date" className={styles.input} />
              </div>
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
                    <AlertTriangle size={11} /> Срочно
                  </button>
                </div>
                <label className={styles.demandingToggle}>
                  <input
                    type="checkbox"
                    checked={isDemandingClient}
                    onChange={e => setValue('isDemandingClient', e.target.checked)}
                    className={styles.demandingCheckbox}
                  />
                  <span><Star size={11} /> Требовательный клиент</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* ── 04 Оплата ─────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>04</span>
            <span className={styles.sectionTitle}>Оплата</span>
          </div>
          <div className={styles.sectionBody}>

            {/* F1: Правильный порядок вычислений */}
            <div className={styles.finPipeline}>

              {/* 1. Сумма по позициям — F2 */}
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

              {/* 2. Сумма доставки — F3 */}
              <div className={styles.finRow}>
                <span className={styles.finLabel}>Доставка</span>
                <Controller control={control} name="deliveryFee" render={({ field }) => (
                  <input
                    type="text" inputMode="numeric"
                    className={styles.finInput}
                    placeholder="0 ₸"
                    aria-label="Доставка"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseOptionalAmount(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                  />
                )} />
              </div>

              {/* 3. Скидка на заказ — F5: один мастер-блок */}
              <div className={styles.finRow}>
                <span className={styles.finLabel}>Скидка</span>
                <div className={styles.discountCompound}>
                  <Controller control={control} name="orderDiscount" render={({ field }) => (
                    <input
                      type="text" inputMode="numeric"
                      className={`${styles.finInput} ${styles.discountAmtInput}`}
                      placeholder="0 ₸"
                      aria-label="Скидка на заказ"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const amt = parseOptionalAmount(e.target.value);
                        field.onChange(amt);
                        if (itemsTotal > 0 && Number.isFinite(amt) && (amt ?? 0) > 0) {
                          setDiscountPercent(((amt! / itemsTotal) * 100).toFixed(1));
                        } else { setDiscountPercent(''); }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      onFocus={(e) => e.target.select()}
                    />
                  )} />
                  <div className={styles.discountPctWrap}>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      className={styles.discountPctInput}
                      placeholder="0"
                      aria-label="Процент скидки"
                      value={discountPercent}
                      onChange={(e) => {
                        setDiscountPercent(e.target.value);
                        const pct = parseFloat(e.target.value);
                        if (Number.isFinite(pct) && itemsTotal > 0) {
                          setValue('orderDiscount', Math.round(itemsTotal * pct / 100));
                        } else if (!e.target.value) { setValue('orderDiscount', undefined); }
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className={styles.discountPctSymbol}>%</span>
                  </div>
                </div>
              </div>

              {/* 4. Банковская комиссия — F4 */}
              <div className={styles.finRow}>
                <span className={styles.finLabel}>Комиссия банка</span>
                <div className={styles.discountCompound}>
                  <div className={`${styles.finValue} ${styles.bankCommissionValue}`}>
                    {bankCommissionAmount > 0 ? fmt(bankCommissionAmount) : '—'}
                  </div>
                  {editingRate ? (
                    <div className={styles.bankCommissionEditor}>
                      <div className={styles.discountPctWrap}>
                        <input
                          type="number" min="0" max="100" step="0.1"
                          className={styles.discountPctInput}
                          placeholder="0"
                          aria-label="Ставка комиссии"
                          value={rateInput}
                          autoFocus
                          onChange={(e) => setRateInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { setEditingRate(false); }
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                        <span className={styles.discountPctSymbol}>%</span>
                      </div>
                      <button
                        type="button"
                        className={styles.bankCommissionSaveBtn}
                        onClick={() => {
                          const v = parseFloat(rateInput);
                          const safe = isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
                          setValue('bankCommissionPercent', safe || undefined);
                          updateBankCommission.mutate(safe);
                          setEditingRate(false);
                        }}
                      >Сохранить</button>
                      <button
                        type="button"
                        className={styles.bankCommissionCancelBtn}
                        onClick={() => setEditingRate(false)}
                      >Отмена</button>
                    </div>
                  ) : (
                    <div className={styles.bankCommissionView}>
                      <span className={`${styles.bankCommissionRate} ${bankCommissionPct > 0 ? styles.bankCommissionRateActive : styles.bankCommissionRateMuted}`}>
                        {bankCommissionPct > 0 ? `${bankCommissionPct}%` : '—'}
                      </span>
                      <button
                        type="button"
                        title="Изменить ставку комиссии"
                        onClick={() => { setRateInput(bankCommissionPct > 0 ? String(bankCommissionPct) : ''); setEditingRate(true); }}
                        className={styles.iconButton}
                      >
                        <Pencil size={12} />
                        <span className={styles.srOnly}>Изменить ставку комиссии</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Итог к оплате */}
              <div className={`${styles.finRow} ${styles.finRowTotal}`}>
                <span className={styles.finLabel}>Итого к оплате</span>
                <span className={styles.finValueBold}>{itemsTotal > 0 ? fmt(finalTotal) : '—'}</span>
              </div>

              {/* 6-7. Предоплата / Остаток */}
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
                {!errors.prepayment && finalTotal > 0 && (Number(prepaymentRaw) || 0) > finalTotal && (
                  <span className={styles.fieldError}>
                    ⚠ Предоплата ({fmt(Number(prepaymentRaw) || 0)}) больше итога ({fmt(finalTotal)}) — проверьте лишние нули
                  </span>
                )}
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
                        type="text" inputMode="numeric"
                        className={styles.mixedInput}
                        placeholder="0 ₸"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const parsed = parseOptionalAmount(e.target.value);
                          // Soft cap at prepayment so a stray extra zero in one row can't
                          // silently exceed the prepayment that the order is splitting.
                          if (parsed !== undefined && prepayment > 0 && parsed > prepayment) {
                            field.onChange(prepayment);
                          } else {
                            field.onChange(parsed);
                          }
                        }}
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

            {/* Чеки / квитанции */}
            <div className={styles.field}>
              <label className={styles.label}>Чеки / квитанции</label>
              {receipts.length > 0 && (
                <div className={styles.fileList}>
                  {receipts.map((f, i) => (
                    <div key={i} className={styles.fileItem}>
                      <Paperclip size={12} />
                      <span className={styles.fileName}>{f.name}</span>
                      <button
                        type="button"
                        className={styles.fileRemoveBtn}
                        aria-label={`Удалить чек ${f.name}`}
                        title={`Удалить чек ${f.name}`}
                        onClick={() => setReceipts((r) => r.filter((_, j) => j !== i))}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={styles.receiptUpload}>
                <Paperclip size={14} />
                <span>Прикрепить чек...</span>
                <span className={styles.uploadBadge}>jpg / pdf</span>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setReceipts((r) => [...r, ...files]);
                    if (receiptInputRef.current) receiptInputRef.current.value = '';
                  }}
                />
              </label>
            </div>

          </div>
        </section>

        {/* ── 05 Примечания ─────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNum}>05</span>
            <span className={styles.sectionTitle}>Примечания</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <label className={styles.label}>Внутренняя заметка (только для команды)</label>
              <textarea {...register('managerNote')} className={styles.textarea} placeholder="Особые пожелания, договорённости..." rows={3} aria-label="Внутренняя заметка" />
            </div>
          </div>
        </section>

        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/workzone/chapan/orders')}>
            Отмена
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || createOrder.isPending}
            title={hasIncompleteVariantLines ? 'У позиций каталога не заполнены атрибуты — нажмите, чтобы увидеть подсказку' : undefined}
          >
            {createOrder.isPending ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>

      </form>
    </div>
  );
}
