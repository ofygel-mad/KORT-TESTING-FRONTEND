import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRightLeft,
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  PackageCheck,
  RefreshCw,
  ScrollText,
  SendHorizontal,
} from 'lucide-react';
import {
  useConsumeWarehouseFoundationReservation,
  useCreateWarehouseFoundationBin,
  useCreateWarehouseFoundationReservation,
  useCreateWarehouseFoundationSite,
  useCreateWarehouseFoundationZone,
  usePostWarehouseFoundationReceipt,
  usePostWarehouseFoundationTransfer,
  useReleaseWarehouseFoundationReservation,
  useWarehouseFoundationBalances,
  useWarehouseFoundationDocuments,
  useWarehouseFoundationOutboxRuntime,
  useWarehouseFoundationReservations,
  useWarehouseFoundationSiteControlTower,
  useWarehouseFoundationSiteFeed,
  useWarehouseFoundationSiteHealth,
  useWarehouseFoundationSiteStructure,
  useWarehouseFoundationSites,
  useWarehouseFoundationStatus,
  useWarehouseFoundationVariants,
} from '../../entities/warehouse/queries';
import { useWarehouseFoundationLiveSync } from '../../entities/warehouse/live';
import { WarehouseModeNav } from './WarehouseModeNav';
import { WarehouseTwinPanel } from './WarehouseTwinPanel';
import { localizeAttrSummary } from '../../shared/lib/attrLocalize';
import styles from './Warehouse.module.css';

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-KZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapReservationStatus(status: string) {
  if (status === 'active') return 'Активен';
  if (status === 'consumed') return 'Списан';
  if (status === 'released') return 'Освобождён';
  return status;
}

function mapDocumentType(type: string) {
  if (type === 'handoff_to_warehouse') return 'Передача на склад';
  if (type === 'shipment') return 'Отгрузка';
  return type;
}

function createClientIdempotencyKey(prefix: string) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}:${randomPart}`;
}

function formatVariantLabel(variant?: {
  productCatalog?: { name?: string | null };
  attributesSummary?: string | null;
  variantKey?: string | null;
}) {
  if (!variant) return 'Unknown variant';
  const productName = variant.productCatalog?.name ?? variant.variantKey ?? 'Вариант';
  const details = localizeAttrSummary(variant.attributesSummary);
  return details ? `${productName} · ${details}` : productName;
}

function statusColor(status: string) {
  if (status === 'active' || status === 'processed' || status === 'posted') return 'var(--fill-positive)';
  if (status === 'consumed' || status === 'processing') return 'var(--fill-info, #4ea1ff)';
  if (status === 'released') return 'var(--fill-warning)';
  if (status === 'failed') return 'var(--fill-negative)';
  return 'var(--text-tertiary)';
}

function alertLevelColor(level: string) {
  if (level === 'critical') return 'var(--fill-negative)';
  if (level === 'warning') return 'var(--fill-warning)';
  return 'var(--fill-info, #4ea1ff)';
}

function StatCard({ label, value, note, icon }: {
  label: string;
  value: string | number;
  note?: string;
  icon: ReactNode;
}) {
  return (
    <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--text-tertiary)' }}>
        {icon}
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statValue}>{value}</div>
      {note ? <div className={styles.statLabel}>{note}</div> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children, icon }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface-elevated) 82%, transparent), var(--bg-surface))',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'color-mix(in srgb, var(--bg-surface-inset) 60%, transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
            {subtitle ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ padding: 0 }}>{children}</div>
    </section>
  );
}

export default function WarehousePage() {
  const { data: foundationStatus } = useWarehouseFoundationStatus();
  const { data: sites } = useWarehouseFoundationSites();
  const { data: outboxRuntime } = useWarehouseFoundationOutboxRuntime();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [siteCode, setSiteCode] = useState('');
  const [siteName, setSiteName] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState('storage');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [binCode, setBinCode] = useState('');
  const [binType, setBinType] = useState('standard');
  const [binCapacityUnits, setBinCapacityUnits] = useState('');
  const [receiptVariantId, setReceiptVariantId] = useState('');
  const [receiptBinId, setReceiptBinId] = useState('');
  const [receiptQty, setReceiptQty] = useState('1');
  const [receiptStockStatus, setReceiptStockStatus] = useState('available');
  const [receiptRef, setReceiptRef] = useState('');
  const [transferVariantId, setTransferVariantId] = useState('');
  const [transferFromBinId, setTransferFromBinId] = useState('');
  const [transferToBinId, setTransferToBinId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferRef, setTransferRef] = useState('');
  const [reservationVariantId, setReservationVariantId] = useState('');
  const [reservationQty, setReservationQty] = useState('1');
  const [reservationSourceId, setReservationSourceId] = useState('');
  const [reservationSourceLineId, setReservationSourceLineId] = useState('');

  const createSite = useCreateWarehouseFoundationSite();
  const createZone = useCreateWarehouseFoundationZone();
  const createBin = useCreateWarehouseFoundationBin();
  const postReceipt = usePostWarehouseFoundationReceipt();
  const postTransfer = usePostWarehouseFoundationTransfer();
  const createReservation = useCreateWarehouseFoundationReservation();
  const consumeReservation = useConsumeWarehouseFoundationReservation();
  const releaseReservation = useReleaseWarehouseFoundationReservation();

  useEffect(() => {
    if (!selectedSiteId && sites?.results?.length) {
      setSelectedSiteId(sites.results[0].id);
    }
  }, [selectedSiteId, sites?.results]);

  const { data: structure } = useWarehouseFoundationSiteStructure(selectedSiteId || undefined);
  const { data: siteHealth } = useWarehouseFoundationSiteHealth(selectedSiteId || undefined);
  const { data: controlTower } = useWarehouseFoundationSiteControlTower(selectedSiteId || undefined);
  const { data: siteFeed } = useWarehouseFoundationSiteFeed(selectedSiteId || undefined, { limit: 12 });
  const { data: variants } = useWarehouseFoundationVariants();
  const { data: balances } = useWarehouseFoundationBalances(selectedSiteId || undefined);
  const { data: reservations } = useWarehouseFoundationReservations(selectedSiteId || undefined);
  const { data: documents } = useWarehouseFoundationDocuments(selectedSiteId || undefined);
  const warehouseLive = useWarehouseFoundationLiveSync(selectedSiteId || undefined, { feedLimit: 12 });

  useEffect(() => {
    const nextZoneId = structure?.zones?.[0]?.id ?? '';
    if (!structure?.zones?.length) {
      setSelectedZoneId('');
      return;
    }
    if (!selectedZoneId || !structure.zones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(nextZoneId);
    }
  }, [selectedZoneId, structure?.zones]);

  useEffect(() => {
    const nextVariantId = variants?.results?.[0]?.id ?? '';
    if (!variants?.results?.length) {
      setReceiptVariantId('');
      setTransferVariantId('');
      setReservationVariantId('');
      return;
    }
    if (!receiptVariantId || !variants.results.some((variant) => variant.id === receiptVariantId)) {
      setReceiptVariantId(nextVariantId);
    }
    if (!transferVariantId || !variants.results.some((variant) => variant.id === transferVariantId)) {
      setTransferVariantId(nextVariantId);
    }
    if (!reservationVariantId || !variants.results.some((variant) => variant.id === reservationVariantId)) {
      setReservationVariantId(nextVariantId);
    }
  }, [receiptVariantId, reservationVariantId, transferVariantId, variants?.results]);

  useEffect(() => {
    const bins = structure?.bins ?? [];
    const firstBinId = bins[0]?.id ?? '';
    const secondBinId = bins[1]?.id ?? firstBinId;

    if (!bins.length) {
      setReceiptBinId('');
      setTransferFromBinId('');
      setTransferToBinId('');
      return;
    }

    if (!receiptBinId || !bins.some((bin) => bin.id === receiptBinId)) {
      setReceiptBinId(firstBinId);
    }
    if (!transferFromBinId || !bins.some((bin) => bin.id === transferFromBinId)) {
      setTransferFromBinId(firstBinId);
    }
    if (!transferToBinId || !bins.some((bin) => bin.id === transferToBinId)) {
      setTransferToBinId(secondBinId);
    }
  }, [receiptBinId, structure?.bins, transferFromBinId, transferToBinId]);

  const topBalances = useMemo(() => balances?.results?.slice(0, 12) ?? [], [balances?.results]);
  const topReservations = useMemo(() => reservations?.results?.slice(0, 12) ?? [], [reservations?.results]);
  const topDocuments = useMemo(() => documents?.results?.slice(0, 10) ?? [], [documents?.results]);
  const topFeed = useMemo(() => siteFeed?.results?.slice(0, 12) ?? [], [siteFeed?.results]);
  const controlAlerts = useMemo(() => controlTower?.alerts?.slice(0, 4) ?? [], [controlTower?.alerts]);
  const previewBins = useMemo(() => structure?.bins?.slice(0, 8) ?? [], [structure?.bins]);
  const variantOptions = useMemo(() => variants?.results ?? [], [variants?.results]);
  const binOptions = useMemo(() => structure?.bins ?? [], [structure?.bins]);

  async function handleCreateSite() {
    if (!siteCode.trim() || !siteName.trim()) {
      return;
    }

    const created = await createSite.mutateAsync({
      code: siteCode.trim(),
      name: siteName.trim(),
      timezone: 'Asia/Qyzylorda',
    });

    setSelectedSiteId(created.id);
    setSiteCode('');
    setSiteName('');
  }

  async function handleCreateZone() {
    if (!selectedSiteId || !zoneCode.trim() || !zoneName.trim()) {
      return;
    }

    const created = await createZone.mutateAsync({
      siteId: selectedSiteId,
      dto: {
        code: zoneCode.trim(),
        name: zoneName.trim(),
        zoneType,
      },
    });

    setSelectedZoneId(created.id);
    setZoneCode('');
    setZoneName('');
  }

  async function handleCreateBin() {
    if (!selectedSiteId || !selectedZoneId || !binCode.trim()) {
      return;
    }

    await createBin.mutateAsync({
      siteId: selectedSiteId,
      dto: {
        zoneId: selectedZoneId,
        code: binCode.trim(),
        binType,
        capacityUnits: binCapacityUnits.trim() ? Number(binCapacityUnits) : undefined,
      },
    });

    setBinCode('');
    setBinCapacityUnits('');
  }

  async function handlePostReceipt() {
    if (!selectedSiteId || !receiptVariantId || !receiptBinId || Number(receiptQty) <= 0) {
      return;
    }

    await postReceipt.mutateAsync({
      warehouseSiteId: selectedSiteId,
      variantId: receiptVariantId,
      toBinId: receiptBinId,
      qty: Number(receiptQty),
      stockStatus: receiptStockStatus,
      sourceType: 'manual_ui_receipt',
      sourceId: receiptRef.trim() || 'manual_ui_receipt',
      idempotencyKey: createClientIdempotencyKey('manual-receipt'),
      reason: 'manual_ui_receipt',
    });

    setReceiptQty('1');
    setReceiptRef('');
  }

  async function handlePostTransfer() {
    if (
      !selectedSiteId
      || !transferVariantId
      || !transferFromBinId
      || !transferToBinId
      || Number(transferQty) <= 0
    ) {
      return;
    }

    await postTransfer.mutateAsync({
      warehouseSiteId: selectedSiteId,
      variantId: transferVariantId,
      fromBinId: transferFromBinId,
      toBinId: transferToBinId,
      qty: Number(transferQty),
      sourceType: 'manual_ui_transfer',
      sourceId: transferRef.trim() || 'manual_ui_transfer',
      idempotencyKey: createClientIdempotencyKey('manual-transfer'),
      reason: 'manual_ui_transfer',
    });

    setTransferQty('1');
    setTransferRef('');
  }

  async function handleCreateReservation() {
    if (!selectedSiteId || !reservationVariantId || Number(reservationQty) <= 0) {
      return;
    }

    await createReservation.mutateAsync({
      warehouseSiteId: selectedSiteId,
      variantId: reservationVariantId,
      qty: Number(reservationQty),
      sourceType: 'manual_ui_reservation',
      sourceId: reservationSourceId.trim() || createClientIdempotencyKey('manual-reserve-source'),
      sourceLineId: reservationSourceLineId.trim() || undefined,
      idempotencyKey: createClientIdempotencyKey('manual-reservation'),
      reason: 'manual_ui_reservation',
    });

    setReservationQty('1');
    setReservationSourceId('');
    setReservationSourceLineId('');
  }

  return (
    <div className={styles.root} style={{ overflowY: 'auto' }}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Warehouse Foundation</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Canonical balances, reservations, operation documents and outbox runtime for the new WMS layer.
            {selectedSiteId
              ? ` Live stream: ${warehouseLive.isConnected ? 'connected' : 'reconnecting'}${warehouseLive.lastSyncAt ? ` · ${formatDateTime(warehouseLive.lastSyncAt)}` : ''}`
              : ''}
          </div>
        </div>
        {sites?.results?.length ? (
          <div className={styles.headerRight} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <WarehouseModeNav />
            <div className={styles.tabs}>
              {sites.results.map((site) => (
                <button
                  key={site.id}
                  className={`${styles.tab} ${selectedSiteId === site.id ? styles.tabActive : ''}`}
                  onClick={() => setSelectedSiteId(site.id)}
                >
                  <Building2 size={13} />
                  {site.code}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.statsBar}>
        <StatCard
          label="Sites"
          value={foundationStatus?.structure.sites ?? 0}
          note={foundationStatus?.structure.structureReady ? 'Structure baseline exists' : 'Structure not bootstrapped'}
          icon={<Building2 size={14} />}
        />
        <StatCard
          label="Zones / Bins"
          value={`${foundationStatus?.structure.zones ?? 0} / ${foundationStatus?.structure.bins ?? 0}`}
          note="Physical structure"
          icon={<Boxes size={14} />}
        />
        <StatCard
          label="Variants / Balances"
          value={`${foundationStatus?.inventory.variants ?? 0} / ${foundationStatus?.inventory.balances ?? 0}`}
          note="Canonical inventory"
          icon={<PackageCheck size={14} />}
        />
        <StatCard
          label="Pending Outbox"
          value={outboxRuntime?.summary.pending ?? foundationStatus?.system.pendingOutbox ?? 0}
          note={`Processed: ${outboxRuntime?.summary.processed ?? foundationStatus?.system.processedInbox ?? 0}`}
          icon={<SendHorizontal size={14} />}
        />
      </div>

      {!sites?.results?.length ? (
        <SectionCard
          title="Bootstrap Site"
          subtitle="Создай первый warehouse site, чтобы foundation inventory начал жить в UI."
          icon={<Building2 size={16} color="var(--fill-accent)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 10 }}>
              <input
                className={styles.input}
                placeholder="SITE-A"
                value={siteCode}
                onChange={(event) => setSiteCode(event.target.value)}
              />
              <input
                className={styles.input}
                placeholder="Основной склад"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
              />
              <button
                className={styles.addBtn}
                onClick={() => void handleCreateSite()}
                disabled={createSite.isPending || !siteCode.trim() || !siteName.trim()}
              >
                {createSite.isPending ? <RefreshCw size={14} /> : <Building2 size={14} />}
                Создать
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              После site можно наращивать zones/bins и гонять canonical receipts, reservations и shipment handoff flow.
            </div>
          </div>
        </SectionCard>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <WarehouseTwinPanel
            siteId={selectedSiteId}
            structure={structure}
            controlTower={controlTower}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
            <SectionCard
              title="Structure Bootstrap"
              subtitle={structure?.site ? `Quick-create zones and bins inside ${structure.site.name}` : 'Prepare physical structure'}
              icon={<Boxes size={16} color="var(--fill-accent)" />}
            >
              <div style={{ padding: 16, display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Create Zone</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr auto', gap: 10 }}>
                    <input
                      className={styles.input}
                      placeholder="PICK-A"
                      value={zoneCode}
                      onChange={(event) => setZoneCode(event.target.value)}
                    />
                    <input
                      className={styles.input}
                      placeholder="Picking Zone A"
                      value={zoneName}
                      onChange={(event) => setZoneName(event.target.value)}
                    />
                    <select
                      className={styles.input}
                      value={zoneType}
                      onChange={(event) => setZoneType(event.target.value)}
                    >
                      <option value="storage">Storage</option>
                      <option value="picking">Picking</option>
                      <option value="receiving">Receiving</option>
                      <option value="staging">Staging</option>
                      <option value="shipping">Shipping</option>
                      <option value="quarantine">Quarantine</option>
                    </select>
                    <button
                      className={styles.addBtn}
                      onClick={() => void handleCreateZone()}
                      disabled={createZone.isPending || !selectedSiteId || !zoneCode.trim() || !zoneName.trim()}
                    >
                      {createZone.isPending ? <RefreshCw size={14} /> : <Boxes size={14} />}
                      Zone
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Create Bin</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr .8fr auto', gap: 10 }}>
                    <select
                      className={styles.input}
                      value={selectedZoneId}
                      onChange={(event) => setSelectedZoneId(event.target.value)}
                    >
                      <option value="">Select zone</option>
                      {(structure?.zones ?? []).map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.code} · {zone.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.input}
                      placeholder="A-01-01"
                      value={binCode}
                      onChange={(event) => setBinCode(event.target.value)}
                    />
                    <select
                      className={styles.input}
                      value={binType}
                      onChange={(event) => setBinType(event.target.value)}
                    >
                      <option value="standard">Standard</option>
                      <option value="pick_face">Pick face</option>
                      <option value="reserve">Reserve</option>
                      <option value="staging">Staging</option>
                      <option value="quarantine">Quarantine</option>
                    </select>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      placeholder="Cap."
                      value={binCapacityUnits}
                      onChange={(event) => setBinCapacityUnits(event.target.value)}
                    />
                    <button
                      className={styles.addBtn}
                      onClick={() => void handleCreateBin()}
                      disabled={createBin.isPending || !selectedSiteId || !selectedZoneId || !binCode.trim()}
                    >
                      {createBin.isPending ? <RefreshCw size={14} /> : <Database size={14} />}
                      Bin
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Zones</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {(structure?.zones ?? []).length ? (structure?.zones ?? []).map((zone) => (
                        <span key={zone.id} className={styles.stockBadge}>
                          {zone.code} · {zone.zoneType}
                        </span>
                      )) : (
                        <div className={styles.tdSecondary}>No zones yet.</div>
                      )}
                    </div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Recent Bins</div>
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      {previewBins.length ? previewBins.map((bin) => (
                        <div key={bin.id} className={styles.drawerCardRowSecondary}>
                          {bin.code} · {bin.zone?.code ?? 'zone'} · {bin.binType}
                        </div>
                      )) : (
                        <div className={styles.tdSecondary}>No bins yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Site Health"
              subtitle={siteHealth ? `${siteHealth.site.name} operational snapshot` : 'Loading site health'}
              icon={<Activity size={16} color="var(--fill-positive)" />}
            >
              <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Reservations</div>
                    <div className={styles.drawerCardRowSecondary}>Active: {siteHealth?.operations.reservations.active ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Consumed: {siteHealth?.operations.reservations.consumed ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Released: {siteHealth?.operations.reservations.released ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Documents</div>
                    <div className={styles.drawerCardRowSecondary}>Handoffs: {siteHealth?.operations.documents.handoffs ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Shipments: {siteHealth?.operations.documents.shipments ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Total: {siteHealth?.operations.documents.total ?? 0}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Inventory</div>
                    <div className={styles.drawerCardRowSecondary}>Rows: {siteHealth?.inventory.balanceRows ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Variants: {siteHealth?.inventory.variantsWithStock ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Outbox</div>
                    <div className={styles.drawerCardRowSecondary}>Pending: {siteHealth?.realtime.pending ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Failed: {siteHealth?.realtime.failed ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Last Document</div>
                    <div className={styles.drawerCardRowSecondary}>
                      {siteHealth?.operations.lastDocument
                        ? `${mapDocumentType(siteHealth.operations.lastDocument.documentType)} · ${formatDateTime(siteHealth.operations.lastDocument.postedAt)}`
                        : 'No documents yet'}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Operations Workbench"
            subtitle="Manual canonical actions for bootstrap, QA and controlled warehouse corrections."
            icon={<ArrowRightLeft size={16} color="var(--fill-info, #4ea1ff)" />}
          >
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div className={styles.drawerCard} style={{ display: 'grid', gap: 10 }}>
                <div className={styles.drawerCardLabel}>Receipt</div>
                <select
                  className={styles.input}
                  value={receiptVariantId}
                  onChange={(event) => setReceiptVariantId(event.target.value)}
                >
                  <option value="">Select variant</option>
                  {variantOptions.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {formatVariantLabel(variant)}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.input}
                  value={receiptBinId}
                  onChange={(event) => setReceiptBinId(event.target.value)}
                >
                  <option value="">Select bin</option>
                  {binOptions.map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code} · {bin.zone?.code ?? 'zone'}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr', gap: 10 }}>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    placeholder="Qty"
                    value={receiptQty}
                    onChange={(event) => setReceiptQty(event.target.value)}
                  />
                  <select
                    className={styles.input}
                    value={receiptStockStatus}
                    onChange={(event) => setReceiptStockStatus(event.target.value)}
                  >
                    <option value="available">Available</option>
                    <option value="quarantined">Quarantined</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
                <input
                  className={styles.input}
                  placeholder="Reference / source id"
                  value={receiptRef}
                  onChange={(event) => setReceiptRef(event.target.value)}
                />
                <button
                  className={styles.addBtn}
                  onClick={() => void handlePostReceipt()}
                  disabled={postReceipt.isPending || !selectedSiteId || !receiptVariantId || !receiptBinId}
                >
                  {postReceipt.isPending ? <RefreshCw size={14} /> : <PackageCheck size={14} />}
                  Post receipt
                </button>
              </div>

              <div className={styles.drawerCard} style={{ display: 'grid', gap: 10 }}>
                <div className={styles.drawerCardLabel}>Transfer</div>
                <select
                  className={styles.input}
                  value={transferVariantId}
                  onChange={(event) => setTransferVariantId(event.target.value)}
                >
                  <option value="">Select variant</option>
                  {variantOptions.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {formatVariantLabel(variant)}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select
                    className={styles.input}
                    value={transferFromBinId}
                    onChange={(event) => setTransferFromBinId(event.target.value)}
                  >
                    <option value="">From bin</option>
                    {binOptions.map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.input}
                    value={transferToBinId}
                    onChange={(event) => setTransferToBinId(event.target.value)}
                  >
                    <option value="">To bin</option>
                    {binOptions.map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  placeholder="Qty"
                  value={transferQty}
                  onChange={(event) => setTransferQty(event.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Reference / source id"
                  value={transferRef}
                  onChange={(event) => setTransferRef(event.target.value)}
                />
                <button
                  className={styles.addBtn}
                  onClick={() => void handlePostTransfer()}
                  disabled={
                    postTransfer.isPending
                    || !selectedSiteId
                    || !transferVariantId
                    || !transferFromBinId
                    || !transferToBinId
                  }
                >
                  {postTransfer.isPending ? <RefreshCw size={14} /> : <ArrowRightLeft size={14} />}
                  Post transfer
                </button>
              </div>

              <div className={styles.drawerCard} style={{ display: 'grid', gap: 10 }}>
                <div className={styles.drawerCardLabel}>Reservation</div>
                <select
                  className={styles.input}
                  value={reservationVariantId}
                  onChange={(event) => setReservationVariantId(event.target.value)}
                >
                  <option value="">Select variant</option>
                  {variantOptions.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {formatVariantLabel(variant)}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  placeholder="Qty"
                  value={reservationQty}
                  onChange={(event) => setReservationQty(event.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Source id / external order"
                  value={reservationSourceId}
                  onChange={(event) => setReservationSourceId(event.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Source line id"
                  value={reservationSourceLineId}
                  onChange={(event) => setReservationSourceLineId(event.target.value)}
                />
                <button
                  className={styles.addBtn}
                  onClick={() => void handleCreateReservation()}
                  disabled={createReservation.isPending || !selectedSiteId || !reservationVariantId}
                >
                  {createReservation.isPending ? <RefreshCw size={14} /> : <SendHorizontal size={14} />}
                  Create reservation
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Control Tower"
            subtitle={controlTower ? `Health score ${controlTower.healthScore} · refreshed ${formatDateTime(controlTower.refreshedAt)}` : 'Building operational control snapshot'}
            icon={<Activity size={16} color="var(--fill-negative)" />}
          >
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div
                  className={styles.stockBadge}
                  style={{
                    width: 'fit-content',
                    background: `color-mix(in srgb, ${warehouseLive.isConnected ? 'var(--fill-positive)' : 'var(--fill-warning)'} 14%, transparent)`,
                    color: warehouseLive.isConnected ? 'var(--fill-positive)' : 'var(--fill-warning)',
                  }}
                >
                  {warehouseLive.isConnected
                    ? `Live stream connected${warehouseLive.lastSyncAt ? ` · ${formatDateTime(warehouseLive.lastSyncAt)}` : ''}`
                    : 'Live stream reconnecting'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Health</div>
                    <div className={styles.drawerCardRowSecondary}>Score: {controlTower?.healthScore ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Alerts: {controlTower?.alerts.length ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Reservations</div>
                    <div className={styles.drawerCardRowSecondary}>Active: {controlTower?.operations.reservations.active ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Released: {controlTower?.operations.reservations.released ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Documents</div>
                    <div className={styles.drawerCardRowSecondary}>Handoffs: {controlTower?.operations.documents.handoffs ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Shipments: {controlTower?.operations.documents.shipments ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Realtime</div>
                    <div className={styles.drawerCardRowSecondary}>Pending: {controlTower?.operations.realtime.pending ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Failed: {controlTower?.operations.realtime.failed ?? 0}</div>
                  </div>
                </div>

                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Priority Alerts</div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {controlAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className={styles.stockBadge}
                            style={{
                              background: `color-mix(in srgb, ${alertLevelColor(alert.level)} 14%, transparent)`,
                              color: alertLevelColor(alert.level),
                            }}
                          >
                            {alert.level}
                          </span>
                          <div className={styles.tdName}>{alert.title}</div>
                        </div>
                        <div className={styles.tdSecondary} style={{ marginTop: 6 }}>
                          {alert.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Recent Feed</div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {(controlTower?.recentFeed ?? []).slice(0, 5).map((event) => (
                      <div key={event.id} className={styles.drawerCardRowSecondary}>
                        {event.eventType} · {formatDateTime(event.createdAt)}
                      </div>
                    ))}
                    {!(controlTower?.recentFeed?.length) ? (
                      <div className={styles.tdSecondary}>No recent activity.</div>
                    ) : null}
                  </div>
                </div>

                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Top Reservations</div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {(controlTower?.topReservations ?? []).map((reservation) => (
                      <div key={reservation.id} className={styles.drawerCardRowSecondary}>
                        {(reservation.variant?.productCatalog?.name ?? reservation.variant?.variantKey ?? reservation.variantId)} · {reservation.qtyReserved} · {reservation.status}
                      </div>
                    ))}
                    {!(controlTower?.topReservations?.length) ? (
                      <div className={styles.tdSecondary}>No site reservations yet.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16 }}>
            <SectionCard
              title="Balances"
              subtitle={balances ? `${balances.count} balance rows in ${balances.site.name}` : 'Loading site balances'}
              icon={<Database size={16} color="var(--fill-info, #4ea1ff)" />}
            >
              <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Bin</th>
                      <th>On hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBalances.map((balance) => (
                      <tr key={balance.id} className={styles.row}>
                        <td>
                          <div className={styles.tdName}>{balance.variant?.productCatalog?.name ?? balance.variant?.variantKey ?? balance.variantId}</div>
                          <div className={styles.tdSecondary}>{localizeAttrSummary(balance.variant?.attributesSummary) || balance.variant?.variantKey || '—'}</div>
                        </td>
                        <td className={styles.tdMono}>{balance.bin?.code ?? '—'}</td>
                        <td className={styles.tdNum}>{formatNumber(balance.qtyOnHand)}</td>
                        <td className={styles.tdNum}>{formatNumber(balance.qtyReserved)}</td>
                        <td className={styles.tdNum}>{formatNumber(balance.qtyAvailable)}</td>
                      </tr>
                    ))}
                    {!topBalances.length ? (
                      <tr className={styles.row}>
                        <td colSpan={5} className={styles.tdSecondary}>No canonical balances yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Runtime / Structure"
              subtitle={structure?.site ? `${structure.site.name} · live layout v${structure.liveLayout?.versionNo ?? '—'}` : 'Warehouse runtime'}
              icon={<Activity size={16} color="var(--fill-positive)" />}
            >
              <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Structure</div>
                    <div className={styles.drawerCardRowSecondary}>Zones: {structure?.site._count.zones ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Bins: {structure?.site._count.bins ?? 0}</div>
                    <div className={styles.drawerCardRowSecondary}>Layouts: {structure?.site._count.layoutVersions ?? 0}</div>
                  </div>
                  <div className={styles.drawerCard}>
                    <div className={styles.drawerCardLabel}>Inventory Totals</div>
                    <div className={styles.drawerCardRowSecondary}>On hand: {formatNumber(balances?.totals.qtyOnHand ?? 0)}</div>
                    <div className={styles.drawerCardRowSecondary}>Reserved: {formatNumber(balances?.totals.qtyReserved ?? 0)}</div>
                    <div className={styles.drawerCardRowSecondary}>Available: {formatNumber(balances?.totals.qtyAvailable ?? 0)}</div>
                  </div>
                </div>

                <div className={styles.drawerCard}>
                  <div className={styles.drawerCardLabel}>Outbox</div>
                  <div className={styles.drawerActions}>
                    {[
                      ['Pending', outboxRuntime?.summary.pending ?? 0, 'pending'],
                      ['Processing', outboxRuntime?.summary.processing ?? 0, 'processing'],
                      ['Processed', outboxRuntime?.summary.processed ?? 0, 'processed'],
                      ['Failed', outboxRuntime?.summary.failed ?? 0, 'failed'],
                    ].map(([label, value, status]) => (
                      <div
                        key={String(label)}
                        style={{
                          flex: 1,
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: statusColor(String(status)) }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Reservations"
            subtitle={reservations ? `${reservations.count} reservations on selected site` : 'Loading reservations'}
            icon={<ArrowRightLeft size={16} color="var(--fill-warning)" />}
          >
            <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Variant</th>
                    <th>Bins</th>
                    <th>Status</th>
                    <th>Qty</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topReservations.map((reservation) => {
                    const isPendingAction =
                      consumeReservation.isPending || releaseReservation.isPending;
                    const binCodes = reservation.allocations?.map((allocation) => allocation.bin?.code).filter(Boolean).join(', ') || '—';

                    return (
                      <tr key={reservation.id} className={styles.row}>
                        <td>
                          <div className={styles.tdMono}>{reservation.sourceType}</div>
                          <div className={styles.tdSecondary}>{reservation.sourceLineId ?? reservation.sourceId}</div>
                        </td>
                        <td>
                          <div className={styles.tdName}>
                            {reservation.variant?.productCatalog?.name ?? reservation.variant?.variantKey ?? reservation.variantId}
                          </div>
                          <div className={styles.tdSecondary}>{localizeAttrSummary(reservation.variant?.attributesSummary) || '—'}</div>
                        </td>
                        <td className={styles.tdMono}>{binCodes}</td>
                        <td>
                          <span
                            className={styles.stockBadge}
                            style={{
                              background: `color-mix(in srgb, ${statusColor(reservation.status)} 14%, transparent)`,
                              color: statusColor(reservation.status),
                            }}
                          >
                            {mapReservationStatus(reservation.status)}
                          </span>
                        </td>
                        <td className={styles.tdNum}>{formatNumber(reservation.qtyReserved)}</td>
                        <td>
                          <div className={styles.tdActions}>
                            <button
                              className={styles.incomBtn}
                              disabled={reservation.status !== 'active' || isPendingAction}
                              onClick={() => consumeReservation.mutate({
                                reservationId: reservation.id,
                                siteId: reservation.warehouseSiteId,
                                reason: 'manual_ui_consume',
                              })}
                            >
                              Списать
                            </button>
                            <button
                              className={styles.deleteBtn}
                              disabled={reservation.status !== 'active' || isPendingAction}
                              onClick={() => releaseReservation.mutate({
                                reservationId: reservation.id,
                                siteId: reservation.warehouseSiteId,
                                reason: 'manual_ui_release',
                              })}
                            >
                              Освободить
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!topReservations.length ? (
                    <tr className={styles.row}>
                      <td colSpan={6} className={styles.tdSecondary}>No canonical reservations yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SectionCard
              title="Operation Documents"
              subtitle={documents ? `${documents.count} posted documents` : 'Loading posted documents'}
              icon={<ScrollText size={16} color="var(--fill-accent)" />}
            >
              <div className={styles.tableWrap} style={{ maxHeight: 320 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDocuments.map((document) => (
                      <tr key={document.id} className={styles.row}>
                        <td className={styles.tdName}>{mapDocumentType(document.documentType)}</td>
                        <td className={styles.tdMono}>{document.referenceNo ?? document.orderId ?? '—'}</td>
                        <td>
                          <span
                            className={styles.stockBadge}
                            style={{
                              background: `color-mix(in srgb, ${statusColor(document.status)} 14%, transparent)`,
                              color: statusColor(document.status),
                            }}
                          >
                            {document.status}
                          </span>
                        </td>
                        <td className={styles.tdDate}>{formatDateTime(document.postedAt)}</td>
                      </tr>
                    ))}
                    {!topDocuments.length ? (
                      <tr className={styles.row}>
                        <td colSpan={4} className={styles.tdSecondary}>No warehouse documents yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Site Feed"
              subtitle={siteFeed ? `${siteFeed.count} recent warehouse events` : 'Loading site feed'}
              icon={<SendHorizontal size={16} color="var(--fill-info, #4ea1ff)" />}
            >
              <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                {topFeed.length ? topFeed.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.eventType}</div>
                      <div className={styles.tdSecondary} style={{ marginTop: 4 }}>
                        {row.aggregateType} · {row.aggregateId.slice(0, 8)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: statusColor(row.status) }}>{row.status}</div>
                      <div className={styles.tdDate}>{formatDateTime(row.createdAt)}</div>
                    </div>
                  </div>
                )) : (
                  <div className={styles.empty} style={{ padding: 24 }}>
                    <CheckCircle2 className={styles.emptyIcon} size={20} />
                    <div>Site feed is quiet right now.</div>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
