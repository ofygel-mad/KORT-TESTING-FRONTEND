import { api, apiClient } from '../../shared/api/client';
import type {
  KaspiConnection,
  KaspiConnectionHistoryItem,
  KaspiOrderDetail,
  KaspiOrdersSummary,
  KaspiOrdersListResponse,
  SaveKaspiConnectionDto,
  ListKaspiOrdersParams,
  SyncKaspiOrdersResponse,
} from './types';

export const kaspiApi = {
  getConnection: () =>
    api.get<KaspiConnection | null>('/integrations/kaspi/connection'),

  listConnections: () =>
    api.get<KaspiConnectionHistoryItem[]>('/integrations/kaspi/connections'),

  saveConnection: (dto: SaveKaspiConnectionDto) =>
    api.put<KaspiConnection>('/integrations/kaspi/connection', dto),

  disconnectConnection: () =>
    api.post<KaspiConnection | null>('/integrations/kaspi/connection/disconnect', {}),

  testConnection: () =>
    api.post<{ ok: true; checkedAt: string; sampleOrders: number }>('/integrations/kaspi/connection/test', {}),

  syncOrders: () =>
    apiClient.post<SyncKaspiOrdersResponse>(
      '/integrations/kaspi/sync',
      {},
      { timeout: 180000 },
    ).then((response) => response.data),

  listOrders: (params?: ListKaspiOrdersParams) =>
    api.get<KaspiOrdersListResponse>('/integrations/kaspi/orders', params),

  getOrder: (externalOrderId: string) =>
    api.get<KaspiOrderDetail>(`/integrations/kaspi/orders/${externalOrderId}`),

  getSummary: () =>
    api.get<KaspiOrdersSummary>('/integrations/kaspi/orders/summary'),

  exportConnection: async (connectionId: string) => {
    const response = await apiClient.get<ArrayBuffer>(`/integrations/kaspi/connections/${connectionId}/export`, {
      responseType: 'arraybuffer',
    });

    const contentDisposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    const fileName = match?.[1] ?? `kaspi_orders_${connectionId}.xlsx`;

    return {
      buffer: response.data,
      fileName,
      contentType: String(response.headers['content-type'] ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    };
  },
};
