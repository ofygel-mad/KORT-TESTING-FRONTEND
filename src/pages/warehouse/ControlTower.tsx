import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Database,
  ScrollText,
  SendHorizontal,
} from 'lucide-react';
import {
  useWarehouseFoundationDocuments,
  useWarehouseFoundationOutboxRuntime,
  useWarehouseFoundationReservations,
  useWarehouseFoundationSiteControlTower,
  useWarehouseFoundationSiteFeed,
  useWarehouseFoundationSiteHealth,
  useWarehouseFoundationSites,
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

export default function WarehouseControlTowerPage() {
  const { data: sites } = useWarehouseFoundationSites();
  const { data: outboxRuntime } = useWarehouseFoundationOutboxRuntime();
  const [searchParams] = useSearchParams();
  const [selectedSiteId, setSelectedSiteId] = useState('');

  useEffect(() => {
    if (!selectedSiteId && sites?.results?.length) {
      const requestedSiteId = searchParams.get('site');
      const querySite = requestedSiteId && sites.results.some((site) => site.id === requestedSiteId)
        ? requestedSiteId
        : null;
      setSelectedSiteId(querySite ?? sites.results[0].id);
    }
  }, [searchParams, selectedSiteId, sites?.results]);

  const { data: siteHealth } = useWarehouseFoundationSiteHealth(selectedSiteId || undefined);
  const { data: controlTower } = useWarehouseFoundationSiteControlTower(selectedSiteId || undefined);
  const { data: siteFeed } = useWarehouseFoundationSiteFeed(selectedSiteId || undefined, { limit: 18 });
  const { data: reservations } = useWarehouseFoundationReservations(selectedSiteId || undefined);
  const { data: documents } = useWarehouseFoundationDocuments(selectedSiteId || undefined);
  const warehouseLive = useWarehouseFoundationLiveSync(selectedSiteId || undefined, { feedLimit: 18 });

  const alerts = useMemo(() => controlTower?.alerts?.slice(0, 6) ?? [], [controlTower?.alerts]);
  const alertClasses = useMemo(() => controlTower?.alertClasses ?? [], [controlTower?.alertClasses]);
  const actionableCounters = useMemo(() => controlTower?.actionableCounters ?? [], [controlTower?.actionableCounters]);
  const actionCards = useMemo(() => controlTower?.actionCards ?? [], [controlTower?.actionCards]);
  const taskQueues = useMemo(() => controlTower?.taskQueues ?? [], [controlTower?.taskQueues]);
  const exceptions = useMemo(() => controlTower?.exceptions ?? [], [controlTower?.exceptions]);
  const replenishmentHotspots = useMemo(() => controlTower?.replenishmentHotspots ?? [], [controlTower?.replenishmentHotspots]);
  const topReservations = useMemo(() => reservations?.results?.slice(0, 10) ?? [], [reservations?.results]);
  const recentDocuments = useMemo(() => documents?.results?.slice(0, 8) ?? [], [documents?.results]);
  const recentFeed = useMemo(() => siteFeed?.results?.slice(0, 12) ?? [], [siteFeed?.results]);

  if (!sites?.results?.length) {
    return (
      <div className={styles.root} style={{ overflowY: 'auto' }}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Warehouse Control Tower</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Dedicated operational shell for the new canonical warehouse layer.
            </div>
          </div>
        <div className={styles.headerRight}>
            <WarehouseModeNav />
          </div>
        </div>

        <SectionCard
          title="No Sites Yet"
          subtitle="Bootstrap the first warehouse site before opening the control tower."
          icon={<Building2 size={16} color="var(--fill-accent)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div className={styles.tdSecondary}>
              Control Tower depends on canonical site structure, balances, reservations and site feed projections.
            </div>
            <div>
              <Link to="/warehouse" className={styles.addBtn}>Go to Foundation Setup</Link>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className={styles.root} style={{ overflowY: 'auto' }}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Warehouse Control Tower</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Live operational shell for reservations, documents, alerts and site feed.
            {selectedSiteId
              ? ` ${warehouseLive.isConnected ? 'Live stream connected' : 'Live stream reconnecting'}${warehouseLive.lastSyncAt ? ` · ${formatDateTime(warehouseLive.lastSyncAt)}` : ''}`
              : ''}
          </div>
        </div>
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
      </div>

      <div className={styles.statsBar}>
        <StatCard
          label="Health Score"
          value={controlTower?.healthScore ?? 0}
          note={controlTower ? `Refreshed ${formatDateTime(controlTower.refreshedAt)}` : 'Awaiting snapshot'}
          icon={<Activity size={14} />}
        />
        <StatCard
          label="Active Reservations"
          value={controlTower?.operations.reservations.active ?? 0}
          note={`Consumed ${controlTower?.operations.reservations.consumed ?? 0}`}
          icon={<ArrowLeftRight size={14} />}
        />
        <StatCard
          label="Documents"
          value={controlTower?.operations.documents.total ?? 0}
          note={`Shipments ${controlTower?.operations.documents.shipments ?? 0}`}
          icon={<ScrollText size={14} />}
        />
        <StatCard
          label="Pending Outbox"
          value={outboxRuntime?.summary.pending ?? 0}
          note={`Failed ${outboxRuntime?.summary.failed ?? 0}`}
          icon={<SendHorizontal size={14} />}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
        <div id="alerts-panel">
        <SectionCard
          title="Action Cards"
          subtitle={actionCards.length ? `${actionCards.length} recommended warehouse actions` : 'No urgent warehouse actions'}
          icon={<Activity size={16} color="var(--fill-accent)" />}
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
                <div>
                  <Link to={actionLinkHref(card.href, selectedSiteId)} className={styles.addBtn}>
                    {card.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        </div>

        <div id="realtime-panel">
        <SectionCard
          title="Signal Classes"
          subtitle="Grouped alert pressure and actionable warehouse counters"
          icon={<AlertTriangle size={16} color="var(--fill-warning)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {alertClasses.map((item) => (
                <div
                  key={item.id}
                  style={{
                    minWidth: 120,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div className={styles.tdSecondary}>{item.label}</div>
                  <div className={styles.tdName} style={{ color: alertLevelColor(item.level) }}>{item.count}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
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
          </div>
        </SectionCard>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
        <SectionCard
          title="Task Queues"
          subtitle={taskQueues.length ? `${controlTower?.operations.tasks.queued ?? 0} execution queue items · ${controlTower?.operations.tasks.overdue ?? 0} overdue` : 'No active queue pressure'}
          icon={<Activity size={16} color="var(--fill-info, #4ea1ff)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {taskQueues.map((queue) => (
              <div
                key={queue.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                  background: `color-mix(in srgb, ${alertLevelColor(queue.level)} 8%, var(--bg-surface))`,
                }}
              >
                <span
                  className={styles.stockBadge}
                  style={{
                    background: `color-mix(in srgb, ${alertLevelColor(queue.level)} 14%, transparent)`,
                    color: alertLevelColor(queue.level),
                  }}
                >
                  {queue.level}
                </span>
                <div>
                  <div className={styles.tdName}>{queue.label}</div>
                  <div className={styles.tdSecondary}>{queue.description}</div>
                </div>
                <div className={styles.tdNum}>{formatNumber(queue.count)}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div id="exceptions-panel">
        <SectionCard
          title="Exception Hotspots"
          subtitle={exceptions.length ? `${controlTower?.operations.exceptions.open ?? 0} active hotspots · ${controlTower?.operations.exceptions.breached ?? 0} breached` : 'No active exception hotspots'}
          icon={<AlertTriangle size={16} color="var(--fill-negative)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {exceptions.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: 'var(--bg-surface)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div className={styles.tdName}>{item.title}</div>
                  <span
                    className={styles.stockBadge}
                    style={{
                      background: `color-mix(in srgb, ${alertLevelColor(item.level)} 14%, transparent)`,
                      color: alertLevelColor(item.level),
                    }}
                  >
                    {item.level}
                  </span>
                </div>
                <div className={styles.tdSecondary}>{item.description}</div>
                <div className={styles.tdSecondary}>
                  {item.zoneCode ? `${item.zoneCode}${item.binCode ? ` · ${item.binCode}` : ''}` : item.category}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 16 }}>
        <SectionCard
          title="Priority Alerts"
          subtitle={alerts.length ? `${alerts.length} active site alerts` : 'No priority alerts'}
          icon={<AlertTriangle size={16} color="var(--fill-warning)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div
              className={styles.stockBadge}
              style={{
                width: 'fit-content',
                background: `color-mix(in srgb, ${warehouseLive.isConnected ? 'var(--fill-positive)' : 'var(--fill-warning)'} 14%, transparent)`,
                color: warehouseLive.isConnected ? 'var(--fill-positive)' : 'var(--fill-warning)',
              }}
            >
              {warehouseLive.isConnected ? 'SSE live snapshot active' : 'SSE reconnecting'}
            </div>
            {alerts.length ? alerts.map((alert) => (
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
            )) : (
              <div className={styles.tdSecondary} style={{ padding: '10px 2px' }}>
                Site is stable right now. New alerts will appear here as projections update.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Operational Snapshot"
          subtitle={siteHealth ? `${siteHealth.site.name} · ${siteHealth.structure.zones} zones / ${siteHealth.structure.bins} bins` : 'Loading health snapshot'}
          icon={<Database size={16} color="var(--fill-info, #4ea1ff)" />}
        >
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>Inventory</div>
                <div className={styles.drawerCardRowSecondary}>On hand: {formatNumber(siteHealth?.inventory.qtyOnHand ?? 0)}</div>
                <div className={styles.drawerCardRowSecondary}>Reserved: {formatNumber(siteHealth?.inventory.qtyReserved ?? 0)}</div>
                <div className={styles.drawerCardRowSecondary}>Available: {formatNumber(siteHealth?.inventory.qtyAvailable ?? 0)}</div>
              </div>
              <div className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>Realtime</div>
                <div className={styles.drawerCardRowSecondary}>Pending: {controlTower?.operations.realtime.pending ?? 0}</div>
                <div className={styles.drawerCardRowSecondary}>Processing: {controlTower?.operations.realtime.processing ?? 0}</div>
                <div className={styles.drawerCardRowSecondary}>Processed: {controlTower?.operations.realtime.processed ?? 0}</div>
              </div>
              <div className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>Reservations</div>
                <div className={styles.drawerCardRowSecondary}>Active: {siteHealth?.operations.reservations.active ?? 0}</div>
                <div className={styles.drawerCardRowSecondary}>Consumed: {siteHealth?.operations.reservations.consumed ?? 0}</div>
                <div className={styles.drawerCardRowSecondary}>Released: {siteHealth?.operations.reservations.released ?? 0}</div>
              </div>
              <div className={styles.drawerCard}>
                <div className={styles.drawerCardLabel}>Operational Pressure</div>
                <div className={styles.drawerCardRowSecondary}>Queued tasks: {controlTower?.operations.tasks.queued ?? 0}</div>
                <div className={styles.drawerCardRowSecondary}>Open exceptions: {controlTower?.operations.exceptions.open ?? 0}</div>
                <div className={styles.drawerCardRowSecondary}>Urgent replenishment: {controlTower?.operations.replenishment.urgentBins ?? 0}</div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Replenishment Hotspots"
        subtitle={replenishmentHotspots.length ? `${replenishmentHotspots.length} bins need replenishment focus` : 'No urgent replenishment hotspots'}
        icon={<Database size={16} color="var(--fill-warning)" />}
      >
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {replenishmentHotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div className={styles.tdName}>{hotspot.zoneCode} / {hotspot.binCode}</div>
                <span
                  className={styles.stockBadge}
                  style={{
                    background: `color-mix(in srgb, ${alertLevelColor(hotspot.level)} 14%, transparent)`,
                    color: alertLevelColor(hotspot.level),
                  }}
                >
                  {hotspot.level}
                </span>
              </div>
              <div className={styles.tdSecondary}>
                {formatNumber(hotspot.qtyAvailable)} available / {formatNumber(hotspot.qtyReserved)} reserved
              </div>
              <div className={styles.tdSecondary}>
                {hotspot.primaryVariantLabel ?? hotspot.zoneName}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard
          title="Top Reservations"
          subtitle={topReservations.length ? `${topReservations.length} most visible reservations` : 'No reservations yet'}
          icon={<ArrowLeftRight size={16} color="var(--fill-accent)" />}
        >
          <div className={styles.tableWrap} style={{ maxHeight: 340 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Variant</th>
                  <th>Status</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {topReservations.map((reservation) => (
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
                  </tr>
                ))}
                {!topReservations.length ? (
                  <tr className={styles.row}>
                    <td colSpan={4} className={styles.tdSecondary}>No canonical reservations yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div id="documents-panel">
        <SectionCard
          title="Recent Documents"
          subtitle={recentDocuments.length ? `${recentDocuments.length} latest handoffs and shipments` : 'No posted documents yet'}
          icon={<ScrollText size={16} color="var(--fill-positive)" />}
        >
          <div className={styles.tableWrap} style={{ maxHeight: 340 }}>
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
                {recentDocuments.map((document) => (
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
                {!recentDocuments.length ? (
                  <tr className={styles.row}>
                    <td colSpan={4} className={styles.tdSecondary}>No warehouse documents yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
        </div>
      </div>

      <div id="feed-panel">
      <SectionCard
        title="Live Site Feed"
        subtitle={recentFeed.length ? `${recentFeed.length} recent projection events` : 'Waiting for live activity'}
        icon={<SendHorizontal size={16} color="var(--fill-info, #4ea1ff)" />}
      >
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          {recentFeed.length ? recentFeed.map((row) => (
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
          )) : (
            <div className={styles.tdSecondary} style={{ padding: '10px 6px' }}>
              Feed is empty for this site right now.
            </div>
          )}
        </div>
      </SectionCard>
      </div>
    </div>
  );
}
