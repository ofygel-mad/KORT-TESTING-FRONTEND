import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ordersApi, usersApi, productionApi, chapanSettingsApi, invoicesApi, changeRequestsApi, attachmentsApi, returnsApi } from './api';
import type {
  CreateOrderDto,
  UpdateOrderDto,
  AddPaymentDto,
  ChapanCatalogs,
  ChapanProfile,
  CreateOrderItemDto,
  InvoiceDocumentPayload,
  CreateReturnDto,
} from './types';
import { readApiErrorMessage } from '../../shared/api/errors';

// ── Query keys ────────────────────────────────────────────────────────────────

export const orderKeys = {
  all: ['chapan_orders'] as const,
  list: (filters?: object) => [...orderKeys.all, filters] as const,
  detail: (id: string) => [...orderKeys.all, id] as const,
  warehouseState: (id: string) => [...orderKeys.all, id, 'warehouse-state'] as const,
  warehouseStates: (ids: string[]) => [...orderKeys.all, 'warehouse-states', ids] as const,
  production: ['chapan_production'] as const,
  productionList: (filters?: object) => [...orderKeys.production, filters] as const,
  invoices: ['chapan_invoices'] as const,
  invoiceList: (filters?: object) => ['chapan_invoices', filters] as const,
  invoiceDetail: (id: string) => ['chapan_invoices', id] as const,
  settings: ['chapan_settings'] as const,
  catalogs: ['chapan_catalogs'] as const,
  clients: ['chapan_clients'] as const,
  changeRequests: ['chapan_change_requests'] as const,
  returns: ['chapan_returns'] as const,
  returnsList: (filters?: object) => ['chapan_returns', filters] as const,
  returnDetail: (id: string) => ['chapan_returns', id] as const,
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const useOrders = (params?: Parameters<typeof ordersApi.list>[0]) =>
  useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => ordersApi.list(params),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

export const useOrder = (id: string) =>
  useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.get(id),
    enabled: Boolean(id),
    staleTime: 120_000,
  });

export const useOrderWarehouseState = (id: string) =>
  useQuery({
    queryKey: orderKeys.warehouseState(id),
    queryFn: () => ordersApi.getWarehouseState(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  });

export const useOrderWarehouseStates = (ids: string[]) => {
  const sortedIds = [...new Set(ids)].sort();

  return useQuery({
    queryKey: orderKeys.warehouseStates(sortedIds),
    queryFn: () => ordersApi.listWarehouseStates(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 15_000,
  });
};

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...dto }: CreateOrderDto & { idempotencyKey?: string }) =>
      ordersApi.create(dto as CreateOrderDto, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Заказ создан');
    },
    onError: () => toast.error('Не удалось создать заказ'),
  });
};

export const useUpdateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderDto }) => ordersApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ обновлён');
    },
    onError: () => toast.error('Не удалось сохранить изменения'),
  });
};

export const useRestoreOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status?: string }) => ordersApi.restore(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
      toast.success('Заказ восстановлен');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось восстановить заказ')),
  });
};

export const useArchiveOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.archive(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Заказ перемещён в архив');
    },
    onError: () => toast.error('Не удалось архивировать заказ'),
  });
};

export const useCloseOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.close(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Сделка закрыта, заказ отправлен в архив');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось закрыть сделку')),
  });
};

export const useFulfillFromStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.fulfillFromStock(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
      toast.success('Заказ переведён в «Готово»');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось выполнить со склада')),
  });
};

export const useRouteOrderItems = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: Array<{ itemId: string; fulfillmentMode: 'warehouse' | 'production' }> }) =>
      ordersApi.routeItems(id, items),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Маршрут позиций обновлён');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось сохранить маршрут позиций')),
  });
};

export const useConfirmOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.confirm(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Заказ подтверждён и отправлен в цех');
    },
    onError: () => toast.error('Не удалось подтвердить заказ'),
  });
};

export const useChangeOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ordersApi.changeStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
    },
    onError: () => toast.error('Не удалось изменить статус'),
  });
};

export const useAddPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AddPaymentDto }) =>
      ordersApi.addPayment(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      toast.success('Оплата добавлена');
    },
    onError: () => toast.error('Не удалось добавить оплату'),
  });
};

export const useShipOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      courierType?: string;
      recipientName?: string;
      recipientAddress?: string;
      shippingNote?: string;
    }) => ordersApi.ship(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(vars.id) });
      toast.success('Заказ отправлен клиенту');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось отправить заказ')),
  });
};

export const useAddOrderActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      ordersApi.addActivity(id, content),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
    },
  });
};

export const useSetRequiresInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, requiresInvoice }: { id: string; requiresInvoice: boolean }) =>
      ordersApi.setRequiresInvoice(id, requiresInvoice),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
    },
    onError: () => toast.error('Не удалось обновить настройку'),
  });
};

export const useReturnToReady = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      ordersApi.returnToReady(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.warehouseState(id) });
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      toast.success('Заказ возвращён в раздел «Готово»');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось вернуть заказ')),
  });
};

// ── Production ────────────────────────────────────────────────────────────────

export const useProductionTasks = (params?: Parameters<typeof productionApi.list>[0]) =>
  useQuery({
    queryKey: orderKeys.productionList(params),
    queryFn: () => productionApi.list(params),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });

export const useWorkshopTasks = () =>
  useQuery({
    queryKey: [...orderKeys.production, 'workshop'],
    queryFn: () => productionApi.listWorkshop(),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });

export const useUpdateProductionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      productionApi.updateStatus(taskId, status),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orderKeys.production });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      if (data.orderId) {
        qc.invalidateQueries({ queryKey: orderKeys.detail(data.orderId) });
      }
    },
    onError: () => toast.error('Не удалось изменить статус задания'),
  });
};

export const useClaimProductionTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => productionApi.claim(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.production });
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось взять заказ в работу')),
  });
};

export const useAssignWorker = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, worker }: { taskId: string; worker: string | null }) =>
      productionApi.assignWorker(taskId, worker),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.production }),
  });
};

export const useFlagTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      productionApi.flag(taskId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.warning('Задание заблокировано');
    },
  });
};

export const useUnflagTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => productionApi.unflag(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Блокировка снята');
    },
  });
};

// ── Invoices ──────────────────────────────────────────────────────────────────

export const useInvoices = (params?: Parameters<typeof invoicesApi.list>[0]) =>
  useQuery({
    queryKey: orderKeys.invoiceList(params),
    queryFn: () => invoicesApi.list(params),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: orderKeys.invoiceDetail(id),
    queryFn: () => invoicesApi.get(id),
    enabled: Boolean(id),
    staleTime: 120_000,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderIds, notes, documentPayload }: { orderIds: string[]; notes?: string; documentPayload?: InvoiceDocumentPayload }) =>
      invoicesApi.create(orderIds, notes, documentPayload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Накладная создана');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось создать накладную')),
  });
};

export const usePreviewInvoiceDocument = () =>
  useMutation({
    mutationFn: ({ orderIds }: { orderIds: string[] }) =>
      invoicesApi.previewDocument(orderIds),
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось создать preview накладной')),
  });

export const useSaveInvoiceDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentPayload }: { id: string; documentPayload: InvoiceDocumentPayload }) =>
      invoicesApi.saveDocument(id, documentPayload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      toast.success('Накладная сохранена');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось сохранить накладную')),
  });
};

export const useConfirmSeamstress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.confirmSeamstress(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Отправка подтверждена');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось подтвердить')),
  });
};

export const useConfirmWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.confirmWarehouse(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Получение подтверждено');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось подтвердить')),
  });
};

export const useArchiveInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.archive(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
    },
  });
};

export const useRejectInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoicesApi.reject(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.invoices });
      qc.invalidateQueries({ queryKey: orderKeys.invoiceDetail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Накладная отклонена');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось отклонить')),
  });
};

// ── Change Requests ───────────────────────────────────────────────────────────

export const usePendingChangeRequests = () =>
  useQuery({
    queryKey: orderKeys.changeRequests,
    queryFn: () => changeRequestsApi.list(),
    refetchInterval: 5 * 60_000,
    staleTime: 30_000,
  });

export const useRequestItemChange = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items, managerNote }: { id: string; items: CreateOrderItemDto[]; managerNote?: string }) =>
      ordersApi.requestItemChange(id, items, managerNote),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.changeRequests });
      toast.success('Запрос отправлен в цех. Ожидайте согласования.');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось отправить запрос')),
  });
};

export const useApproveChangeRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (crId: string) => changeRequestsApi.approve(crId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.changeRequests });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.production });
      toast.success('Изменения согласованы, заказ возвращён на маршрутизацию');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось согласовать')),
  });
};

export const useRejectChangeRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ crId, rejectReason }: { crId: string; rejectReason: string }) =>
      changeRequestsApi.reject(crId, rejectReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.changeRequests });
      toast.success('Запрос на изменение отклонён');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось отклонить')),
  });
};

export const useRouteSingleItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, fulfillmentMode }: { orderId: string; itemId: string; fulfillmentMode: 'warehouse' | 'production' }) =>
      ordersApi.routeItem(orderId, itemId, fulfillmentMode),
    onSuccess: (_data, { orderId }) => {
      void qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      void qc.invalidateQueries({ queryKey: orderKeys.warehouseState(orderId) });
      void qc.invalidateQueries({ queryKey: orderKeys.all });
      void qc.invalidateQueries({ queryKey: orderKeys.production });
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось маршрутизировать позицию')),
  });
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const useChapanCatalogs = () =>
  useQuery({
    queryKey: orderKeys.catalogs,
    queryFn: () => chapanSettingsApi.getCatalogs(),
    staleTime: 5 * 60_000,  // catalogs rarely change
  });

export const useChapanProfile = () =>
  useQuery({
    queryKey: orderKeys.settings,
    queryFn: () => chapanSettingsApi.getProfile(),
    staleTime: 5 * 60_000,
  });

export const useSaveCatalogs = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ChapanCatalogs>) => chapanSettingsApi.saveCatalogs(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.catalogs });
      toast.success('Каталог сохранён');
    },
    onError: () => toast.error('Не удалось сохранить'),
  });
};

export const useSaveProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ChapanProfile>) => chapanSettingsApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.settings });
      toast.success('Профиль сохранён');
    },
  });
};

export const useUpdateBankCommission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (percent: number) => chapanSettingsApi.updateBankCommission(percent),
    onSuccess: (_data, percent) => {
      qc.invalidateQueries({ queryKey: orderKeys.settings });
      toast.success(`Ставка комиссии банка сохранена: ${percent}%`);
    },
    onError: () => toast.error('Не удалось сохранить ставку комиссии'),
  });
};

export const useChapanClients = () =>
  useQuery({
    queryKey: orderKeys.clients,
    queryFn: () => chapanSettingsApi.getClients(),
    staleTime: 2 * 60_000,
  });

// ── Attachments ───────────────────────────────────────────────────────────────

export function useUploadAttachment(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(orderId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
}

export function useDeleteAttachment(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(orderId, attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
}

// ── Trash mutations ───────────────────────────────────────────────────────────
export function useTrashOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.trash(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: orderKeys.all });
      const snapshots = qc.getQueriesData({ queryKey: orderKeys.all });
      qc.setQueriesData({ queryKey: orderKeys.all }, (old: any) => {
        if (!old?.results) return old;
        return { ...old, results: old.results.filter((o: any) => o.id !== id), count: Math.max(0, (old.count ?? 1) - 1) };
      });
      return { snapshots };
    },
    onError: (_err: unknown, _id: string, context: any) => {
      for (const [key, data] of context?.snapshots ?? []) {
        qc.setQueryData(key, data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['chapan-orders-trash'] });
    },
  });
}

export function useRestoreFromTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.restoreFromTrash(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ['chapan-orders-trash'] });
    },
  });
}

export function usePermanentDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersApi.permanentDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chapan-orders-trash'] });
    },
  });
}

export function useTrashedOrders() {
  return useQuery({
    queryKey: ['chapan-orders-trash'],
    queryFn: () => ordersApi.listTrashed(),
    staleTime: 60_000,
  });
}

// ── Account mutations ─────────────────────────────────────────────────────────
export function useChangeEmail() {
  return useMutation({
    mutationFn: ({ new_email, current_password }: { new_email: string; current_password: string }) =>
      usersApi.changeEmail(new_email, current_password),
  });
}

// ── Manager reassignment ──────────────────────────────────────────────────────

export function useOrgManagers() {
  return useQuery({
    queryKey: ['chapan_org_managers'],
    queryFn: () => ordersApi.listManagers(),
    staleTime: 5 * 60_000,
  });
}

export function useReassignManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, managerId }: { orderId: string; managerId: string }) =>
      ordersApi.reassignManager(orderId, managerId),
    onSuccess: (updatedOrder) => {
      qc.setQueryData(orderKeys.detail(updatedOrder.id), updatedOrder);
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success('Менеджер переназначен');
    },
    onError: (err: unknown) => {
      const msg = readApiErrorMessage(err) ?? 'Не удалось переназначить менеджера';
      toast.error(msg);
    },
  });
}

// ── Returns (Акты возврата) ───────────────────────────────────────────────────

export const useReturns = (params?: { orderId?: string; status?: string }) =>
  useQuery({
    queryKey: orderKeys.returnsList(params),
    queryFn: () => returnsApi.list(params),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

export const useCreateReturn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateReturnDto) => returnsApi.create(dto),
    onSuccess: (_data, dto) => {
      qc.invalidateQueries({ queryKey: orderKeys.returns });
      qc.invalidateQueries({ queryKey: orderKeys.detail(dto.orderId) });
      toast.success('Черновик возврата создан');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось создать возврат')),
  });
};

export const useConfirmReturn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => returnsApi.confirm(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orderKeys.returns });
      qc.invalidateQueries({ queryKey: orderKeys.detail(data.orderId) });
      toast.success(`Возврат ${data.returnNumber} подтверждён, склад пополнен`);
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось подтвердить возврат')),
  });
};

export const useDeleteReturnDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => returnsApi.deleteDraft(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.returns });
      toast.success('Черновик возврата удалён');
    },
    onError: (error) => toast.error(readApiErrorMessage(error, 'Не удалось удалить возврат')),
  });
};
