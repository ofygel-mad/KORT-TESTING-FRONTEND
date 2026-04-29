import { api, apiClient } from '../../shared/api/client';
import type { ManualInvoice, CreateManualInvoiceDto } from './types';

export const purchaseApi = {
  list: (params?: { type?: string }) =>
    api.get<{ count: number; results: ManualInvoice[] }>('/chapan/purchase', params),

  getById: (id: string) =>
    api.get<ManualInvoice>(`/chapan/purchase/${id}`),

  create: (dto: CreateManualInvoiceDto) =>
    api.post<ManualInvoice>('/chapan/purchase', dto),

  update: (id: string, dto: Partial<Omit<CreateManualInvoiceDto, 'type'>>) =>
    api.patch<ManualInvoice>(`/chapan/purchase/${id}`, dto),

  remove: (id: string) =>
    api.delete<{ deleted: boolean }>(`/chapan/purchase/${id}`),

  download: (id: string) =>
    apiClient.get(`/chapan/purchase/${id}/download`, {
      responseType: 'blob',
    }),
};
