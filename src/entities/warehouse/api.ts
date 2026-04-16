import { api, apiClient } from '../../shared/api/client';
import type {
  WarehouseItem, WarehouseMovement, WarehouseAlert, WarehouseCategory,
  WarehouseSummary, PaginatedWarehouseItems, PaginatedMovements,
  CreateItemDto, AddMovementDto, ProductsAvailabilityMap, ImportOpeningBalanceRow, ImportOpeningBalanceResult,
  VariantAvailabilityMap, ItemFormulaBreakdown,
  WarehouseFieldDefinition, WarehouseProductCatalog, OrderFormCatalog,
  VariantAvailability, ImportResult, WarehouseFoundationStatus,
  WarehouseSite, WarehouseSiteStructure, WarehouseSiteHealthSnapshot, WarehouseSiteControlTowerSnapshot, WarehouseZone, WarehouseBin,
  CreateWarehouseSiteDto, CreateWarehouseZoneDto, CreateWarehouseBinDto,
  WarehouseVariant, WarehouseSiteBalancesResponse, UpsertWarehouseVariantDto,
  PostStockReceiptDto, PostStockTransferDto, CreateStockReservationDto,
  WarehouseStockReservation, WarehouseSiteReservationsResponse,
  WarehouseSiteDocumentsResponse, WarehouseSiteFeedResponse, WarehouseOutboxRuntimeStatus,
  WarehouseSiteTasksResponse, WarehouseSiteExceptionsResponse, WarehouseTwinRuntime,
  CreateWarehouseLayoutDraftDto, UpdateWarehouseLayoutNodeDto,
  WarehouseLayoutDraftCreateResult, WarehouseLayoutNodeUpdateResult, WarehouseLayoutPublishResult,
  WarehouseTaskCommandDto, WarehouseExceptionCommandDto, WarehouseLayoutAnalysis,
  WarehouseLayoutPublishDto, WarehouseAssigneePoolsResponse, WarehouseTaskTimelineResponse,
  WarehouseExceptionTimelineResponse, WarehouseLayoutVersionCompareResult,
  WarehouseLayoutPublishAuditResponse, WarehouseLayoutRollbackResult,
  WarehouseRouteHistoryResponse, WarehouseSlaEscalationResult, WarehousePoolPolicyDto,
} from './types';

export const warehouseApi = {
  // Items
  listItems: (params?: { search?: string; categoryId?: string; lowStock?: string; page?: number; limit?: number }) =>
    api.get<PaginatedWarehouseItems>('/warehouse/items', params),

  createItem: (dto: CreateItemDto) =>
    api.post<WarehouseItem>('/warehouse/items', dto),

  updateItem: (id: string, dto: Partial<CreateItemDto>) =>
    api.patch<WarehouseItem>(`/warehouse/items/${id}`, dto),

  deleteItem: (id: string) =>
    api.delete<{ ok: boolean }>(`/warehouse/items/${id}`),

  importOpeningBalance: (rows: ImportOpeningBalanceRow[]) =>
    api.post<ImportOpeningBalanceResult>('/warehouse/items/import-opening-balance', { rows }),

  // Accumulation Method
  setBeginningBalance: (id: string, qty: number, note?: string) =>
    api.post<ItemFormulaBreakdown>(`/warehouse/items/${id}/set-beginning-balance`, { qty, note }),

  syncFromOrders: () =>
    api.post<{ createdItemIds: string[]; matchedItemIds: string[]; scannedOrders: number }>(
      '/warehouse/items/sync-from-orders', {},
    ),

  getItemFormula: (id: string) =>
    api.get<ItemFormulaBreakdown>(`/warehouse/items/${id}/formula`),

  // Movements
  listMovements: (params?: { itemId?: string; type?: string; page?: number; limit?: number }) =>
    api.get<PaginatedMovements>('/warehouse/movements', params),

  addMovement: (dto: AddMovementDto) =>
    api.post<WarehouseMovement>('/warehouse/movements', dto),

  // Alerts
  listAlerts: (params?: { status?: string }) =>
    api.get<{ count: number; results: WarehouseAlert[] }>('/warehouse/alerts', params),

  resolveAlert: (id: string) =>
    api.patch<WarehouseAlert>(`/warehouse/alerts/${id}/resolve`, {}),

  // Categories
  listCategories: () =>
    api.get<{ count: number; results: WarehouseCategory[] }>('/warehouse/categories'),

  createCategory: (name: string) =>
    api.post<WarehouseCategory>('/warehouse/categories', { name }),

  // Summary
  getSummary: () =>
    api.get<WarehouseSummary>('/warehouse/summary'),

  // Foundation / canonical WMS slice
  getFoundationStatus: () =>
    api.get<WarehouseFoundationStatus>('/warehouse/foundation/status'),

  listFoundationSites: () =>
    api.get<{ count: number; results: WarehouseSite[] }>('/warehouse/foundation/sites'),

  createFoundationSite: (dto: CreateWarehouseSiteDto) =>
    api.post<WarehouseSite>('/warehouse/foundation/sites', dto),

  getFoundationSiteStructure: (id: string) =>
    api.get<WarehouseSiteStructure>(`/warehouse/foundation/sites/${id}/structure`),

  getFoundationSiteHealth: (id: string) =>
    api.get<WarehouseSiteHealthSnapshot>(`/warehouse/foundation/sites/${id}/health`),

  getFoundationSiteControlTower: (id: string) =>
    api.get<WarehouseSiteControlTowerSnapshot>(`/warehouse/foundation/sites/${id}/control-tower`),

  createFoundationZone: (siteId: string, dto: CreateWarehouseZoneDto) =>
    api.post<WarehouseZone>(`/warehouse/foundation/sites/${siteId}/zones`, dto),

  createFoundationBin: (siteId: string, dto: CreateWarehouseBinDto) =>
    api.post<WarehouseBin>(`/warehouse/foundation/sites/${siteId}/bins`, dto),

  listFoundationVariants: () =>
    api.get<{ count: number; results: WarehouseVariant[] }>('/warehouse/foundation/variants'),

  upsertFoundationVariant: (dto: UpsertWarehouseVariantDto) =>
    api.post<{ variant: WarehouseVariant }>('/warehouse/foundation/variants/upsert', dto),

  listFoundationBalances: (siteId: string, params?: { variantId?: string; binId?: string }) =>
    api.get<WarehouseSiteBalancesResponse>(`/warehouse/foundation/sites/${siteId}/balances`, params),

  listFoundationReservations: (siteId: string, params?: { status?: string }) =>
    api.get<WarehouseSiteReservationsResponse>(`/warehouse/foundation/sites/${siteId}/reservations`, params),

  listFoundationTasks: (siteId: string, params?: { status?: string; taskType?: string }) =>
    api.get<WarehouseSiteTasksResponse>(`/warehouse/foundation/sites/${siteId}/tasks`, params),

  listFoundationAssigneePools: (siteId: string) =>
    api.get<WarehouseAssigneePoolsResponse>(`/warehouse/foundation/sites/${siteId}/assignee-pools`),

  getFoundationTaskTimeline: (taskId: string) =>
    api.get<WarehouseTaskTimelineResponse>(`/warehouse/foundation/tasks/${taskId}/timeline`),

  getFoundationExceptionTimeline: (exceptionId: string) =>
    api.get<WarehouseExceptionTimelineResponse>(`/warehouse/foundation/exceptions/${exceptionId}/timeline`),

  listFoundationExceptions: (siteId: string, params?: { status?: string; severity?: string }) =>
    api.get<WarehouseSiteExceptionsResponse>(`/warehouse/foundation/sites/${siteId}/exceptions`, params),

  listFoundationDocuments: (siteId: string, params?: { documentType?: string }) =>
    api.get<WarehouseSiteDocumentsResponse>(`/warehouse/foundation/sites/${siteId}/documents`, params),

  getFoundationSiteFeed: (siteId: string, params?: { limit?: number }) =>
    api.get<WarehouseSiteFeedResponse>(`/warehouse/foundation/sites/${siteId}/feed`, params),

  syncFoundationOperationalState: (siteId: string) =>
    api.post(`/warehouse/foundation/sites/${siteId}/operational/sync`, {}),

  getFoundationTwinRuntime: (siteId: string, params?: { draftVersionId?: string }) =>
    api.get<WarehouseTwinRuntime>(`/warehouse/foundation/sites/${siteId}/twin`, params),

  createFoundationLayoutDraft: (siteId: string, dto?: CreateWarehouseLayoutDraftDto) =>
    api.post<WarehouseLayoutDraftCreateResult>(`/warehouse/foundation/sites/${siteId}/layout-drafts`, dto ?? {}),

  updateFoundationLayoutNode: (draftId: string, nodeId: string, dto: UpdateWarehouseLayoutNodeDto) =>
    api.patch<WarehouseLayoutNodeUpdateResult>(`/warehouse/foundation/layout-drafts/${draftId}/nodes/${nodeId}`, dto),

  validateFoundationLayoutDraft: (draftId: string) =>
    api.post<WarehouseLayoutAnalysis>(`/warehouse/foundation/layout-drafts/${draftId}/validate`, {}),

  publishFoundationLayoutDraft: (draftId: string, dto?: WarehouseLayoutPublishDto) =>
    api.post<WarehouseLayoutPublishResult>(`/warehouse/foundation/layout-drafts/${draftId}/publish`, dto ?? {}),

  compareFoundationLayoutVersions: (leftVersionId: string, rightVersionId: string) =>
    api.get<WarehouseLayoutVersionCompareResult>('/warehouse/foundation/layout-versions/compare', {
      leftVersionId,
      rightVersionId,
    }),

  updateFoundationTaskStatus: (taskId: string, status: string) =>
    api.post(`/warehouse/foundation/tasks/${taskId}/status`, { status }),

  commandFoundationTask: (taskId: string, dto: WarehouseTaskCommandDto) =>
    api.post(`/warehouse/foundation/tasks/${taskId}/command`, dto),

  updateFoundationExceptionStatus: (exceptionId: string, status: string) =>
    api.post(`/warehouse/foundation/exceptions/${exceptionId}/status`, { status }),

  commandFoundationException: (exceptionId: string, dto: WarehouseExceptionCommandDto) =>
    api.post(`/warehouse/foundation/exceptions/${exceptionId}/command`, dto),

  getFoundationOutboxRuntime: () =>
    api.get<WarehouseOutboxRuntimeStatus>('/warehouse/foundation/system/outbox'),

  postFoundationReceipt: (dto: PostStockReceiptDto) =>
    api.post('/warehouse/foundation/inventory/receipts', dto),

  postFoundationTransfer: (dto: PostStockTransferDto) =>
    api.post('/warehouse/foundation/inventory/transfers', dto),

  createFoundationReservation: (dto: CreateStockReservationDto) =>
    api.post<{ reservation: WarehouseStockReservation }>('/warehouse/foundation/inventory/reservations', dto),

  releaseFoundationReservation: (reservationId: string, reason?: string) =>
    api.post<{ reservation: WarehouseStockReservation }>(
      `/warehouse/foundation/inventory/reservations/${reservationId}/release`,
      reason ? { reason } : {},
    ),

  consumeFoundationReservation: (reservationId: string, reason?: string) =>
    api.post<{ reservation: WarehouseStockReservation }>(
      `/warehouse/foundation/inventory/reservations/${reservationId}/consume`,
      reason ? { reason } : {},
    ),

  // Chapan integration: check if finished products are in stock by name
  checkProducts: (names: string[]) =>
    api.post<ProductsAvailabilityMap>('/warehouse/products-availability', { names }),

  // Chapan integration: check stock by full variant (name + color/size/gender)
  checkVariants: (variants: Array<{ name: string; color?: string; size?: string; gender?: string }>) =>
    api.post<VariantAvailabilityMap>('/warehouse/items/variant-availability', { variants }),

  // Layout rollback
  rollbackFoundationLayout: (siteId: string, dto: { targetVersionId: string; reason?: string }) =>
    api.post<WarehouseLayoutRollbackResult>(`/warehouse/foundation/sites/${siteId}/layout-rollback`, dto),

  getFoundationLayoutPublishAudit: (siteId: string, params?: { limit?: number }) =>
    api.get<WarehouseLayoutPublishAuditResponse>(`/warehouse/foundation/sites/${siteId}/layout-publish-audit`, params),

  // Route history (event-sourced replay)
  getFoundationRouteHistory: (siteId: string, params?: { limit?: number; taskType?: string; since?: string }) =>
    api.get<WarehouseRouteHistoryResponse>(`/warehouse/foundation/sites/${siteId}/route-history`, params),

  // SLA escalation
  triggerSlaEscalation: (siteId: string) =>
    api.post<WarehouseSlaEscalationResult>(`/warehouse/foundation/sites/${siteId}/execution/escalate-sla`, {}),

  // Pool policy
  updatePoolPolicy: (poolId: string, dto: WarehousePoolPolicyDto) =>
    api.patch<WarehouseAssigneePoolsResponse>(`/warehouse/foundation/assignee-pools/${poolId}/policy`, dto),
};

// ── Smart Catalog API ──────────────────────────────────────────────────────────

export const warehouseCatalogApi = {
  // Field definitions
  listDefinitions: () =>
    api.get<WarehouseFieldDefinition[]>('/warehouse/catalog/definitions'),

  createDefinition: (data: {
    code: string; label: string; inputType: string;
    isVariantAxis?: boolean; affectsAvailability?: boolean;
    showInWarehouseForm?: boolean; showInOrderForm?: boolean;
    sortOrder?: number;
  }) => api.post<WarehouseFieldDefinition>('/warehouse/catalog/definitions', data),

  updateDefinition: (id: string, data: Partial<WarehouseFieldDefinition>) =>
    api.patch<WarehouseFieldDefinition>(`/warehouse/catalog/definitions/${id}`, data),

  deleteDefinition: (id: string) =>
    api.delete<{ ok: boolean }>(`/warehouse/catalog/definitions/${id}`),

  addOption: (defId: string, data: { value: string; label: string; sortOrder?: number; colorHex?: string }) =>
    api.post(`/warehouse/catalog/definitions/${defId}/options`, data),

  bulkAddOptions: (defId: string, values: Array<{ value: string; label: string }>) =>
    api.post(`/warehouse/catalog/definitions/${defId}/options/bulk`, { values }),

  updateOption: (defId: string, optId: string, data: { label?: string; colorHex?: string }) =>
    api.patch(`/warehouse/catalog/definitions/${defId}/options/${optId}`, data),

  deleteOption: (defId: string, optId: string) =>
    api.delete(`/warehouse/catalog/definitions/${defId}/options/${optId}`),

  // Product catalog
  listProducts: () =>
    api.get<WarehouseProductCatalog[]>('/warehouse/catalog/products'),

  createProduct: (name: string) =>
    api.post<WarehouseProductCatalog>('/warehouse/catalog/products', { name }),

  updateProduct: (id: string, data: { name: string }) =>
    api.patch<WarehouseProductCatalog>(`/warehouse/catalog/products/${id}`, data),

  deleteProduct: (id: string) =>
    api.delete<{ ok: boolean }>(`/warehouse/catalog/products/${id}`),

  setProductFields: (productId: string, fields: Array<{ definitionId: string; isRequired?: boolean; sortOrder?: number }>) =>
    api.put<WarehouseProductCatalog>(`/warehouse/catalog/products/${productId}/fields`, { fields }),

  // Seed defaults (size, color, gender, length)
  seedDefaults: () =>
    api.post<{ created: string[]; skipped: string[] }>('/warehouse/catalog/seed-defaults', {}),

  // Order-form live catalog
  getOrderFormCatalog: () =>
    api.get<OrderFormCatalog>('/warehouse/order-form/catalog'),

  // Variant availability check
  checkVariant: (productName: string, attributes: Record<string, string>) =>
    api.post<VariantAvailability>('/warehouse/availability/check-variant', { productName, attributes }),

  // Smart one-click import (robot)
  smartImportProducts: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<{ fields: { created: string[]; skipped: string[] }; products: { created: number; skipped: number; errors: string[] } }>(
        '/warehouse/catalog/smart-import/products', form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },

  smartImportColors: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<{ field: string; created: number; skipped: number; errors: string[] }>(
        '/warehouse/catalog/smart-import/colors', form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },

  // Excel import
  importProducts: (file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<ImportResult>('/warehouse/catalog/import/products', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  importFieldOptions: (code: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiClient
      .post<ImportResult>(`/warehouse/catalog/import/field-options/${code}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
