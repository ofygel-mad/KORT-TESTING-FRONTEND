// Backend: /api/v1/warehouse/*

export interface WarehouseCategory {
  id: string;
  name: string;
  color?: string;
}

export interface WarehouseItem {
  id: string;
  orgId: string;
  name: string;
  sku?: string | null;
  unit: string;
  qty: number;
  qtyBeginning: number;
  qtyReserved: number;
  verificationRequired: boolean;
  qtyMin: number;
  qtyMax?: number | null;
  costPrice?: number | null;
  categoryId?: string | null;
  category?: WarehouseCategory | null;
  tags: string[];
  notes?: string | null;
  variantKey?: string | null;
  attributesJson?: Record<string, string> | null;
  attributesSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemFormulaBreakdown {
  qtyBeginning: number;
  totalIn: number;
  totalOut: number;
  qtyEnd: number;
  qtyReserved: number;
  qtyAvailable: number;
  verificationRequired: boolean;
}

export type MovementType = 'in' | 'out' | 'adjustment' | 'write_off' | 'return';

export interface WarehouseMovement {
  id: string;
  orgId: string;
  itemId: string;
  item?: Pick<WarehouseItem, 'id' | 'name' | 'unit'>;
  type: MovementType;
  qty: number;
  qtyBefore?: number | null;
  qtyAfter?: number | null;
  sourceId?: string | null;
  sourceType?: string | null;
  reason?: string | null;
  author: string;
  createdAt: string;
}

export interface WarehouseAlert {
  id: string;
  orgId: string;
  itemId: string;
  item?: Pick<WarehouseItem, 'id' | 'name' | 'unit' | 'qty' | 'qtyMin'>;
  type: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface WarehouseSummary {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  categories: number;
}

export interface WarehouseFoundationStatus {
  structure: {
    sites: number;
    zones: number;
    bins: number;
    structureReady: boolean;
  };
  inventory: {
    variants: number;
    balances: number;
    ledgerEvents: number;
  };
  system: {
    layoutVersions: number;
    pendingOutbox: number;
    processedInbox: number;
  };
}

export interface WarehouseSite {
  id: string;
  orgId: string;
  code: string;
  name: string;
  status: string;
  timezone: string;
  publishedLayoutVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    zones: number;
    bins: number;
    layoutVersions: number;
  };
}

export interface WarehouseZone {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  parentZoneId?: string | null;
  code: string;
  name: string;
  zoneType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    bins: number;
    aisles: number;
    racks: number;
    childZones: number;
  };
}

export interface WarehouseBin {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  zoneId: string;
  aisleId?: string | null;
  rackId?: string | null;
  shelfId?: string | null;
  code: string;
  status: string;
  binType: string;
  capacityUnits?: number | null;
  capacityWeight?: number | null;
  capacityVolume?: number | null;
  pickFaceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  zone?: Pick<WarehouseZone, 'id' | 'code' | 'name'>;
}

export interface WarehouseLayoutVersion {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  versionNo: number;
  state: string;
  basedOnVersionId?: string | null;
  validationStatus?: string;
  validationSummaryJson?: Record<string, unknown> | null;
  validatedAt?: string | null;
  publishedAt?: string | null;
  createdBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseAssigneePool {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  code: string;
  name: string;
  poolType: string;
  active: boolean;
  capacityLimit?: number | null;
  assignmentPolicy: 'fifo' | 'round_robin' | 'skill_match';
  slaTimeoutMin: number;
  escalationPoolId?: string | null;
  createdAt: string;
  updatedAt: string;
  activeTasks?: number;
  overdueTasks?: number;
  activeExceptions?: number;
  breachedExceptions?: number;
}

export interface WarehouseSiteStructure {
  site: WarehouseSite & {
    _count: {
      zones: number;
      bins: number;
      aisles: number;
      racks: number;
      layoutVersions: number;
    };
  };
  liveLayout: WarehouseLayoutVersion | null;
  zones: WarehouseZone[];
  bins: WarehouseBin[];
  pendingOutbox: number;
}

export interface WarehouseSiteHealthSnapshot {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'> & {
    _count: {
      zones: number;
      bins: number;
      layoutVersions: number;
    };
  };
  structure: {
    zones: number;
    bins: number;
    layoutVersions: number;
  };
  inventory: {
    balanceRows: number;
    variantsWithStock: number;
    qtyOnHand: number;
    qtyReserved: number;
    qtyAvailable: number;
  };
  operations: {
    reservations: {
      active: number;
      consumed: number;
      released: number;
    };
    documents: {
      total: number;
      handoffs: number;
      shipments: number;
    };
    lastDocument?: {
      id: string;
      documentType: string;
      status: string;
      postedAt: string;
      referenceNo?: string | null;
    } | null;
  };
  realtime: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
  };
}

export interface WarehouseSiteControlAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  code: string;
  title: string;
  description: string;
}

export interface WarehouseSiteAlertClassSummary {
  id: string;
  label: string;
  level: 'info' | 'warning' | 'critical';
  count: number;
}

export interface WarehouseSiteActionableCounter {
  id: string;
  label: string;
  value: number;
  level: 'info' | 'warning' | 'critical';
  note: string;
}

export interface WarehouseSiteActionCard {
  id: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  metric?: string;
}

export interface WarehouseOperationalTaskSummary {
  queued: number;
  active: number;
  blocked: number;
  assigned: number;
  overdue: number;
}

export interface WarehouseOperationalExceptionSummary {
  open: number;
  critical: number;
  owned: number;
  breached: number;
}

export interface WarehouseReplenishmentSummary {
  candidateBins: number;
  urgentBins: number;
  urgentZones: number;
}

export interface WarehouseOperationalTaskQueue {
  id: string;
  label: string;
  queueType: 'pick' | 'putaway' | 'replenishment' | 'exception';
  count: number;
  level: 'info' | 'warning' | 'critical';
  description: string;
  href: string;
}

export interface WarehouseOperationalException {
  id: string;
  level: 'info' | 'warning' | 'critical';
  category: 'structure' | 'stockout' | 'replenishment' | 'blocked' | 'capacity';
  title: string;
  description: string;
  zoneId?: string;
  zoneCode?: string;
  binId?: string;
  binCode?: string;
  href: string;
}

export interface WarehouseReplenishmentHotspot {
  id: string;
  binId: string;
  binCode: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  level: 'info' | 'warning' | 'critical';
  qtyAvailable: number;
  qtyReserved: number;
  capacityUnits?: number | null;
  primaryVariantLabel?: string | null;
}

export interface WarehouseSiteMapZoneHeat {
  id: string;
  code: string;
  name: string;
  zoneType: string;
  status: string;
  binCount: number;
  activeBins: number;
  blockedBins: number;
  qtyOnHand: number;
  qtyAvailable: number;
  qtyReserved: number;
  occupancyRate?: number | null;
  reservationPressure: number;
  taskPressure: number;
  exceptionCount: number;
  replenishmentCandidates: number;
  urgentReplenishment: number;
  dominantSignal: string;
  level: 'info' | 'warning' | 'critical';
}

export interface WarehouseSiteMapBinHeat {
  id: string;
  code: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  zoneType: string;
  status: string;
  binType: string;
  pickFaceEnabled: boolean;
  capacityUnits?: number | null;
  qtyOnHand: number;
  qtyAvailable: number;
  qtyReserved: number;
  occupancyRate?: number | null;
  reservationPressure: number;
  replenishmentLevel: 'info' | 'warning' | 'critical';
  level: 'info' | 'warning' | 'critical';
  primaryVariantLabel?: string | null;
  signals: string[];
}

export interface WarehouseSiteMapSnapshot {
  zones: WarehouseSiteMapZoneHeat[];
  bins: WarehouseSiteMapBinHeat[];
}

export interface WarehouseSiteControlTowerSnapshot {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  refreshedAt: string;
  healthScore: number;
  structure: {
    zones: number;
    bins: number;
    layoutVersions: number;
  };
  inventory: {
    balanceRows: number;
    variantsWithStock: number;
    qtyOnHand: number;
    qtyReserved: number;
    qtyAvailable: number;
  };
  operations: {
    reservations: {
      active: number;
      consumed: number;
      released: number;
    };
    documents: {
      total: number;
      handoffs: number;
      shipments: number;
    };
    realtime: {
      pending: number;
      processing: number;
      processed: number;
      failed: number;
    };
    tasks: WarehouseOperationalTaskSummary;
    exceptions: WarehouseOperationalExceptionSummary;
    replenishment: WarehouseReplenishmentSummary;
  };
  alerts: WarehouseSiteControlAlert[];
  alertClasses: WarehouseSiteAlertClassSummary[];
  actionableCounters: WarehouseSiteActionableCounter[];
  actionCards: WarehouseSiteActionCard[];
  taskQueues: WarehouseOperationalTaskQueue[];
  exceptions: WarehouseOperationalException[];
  replenishmentHotspots: WarehouseReplenishmentHotspot[];
  siteMap: WarehouseSiteMapSnapshot;
  topReservations: WarehouseStockReservation[];
  recentDocuments: WarehouseOperationDocument[];
  recentFeed: WarehouseSiteFeedEvent[];
}

export interface WarehouseSiteLiveSnapshot {
  siteId: string;
  generatedAt: string;
  controlTower: WarehouseSiteControlTowerSnapshot;
  siteFeed: WarehouseSiteFeedResponse;
  siteHealth: WarehouseSiteHealthSnapshot;
}

export interface WarehouseSiteFeedPatchEvent {
  siteId: string;
  generatedAt: string;
  siteFeed: WarehouseSiteFeedResponse;
}

export interface WarehouseSiteAlertsPatchEvent {
  siteId: string;
  generatedAt: string;
  controlTower: WarehouseSiteControlTowerSnapshot;
  siteHealth: WarehouseSiteHealthSnapshot;
}

export interface WarehouseSiteOperationsPatchEvent {
  siteId: string;
  generatedAt: string;
  controlTower: WarehouseSiteControlTowerSnapshot;
}

export interface WarehouseVariant {
  id: string;
  orgId: string;
  productCatalogId: string;
  variantKey: string;
  attributesJson?: Record<string, string> | null;
  attributesSummary?: string | null;
  schemaVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productCatalog?: Pick<WarehouseProductCatalog, 'id' | 'name'>;
}

export interface WarehouseStockBalance {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  variantId: string;
  binId: string;
  stockStatus: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  createdAt: string;
  updatedAt: string;
  bin?: {
    id: string;
    code: string;
    zone?: Pick<WarehouseZone, 'id' | 'code' | 'name'>;
  };
  variant?: WarehouseVariant;
}

export interface WarehouseStockReservationAllocation {
  id: string;
  reservationId: string;
  stockBalanceId: string;
  binId: string;
  qtyReserved: number;
  createdAt: string;
  bin?: {
    id: string;
    code: string;
  };
}

export interface WarehouseStockReservation {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  variantId: string;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string | null;
  qtyReserved: number;
  status: string;
  idempotencyKey: string;
  compatibilityReservationId?: string | null;
  releasedAt?: string | null;
  consumedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  allocations?: WarehouseStockReservationAllocation[];
  site?: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  variant?: WarehouseVariant & {
    productCatalog?: Pick<WarehouseProductCatalog, 'id' | 'name'>;
  };
}

export interface WarehouseOperationDocument {
  id: string;
  orgId: string;
  warehouseSiteId?: string | null;
  orderId?: string | null;
  documentType: 'handoff_to_warehouse' | 'shipment';
  status: string;
  idempotencyKey: string;
  referenceNo?: string | null;
  payload?: Record<string, unknown> | null;
  postedAt: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  site?: Pick<WarehouseSite, 'id' | 'code' | 'name'> | null;
}

export interface WarehouseTask {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  zoneId?: string | null;
  binId?: string | null;
  sourceBinId?: string | null;
  targetBinId?: string | null;
  variantId?: string | null;
  reservationId?: string | null;
  assigneePoolId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineId?: string | null;
  taskType: string;
  status: string;
  priority: string;
  assigneeName?: string | null;
  assigneeRole?: string | null;
  assignedAt?: string | null;
  slaStatus: string;
  escalationLevel: number;
  escalatedAt?: string | null;
  title: string;
  description?: string | null;
  sourceStrategy?: string | null;
  externalKey: string;
  routeKey?: string | null;
  metadataJson?: Record<string, unknown> | null;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  zone?: Pick<WarehouseZone, 'id' | 'code' | 'name'> | null;
  bin?: Pick<WarehouseBin, 'id' | 'code'> | null;
  sourceBin?: Pick<WarehouseBin, 'id' | 'code'> | null;
  targetBin?: Pick<WarehouseBin, 'id' | 'code'> | null;
  variant?: WarehouseVariant & {
    productCatalog?: Pick<WarehouseProductCatalog, 'id' | 'name'>;
  };
  assigneePool?: WarehouseAssigneePool | null;
  reservation?: {
    id: string;
    sourceType: string;
    sourceId: string;
    qtyReserved: number;
    status: string;
  } | null;
}

export interface WarehouseExceptionEntity {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  zoneId?: string | null;
  binId?: string | null;
  taskId?: string | null;
  variantId?: string | null;
  ownerPoolId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  exceptionType: string;
  severity: string;
  status: string;
  ownerName?: string | null;
  ownerRole?: string | null;
  assignedAt?: string | null;
  dueAt?: string | null;
  resolutionCode?: string | null;
  slaStatus: string;
  title: string;
  description?: string | null;
  sourceStrategy?: string | null;
  externalKey: string;
  metadataJson?: Record<string, unknown> | null;
  openedAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  zone?: Pick<WarehouseZone, 'id' | 'code' | 'name'> | null;
  bin?: Pick<WarehouseBin, 'id' | 'code'> | null;
  task?: Pick<WarehouseTask, 'id' | 'title' | 'taskType' | 'status'> | null;
  variant?: WarehouseVariant & {
    productCatalog?: Pick<WarehouseProductCatalog, 'id' | 'name'>;
  };
  ownerPool?: WarehouseAssigneePool | null;
}

export interface WarehouseLayoutNode {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  layoutVersionId: string;
  zoneId?: string | null;
  binId?: string | null;
  parentNodeId?: string | null;
  nodeType: string;
  domainType: string;
  domainId: string;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  hidden: boolean;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  zone?: Pick<WarehouseZone, 'id' | 'code' | 'name' | 'zoneType'> | null;
  bin?: Pick<WarehouseBin, 'id' | 'code' | 'binType' | 'pickFaceEnabled'> | null;
}

export interface WarehouseLayoutAnalysisEntry {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
  nodeId?: string;
  relatedNodeId?: string;
  domainType?: string;
  domainId?: string;
  taskId?: string;
}

export interface WarehouseLayoutTaskImpactEntry {
  taskId: string;
  taskType: string;
  title: string;
  status: string;
  impactLevel: 'hard_blocker' | 'review_required';
  action: string;
  sourceBinId?: string | null;
  sourceBinCode?: string | null;
  targetBinId?: string | null;
  targetBinCode?: string | null;
}

export interface WarehouseLayoutAnalysis {
  draft: {
    id: string;
    warehouseSiteId: string;
    versionNo: number;
    state: string;
    validationStatus: 'valid' | 'warning' | 'blocked' | 'not_validated' | 'stale';
    validatedAt: string;
  };
  publishReady: boolean;
  publishPolicy: {
    canPublish: boolean;
    canForcePublish: boolean;
    requiresSupervisorReview: boolean;
    blockedBy: string[];
    forceActions: string[];
  };
  summary: {
    createdNodes: number;
    movedNodes: number;
    resizedNodes: number;
    hiddenNodes: number;
    hardBlockers: number;
    warnings: number;
    impactedTasks: number;
  };
  diff: {
    createdNodes: number;
    movedNodes: number;
    resizedNodes: number;
    hiddenNodes: number;
    changedNodes: Array<{
      domainType: string;
      domainId: string;
      changeType: string;
      label?: string | null;
      moveDistance?: number;
    }>;
  };
  hardBlockers: WarehouseLayoutAnalysisEntry[];
  warnings: WarehouseLayoutAnalysisEntry[];
  taskImpactMatrix: WarehouseLayoutTaskImpactEntry[];
  conflictSheet: {
    impactedTaskCount: number;
    hardBlockerCount: number;
    reviewRequiredCount: number;
    impactedBinIds: string[];
  };
}

export interface WarehouseTwinRouteOverlay {
  id: string;
  taskId: string;
  taskType: string;
  status: string;
  priority: string;
  from: {
    x: number;
    y: number;
    label: string;
    nodeId?: string | null;
  };
  to: {
    x: number;
    y: number;
    label: string;
    nodeId?: string | null;
  };
}

export interface WarehouseTwinFocusTarget {
  id: string;
  label: string;
  kind: 'zone' | 'task';
  nodeId?: string | null;
  x: number;
  y: number;
}

export interface WarehouseTwinRuntime {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name' | 'publishedLayoutVersionId'>;
  layout: {
    mode: 'live' | 'draft';
    liveVersion: WarehouseLayoutVersion;
    activeVersion: WarehouseLayoutVersion;
    draftVersion?: WarehouseLayoutVersion | null;
    availableDrafts: WarehouseLayoutVersion[];
    historyVersions: WarehouseLayoutVersion[];
    nodes: WarehouseLayoutNode[];
    analysis?: WarehouseLayoutAnalysis | null;
  };
  assigneePools: WarehouseAssigneePool[];
  tasks: WarehouseTask[];
  exceptions: WarehouseExceptionEntity[];
  routes: WarehouseTwinRouteOverlay[];
  focusTargets: WarehouseTwinFocusTarget[];
  camera: {
    dispatchAnchor: {
      x: number;
      y: number;
      label: string;
    };
    overviewCenter: {
      x: number;
      y: number;
    };
  };
}

export interface WarehouseLayoutDraftCreateResult {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name' | 'publishedLayoutVersionId'>;
  draft: WarehouseLayoutVersion;
  basedOn: WarehouseLayoutVersion;
}

export interface WarehouseLayoutNodeUpdateResult extends WarehouseLayoutNode {}

export interface WarehouseLayoutPublishResult extends WarehouseLayoutVersion {}

export interface WarehouseLayoutPublishDto {
  force?: boolean;
  forceReason?: string;
}

export interface WarehouseLayoutVersionCompareResult {
  leftVersion: WarehouseLayoutVersion;
  rightVersion: WarehouseLayoutVersion;
  summary: {
    createdNodes: number;
    removedNodes: number;
    movedNodes: number;
    resizedNodes: number;
    hiddenChangedNodes: number;
    changedNodes: number;
  };
  changedNodes: Array<{
    domainType: string;
    domainId: string;
    changeType: string;
    label?: string | null;
    moveDistance?: number;
  }>;
}

export interface WarehouseTaskEventEntity {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  taskId: string;
  eventType: string;
  actorName?: string | null;
  payloadJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WarehouseExceptionEventEntity {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  exceptionId: string;
  eventType: string;
  actorName?: string | null;
  payloadJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WarehouseTaskTimelineResponse {
  task: WarehouseTask;
  count: number;
  results: WarehouseTaskEventEntity[];
}

export interface WarehouseExceptionTimelineResponse {
  exception: WarehouseExceptionEntity;
  count: number;
  results: WarehouseExceptionEventEntity[];
}

export interface WarehouseTaskCommandDto {
  command: 'assign' | 'start' | 'pause' | 'complete' | 'cancel' | 'replenish';
  assigneeName?: string;
  assigneeRole?: string;
  poolId?: string;
}

export interface WarehouseExceptionCommandDto {
  command: 'assign' | 'acknowledge' | 'resolve' | 'escalate' | 'reopen';
  ownerName?: string;
  ownerRole?: string;
  poolId?: string;
  resolutionCode?: string;
}

export interface WarehouseSiteReservationsResponse {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  count: number;
  results: WarehouseStockReservation[];
}

export interface WarehouseSiteTasksResponse {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  count: number;
  results: WarehouseTask[];
}

export interface WarehouseAssigneePoolsResponse {
  count: number;
  results: WarehouseAssigneePool[];
}

export interface WarehouseSiteExceptionsResponse {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  count: number;
  results: WarehouseExceptionEntity[];
}

export interface WarehouseSiteDocumentsResponse {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  count: number;
  results: WarehouseOperationDocument[];
}

export interface WarehouseSiteFeedEvent {
  id: string;
  kind: 'reservation' | 'document' | 'task' | 'exception' | 'outbox' | 'projection';
  status: string;
  eventType: string;
  title: string;
  description: string;
  occurredAt: string;
  createdAt: string;
  referenceId: string;
  aggregateId: string;
  aggregateType: string;
}

export interface WarehouseSiteFeedResponse {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  count: number;
  results: WarehouseSiteFeedEvent[];
}

export interface WarehouseOutboxRuntimeStatus {
  summary: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
  };
  recentOutbox: Array<{
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    status: string;
    retryCount: number;
    lastError?: string | null;
    availableAt: string;
    processedAt?: string | null;
    createdAt: string;
    warehouseSiteId?: string | null;
  }>;
  recentInbox: Array<{
    id: string;
    consumer: string;
    eventId: string;
    status: string;
    processedAt: string;
    warehouseSiteId?: string | null;
  }>;
}

export interface WarehouseSiteBalancesResponse {
  site: Pick<WarehouseSite, 'id' | 'code' | 'name'>;
  totals: {
    qtyOnHand: number;
    qtyReserved: number;
    qtyAvailable: number;
  };
  count: number;
  results: WarehouseStockBalance[];
}

export interface UpsertWarehouseVariantDto {
  productCatalogId: string;
  variantKey?: string;
  attributesJson?: Record<string, string>;
  attributesSummary?: string | null;
}

export interface PostStockReceiptDto {
  warehouseSiteId: string;
  variantId: string;
  toBinId: string;
  qty: number;
  stockStatus?: string;
  sourceType: string;
  sourceId?: string;
  sourceLineId?: string;
  idempotencyKey: string;
  reason?: string;
}

export interface PostStockTransferDto {
  warehouseSiteId: string;
  variantId: string;
  fromBinId: string;
  toBinId: string;
  qty: number;
  stockStatusFrom?: string;
  stockStatusTo?: string;
  sourceType: string;
  sourceId?: string;
  sourceLineId?: string;
  idempotencyKey: string;
  reason?: string;
}

export interface CreateStockReservationDto {
  warehouseSiteId: string;
  variantId: string;
  qty: number;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string;
  idempotencyKey: string;
  reason?: string;
}

export interface CreateWarehouseLayoutDraftDto {
  notes?: string;
}

export interface UpdateWarehouseLayoutNodeDto {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  hidden?: boolean;
}

export interface CreateWarehouseSiteDto {
  code: string;
  name: string;
  timezone?: string;
  status?: string;
}

export interface CreateWarehouseZoneDto {
  code: string;
  name: string;
  zoneType?: string;
  status?: string;
  parentZoneId?: string;
  capacityPolicyJson?: Record<string, unknown> | null;
}

export interface CreateWarehouseBinDto {
  zoneId: string;
  aisleId?: string;
  rackId?: string;
  shelfId?: string;
  code: string;
  status?: string;
  binType?: string;
  capacityUnits?: number;
  capacityWeight?: number;
  capacityVolume?: number;
  pickFaceEnabled?: boolean;
}

export interface PaginatedWarehouseItems {
  count: number;
  page: number;
  totalPages: number;
  results: WarehouseItem[];
}

export interface PaginatedMovements {
  count: number;
  page: number;
  totalPages: number;
  results: WarehouseMovement[];
}

export interface CreateItemDto {
  name: string;
  sku?: string;
  unit?: string;
  qty?: number;
  qtyMin?: number;
  costPrice?: number;
  categoryId?: string;
  notes?: string;
  color?: string;
  gender?: string;
  size?: string;
  length?: string;
}

export interface AddMovementDto {
  itemId: string;
  type: MovementType;
  qty: number;
  reason?: string;
}

export interface ImportOpeningBalanceRow {
  name: string;
  color?: string;
  gender?: string;
  size?: string;
  length?: string;
  qty: number;
  costPrice?: number;
}

export interface ImportOpeningBalanceResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

export type StockStatus = 'ok' | 'low' | 'critical';

export interface ProductStockInfo {
  available: boolean;
  qty: number;
  itemName: string | null;
}

export type ProductsAvailabilityMap = Record<string, ProductStockInfo>;

export type VariantAvailabilityStatus = 'ok' | 'low' | 'none';

export interface VariantAvailabilityResult {
  qty: number;
  available: number;
  status: VariantAvailabilityStatus;
  itemName: string | null;
}

/** key = variantKey (e.g. "платье:color=красный:size=m") */
export type VariantAvailabilityMap = Record<string, VariantAvailabilityResult>;

// ── Smart Catalog types ────────────────────────────────────────────────────────

export type FieldInputType = 'select' | 'multiselect' | 'text' | 'number' | 'boolean';

export interface WarehouseFieldOption {
  id: string;
  definitionId: string;
  value: string;
  label: string;
  sortOrder: number;
  colorHex?: string | null;
  isActive: boolean;
}

export interface WarehouseFieldDefinition {
  id: string;
  orgId: string;
  code: string;
  label: string;
  entityScope: string;
  inputType: FieldInputType;
  isRequired: boolean;
  isVariantAxis: boolean;
  showInWarehouseForm: boolean;
  showInOrderForm: boolean;
  showInDocuments: boolean;
  affectsAvailability: boolean;
  sortOrder: number;
  isSystem: boolean;
  options: WarehouseFieldOption[];
}

export interface WarehouseProductField {
  id: string;
  productId: string;
  definitionId: string;
  isRequired: boolean;
  sortOrder: number;
  definition: WarehouseFieldDefinition;
}

export interface WarehouseProductCatalog {
  id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  source?: string | null;
  fieldLinks: WarehouseProductField[];
}

export interface OrderFormField {
  code: string;
  label: string;
  inputType: FieldInputType;
  isRequired: boolean;
  affectsAvailability: boolean;
  options: Array<{ value: string; label: string }>;
}

export interface OrderFormProduct {
  id: string;
  name: string;
  fields: OrderFormField[];
}

export interface OrderFormCatalog {
  products: OrderFormProduct[];
}

export interface VariantAvailability {
  status: 'in_stock' | 'low' | 'out_of_stock' | 'unknown';
  variantKey: string;
  qty: number | null;
  itemId?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

/** Доступное количество — никогда не бывает отрицательным. */
export function getQtyAvailable(item: WarehouseItem): number {
  return Math.max(0, item.qty - item.qtyReserved);
}

/** Доступное количество со знаком — может быть отрицательным (метод накопления). */
export function getQtyAvailableSigned(item: WarehouseItem): number {
  return item.qty - item.qtyReserved;
}

/** Статус товара рассчитывается по доступному, а не валовому количеству. */
export function getStockStatus(item: WarehouseItem): StockStatus {
  const available = getQtyAvailable(item);
  if (available <= item.qtyMin) return 'critical';
  if (available <= item.qtyMin * 1.5) return 'low';
  return 'ok';
}

// ── Execution engine / publish audit types ────────────────────────────────────

export interface WarehouseLayoutPublishAuditEntry {
  id: string;
  orgId: string;
  warehouseSiteId: string;
  layoutVersionId: string;
  action: 'publish' | 'force_publish' | 'rollback';
  actorName: string;
  forceReason?: string | null;
  previousVersionId?: string | null;
  blockerSummaryJson?: Record<string, unknown> | null;
  impactedTaskCount: number;
  createdAt: string;
}

export interface WarehouseLayoutPublishAuditResponse {
  count: number;
  results: WarehouseLayoutPublishAuditEntry[];
}

export interface WarehouseLayoutRollbackResult {
  restored: WarehouseLayoutVersion;
  previousVersionId: string | null;
  requeuedTaskCount: number;
}

export interface WarehouseRouteHistorySegment {
  taskId: string;
  taskType: string;
  status: string;
  priority: string;
  slaStatus: string;
  escalationLevel: number;
  title: string;
  variantLabel?: string | null;
  from: {
    binId?: string | null;
    binCode?: string | null;
    zoneId?: string | null;
    zoneCode?: string | null;
  } | null;
  to: {
    binId?: string | null;
    binCode?: string | null;
    zoneId?: string | null;
    zoneCode?: string | null;
  } | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  sourceStrategy?: string | null;
  actorName?: string | null;
}

export interface WarehouseRouteHistoryResponse {
  count: number;
  since: string;
  segments: WarehouseRouteHistorySegment[];
}

export interface WarehouseSlaEscalationResult {
  escalated: number;
  details: Array<{ taskId: string; escalationLevel: number; toPoolId: string | null }>;
}

export interface WarehousePoolPolicyDto {
  assignmentPolicy?: 'fifo' | 'round_robin' | 'skill_match';
  slaTimeoutMin?: number;
  escalationPoolId?: string | null;
}
