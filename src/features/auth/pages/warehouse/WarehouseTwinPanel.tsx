import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Eye,
  Ghost,
  Layers3,
  Map as MapIcon,
} from 'lucide-react';
import type {
  WarehouseSiteControlTowerSnapshot,
  WarehouseSiteMapBinHeat,
  WarehouseSiteMapZoneHeat,
  WarehouseSiteStructure,
} from '@/entities/warehouse/types';
import styles from './Warehouse.module.css';

type OverlayMode = 'activity' | 'reservation' | 'replenishment' | 'exceptions' | 'occupancy';

const OVERLAY_OPTIONS: Array<{ id: OverlayMode; label: string }> = [
  { id: 'activity', label: 'Activity' },
  { id: 'reservation', label: 'Reservations' },
  { id: 'replenishment', label: 'Replenishment' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'occupancy', label: 'Occupancy' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${Math.round(value * 100)}%`;
}

function levelColor(level: 'info' | 'warning' | 'critical') {
  if (level === 'critical') return 'var(--fill-negative)';
  if (level === 'warning') return 'var(--fill-warning)';
  return 'var(--fill-info, #4ea1ff)';
}

function overlayLevel(zone: WarehouseSiteMapZoneHeat, overlay: OverlayMode) {
  if (overlay === 'exceptions') {
    return zone.exceptionCount > 0 ? zone.level : 'info';
  }
  if (overlay === 'replenishment') {
    return zone.urgentReplenishment > 0 ? 'critical' : (zone.replenishmentCandidates > 0 ? 'warning' : 'info');
  }
  if (overlay === 'reservation') {
    return zone.qtyReserved > zone.qtyAvailable && zone.qtyReserved > 0 ? 'warning' : zone.level;
  }
  if (overlay === 'occupancy') {
    return (zone.occupancyRate ?? 0) > 0.9 ? 'warning' : zone.level;
  }
  return zone.level;
}

function zoneMetric(zone: WarehouseSiteMapZoneHeat, overlay: OverlayMode) {
  if (overlay === 'reservation') {
    return `${formatNumber(zone.qtyReserved)} reserved / ${formatNumber(zone.qtyAvailable)} available`;
  }
  if (overlay === 'replenishment') {
    return `${zone.urgentReplenishment} urgent / ${zone.replenishmentCandidates} candidates`;
  }
  if (overlay === 'exceptions') {
    return `${zone.exceptionCount} hotspots / ${zone.blockedBins} blocked bins`;
  }
  if (overlay === 'occupancy') {
    return `${formatPercent(zone.occupancyRate)} occupied`;
  }
  return `${zone.taskPressure} task pressure / ${zone.activeBins} active bins`;
}

function binMetric(bin: WarehouseSiteMapBinHeat, overlay: OverlayMode) {
  if (overlay === 'reservation') {
    return `${formatNumber(bin.qtyReserved)} / ${formatNumber(bin.qtyAvailable)}`;
  }
  if (overlay === 'replenishment') {
    return `${bin.replenishmentLevel}${bin.capacityUnits ? ` · ${formatPercent(bin.occupancyRate)}` : ''}`;
  }
  if (overlay === 'exceptions') {
    return bin.signals.filter((signal) => signal !== 'pick').join(', ') || bin.status;
  }
  if (overlay === 'occupancy') {
    return `${formatPercent(bin.occupancyRate)}`;
  }
  return `${formatNumber(bin.qtyOnHand)} on hand`;
}

function buildZoneFallback(zone: WarehouseSiteStructure['zones'][number]): WarehouseSiteMapZoneHeat {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    zoneType: zone.zoneType,
    status: zone.status,
    binCount: zone._count?.bins ?? 0,
    activeBins: 0,
    blockedBins: 0,
    qtyOnHand: 0,
    qtyAvailable: 0,
    qtyReserved: 0,
    occupancyRate: null,
    reservationPressure: 0,
    taskPressure: 0,
    exceptionCount: 0,
    replenishmentCandidates: 0,
    urgentReplenishment: 0,
    dominantSignal: 'stable',
    level: 'info',
  };
}

interface WarehouseTwinPanelProps {
  siteId?: string;
  structure?: WarehouseSiteStructure;
  controlTower?: WarehouseSiteControlTowerSnapshot;
}

export function WarehouseTwinPanel({ siteId, structure, controlTower }: WarehouseTwinPanelProps) {
  const [overlay, setOverlay] = useState<OverlayMode>('activity');
  const [ghostMode, setGhostMode] = useState(true);
  const [focusedZoneId, setFocusedZoneId] = useState('');
  const [focusedBinId, setFocusedBinId] = useState('');

  const zones = useMemo(() => {
    const heatMap = new Map((controlTower?.siteMap.zones ?? []).map((zone) => [zone.id, zone]));
    return (structure?.zones ?? []).map((zone) => heatMap.get(zone.id) ?? buildZoneFallback(zone));
  }, [controlTower?.siteMap.zones, structure?.zones]);

  const binsByZone = useMemo(() => {
    const heatMap = new Map((controlTower?.siteMap.bins ?? []).map((bin) => [bin.id, bin]));
    const grouped = new Map<string, WarehouseSiteMapBinHeat[]>();

    for (const bin of structure?.bins ?? []) {
      const fallback: WarehouseSiteMapBinHeat = {
        id: bin.id,
        code: bin.code,
        zoneId: bin.zoneId,
        zoneCode: bin.zone?.code ?? 'ZONE',
        zoneName: bin.zone?.name ?? 'Zone',
        zoneType: 'storage',
        status: bin.status,
        binType: bin.binType,
        pickFaceEnabled: bin.pickFaceEnabled,
        capacityUnits: bin.capacityUnits ?? null,
        qtyOnHand: 0,
        qtyAvailable: 0,
        qtyReserved: 0,
        occupancyRate: null,
        reservationPressure: 0,
        replenishmentLevel: 'info',
        level: bin.status === 'active' ? 'info' : 'critical',
        primaryVariantLabel: null,
        signals: [],
      };
      const resolved = heatMap.get(bin.id) ?? fallback;
      const list = grouped.get(bin.zoneId) ?? [];
      list.push(resolved);
      grouped.set(bin.zoneId, list);
    }

    for (const list of grouped.values()) {
      list.sort((left, right) => (
        left.code.localeCompare(right.code)
      ));
    }

    return grouped;
  }, [controlTower?.siteMap.bins, structure?.bins]);

  const focusedZone = useMemo(() => {
    if (!zones.length) return null;
    return zones.find((zone) => zone.id === focusedZoneId) ?? zones[0];
  }, [focusedZoneId, zones]);

  const focusedBin = useMemo(() => {
    if (!focusedBinId) return null;
    return (controlTower?.siteMap.bins ?? []).find((bin) => bin.id === focusedBinId)
      ?? Array.from(binsByZone.values()).flat().find((bin) => bin.id === focusedBinId)
      ?? null;
  }, [binsByZone, controlTower?.siteMap.bins, focusedBinId]);

  const visibleBins = useMemo(() => {
    if (!focusedZone) return [];
    return binsByZone.get(focusedZone.id) ?? [];
  }, [binsByZone, focusedZone]);

  useEffect(() => {
    if (!zones.length) {
      setFocusedZoneId('');
      return;
    }

    if (!focusedZoneId || !zones.some((zone) => zone.id === focusedZoneId)) {
      setFocusedZoneId(zones[0].id);
    }
  }, [focusedZoneId, zones]);

  useEffect(() => {
    if (!focusedBinId) return;
    const hasFocusedBin = Array.from(binsByZone.values()).some((list) => list.some((bin) => bin.id === focusedBinId));
    if (!hasFocusedBin) {
      setFocusedBinId('');
    }
  }, [binsByZone, focusedBinId]);

  const tacticalQueues = controlTower?.taskQueues ?? [];
  const tacticalExceptions = controlTower?.exceptions ?? [];
  const replenishmentHotspots = controlTower?.replenishmentHotspots ?? [];

  return (
    <section
      id="site-map-panel"
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface-elevated) 82%, transparent), var(--bg-surface))',
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
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapIcon size={16} color="var(--fill-accent)" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Warehouse Twin Preview</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              2D spatial-operational shell with zone/bin focus, ghost mode and tactical overlays.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className={styles.typeGroup}>
            {OVERLAY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.typeBtn} ${overlay === option.id ? styles.typeBtnActive : ''}`}
                style={overlay === option.id ? { ['--tc' as string]: levelColor('info') } : undefined}
                onClick={() => setOverlay(option.id)}
              >
                <Layers3 size={12} />
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.typeBtn} ${ghostMode ? styles.typeBtnActive : ''}`}
            style={ghostMode ? { ['--tc' as string]: 'var(--fill-warning)' } : undefined}
            onClick={() => setGhostMode((value) => !value)}
          >
            <Ghost size={12} />
            Ghost
          </button>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gap: 12,
              alignContent: 'start',
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(controlTower?.actionableCounters ?? []).slice(0, 4).map((counter) => (
                <div
                  key={counter.id}
                  style={{
                    minWidth: 150,
                    flex: '1 1 150px',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div className={styles.drawerCardLabel}>{counter.label}</div>
                  <div className={styles.statValue} style={{ fontSize: 18, color: levelColor(counter.level) }}>
                    {formatNumber(counter.value)}
                  </div>
                  <div className={styles.tdSecondary}>{counter.note}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {zones.map((zone) => {
                const zoneLevel = overlayLevel(zone, overlay);
                const isFocused = focusedZone?.id === zone.id;
                const dimmed = ghostMode && focusedZone && focusedZone.id !== zone.id;
                const zoneBins = binsByZone.get(zone.id) ?? [];

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => {
                      setFocusedZoneId(zone.id);
                      setFocusedBinId('');
                    }}
                    style={{
                      textAlign: 'left',
                      borderRadius: 14,
                      border: `1px solid color-mix(in srgb, ${levelColor(zoneLevel)} 42%, var(--border-subtle))`,
                      background: `linear-gradient(180deg, color-mix(in srgb, ${levelColor(zoneLevel)} 10%, var(--bg-surface)), var(--bg-surface-elevated))`,
                      padding: 14,
                      display: 'grid',
                      gap: 10,
                      cursor: 'pointer',
                      opacity: dimmed ? 0.34 : 1,
                      boxShadow: isFocused ? `0 0 0 1px color-mix(in srgb, ${levelColor(zoneLevel)} 28%, transparent)` : 'none',
                      transition: 'opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div className={styles.tdName}>{zone.code}</div>
                        <div className={styles.tdSecondary}>{zone.name}</div>
                      </div>
                      <span
                        className={styles.stockBadge}
                        style={{
                          background: `color-mix(in srgb, ${levelColor(zoneLevel)} 14%, transparent)`,
                          color: levelColor(zoneLevel),
                        }}
                      >
                        {zone.zoneType}
                      </span>
                    </div>

                    <div className={styles.tdSecondary}>{zoneMetric(zone, overlay)}</div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className={styles.stockBadge}>{zone.binCount} bins</span>
                      <span className={styles.stockBadge}>{zone.taskPressure} pressure</span>
                      <span className={styles.stockBadge}>{zone.exceptionCount} exceptions</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {zoneBins.slice(0, 12).map((bin) => {
                        const binLevel = overlay === 'replenishment' ? bin.replenishmentLevel : bin.level;
                        const binFocused = focusedBin?.id === bin.id;
                        return (
                          <button
                            key={bin.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFocusedZoneId(zone.id);
                              setFocusedBinId(bin.id);
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 10,
                              border: `1px solid color-mix(in srgb, ${levelColor(binLevel)} 35%, var(--border-subtle))`,
                              background: `color-mix(in srgb, ${levelColor(binLevel)} 12%, var(--bg-surface))`,
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              minWidth: 72,
                              boxShadow: binFocused ? `0 0 0 1px ${levelColor(binLevel)}` : 'none',
                            }}
                          >
                            <div className={styles.tdMono}>{bin.code}</div>
                            <div className={styles.tdSecondary} style={{ fontSize: 10, marginTop: 2 }}>
                              {binMetric(bin, overlay)}
                            </div>
                          </button>
                        );
                      })}
                      {zoneBins.length > 12 ? (
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRadius: 10,
                            border: '1px dashed var(--border-subtle)',
                            color: 'var(--text-tertiary)',
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          +{zoneBins.length - 12} more
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                background: 'var(--bg-surface)',
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div className={styles.drawerCardLabel}>Focus panel</div>
                  <div className={styles.tdName}>
                    {focusedBin ? focusedBin.code : (focusedZone?.code ?? 'No zone selected')}
                  </div>
                </div>
                <span
                  className={styles.stockBadge}
                  style={{
                    background: `color-mix(in srgb, ${levelColor(focusedBin ? focusedBin.level : (focusedZone?.level ?? 'info'))} 14%, transparent)`,
                    color: levelColor(focusedBin ? focusedBin.level : (focusedZone?.level ?? 'info')),
                  }}
                >
                  {focusedBin ? focusedBin.binType : (focusedZone?.zoneType ?? 'site')}
                </span>
              </div>

              {focusedBin ? (
                <>
                  <div className={styles.tdSecondary}>
                    {focusedBin.zoneCode} · {focusedBin.zoneName}
                    {focusedBin.primaryVariantLabel ? ` · ${focusedBin.primaryVariantLabel}` : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <div className={styles.drawerCard}>
                      <div className={styles.drawerCardLabel}>On hand</div>
                      <div className={styles.tdName}>{formatNumber(focusedBin.qtyOnHand)}</div>
                    </div>
                    <div className={styles.drawerCard}>
                      <div className={styles.drawerCardLabel}>Reserved</div>
                      <div className={styles.tdName}>{formatNumber(focusedBin.qtyReserved)}</div>
                    </div>
                    <div className={styles.drawerCard}>
                      <div className={styles.drawerCardLabel}>Available</div>
                      <div className={styles.tdName}>{formatNumber(focusedBin.qtyAvailable)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className={styles.stockBadge}>
                      occupancy {formatPercent(focusedBin.occupancyRate)}
                    </span>
                    <span className={styles.stockBadge}>
                      pressure {focusedBin.reservationPressure.toFixed(2)}
                    </span>
                    {focusedBin.signals.map((signal) => (
                      <span key={signal} className={styles.stockBadge}>
                        {signal}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.tdSecondary}>
                    {focusedZone?.name ?? 'Select a zone on the site map to inspect its pressure profile.'}
                  </div>
                  {focusedZone ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      <div className={styles.drawerCard}>
                        <div className={styles.drawerCardLabel}>Task pressure</div>
                        <div className={styles.tdName}>{focusedZone.taskPressure}</div>
                      </div>
                      <div className={styles.drawerCard}>
                        <div className={styles.drawerCardLabel}>Exceptions</div>
                        <div className={styles.tdName}>{focusedZone.exceptionCount}</div>
                      </div>
                      <div className={styles.drawerCard}>
                        <div className={styles.drawerCardLabel}>Replenishment</div>
                        <div className={styles.tdName}>
                          {focusedZone.urgentReplenishment} urgent / {focusedZone.replenishmentCandidates}
                        </div>
                      </div>
                      <div className={styles.drawerCard}>
                        <div className={styles.drawerCardLabel}>Occupancy</div>
                        <div className={styles.tdName}>{formatPercent(focusedZone.occupancyRate)}</div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                background: 'var(--bg-surface)',
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Boxes size={14} color="var(--fill-info, #4ea1ff)" />
                <div className={styles.tdName}>Operational queues</div>
              </div>
              {tacticalQueues.map((queue) => (
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
                    background: `color-mix(in srgb, ${levelColor(queue.level)} 8%, var(--bg-surface-inset))`,
                  }}
                >
                  <span
                    className={styles.stockBadge}
                    style={{
                      background: `color-mix(in srgb, ${levelColor(queue.level)} 14%, transparent)`,
                      color: levelColor(queue.level),
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

            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                background: 'var(--bg-surface)',
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="var(--fill-warning)" />
                <div className={styles.tdName}>Hotspots</div>
              </div>
              {(focusedBin ? replenishmentHotspots : tacticalExceptions).slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 12,
                    border: '1px solid var(--border-subtle)',
                    padding: '10px 12px',
                    background: 'var(--bg-surface-inset)',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <div className={styles.tdName}>
                      {'title' in item ? item.title : `${item.zoneCode} / ${item.binCode}`}
                    </div>
                    <span
                      className={styles.stockBadge}
                      style={{
                        background: `color-mix(in srgb, ${levelColor(item.level)} 14%, transparent)`,
                        color: levelColor(item.level),
                      }}
                    >
                      {item.level}
                    </span>
                  </div>
                  <div className={styles.tdSecondary}>
                    {'description' in item
                      ? item.description
                      : `${formatNumber(item.qtyAvailable)} available · ${formatNumber(item.qtyReserved)} reserved${item.primaryVariantLabel ? ` · ${item.primaryVariantLabel}` : ''}`}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to={siteId ? `/warehouse/control-tower?site=${siteId}` : '/warehouse/control-tower'} className={styles.addBtn}>
                <Eye size={14} />
                Control Tower
              </Link>
              <Link to={siteId ? `/warehouse/operations?site=${siteId}` : '/warehouse/operations'} className={styles.exportBtn}>
                <ArrowRightLeft size={14} />
                Operations
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
