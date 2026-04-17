import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  AlertTriangle,
  Database,
  PackageCheck,
  RefreshCw,
  ScrollText,
  SendHorizontal,
} from 'lucide-react';
import {
  useConsumeWarehouseFoundationReservation,
  useCreateWarehouseFoundationReservation,
  usePostWarehouseFoundationReceipt,
  usePostWarehouseFoundationTransfer,
  useReleaseWarehouseFoundationReservation,
  useWarehouseFoundationBalances,
  useWarehouseFoundationDocuments,
  useWarehouseFoundationReservations,
  useWarehouseFoundationSiteControlTower,
  useWarehouseFoundationSiteFeed,
  useWarehouseFoundationSiteHealth,
  useWarehouseFoundationSites,
  useWarehouseFoundationVariants,
} from '../../entities/warehouse/queries';
import { useWarehouseFoundationLiveSync } from '../../entities/warehouse/live';
import { WarehouseModeNav } from './WarehouseModeNav';
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

function createClientIdempotencyKey(prefix: string) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}:${randomPart}`;
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

function actionLinkHref(href: string, siteId?: string) {
  if (!siteId) return href;
  const [base, hash] = href.split('#');
  const withQuery = `${base}${base.includes('?') ? '&' : '?'}site=${siteId}`;
  return hash ? `${withQuery}#${hash}` : withQuery;
}

function mapDocumentType(type: string) {
  if (type === 'handoff_to_warehouse') return 'Передача на склад';
  if (type === 'shipment') return 'Отгрузка';
  return type;
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
            {subtitle ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div> : null}
          </div>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function WarehouseOperationsPage() {
  const { data: sites } = useWarehouseFoundationSites();
  const { data: variants } = useWarehouseFoundationVariants();
  const [searchParams] = useSearchParams();
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [receiptVariantId, setReceiptVariantId] = useState('');
  const [receiptBinId, setReceiptBinId] = useState('');
  const [receiptQty, setReceiptQty] = useState('1');
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

  const { data: balances } = useWarehouseFoundationBalances(selectedSiteId || undefined);
  const { data: reservations } = useWarehouseFoundationReservations(selectedSiteId || undefined);
  const { data: documents } = useWarehouseFoundationDocuments(selectedSiteId || undefined);
  const { data: siteFeed } = useWarehouseFoundationSiteFeed(selectedSiteId || undefined, { limit: 18 });
  const { data: siteHealth } = useWarehouseFoundationSiteHealth(selectedSiteId || undefined);
  const { data: controlTower } = useWarehouseFoundationSiteControlTower(selectedSiteId || undefined);
  const warehouseLive = useWarehouseFoundationLiveSync(selectedSiteId || undefined, { feedLimit: 18 });

  const postReceipt = usePostWarehouseFoundationReceipt();
  const postTransfer = usePostWarehouseFoundationTransfer();
  const createReservation = useCreateWarehouseFoundationReservation();
  const consumeReservation = useConsumeWarehouseFoundationReservation();
  const releaseReservation = useReleaseWarehouseFoundationReservation();

  useEffect(() => {
    if (!selectedSiteId && sites?.results?.length) {
      const requestedSiteId = searchParams.get('site');
      const querySite = requestedSiteId && sites.results.some((site) => site.id === requestedSiteId)
        ? requestedSiteId
        : null;
      setSelectedSiteId(querySite ?? sites.results[0].id);
    }
  }, [searchParams, selectedSiteId, sites?.results]);

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
    const bins = balances?.results?.map((row) => row.bin).filter(Boolean) ?? [];
    const uniqueBins = Array.from(new Map(bins.map((bin) => [bin!.id, bin!])).values());
    const firstBinId = uniqueBins[0]?.id ?? '';
    const secondBinId = uniqueBins[1]?.id ?? firstBinId;

    if (!uniqueBins.length) {
      setReceiptBinId('');
      setTransferFromBinId('');
      setTransferToBinId('');
      return;
    }

    if (!receiptBinId || !uniqueBins.some((bin) => bin.id === receiptBinId)) {
      setReceiptBinId(firstBinId);
    }
    if (!transferFromBinId || !uniqueBins.some((bin) => bin.id === transferFromBinId)) {
      setTransferFromBinId(firstBinId);
    }
    if (!transferToBinId || !uniqueBins.some((bin) => bin.id === transferToBinId)) {
      setTransferToBinId(secondBinId);
    }
  }, [balances?.results, receiptBinId, transferFromBinId, transferToBinId]);

  const binOptions = useMemo(() => {
    const bins = balances?.results?.map((row) => row.bin).filter(Boolean) ?? [];
    return Array.from(new Map(bins.map((bin) => [bin!.id, bin!])).values());
  }, [balances?.results]);

  const actionCards = useMemo(() => controlTower?.actionCards ?? [], [controlTower?.actionCards]);
  const actionableCounters = useMemo(() => controlTower?.actionableCounters ?? [], [controlTower?.actionableCounters]);
  const taskQueues = useMemo(() => controlTower?.taskQueues ?? [], [controlTower?.taskQueues]);
  const exceptions = useMemo(() => controlTower?.exceptions ?? [], [controlTower?.exceptions]);
  const replenishmentHotspots = useMemo(() => controlTower?.replenishmentHotspots ?? [], [controlTower?.replenishmentHotspots]);

  async function handlePostReceipt() {
    if (!selectedSiteId || !receiptVariantId || !receiptBinId || Number(receiptQty) <= 0) return;

    await postReceipt.mutateAsync({
      warehouseSiteId: selectedSiteId,
      variantId: receiptVariantId,
      toBinId: receiptBinId,
      qty: Number(receiptQty),
      stockStatus: 'available',
      sourceType: 'manual_ui_receipt',
      sourceId: receiptRef.trim() || 'manual_ui_receipt',
      idempotencyKey: createClientIdempotencyKey('operations-receipt'),
      reason: 'manual_ui_receipt',
    });

    setReceiptQty('1');
    setReceiptRef('');
  }

  async function handlePostTransfer() {
    if (!selectedSiteId || !transferVariantId || !transferFromBinId || !transferToBinId || Number(transferQty) <= 0) return;

    await postTransfer.mutateAsync({
      warehouseSiteId: selectedSiteId,
      variantId: transferVariantId,
      fromBinId: transferFromBinId,
      toBinId: transferToBinId,
      qty: Number(transferQty),
      sourceType: 'manual_ui_transfer',
      sourceId: transferRef.trim() || 'manual_ui_transfer',
      idempotencyKey: createClientIdempotencyKey('operations-transfer'),
      reason: 'manual_ui_transfer',
    });

    setTransferQty('1');
    setTransferRef('');
  }

  async function handleCreateReservation() {
    if (!selectedSiteId || !reservationVariantId || Number(reservationQty) <= 0) return;

    await createReservation.mutateAsync({
      warehouseSiteId: selectedSiteId,
      variantId: reservationVariantId,
      qty: Number(reservationQty),
      sourceType: 'manual_ui_reservation',
      sourceId: reservationSourceId.trim() || createClientIdempotencyKey('operations-reserve-source'),
      sourceLineId: reservationSourceLineId.trim() || undefined,
      idempotencyKey: createClientIdempotencyKey('operations-reservation'),
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
          <div className={styles.title}>Warehouse Operations</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Manual receipts, transfers, reservations and the operational read model on top of canonical warehouse data.
            {selectedSiteId ? ` ${warehouseLive.isConnected ? 'Live stream connected' : 'Live stream reconnecting'}${warehouseLive.lastSyncAt ? ` · ${formatDateTime(warehouseLive.lastSyncAt)}` : ''}` : ''}
          </div>
        </div>
        <div className={styles.headerRight} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <WarehouseModeNav />
          <div className={styles.tabs}>
            {(sites?.results ?? []).map((site) => (
              <button
                key={site.id}
                className={`${styles.tab} ${selectedSiteId === site.id ? styles.tabActive : ''}`}
                onClick={() => setSelectedSiteId(site.id)}
              >
                {site.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.statLabel}>Available Stock</div>
          <div className={styles.statValue}>{formatNumber(siteHealth?.inventory.qtyAvailable ?? 0)}</div>
          <div className={styles.statLabel}>On hand {formatNumber(siteHealth?.inventory.qtyOnHand ?? 0)}</div>
        </div>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.statLabel}>Active Reservations</div>
          <div className={styles.statValue}>{formatNumber(controlTower?.operations.reservations.active ?? 0)}</div>
          <div className={styles.statLabel}>Consumed {formatNumber(controlTower?.operations.reservations.consumed ?? 0)}</div>
        </div>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.statLabel}>Warehouse Docs</div>
          <div className={styles.statValue}>{formatNumber(controlTower?.operations.documents.total ?? 0)}</div>
          <div className={styles.statLabel}>Shipments {formatNumber(controlTower?.operations.documents.shipments ?? 0)}</div>
        </div>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.statLabel}>Projection Backlog</div>
          <div className={styles.statValue}>{formatNumber(controlTower?.operations.realtime.pending ?? 0)}</div>
          <div className={styles.statLabel}>Failed {formatNumber(controlTower?.operations.realtime.failed ?? 0)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
        <SectionCard
          title="Action Cards"
          subtitle={actionCards.length ? `${actionCards.length} recommended warehouse actions` : 'No urgent warehouse actions'}
          icon={<AlertTriangle size={16} color="var(--fill-warning)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {actionCards.map((card) => (
              <div
                key={card.id}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className={styles.stockBadge}
                    style={{
                      background: `color-mix(in srgb, ${alertLevelColor(card.level)} 14%, transparent)`,
                      color: alertLevelColor(card.level),
                    }}
                  >
                    {card.level}
                  </span>
                  <div className={styles.tdName}>{card.title}</div>
                  {card.metric ? <div className={styles.tdSecondary}>{card.metric}</div> : null}
                </div>
                <div className={styles.tdSecondary}>{card.description}</div>
                <a href={actionLinkHref(card.href, selectedSiteId)} className={styles.addBtn}>{card.actionLabel}</a>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Actionable Counters"
          subtitle="Signal pressure across stock, reservations and realtime delivery"
          icon={<Database size={16} color="var(--fill-info, #4ea1ff)" />}
        >
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {actionableCounters.map((counter) => (
              <div key={counter.id} className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>{counter.label}</div>
                <div className={styles.statValue} style={{ fontSize: 18, color: alertLevelColor(counter.level) }}>
                  {formatNumber(counter.value)}
                </div>
                <div className={styles.drawerCardRowSecondary}>{counter.note}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <SectionCard
          title="Task Queues"
          subtitle={`${controlTower?.operations.tasks.queued ?? 0} tactical queue items`}
          icon={<ArrowRightLeft size={16} color="var(--fill-info, #4ea1ff)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {taskQueues.map((queue) => (
              <div key={queue.id} className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>{queue.label}</div>
                <div className={styles.statValue} style={{ fontSize: 18, color: alertLevelColor(queue.level) }}>
                  {formatNumber(queue.count)}
                </div>
                <div className={styles.drawerCardRowSecondary}>{queue.description}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Exception Pressure"
          subtitle={`${controlTower?.operations.exceptions.open ?? 0} active hotspots`}
          icon={<AlertTriangle size={16} color="var(--fill-negative)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {exceptions.slice(0, 4).map((item) => (
              <div key={item.id} className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>{item.category}</div>
                <div className={styles.tdName}>{item.title}</div>
                <div className={styles.drawerCardRowSecondary}>{item.description}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Replenishment Hotspots"
          subtitle={`${controlTower?.operations.replenishment.urgentBins ?? 0} urgent bins`}
          icon={<PackageCheck size={16} color="var(--fill-warning)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {replenishmentHotspots.slice(0, 4).map((hotspot) => (
              <div key={hotspot.id} className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>{hotspot.zoneCode} / {hotspot.binCode}</div>
                <div className={styles.tdName} style={{ color: alertLevelColor(hotspot.level) }}>
                  {formatNumber(hotspot.qtyAvailable)} available / {formatNumber(hotspot.qtyReserved)} reserved
                </div>
                <div className={styles.drawerCardRowSecondary}>{hotspot.primaryVariantLabel ?? hotspot.zoneName}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <div id="receipt-panel">
        <SectionCard title="Receipt" subtitle="Post stock receipt to a bin" icon={<PackageCheck size={16} color="var(--fill-positive)" />}>
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <select className={styles.select} value={receiptVariantId} onChange={(event) => setReceiptVariantId(event.target.value)}>
              {(variants?.results ?? []).map((variant) => (
                <option key={variant.id} value={variant.id}>{variant.productCatalog?.name ?? variant.variantKey}</option>
              ))}
            </select>
            <select className={styles.select} value={receiptBinId} onChange={(event) => setReceiptBinId(event.target.value)}>
              {binOptions.map((bin) => (
                <option key={bin.id} value={bin.id}>{bin.code}</option>
              ))}
            </select>
            <input className={styles.input} inputMode="numeric" value={receiptQty} onChange={(event) => setReceiptQty(event.target.value)} placeholder="Qty" />
            <input className={styles.input} value={receiptRef} onChange={(event) => setReceiptRef(event.target.value)} placeholder="Reference / source id" />
            <button className={styles.addBtn} onClick={() => void handlePostReceipt()} disabled={postReceipt.isPending || !selectedSiteId || !receiptVariantId || !receiptBinId}>
              {postReceipt.isPending ? <RefreshCw size={14} /> : <PackageCheck size={14} />}
              Post receipt
            </button>
          </div>
        </SectionCard>
        </div>

        <div id="transfer-panel">
        <SectionCard title="Transfer" subtitle="Move stock between bins" icon={<ArrowRightLeft size={16} color="var(--fill-warning)" />}>
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <select className={styles.select} value={transferVariantId} onChange={(event) => setTransferVariantId(event.target.value)}>
              {(variants?.results ?? []).map((variant) => (
                <option key={variant.id} value={variant.id}>{variant.productCatalog?.name ?? variant.variantKey}</option>
              ))}
            </select>
            <select className={styles.select} value={transferFromBinId} onChange={(event) => setTransferFromBinId(event.target.value)}>
              {binOptions.map((bin) => (
                <option key={bin.id} value={bin.id}>From {bin.code}</option>
              ))}
            </select>
            <select className={styles.select} value={transferToBinId} onChange={(event) => setTransferToBinId(event.target.value)}>
              {binOptions.map((bin) => (
                <option key={bin.id} value={bin.id}>To {bin.code}</option>
              ))}
            </select>
            <input className={styles.input} inputMode="numeric" value={transferQty} onChange={(event) => setTransferQty(event.target.value)} placeholder="Qty" />
            <input className={styles.input} value={transferRef} onChange={(event) => setTransferRef(event.target.value)} placeholder="Reference / source id" />
            <button className={styles.addBtn} onClick={() => void handlePostTransfer()} disabled={postTransfer.isPending || !selectedSiteId || !transferVariantId || !transferFromBinId || !transferToBinId}>
              {postTransfer.isPending ? <RefreshCw size={14} /> : <ArrowRightLeft size={14} />}
              Post transfer
            </button>
          </div>
        </SectionCard>
        </div>

        <div id="reservation-panel">
        <SectionCard title="Reservation" subtitle="Create and manage stock claims" icon={<SendHorizontal size={16} color="var(--fill-accent)" />}>
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <select className={styles.select} value={reservationVariantId} onChange={(event) => setReservationVariantId(event.target.value)}>
              {(variants?.results ?? []).map((variant) => (
                <option key={variant.id} value={variant.id}>{variant.productCatalog?.name ?? variant.variantKey}</option>
              ))}
            </select>
            <input className={styles.input} inputMode="numeric" value={reservationQty} onChange={(event) => setReservationQty(event.target.value)} placeholder="Qty" />
            <input className={styles.input} value={reservationSourceId} onChange={(event) => setReservationSourceId(event.target.value)} placeholder="Source id / external order" />
            <input className={styles.input} value={reservationSourceLineId} onChange={(event) => setReservationSourceLineId(event.target.value)} placeholder="Source line id" />
            <button className={styles.addBtn} onClick={() => void handleCreateReservation()} disabled={createReservation.isPending || !selectedSiteId || !reservationVariantId}>
              {createReservation.isPending ? <RefreshCw size={14} /> : <SendHorizontal size={14} />}
              Create reservation
            </button>
          </div>
        </SectionCard>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
        <SectionCard title="Balances" subtitle={balances ? `${balances.count} canonical balance rows` : 'Loading balances'} icon={<Database size={16} color="var(--fill-info, #4ea1ff)" />}>
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
                {(balances?.results ?? []).slice(0, 12).map((balance) => (
                  <tr key={balance.id} className={styles.row}>
                    <td>
                      <div className={styles.tdName}>{balance.variant?.productCatalog?.name ?? balance.variant?.variantKey ?? balance.variantId}</div>
                      <div className={styles.tdSecondary}>{localizeAttrSummary(balance.variant?.attributesSummary) || '—'}</div>
                    </td>
                    <td className={styles.tdMono}>{balance.bin?.code ?? '—'}</td>
                    <td className={styles.tdNum}>{formatNumber(balance.qtyOnHand)}</td>
                    <td className={styles.tdNum}>{formatNumber(balance.qtyReserved)}</td>
                    <td className={styles.tdNum}>{formatNumber(balance.qtyAvailable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div id="feed-panel">
        <SectionCard title="Live Feed" subtitle={siteFeed ? `${siteFeed.count} recent events` : 'Loading site feed'} icon={<SendHorizontal size={16} color="var(--fill-info, #4ea1ff)" />}>
          <div style={{ padding: 12, display: 'grid', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {(siteFeed?.results ?? []).slice(0, 12).map((row) => (
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
                <div>
                  <div className={styles.tdName}>{row.eventType}</div>
                  <div className={styles.tdSecondary}>{row.aggregateId}</div>
                </div>
                <div className={styles.tdDate}>{formatDateTime(row.createdAt)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Reservations" subtitle={reservations ? `${reservations.count} site reservations` : 'Loading reservations'} icon={<ArrowRightLeft size={16} color="var(--fill-warning)" />}>
          <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Qty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(reservations?.results ?? []).slice(0, 12).map((reservation) => {
                  const isPendingAction = consumeReservation.isPending || releaseReservation.isPending;
                  return (
                    <tr key={reservation.id} className={styles.row}>
                      <td>
                        <div className={styles.tdMono}>{reservation.sourceType}</div>
                        <div className={styles.tdSecondary}>{reservation.sourceLineId ?? reservation.sourceId}</div>
                      </td>
                      <td>
                        <span
                          className={styles.stockBadge}
                          style={{
                            background: `color-mix(in srgb, ${statusColor(reservation.status)} 14%, transparent)`,
                            color: statusColor(reservation.status),
                          }}
                        >
                          {reservation.status}
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
                            Consume
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
                            Release
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div id="documents-panel">
        <SectionCard title="Documents" subtitle={documents ? `${documents.count} posted warehouse documents` : 'Loading documents'} icon={<ScrollText size={16} color="var(--fill-accent)" />}>
          <div className={styles.tableWrap} style={{ maxHeight: 360 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Posted</th>
                </tr>
              </thead>
              <tbody>
                {(documents?.results ?? []).slice(0, 12).map((document) => (
                  <tr key={document.id} className={styles.row}>
                    <td className={styles.tdName}>{mapDocumentType(document.documentType)}</td>
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
                    <td className={styles.tdMono}>{document.referenceNo ?? document.orderId ?? '—'}</td>
                    <td className={styles.tdDate}>{formatDateTime(document.postedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        </div>
      </div>
    </div>
  );
}
