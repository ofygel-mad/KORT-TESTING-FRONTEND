import { api, apiClient } from '../../shared/api/client';
import type {
  ChapanOrder, ChapanInvoice, CreateOrderDto, UpdateOrderDto, AddPaymentDto, ListResponse,
  ProductionTask, ChapanCatalogs, ChapanProfile, ChapanClient, ChapanChangeRequest, CreateOrderItemDto, InvoiceDocumentPayload,
  OrderAttachment, OrderWarehouseState, OrgManager,
  ChapanReturn, CreateReturnDto, ChapanClientAggregated, ChapanClientDetail, ChapanClientsListParams,
} from './types';

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  list: (params?: {
    status?: string;
    statuses?: string;
    priority?: string;
    paymentStatus?: string;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    archived?: boolean;
    hasWarehouseItems?: boolean;
    createdFrom?: string;
    createdTo?: string;
    managerId?: string;
    customerType?: string;
  }) =>
    api.get<ListResponse<ChapanOrder>>('/chapan/orders', params),

  get: (id: string) =>
    api.get<ChapanOrder>(`/chapan/orders/${id}`),

  getWarehouseState: (id: string) =>
    api.get<OrderWarehouseState>(`/chapan/orders/${id}/warehouse-state`),

  listWarehouseStates: (ids: string[]) =>
    api.get<{ count: number; results: OrderWarehouseState[] }>('/chapan/orders/warehouse-states', {
      ids: ids.join(','),
    }),

  create: (dto: CreateOrderDto, idempotencyKey?: string) =>
    api.post<ChapanOrder>(
      '/chapan/orders',
      dto,
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    ),

  update: (id: string, dto: UpdateOrderDto) =>
    api.patch<ChapanOrder>(`/chapan/orders/${id}`, dto),

  restore: (id: string, _status?: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/restore`, {}),

  archive: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/archive`, {}),

  close: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/close`, {}),

  confirm: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/confirm`, {}),

  changeStatus: (id: string, status: string) =>
    api.patch<{ ok: boolean }>(`/chapan/orders/${id}/status`, { status }),

  addPayment: (id: string, dto: AddPaymentDto) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/payments`, {
      amount: dto.amount,
      method: dto.method,
      notes: dto.note,
    }),

  ship: (id: string, data?: {
    courierType?: string;
    recipientName?: string;
    recipientAddress?: string;
    shippingNote?: string;
  }) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/ship`, data ?? {}),

  fulfillFromStock: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/fulfill-from-stock`, {}),

  routeItems: (
    id: string,
    items: Array<{ itemId: string; fulfillmentMode: 'warehouse' | 'production' }>,
  ) =>
    api.post<ChapanOrder>(`/chapan/orders/${id}/route-items`, { items }),

  addActivity: (id: string, content: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/activities`, {
      type: 'comment',
      content,
    }),

  setRequiresInvoice: (id: string, requiresInvoice: boolean) =>
    api.patch<{ ok: boolean }>(`/chapan/orders/${id}/requires-invoice`, { requiresInvoice }),

  returnToReady: (id: string, reason: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/return-to-ready`, { reason }),

  requestItemChange: (id: string, items: CreateOrderItemDto[], managerNote?: string) =>
    api.post<ChapanChangeRequest>(`/chapan/orders/${id}/change-request`, { items, managerNote }),

  // Trash (soft-delete)
  trash: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/trash`, {}),
  restoreFromTrash: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/${id}/restore-from-trash`, {}),
  permanentDelete: (id: string) =>
    api.delete<{ ok: boolean }>(`/chapan/orders/${id}`),
  listTrashed: () =>
    api.get<ChapanOrder[]>('/chapan/orders/trash'),

  routeItem: (orderId: string, itemId: string, fulfillmentMode: 'warehouse' | 'production') =>
    api.post<{ ok: boolean }>(`/chapan/orders/${orderId}/items/${itemId}/route`, { fulfillmentMode }),

  reassignManager: (orderId: string, managerId: string) =>
    api.patch<ChapanOrder>(`/chapan/orders/${orderId}/manager`, { managerId }),

  listManagers: () =>
    api.get<OrgManager[]>('/chapan/orders/managers'),
};

// ── Production ────────────────────────────────────────────────────────────────

export const productionApi = {
  // Manager view — includes clientName/clientPhone
  list: (params?: { status?: string; assignedTo?: string }) =>
    api.get<ListResponse<ProductionTask>>('/chapan/production', params),

  // Workshop view — no PII
  listWorkshop: () =>
    api.get<ListResponse<ProductionTask>>('/chapan/production/workshop'),

  claim: (taskId: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/claim`, {}),

  updateStatus: (taskId: string, status: string) =>
    api.patch<{ ok: boolean; orderId: string }>(`/chapan/production/${taskId}/status`, { status }),

  assignWorker: (taskId: string, worker: string | null) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/assign`, { worker }),

  flag: (taskId: string, reason: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/flag`, { reason }),

  unflag: (taskId: string) =>
    api.post<{ ok: boolean }>(`/chapan/production/${taskId}/unflag`, {}),

  setDefect: (taskId: string, defect: string) =>
    api.patch<{ ok: boolean }>(`/chapan/production/${taskId}/defect`, { defect }),
};

// ── Invoices (Накладные) ──────────────────────────────────────────────────────

export const invoicesApi = {
  create: (orderIds: string[], notes?: string, documentPayload?: InvoiceDocumentPayload) =>
    api.post<ChapanInvoice>('/chapan/invoices', { orderIds, notes, documentPayload }),

  list: (params?: { status?: string; orderId?: string; limit?: number; offset?: number }) =>
    api.get<ListResponse<ChapanInvoice>>('/chapan/invoices', params),

  get: (id: string) =>
    api.get<ChapanInvoice>(`/chapan/invoices/${id}`),

  previewDocument: (orderIds: string[]) =>
    api.post<InvoiceDocumentPayload>('/chapan/invoices/preview', { orderIds }),

  saveDocument: (id: string, documentPayload: InvoiceDocumentPayload) =>
    api.patch<ChapanInvoice>(`/chapan/invoices/${id}/document`, { documentPayload }),

  confirmSeamstress: (id: string) =>
    api.post<{ bothConfirmed: boolean }>(`/chapan/invoices/${id}/confirm-seamstress`, {}),

  confirmWarehouse: (id: string) =>
    api.post<{ bothConfirmed: boolean }>(`/chapan/invoices/${id}/confirm-warehouse`, {}),

  reject: (id: string, reason: string) =>
    api.post<{ ok: boolean }>(`/chapan/invoices/${id}/reject`, { reason }),

  archive: (id: string) =>
    api.post<{ ok: boolean }>(`/chapan/invoices/${id}/archive`, {}),
};

// ── Change Requests ───────────────────────────────────────────────────────────

export const changeRequestsApi = {
  list: () =>
    api.get<ChapanChangeRequest[]>('/chapan/orders/change-requests'),

  approve: (crId: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/change-requests/${crId}/approve`, {}),

  reject: (crId: string, rejectReason: string) =>
    api.post<{ ok: boolean }>(`/chapan/orders/change-requests/${crId}/reject`, { rejectReason }),
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const chapanSettingsApi = {
  getProfile: () =>
    api.get<ChapanProfile>('/chapan/settings/profile'),

  updateProfile: (data: Partial<ChapanProfile>) =>
    api.patch<ChapanProfile>('/chapan/settings/profile', data),

  updateBankCommission: (percent: number) =>
    api.patch<{ bankCommissionPercent: number }>('/chapan/settings/bank-commission', { bankCommissionPercent: percent }),

  getCatalogs: () =>
    api.get<ChapanCatalogs>('/chapan/settings/catalogs'),

  // Full replace — send entire new arrays
  saveCatalogs: (data: Partial<ChapanCatalogs>) =>
    api.put<{ ok: boolean }>('/chapan/settings/catalogs', data),

  getClients: () =>
    api.get<ListResponse<ChapanClient>>('/chapan/settings/clients'),

  createClient: (data: { fullName: string; phone: string; email?: string; company?: string; notes?: string }) =>
    api.post<ChapanClient>('/chapan/settings/clients', data),
};

// ── Attachments ───────────────────────────────────────────────────────────────

export const attachmentsApi = {
  list: (orderId: string) =>
    api.get<OrderAttachment[]>(`/chapan/orders/${orderId}/attachments`),

  upload: (orderId: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<OrderAttachment>(`/chapan/orders/${orderId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data);
  },

  download: (orderId: string, attachmentId: string) =>
    `/api/v1/chapan/orders/${orderId}/attachments/${attachmentId}/file`,

  delete: (orderId: string, attachmentId: string) =>
    api.delete<{ ok: boolean }>(`/chapan/orders/${orderId}/attachments/${attachmentId}`),
};

// ── Returns (Акты возврата) ───────────────────────────────────────────────────

export const returnsApi = {
  list: (params?: { orderId?: string; status?: string }) =>
    api.get<{ count: number; results: ChapanReturn[] }>('/chapan/returns', params),

  get: (id: string) =>
    api.get<ChapanReturn>(`/chapan/returns/${id}`),

  create: (dto: CreateReturnDto) =>
    api.post<ChapanReturn>('/chapan/returns', dto),

  confirm: (id: string) =>
    api.post<ChapanReturn>(`/chapan/returns/${id}/confirm`, {}),

  deleteDraft: (id: string) =>
    api.delete<{ ok: boolean }>(`/chapan/returns/${id}`),
};

// ── Chapan Clients API ────────────────────────────────────────────────────────
export const chapanClientsApi = {
  list: (params?: ChapanClientsListParams) =>
    api.get<{ count: number; results: ChapanClientAggregated[] }>('/chapan/clients', { params }),

  get: (id: string) =>
    api.get<ChapanClientDetail>(`/chapan/clients/${id}`),

  update: (
    id: string,
    data: Partial<Pick<ChapanClientAggregated, 'fullName' | 'phone' | 'email' | 'company' | 'notes'>>,
  ) => api.patch<ChapanClientAggregated>(`/chapan/clients/${id}`, data),
};

// ── Users / account API ───────────────────────────────────────────────────────
export const usersApi = {
  changeEmail: (new_email: string, current_password: string) =>
    api.post<{ ok: boolean; requires_relogin: boolean }>('/users/me/change-email', { new_email, current_password }),
};
