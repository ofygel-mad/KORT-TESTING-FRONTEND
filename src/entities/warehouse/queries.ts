import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { warehouseApi, warehouseCatalogApi } from './api';
import type {
  CreateItemDto, AddMovementDto, CreateWarehouseSiteDto,
  CreateWarehouseZoneDto, CreateWarehouseBinDto, UpsertWarehouseVariantDto,
  PostStockReceiptDto, PostStockTransferDto, CreateStockReservationDto,
  WarehousePoolPolicyDto, ImportOpeningBalanceRow,
} from './types';

// New query key for formula
const warehouseFormulaKey = (id: string) => ['warehouse', 'item-formula', id] as const;

export const warehouseKeys = {
  all: ['warehouse'] as const,
  items: (params?: object) => ['warehouse', 'items', params] as const,
  movements: (params?: object) => ['warehouse', 'movements', params] as const,
  alerts: ['warehouse', 'alerts'] as const,
  categories: ['warehouse', 'categories'] as const,
  summary: ['warehouse', 'summary'] as const,
  foundation: {
    status: ['warehouse', 'foundation', 'status'] as const,
    sites: ['warehouse', 'foundation', 'sites'] as const,
    siteStructure: (siteId: string) => ['warehouse', 'foundation', 'site-structure', siteId] as const,
    siteHealth: (siteId: string) => ['warehouse', 'foundation', 'site-health', siteId] as const,
    controlTower: (siteId: string) => ['warehouse', 'foundation', 'site-control-tower', siteId] as const,
    feed: (siteId: string, params?: object) => ['warehouse', 'foundation', 'site-feed', siteId, params] as const,
    twin: (siteId: string, params?: object) => ['warehouse', 'foundation', 'site-twin', siteId, params] as const,
    pools: (siteId: string) => ['warehouse', 'foundation', 'site-pools', siteId] as const,
    taskTimeline: (taskId: string) => ['warehouse', 'foundation', 'task-timeline', taskId] as const,
    exceptionTimeline: (exceptionId: string) => ['warehouse', 'foundation', 'exception-timeline', exceptionId] as const,
    layoutCompare: (leftVersionId: string, rightVersionId: string) =>
      ['warehouse', 'foundation', 'layout-compare', leftVersionId, rightVersionId] as const,
    publishAudit: (siteId: string) => ['warehouse', 'foundation', 'publish-audit', siteId] as const,
    routeHistory: (siteId: string, params?: object) => ['warehouse', 'foundation', 'route-history', siteId, params] as const,
    variants: ['warehouse', 'foundation', 'variants'] as const,
    balances: (siteId: string, params?: object) => ['warehouse', 'foundation', 'balances', siteId, params] as const,
    reservations: (siteId: string, params?: object) => ['warehouse', 'foundation', 'reservations', siteId, params] as const,
    tasks: (siteId: string, params?: object) => ['warehouse', 'foundation', 'tasks', siteId, params] as const,
    exceptions: (siteId: string, params?: object) => ['warehouse', 'foundation', 'exceptions', siteId, params] as const,
    documents: (siteId: string, params?: object) => ['warehouse', 'foundation', 'documents', siteId, params] as const,
    outbox: ['warehouse', 'foundation', 'outbox'] as const,
  },
  catalog: {
    definitions: ['warehouse', 'catalog', 'definitions'] as const,
    products: ['warehouse', 'catalog', 'products'] as const,
    orderForm: ['warehouse', 'order-form', 'catalog'] as const,
  },
};

export const useWarehouseItems = (params?: { search?: string; categoryId?: string; lowStock?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: warehouseKeys.items(params), queryFn: () => warehouseApi.listItems(params), staleTime: 60_000, refetchInterval: 5 * 60_000 });

export const useWarehouseMovements = (params?: { itemId?: string; type?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: warehouseKeys.movements(params), queryFn: () => warehouseApi.listMovements(params), staleTime: 60_000, refetchInterval: 5 * 60_000 });

export const useWarehouseAlerts = () =>
  useQuery({ queryKey: warehouseKeys.alerts, queryFn: () => warehouseApi.listAlerts({ status: 'open' }), staleTime: 30_000, refetchInterval: 5 * 60_000 });

export const useWarehouseCategories = () =>
  useQuery({ queryKey: warehouseKeys.categories, queryFn: () => warehouseApi.listCategories(), staleTime: 5 * 60_000 });

export const useWarehouseSummary = () =>
  useQuery({ queryKey: warehouseKeys.summary, queryFn: () => warehouseApi.getSummary(), staleTime: 60_000, refetchInterval: 5 * 60_000 });

export const useWarehouseFoundationStatus = () =>
  useQuery({
    queryKey: warehouseKeys.foundation.status,
    queryFn: () => warehouseApi.getFoundationStatus(),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationSites = () =>
  useQuery({
    queryKey: warehouseKeys.foundation.sites,
    queryFn: () => warehouseApi.listFoundationSites(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationSiteStructure = (siteId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.siteStructure(siteId ?? 'unknown'),
    queryFn: () => warehouseApi.getFoundationSiteStructure(siteId!),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });

export const useWarehouseFoundationSiteHealth = (siteId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.siteHealth(siteId ?? 'unknown'),
    queryFn: () => warehouseApi.getFoundationSiteHealth(siteId!),
    enabled: Boolean(siteId),
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationSiteControlTower = (siteId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.controlTower(siteId ?? 'unknown'),
    queryFn: () => warehouseApi.getFoundationSiteControlTower(siteId!),
    enabled: Boolean(siteId),
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationSiteFeed = (siteId?: string, params?: { limit?: number }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.feed(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.getFoundationSiteFeed(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 10_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationTwinRuntime = (siteId?: string, params?: { draftVersionId?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.twin(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.getFoundationTwinRuntime(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 10_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationAssigneePools = (siteId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.pools(siteId ?? 'unknown'),
    queryFn: () => warehouseApi.listFoundationAssigneePools(siteId!),
    enabled: Boolean(siteId),
    staleTime: 30_000,
  });

export const useWarehouseFoundationTaskTimeline = (taskId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.taskTimeline(taskId ?? 'unknown'),
    queryFn: () => warehouseApi.getFoundationTaskTimeline(taskId!),
    enabled: Boolean(taskId),
    staleTime: 15_000,
  });

export const useWarehouseFoundationExceptionTimeline = (exceptionId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.exceptionTimeline(exceptionId ?? 'unknown'),
    queryFn: () => warehouseApi.getFoundationExceptionTimeline(exceptionId!),
    enabled: Boolean(exceptionId),
    staleTime: 15_000,
  });

export const useWarehouseFoundationLayoutCompare = (leftVersionId?: string, rightVersionId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.layoutCompare(leftVersionId ?? 'unknown', rightVersionId ?? 'unknown'),
    queryFn: () => warehouseApi.compareFoundationLayoutVersions(leftVersionId!, rightVersionId!),
    enabled: Boolean(leftVersionId && rightVersionId),
    staleTime: 15_000,
  });

export const useWarehouseFoundationVariants = () =>
  useQuery({
    queryKey: warehouseKeys.foundation.variants,
    queryFn: () => warehouseApi.listFoundationVariants(),
    staleTime: 60_000,
  });

export const useWarehouseFoundationBalances = (siteId?: string, params?: { variantId?: string; binId?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.balances(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.listFoundationBalances(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationReservations = (siteId?: string, params?: { status?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.reservations(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.listFoundationReservations(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationTasks = (siteId?: string, params?: { status?: string; taskType?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.tasks(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.listFoundationTasks(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 10_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationExceptions = (siteId?: string, params?: { status?: string; severity?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.exceptions(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.listFoundationExceptions(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 10_000,
    refetchInterval: 5 * 60_000,
  });

export const useWarehouseFoundationDocuments = (siteId?: string, params?: { documentType?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.documents(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.listFoundationDocuments(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 15_000,
  });

export const useWarehouseFoundationOutboxRuntime = () =>
  useQuery({
    queryKey: warehouseKeys.foundation.outbox,
    queryFn: () => warehouseApi.getFoundationOutboxRuntime(),
    staleTime: 10_000,
    refetchInterval: 5 * 60_000,
  });

export const useCreateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateItemDto) => warehouseApi.createItem(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Позиция создана'); },
    onError: () => toast.error('Не удалось создать позицию'),
  });
};

export const useUpdateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateItemDto> }) => warehouseApi.updateItem(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Сохранено'); },
    onError: () => toast.error('Не удалось сохранить'),
  });
};

export const useDeleteItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseApi.deleteItem(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Удалено'); },
    onError: () => toast.error('Не удалось удалить'),
  });
};

export const useAddMovement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddMovementDto) => warehouseApi.addMovement(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.all }); toast.success('Движение записано'); },
    onError: () => toast.error('Ошибка при записи движения'),
  });
};

export const useImportOpeningBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: ImportOpeningBalanceRow[]) => warehouseApi.importOpeningBalance(rows),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.all });
      const msg = `Импорт: создано ${result.created}, обновлено ${result.updated}${result.skipped > 0 ? `, пропущено ${result.skipped}` : ''}`;
      result.errors.length > 0 ? toast.warning(msg) : toast.success(msg);
    },
    onError: () => toast.error('Ошибка при импорте остатков'),
  });
};

// ── Accumulation Method hooks ──────────────────────────────────────────────────

export const useItemFormula = (id: string | undefined) =>
  useQuery({
    queryKey: id ? warehouseFormulaKey(id) : ['warehouse', 'item-formula', '_disabled'],
    queryFn: () => warehouseApi.getItemFormula(id!),
    enabled: Boolean(id),
    staleTime: 10_000,
  });

export const useSetBeginningBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty, note }: { id: string; qty: number; note?: string }) =>
      warehouseApi.setBeginningBalance(id, qty, note),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.items() });
      qc.invalidateQueries({ queryKey: warehouseKeys.summary });
      qc.invalidateQueries({ queryKey: warehouseKeys.alerts });
      qc.invalidateQueries({ queryKey: warehouseFormulaKey(variables.id) });
      toast.success('Начальный остаток установлен. Сверка завершена.');
    },
    onError: () => toast.error('Не удалось установить начальный остаток'),
  });
};

export const useSyncFromOrders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => warehouseApi.syncFromOrders(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.items() });
      qc.invalidateQueries({ queryKey: warehouseKeys.alerts });
      toast.success(
        `Синхронизировано: создано ${result.createdItemIds.length}, совпало ${result.matchedItemIds.length} (просмотрено ${result.scannedOrders} заказов)`,
      );
    },
    onError: () => toast.error('Ошибка синхронизации с заказами'),
  });
};

export const useCreateWarehouseFoundationSite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWarehouseSiteDto) => warehouseApi.createFoundationSite(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.status });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.sites });
      toast.success('Склад foundation создан');
    },
    onError: () => toast.error('Не удалось создать foundation-склад'),
  });
};

export const useCreateWarehouseFoundationZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, dto }: { siteId: string; dto: CreateWarehouseZoneDto }) =>
      warehouseApi.createFoundationZone(siteId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.status });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.sites });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteStructure(variables.siteId) });
      toast.success('Зона foundation создана');
    },
    onError: () => toast.error('Не удалось создать foundation-зону'),
  });
};

export const useCreateWarehouseFoundationBin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, dto }: { siteId: string; dto: CreateWarehouseBinDto }) =>
      warehouseApi.createFoundationBin(siteId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.status });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteStructure(variables.siteId) });
      toast.success('Ячейка foundation создана');
    },
    onError: () => toast.error('Не удалось создать foundation-ячейку'),
  });
};

export const useUpsertWarehouseFoundationVariant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpsertWarehouseVariantDto) => warehouseApi.upsertFoundationVariant(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.variants });
      toast.success('Variant foundation сохранён');
    },
    onError: () => toast.error('Не удалось сохранить foundation-variant'),
  });
};

export const usePostWarehouseFoundationReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: PostStockReceiptDto) => warehouseApi.postFoundationReceipt(dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.status });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteStructure(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.balances(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.outbox });
      toast.success('Receipt записан в canonical warehouse');
    },
    onError: () => toast.error('Не удалось записать receipt'),
  });
};

export const usePostWarehouseFoundationTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: PostStockTransferDto) => warehouseApi.postFoundationTransfer(dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.balances(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.outbox });
      toast.success('Transfer записан в canonical warehouse');
    },
    onError: () => toast.error('Не удалось записать transfer'),
  });
};

export const useCreateWarehouseFoundationReservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStockReservationDto) => warehouseApi.createFoundationReservation(dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.balances(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.reservations(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.warehouseSiteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.outbox });
      toast.success('Reservation создан');
    },
    onError: () => toast.error('Не удалось создать reservation'),
  });
};

export const useReleaseWarehouseFoundationReservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, reason, siteId }: { reservationId: string; reason?: string; siteId?: string }) =>
      warehouseApi.releaseFoundationReservation(reservationId, reason).then((result) => ({ result, siteId })),
    onSuccess: ({ siteId }) => {
      if (siteId) {
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.balances(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.reservations(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(siteId) });
      } else {
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.status });
      }
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.outbox });
      toast.success('Reservation released');
    },
    onError: () => toast.error('Не удалось снять reservation'),
  });
};

/** Check finished-goods availability for a list of product names (Chapan integration) */
export const useConsumeWarehouseFoundationReservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, reason, siteId }: { reservationId: string; reason?: string; siteId?: string }) =>
      warehouseApi.consumeFoundationReservation(reservationId, reason).then((result) => ({ result, siteId })),
    onSuccess: ({ siteId }) => {
      if (siteId) {
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.balances(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.reservations(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(siteId) });
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(siteId) });
      } else {
        qc.invalidateQueries({ queryKey: warehouseKeys.foundation.status });
      }
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.outbox });
      toast.success('Reservation consumed');
    },
    onError: () => toast.error('Не удалось списать reservation'),
  });
};

export const useSyncWarehouseFoundationOperationalState = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => warehouseApi.syncFoundationOperationalState(siteId),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteHealth(siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.tasks(siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptions(siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(siteId) });
      toast.success('Warehouse runtime synced');
    },
    onError: () => toast.error('Не удалось синхронизировать warehouse runtime'),
  });
};

export const useCreateWarehouseFoundationLayoutDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, notes }: { siteId: string; notes?: string }) =>
      warehouseApi.createFoundationLayoutDraft(siteId, notes ? { notes } : {}),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteStructure(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      toast.success('Layout draft created');
    },
    onError: () => toast.error('Не удалось создать layout draft'),
  });
};

export const useUpdateWarehouseFoundationLayoutNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, draftId, nodeId, dto }: { siteId: string; draftId: string; nodeId: string; dto: Record<string, unknown> }) =>
      warehouseApi.updateFoundationLayoutNode(draftId, nodeId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
    },
    onError: () => toast.error('Не удалось обновить layout node'),
  });
};

export const usePublishWarehouseFoundationLayoutDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      draftId,
      dto,
    }: {
      siteId: string;
      draftId: string;
      dto?: { force?: boolean; forceReason?: string };
    }) => warehouseApi.publishFoundationLayoutDraft(draftId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.siteStructure(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.pools(variables.siteId) });
      toast.success('Layout draft published');
    },
    onError: () => toast.error('Не удалось опубликовать layout draft'),
  });
};

export const useValidateWarehouseFoundationLayoutDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, draftId }: { siteId: string; draftId: string }) =>
      warehouseApi.validateFoundationLayoutDraft(draftId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      toast.success('Layout draft validated');
    },
    onError: () => toast.error('Не удалось провалидировать layout draft'),
  });
};

export const useUpdateWarehouseFoundationTaskStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, taskId, status }: { siteId: string; taskId: string; status: string }) =>
      warehouseApi.updateFoundationTaskStatus(taskId, status),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.tasks(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      toast.success('Task status updated');
    },
    onError: () => toast.error('Не удалось обновить task'),
  });
};

export const useCommandWarehouseFoundationTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      taskId,
      dto,
    }: {
      siteId: string;
      taskId: string;
      dto: { command: 'assign' | 'start' | 'pause' | 'complete' | 'cancel' | 'replenish'; assigneeName?: string; assigneeRole?: string; poolId?: string };
    }) => warehouseApi.commandFoundationTask(taskId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.tasks(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.pools(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.taskTimeline(variables.taskId) });
      toast.success('Task command applied');
    },
    onError: () => toast.error('Не удалось выполнить warehouse task command'),
  });
};

export const useUpdateWarehouseFoundationExceptionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, exceptionId, status }: { siteId: string; exceptionId: string; status: string }) =>
      warehouseApi.updateFoundationExceptionStatus(exceptionId, status),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptions(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      toast.success('Exception status updated');
    },
    onError: () => toast.error('Не удалось обновить exception'),
  });
};

export const useCommandWarehouseFoundationException = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      exceptionId,
      dto,
    }: {
      siteId: string;
      exceptionId: string;
      dto: { command: 'assign' | 'acknowledge' | 'resolve' | 'escalate' | 'reopen'; ownerName?: string; ownerRole?: string; poolId?: string; resolutionCode?: string };
    }) => warehouseApi.commandFoundationException(exceptionId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.controlTower(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptions(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.feed(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.pools(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.exceptionTimeline(variables.exceptionId) });
      toast.success('Exception command applied');
    },
    onError: () => toast.error('Не удалось выполнить exception command'),
  });
};

export const useProductsAvailability = (names: string[]) => {
  const sorted = [...names].sort();
  return useQuery({
    queryKey: ['warehouse_products_availability', sorted],
    queryFn: () => warehouseApi.checkProducts(sorted),
    enabled: sorted.length > 0,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });
};

export const useVariantAvailability = (
  variants: Array<{ name: string; color?: string; size?: string; gender?: string }>,
) => {
  const stable = JSON.stringify(
    [...variants]
      .filter((v) => v.name?.trim())
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  return useQuery({
    queryKey: ['warehouse_variant_availability', stable],
    queryFn: () => warehouseApi.checkVariants(JSON.parse(stable)),
    enabled: variants.some((v) => v.name?.trim()),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });
};

export const useResolveAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseApi.resolveAlert(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: warehouseKeys.alerts }); },
  });
};

// ── Smart Catalog hooks ────────────────────────────────────────────────────────

export const useCatalogDefinitions = () =>
  useQuery({
    queryKey: warehouseKeys.catalog.definitions,
    queryFn: () => warehouseCatalogApi.listDefinitions(),
    staleTime: 5 * 60_000,
  });

export const useCatalogProducts = () =>
  useQuery({
    queryKey: warehouseKeys.catalog.products,
    queryFn: () => warehouseCatalogApi.listProducts(),
    staleTime: 5 * 60_000,
  });

export const useOrderFormCatalog = () =>
  useQuery({
    queryKey: warehouseKeys.catalog.orderForm,
    queryFn: () => warehouseCatalogApi.getOrderFormCatalog(),
    staleTime: 60_000,
  });

export const useCreateDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: warehouseCatalogApi.createDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      toast.success('Поле создано');
    },
    onError: () => toast.error('Не удалось создать поле'),
  });
};

export const useUpdateDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      warehouseCatalogApi.updateDefinition(id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось обновить поле'),
  });
};

export const useDeleteDefinition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseCatalogApi.deleteDefinition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Поле удалено');
    },
    onError: () => toast.error('Не удалось удалить поле'),
  });
};

export const useAddFieldOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ defId, value, label }: { defId: string; value: string; label: string }) =>
      warehouseCatalogApi.addOption(defId, { value, label }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось добавить значение'),
  });
};

export const useUpdateFieldOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ defId, optId, data }: { defId: string; optId: string; data: { label?: string; colorHex?: string } }) =>
      warehouseCatalogApi.updateOption(defId, optId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось обновить значение'),
  });
};

export const useDeleteFieldOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ defId, optId }: { defId: string; optId: string }) =>
      warehouseCatalogApi.deleteOption(defId, optId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось удалить значение'),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      warehouseCatalogApi.updateProduct(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
    },
    onError: () => toast.error('Не удалось переименовать товар'),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseCatalogApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Товар удалён');
    },
    onError: () => toast.error('Не удалось удалить товар'),
  });
};

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => warehouseCatalogApi.createProduct(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Товар добавлен');
    },
    onError: () => toast.error('Не удалось добавить товар'),
  });
};

export const useSetProductFields = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, fields }: { productId: string; fields: Array<{ definitionId: string; isRequired?: boolean; sortOrder?: number }> }) =>
      warehouseCatalogApi.setProductFields(productId, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success('Поля товара сохранены');
    },
    onError: () => toast.error('Не удалось сохранить поля товара'),
  });
};

export const useSeedDefaults = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => warehouseCatalogApi.seedDefaults(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Созданы поля: ${data.created.length > 0 ? data.created.join(', ') : 'нет новых'}`);
    },
    onError: () => toast.error('Не удалось инициализировать поля'),
  });
};

export const useSmartImportProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => warehouseCatalogApi.smartImportProducts(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      const { products, fields } = data;
      toast.success(`Загружено: ${products.created} товаров. Поля: ${fields.created.length > 0 ? fields.created.join(', ') : 'уже были'}`);
    },
    onError: () => toast.error('Ошибка загрузки таблицы товаров'),
  });
};

export const useSmartImportColors = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => warehouseCatalogApi.smartImportColors(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Загружено: ${data.created} цветов`);
    },
    onError: () => toast.error('Ошибка загрузки таблицы цветов'),
  });
};

export const useImportProducts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => warehouseCatalogApi.importProducts(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.products });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Товары импортированы: +${data.created}, пропущено ${data.skipped}`);
    },
    onError: () => toast.error('Ошибка импорта товаров'),
  });
};

export const useImportFieldOptions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, file }: { code: string; file: File }) =>
      warehouseCatalogApi.importFieldOptions(code, file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.definitions });
      qc.invalidateQueries({ queryKey: warehouseKeys.catalog.orderForm });
      toast.success(`Значения импортированы: +${data.created}, пропущено ${data.skipped}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Ошибка импорта'),
  });
};

// ── Execution engine / publish audit hooks ─────────────────────────────────────

export const useWarehouseFoundationLayoutPublishAudit = (siteId?: string) =>
  useQuery({
    queryKey: warehouseKeys.foundation.publishAudit(siteId ?? 'unknown'),
    queryFn: () => warehouseApi.getFoundationLayoutPublishAudit(siteId!),
    enabled: Boolean(siteId),
    staleTime: 15_000,
  });

export const useWarehouseFoundationRouteHistory = (siteId?: string, params?: { limit?: number; taskType?: string }) =>
  useQuery({
    queryKey: warehouseKeys.foundation.routeHistory(siteId ?? 'unknown', params),
    queryFn: () => warehouseApi.getFoundationRouteHistory(siteId!, params),
    enabled: Boolean(siteId),
    staleTime: 15_000,
  });

export const useRollbackWarehouseFoundationLayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, targetVersionId, reason }: { siteId: string; targetVersionId: string; reason?: string }) =>
      warehouseApi.rollbackFoundationLayout(siteId, { targetVersionId, reason }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.publishAudit(variables.siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.sites });
      toast.success('Layout успешно откачен к предыдущей версии');
    },
    onError: () => toast.error('Не удалось откатить layout'),
  });
};

export const useTriggerSlaEscalation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => warehouseApi.triggerSlaEscalation(siteId),
    onSuccess: (data, siteId) => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.twin(siteId) });
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.pools(siteId) });
      if (data.escalated > 0) {
        toast.warning(`SLA: ${data.escalated} задач эскалировано`);
      } else {
        toast.success('Нет задач с нарушенным SLA');
      }
    },
    onError: () => toast.error('Ошибка при эскалации SLA'),
  });
};

export const useUpdatePoolPolicy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poolId, dto }: { poolId: string; dto: WarehousePoolPolicyDto }) =>
      warehouseApi.updatePoolPolicy(poolId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.foundation.sites });
      toast.success('Политика пула обновлена');
    },
    onError: () => toast.error('Не удалось обновить политику пула'),
  });
};

// ── Transit Zone hooks ─────────────────────────────────────────────────────────

export const useTransitZones = () =>
  useQuery({
    queryKey: ['warehouse', 'transit-zones'] as const,
    queryFn: () => warehouseApi.listTransitZones(),
    staleTime: 60_000,
  });

export const useTransitEntries = (params?: { status?: string; orderId?: string }) =>
  useQuery({
    queryKey: ['warehouse', 'transit-entries', params] as const,
    queryFn: () => warehouseApi.listTransitEntries(params),
    staleTime: 30_000,
  });

export const useDispatchTransitEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, entryId }: { zoneId: string; entryId: string }) =>
      warehouseApi.dispatchTransitEntry(zoneId, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse', 'transit-entries'] });
      toast.success('Отгрузка подтверждена');
    },
    onError: () => toast.error('Не удалось подтвердить отгрузку'),
  });
};
