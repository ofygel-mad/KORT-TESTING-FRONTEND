import { api, apiClient } from '../../shared/api/client';
import type { ManualInvoice, CreateManualInvoiceDto, UpdateManualInvoiceDto } from './types';

export const purchaseApi = {
  list: (params?: { type?: string; archived?: boolean }) =>
    api.get<{ count: number; results: ManualInvoice[] }>('/chapan/purchase', params),

  getById: (id: string) =>
    api.get<ManualInvoice>(`/chapan/purchase/${id}`),

  create: (dto: CreateManualInvoiceDto) =>
    api.post<ManualInvoice>('/chapan/purchase', dto),

  update: (id: string, dto: UpdateManualInvoiceDto) =>
    api.patch<ManualInvoice>(`/chapan/purchase/${id}`, dto),

  archive: (id: string) =>
    api.post<ManualInvoice>(`/chapan/purchase/${id}/archive`),

  restore: (id: string) =>
    api.post<ManualInvoice>(`/chapan/purchase/${id}/restore`),

  remove: (id: string) =>
    api.delete<{ deleted: boolean }>(`/chapan/purchase/${id}`),

  download: (id: string, currency = 'KZT') =>
    apiClient.get(`/chapan/purchase/${id}/download`, {
      params: { currency },
      responseType: 'blob',
    }),
};
