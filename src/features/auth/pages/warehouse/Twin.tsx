import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, Box, Compass, Ghost, History, Layers3, MoveDiagonal, Navigation, Pause, Play,
  Radar, RefreshCw, RotateCcw, Route, ShieldAlert, SkipBack, SkipForward, TriangleAlert,
} from 'lucide-react';
import {
  useCommandWarehouseFoundationException,
  useCommandWarehouseFoundationTask,
  useCreateWarehouseFoundationLayoutDraft,
  usePublishWarehouseFoundationLayoutDraft,
  useRollbackWarehouseFoundationLayout,
  useSyncWarehouseFoundationOperationalState,
  useTriggerSlaEscalation,
  useValidateWarehouseFoundationLayoutDraft,
  useWarehouseFoundationAssigneePools,
  useWarehouseFoundationExceptionTimeline,
  useWarehouseFoundationLayoutCompare,
  useWarehouseFoundationLayoutPublishAudit,
  useWarehouseFoundationRouteHistory,
  useWarehouseFoundationSiteControlTower,
  useWarehouseFoundationSites,
  useWarehouseFoundationTaskTimeline,
  useWarehouseFoundationTwinRuntime,
} from '@/entities/warehouse/queries';
import { useWarehouseFoundationLiveSync } from '@/entities/warehouse/live';
import type { WarehouseExceptionEntity, WarehouseLayoutNode, WarehouseSiteMapBinHeat, WarehouseSiteMapZoneHeat, WarehouseTask } from '@/entities/warehouse/types';
import { WarehouseModeNav } from './WarehouseModeNav';
import { WarehouseTwinPublishReviewModal } from './WarehouseTwinPublishReviewModal';
import { WarehouseTwinSpatialCanvas } from './WarehouseTwinSpatialCanvas';
import { WarehouseTwinTimelineModal } from './WarehouseTwinTimelineModal';
import styles from './Warehouse.module.css';

type CameraMode = 'overview' | 'tasks' | 'exceptions' | 'routes';
type ProjectionMode = 'tactical' | 'spatial';
type HeatLayer = 'none' | 'occupancy' | 'reservation' | 'tasks' | 'exceptions' | 'forecast';
type IsolateLayer = 'none' | 'zones' | 'bins' | 'tasks' | 'exceptions' | 'routes';
type TimelineTarget = { kind: 'task' | 'exception'; id: string } | null;

const formatNumber = (value: number) => new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const levelColor = (level: string) =>
  level === 'critical' || level === 'high' || level === 'breached'
    ? 'var(--fill-negative)'
    : level === 'warning' || level === 'normal' || level === 'at_risk'
      ? 'var(--fill-warning)'
      : 'var(--fill-info, #4ea1ff)';
const heatTone = (value: number, hint?: string) =>
  hint === 'critical' || value >= 0.72 ? 'var(--fill-negative)' : hint === 'warning' || value >= 0.42 ? 'var(--fill-warning)' : 'var(--fill-info, #4ea1ff)';

function zoneMetric(zone: WarehouseSiteMapZoneHeat | undefined, layer: HeatLayer) {
  if (!zone) return { value: 0.12, hint: 'info', label: 'No projection data' };
  if (layer === 'occupancy') return { value: clamp((zone.occupancyRate ?? 0) / 100), hint: zone.level, label: `Occupancy ${Math.round(zone.occupancyRate ?? 0)}%` };
  if (layer === 'reservation') return { value: clamp(zone.reservationPressure / 100), hint: zone.level, label: `Reservation pressure ${Math.round(zone.reservationPressure)}` };
  if (layer === 'tasks') return { value: clamp(zone.taskPressure / 100), hint: zone.level, label: `Task pressure ${Math.round(zone.taskPressure)}` };
  if (layer === 'exceptions') return { value: clamp(zone.exceptionCount / 6), hint: zone.exceptionCount > 0 ? zone.level : 'info', label: `${zone.exceptionCount} exceptions` };
  if (layer === 'forecast') {
    const score = clamp((zone.reservationPressure + zone.taskPressure + (zone.urgentReplenishment * 20)) / 180);
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.42 ? 'warning' : 'info', label: `Forecast ${Math.round(score * 100)}%` };
  }
  return { value: zone.level === 'critical' ? 0.8 : zone.level === 'warning' ? 0.5 : 0.18, hint: zone.level, label: zone.dominantSignal };
}

function binMetric(bin: WarehouseSiteMapBinHeat | undefined, layer: HeatLayer) {
  if (!bin) return { value: 0.12, hint: 'info', label: 'No projection data' };
  if (layer === 'occupancy') return { value: clamp((bin.occupancyRate ?? 0) / 100), hint: bin.level, label: `Occupancy ${Math.round(bin.occupancyRate ?? 0)}%` };
  if (layer === 'reservation') return { value: clamp(bin.reservationPressure / 100), hint: bin.level, label: `Reserved ${Math.round(bin.qtyReserved)}` };
  if (layer === 'tasks') {
    const score = clamp((bin.signals.includes('pick_pressure') ? 0.55 : 0) + (bin.signals.includes('replenishment') ? 0.38 : 0));
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.4 ? 'warning' : 'info', label: bin.signals.join(' • ') || 'No task signal' };
  }
  if (layer === 'exceptions') {
    const score = clamp((bin.status !== 'active' ? 0.85 : 0) + (bin.signals.includes('blocked') ? 0.5 : 0));
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.4 ? 'warning' : 'info', label: bin.signals.join(' • ') || 'No exception signal' };
  }
  if (layer === 'forecast') {
    const score = clamp((bin.reservationPressure + (bin.replenishmentLevel === 'critical' ? 55 : bin.replenishmentLevel === 'warning' ? 28 : 0)) / 120);
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.4 ? 'warning' : 'info', label: `Forecast ${Math.round(score * 100)}%` };
  }
  return { value: bin.level === 'critical' ? 0.82 : bin.level === 'warning' ? 0.5 : 0.2, hint: bin.level, label: bin.primaryVariantLabel ?? bin.code };
}

export default function WarehouseTwinPage() {
  const { data: sites } = useWarehouseFoundationSites();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('tactical');
  const [heatLayer, setHeatLayer] = useState<HeatLayer>('forecast');
  const [isolateLayer, setIsolateLayer] = useState<IsolateLayer>('none');
  const [showRoutes, setShowRoutes] = useState(true);
  const [showBins, setShowBins] = useState(true);
  const [showGhost, setShowGhost] = useState(false);
  const [showForecast, setShowForecast] = useState(true);
  const [focusedNodeId, setFocusedNodeId] = useState('');
  const [executionOwner, setExecutionOwner] = useState('Twin Operator');
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [forcePublish, setForcePublish] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [selectedCompareVersionId, setSelectedCompareVersionId] = useState('');
  const [timelineTarget, setTimelineTarget] = useState<TimelineTarget>(null);
  const [routeReplayPlaying, setRouteReplayPlaying] = useState(false);
  const [routeReplayIndex, setRouteReplayIndex] = useState(0);
  const [routeHistoryMode, setRouteHistoryMode] = useState(false);
  const [routeHistoryIndex, setRouteHistoryIndex] = useState(0);
  const [routeHistoryPlaying, setRouteHistoryPlaying] = useState(false);
  const [rollbackTargetVersionId, setRollbackTargetVersionId] = useState('');
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!selectedSiteId && sites?.results?.length) {
      const requestedSiteId = searchParams.get('site');
      const resolved = requestedSiteId && sites.results.some((site) => site.id === requestedSiteId) ? requestedSiteId : sites.results[0].id;
      setSelectedSiteId(resolved);
    }
  }, [searchParams, selectedSiteId, sites?.results]);

  const selectedDraftId = searchParams.get('draft') ?? undefined;
  const { data: twin } = useWarehouseFoundationTwinRuntime(selectedSiteId || undefined, { draftVersionId: selectedDraftId });
  const { data: controlTower } = useWarehouseFoundationSiteControlTower(selectedSiteId || undefined);
  const { data: poolSnapshot } = useWarehouseFoundationAssigneePools(selectedSiteId || undefined);
  const live = useWarehouseFoundationLiveSync(selectedSiteId || undefined, { feedLimit: 18 });
  const taskTimeline = useWarehouseFoundationTaskTimeline(timelineTarget?.kind === 'task' ? timelineTarget.id : undefined);
  const exceptionTimeline = useWarehouseFoundationExceptionTimeline(timelineTarget?.kind === 'exception' ? timelineTarget.id : undefined);
  const compareResult = useWarehouseFoundationLayoutCompare(twin?.layout.draftVersion?.id, selectedCompareVersionId || undefined);

  const createDraft = useCreateWarehouseFoundationLayoutDraft();
  const publishDraft = usePublishWarehouseFoundationLayoutDraft();
  const validateDraft = useValidateWarehouseFoundationLayoutDraft();
  const commandTask = useCommandWarehouseFoundationTask();
  const commandException = useCommandWarehouseFoundationException();
  const syncRuntime = useSyncWarehouseFoundationOperationalState();
  const rollbackLayout = useRollbackWarehouseFoundationLayout();
  const triggerEscalation = useTriggerSlaEscalation();
  const routeHistory = useWarehouseFoundationRouteHistory(selectedSiteId || undefined, { limit: 60 });
  const publishAudit = useWarehouseFoundationLayoutPublishAudit(selectedSiteId || undefined);

  const nodes = twin?.layout.nodes ?? [];
  const activeAnalysis = twin?.layout.analysis ?? null;
  const zoneNodes = useMemo(() => nodes.filter((node) => node.nodeType === 'zone'), [nodes]);
  const binNodes = useMemo(() => nodes.filter((node) => node.nodeType === 'bin'), [nodes]);
  const focusedNode = useMemo(() => nodes.find((node) => node.id === focusedNodeId) ?? null, [focusedNodeId, nodes]);
  const zoneHeatMap = useMemo(() => new Map((controlTower?.siteMap.zones ?? []).map((zone) => [zone.id, zone])), [controlTower?.siteMap.zones]);
  const binHeatMap = useMemo(() => new Map((controlTower?.siteMap.bins ?? []).map((bin) => [bin.id, bin])), [controlTower?.siteMap.bins]);
  const pools = poolSnapshot?.results ?? twin?.assigneePools ?? [];

  const compareOptions = useMemo(() => {
    if (!twin?.layout.draftVersion) return [];
    const versions = [twin.layout.liveVersion, ...twin.layout.historyVersions.filter((item) => item.id !== twin.layout.draftVersion?.id)];
    return Array.from(new Map(versions.map((item) => [item.id, item])).values()).map((item) => ({
      id: item.id,
      label: `${item.id === twin.layout.liveVersion.id ? 'Live' : 'Candidate'} • v${item.versionNo} • ${item.state}`,
    }));
  }, [twin?.layout.draftVersion, twin?.layout.historyVersions, twin?.layout.liveVersion]);

  useEffect(() => {
    if (!compareOptions.length) {
      setSelectedCompareVersionId('');
      return;
    }
    if (!selectedCompareVersionId || !compareOptions.some((item) => item.id === selectedCompareVersionId)) {
      setSelectedCompareVersionId(compareOptions[0].id);
    }
  }, [compareOptions, selectedCompareVersionId]);

  const sceneBounds = useMemo(() => {
    const maxX = Math.max(...nodes.map((node) => node.x + node.width), twin?.camera.dispatchAnchor.x ?? 0, 8);
    const maxY = Math.max(...nodes.map((node) => node.y + node.height), twin?.camera.dispatchAnchor.y ?? 0, 6);
    return { width: maxX + 1.8, height: maxY + 1.8 };
  }, [nodes, twin?.camera.dispatchAnchor.x, twin?.camera.dispatchAnchor.y]);
  const scale = 78;

  const routeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const route of twin?.routes ?? []) {
      if (route.from.nodeId) ids.add(route.from.nodeId);
      if (route.to.nodeId) ids.add(route.to.nodeId);
    }
    return ids;
  }, [twin?.routes]);

  const taskNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of twin?.tasks ?? []) {
      const sourceNode = nodes.find((node) => node.domainId === (task.sourceBinId ?? task.binId));
      const targetNode = nodes.find((node) => node.domainId === task.targetBinId);
      if (sourceNode) ids.add(sourceNode.id);
      if (targetNode) ids.add(targetNode.id);
    }
    return ids;
  }, [nodes, twin?.tasks]);

  const exceptionNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of twin?.exceptions ?? []) {
      const node = nodes.find((candidate) => candidate.domainId === item.binId);
      if (node) ids.add(node.id);
    }
    return ids;
  }, [nodes, twin?.exceptions]);

  const focusOptions = useMemo(() => {
    if (!twin) return [];
    if (cameraMode === 'tasks') {
      return twin.tasks.map((task) => ({
        id: `task:${task.id}`,
        label: task.title,
        nodeId: nodes.find((node) => node.domainId === task.sourceBinId)?.id ?? nodes.find((node) => node.domainId === task.targetBinId)?.id ?? null,
      })).filter((item) => Boolean(item.nodeId)).slice(0, 8);
    }
    if (cameraMode === 'exceptions') {
      return twin.exceptions.map((item) => ({
        id: `exception:${item.id}`,
        label: item.title,
        nodeId: nodes.find((node) => node.domainId === item.binId)?.id ?? null,
      })).filter((item) => Boolean(item.nodeId)).slice(0, 8);
    }
    if (cameraMode === 'routes') {
      return twin.routes.map((route) => ({
        id: route.id,
        label: `${route.taskType} route`,
        nodeId: route.from.nodeId ?? route.to.nodeId ?? null,
      })).filter((item) => Boolean(item.nodeId)).slice(0, 8);
    }
    return twin.focusTargets.map((item) => ({
      id: item.id,
      label: item.label,
      nodeId: item.nodeId ?? null,
    })).filter((item) => Boolean(item.nodeId)).slice(0, 8);
  }, [cameraMode, nodes, twin]);

  const activeRoute = useMemo(() => {
    const routes = twin?.routes ?? [];
    if (!routes.length) return null;
    return routes[((routeReplayIndex % routes.length) + routes.length) % routes.length] ?? null;
  }, [routeReplayIndex, twin?.routes]);

  const historicalSegments = routeHistory.data?.segments ?? [];
  const activeHistorySegment = useMemo(() => {
    if (!historicalSegments.length) return null;
    return historicalSegments[((routeHistoryIndex % historicalSegments.length) + historicalSegments.length) % historicalSegments.length] ?? null;
  }, [historicalSegments, routeHistoryIndex]);

  useEffect(() => {
    if (!routeReplayPlaying || !(twin?.routes.length)) return undefined;
    const timer = window.setInterval(() => setRouteReplayIndex((current) => current + 1), 2800);
    return () => window.clearInterval(timer);
  }, [routeReplayPlaying, twin?.routes.length]);

  useEffect(() => {
    const segments = routeHistory.data?.segments;
    if (!routeHistoryPlaying || !segments?.length) return undefined;
    const timer = window.setInterval(() => setRouteHistoryIndex((current) => current + 1), 2200);
    return () => window.clearInterval(timer);
  }, [routeHistoryPlaying, routeHistory.data?.segments]);

  useEffect(() => {
    if (!nodes.length) {
      setFocusedNodeId('');
      return;
    }
    if (!focusedNodeId || !nodes.some((node) => node.id === focusedNodeId)) {
      setFocusedNodeId(nodes[0].id);
    }
  }, [focusedNodeId, nodes]);

  useEffect(() => {
    if (!focusedNodeId) return;
    nodeRefs.current[focusedNodeId]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [focusedNodeId]);

  useEffect(() => {
    if (!twin) return;
    const nextNodeId =
      cameraMode === 'routes'
        ? activeRoute?.from.nodeId ?? activeRoute?.to.nodeId ?? focusOptions[0]?.nodeId
        : focusOptions[0]?.nodeId ?? nodes[0]?.id;
    if (nextNodeId && nextNodeId !== focusedNodeId) setFocusedNodeId(nextNodeId);
  }, [activeRoute, cameraMode, focusOptions, focusedNodeId, nodes, twin]);

  const updateParams = (next: { site?: string; draft?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    if (next.site !== undefined) params.set('site', next.site);
    if (next.draft === null) params.delete('draft');
    if (next.draft) params.set('draft', next.draft);
    setSearchParams(params, { replace: true });
  };

  const handleCreateDraft = async () => {
    if (!selectedSiteId) return;
    const result = await createDraft.mutateAsync({ siteId: selectedSiteId });
    updateParams({ site: selectedSiteId, draft: result.draft.id });
  };

  const focusNodeForDomain = (domainId?: string | null) => {
    if (!domainId) return;
    const targetNode = nodes.find((node) => node.domainId === domainId);
    if (targetNode) setFocusedNodeId(targetNode.id);
  };

  const nodeOpacity = (node: WarehouseLayoutNode) => {
    const focusedZoneId = focusedNode?.zoneId ?? focusedNode?.domainId ?? null;
    let opacity = 1;
    if (showGhost && focusedZoneId && node.zoneId && focusedZoneId !== node.zoneId) opacity *= node.nodeType === 'zone' ? 0.2 : 0.12;
    if (isolateLayer === 'zones' && node.nodeType === 'bin') opacity *= 0.12;
    if (isolateLayer === 'bins' && node.nodeType === 'zone') opacity *= 0.18;
    if (isolateLayer === 'tasks' && !taskNodeIds.has(node.id)) opacity *= 0.18;
    if (isolateLayer === 'exceptions' && !exceptionNodeIds.has(node.id)) opacity *= 0.18;
    if (isolateLayer === 'routes' && !routeNodeIds.has(node.id)) opacity *= 0.14;
    return opacity;
  };

  const nodeTone = (node: WarehouseLayoutNode) => {
    if (focusedNodeId === node.id) return 'var(--fill-positive)';
    return node.nodeType === 'zone'
      ? heatTone(zoneMetric(zoneHeatMap.get(node.domainId), heatLayer).value, zoneMetric(zoneHeatMap.get(node.domainId), heatLayer).hint)
      : heatTone(binMetric(binHeatMap.get(node.domainId), heatLayer).value, binMetric(binHeatMap.get(node.domainId), heatLayer).hint);
  };

  const pickPoolId = (task: WarehouseTask) => task.assigneePoolId ?? pools.find((pool) => pool.poolType === task.taskType)?.id ?? pools.find((pool) => pool.poolType === 'pick')?.id;
  const exceptionPoolId = (item: WarehouseExceptionEntity) => item.ownerPoolId ?? pools.find((pool) => pool.poolType === 'exception')?.id;

  const runTaskCommand = async (task: WarehouseTask, command: 'assign' | 'start' | 'pause' | 'complete' | 'cancel' | 'replenish') => {
    if (!selectedSiteId) return;
    await commandTask.mutateAsync({ siteId: selectedSiteId, taskId: task.id, dto: { command, assigneeName: executionOwner || undefined, assigneeRole: 'operator', poolId: pickPoolId(task) } });
  };

  const runExceptionCommand = async (item: WarehouseExceptionEntity, command: 'assign' | 'acknowledge' | 'resolve' | 'escalate' | 'reopen') => {
    if (!selectedSiteId) return;
    await commandException.mutateAsync({ siteId: selectedSiteId, exceptionId: item.id, dto: { command, ownerName: executionOwner || undefined, ownerRole: 'supervisor', poolId: exceptionPoolId(item), resolutionCode: command === 'resolve' ? 'resolved_from_twin' : undefined } });
  };

  if (!sites?.results?.length) {
    return <div className={styles.root}><div className={styles.header}><div><div className={styles.title}>Warehouse Twin</div><div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Twin mode requires at least one warehouse site.</div></div><div className={styles.headerRight}><WarehouseModeNav /></div></div></div>;
  }

  return (
    <div className={styles.root} style={{ overflowY: 'auto' }}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Warehouse Twin</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            One warehouse state with execution pools, publish governance, spatial overlays and live route focus.
            {selectedSiteId ? ` ${live.isConnected ? 'Live stream connected' : 'Live stream reconnecting'}` : ''}
          </div>
        </div>
        <div className={styles.headerRight} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <WarehouseModeNav />
          <div className={styles.tabs}>
            {sites.results.map((site) => (
              <button key={site.id} className={`${styles.tab} ${selectedSiteId === site.id ? styles.tabActive : ''}`} onClick={() => { setSelectedSiteId(site.id); updateParams({ site: site.id, draft: null }); }}>
                <Compass size={13} />
                {site.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}><div className={styles.statLabel}>Runtime</div><div className={styles.statValue}>{twin?.layout.mode === 'draft' ? 'Draft' : 'Live'}</div><div className={styles.statLabel}>Version {twin?.layout.activeVersion.versionNo ?? '-'}</div></div>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}><div className={styles.statLabel}>Tasks</div><div className={styles.statValue}>{formatNumber(twin?.tasks.length ?? 0)}</div><div className={styles.statLabel}>Overdue {formatNumber(controlTower?.operations.tasks.overdue ?? 0)}</div></div>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}><div className={styles.statLabel}>Exceptions</div><div className={styles.statValue}>{formatNumber(twin?.exceptions.length ?? 0)}</div><div className={styles.statLabel}>Breached {formatNumber(controlTower?.operations.exceptions.breached ?? 0)}</div></div>
        <div className={styles.statItem} style={{ minWidth: 0, flex: 1 }}><div className={styles.statLabel}>Routes</div><div className={styles.statValue}>{formatNumber(twin?.routes.length ?? 0)}</div><div className={styles.statLabel}>Replay {activeRoute ? `${routeReplayIndex + 1}/${twin?.routes.length ?? 1}` : 'Idle'}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['tactical', 'spatial'] as ProjectionMode[]).map((mode) => <button key={mode} type="button" className={`${styles.typeBtn} ${projectionMode === mode ? styles.typeBtnActive : ''}`} style={projectionMode === mode ? { ['--tc' as string]: 'var(--fill-positive)' } : undefined} onClick={() => setProjectionMode(mode)}><Box size={12} />{mode}</button>)}
        {(['overview', 'tasks', 'exceptions', 'routes'] as CameraMode[]).map((mode) => <button key={mode} type="button" className={`${styles.typeBtn} ${cameraMode === mode ? styles.typeBtnActive : ''}`} style={cameraMode === mode ? { ['--tc' as string]: 'var(--fill-accent)' } : undefined} onClick={() => setCameraMode(mode)}><Navigation size={12} />{mode}</button>)}
        <select className={styles.select} value={heatLayer} onChange={(event) => setHeatLayer(event.target.value as HeatLayer)}><option value="none">Neutral layer</option><option value="occupancy">Occupancy heat</option><option value="reservation">Reservation heat</option><option value="tasks">Task pressure</option><option value="exceptions">Exception heat</option><option value="forecast">Ghost forecast</option></select>
        <select className={styles.select} value={isolateLayer} onChange={(event) => setIsolateLayer(event.target.value as IsolateLayer)}><option value="none">All layers</option><option value="zones">Isolate zones</option><option value="bins">Isolate bins</option><option value="tasks">Isolate task path</option><option value="exceptions">Isolate exceptions</option><option value="routes">Isolate routes</option></select>
        <button type="button" className={`${styles.typeBtn} ${showRoutes ? styles.typeBtnActive : ''}`} onClick={() => setShowRoutes((value) => !value)}><Route size={12} />Routes</button>
        <button type="button" className={`${styles.typeBtn} ${showBins ? styles.typeBtnActive : ''}`} onClick={() => setShowBins((value) => !value)}><Layers3 size={12} />Bins</button>
        <button type="button" className={`${styles.typeBtn} ${showGhost ? styles.typeBtnActive : ''}`} onClick={() => setShowGhost((value) => !value)}><Ghost size={12} />Ghost</button>
        <button type="button" className={`${styles.typeBtn} ${showForecast ? styles.typeBtnActive : ''}`} onClick={() => setShowForecast((value) => !value)}><Radar size={12} />Forecast</button>
      </div>

      {focusOptions.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{focusOptions.map((item) => <button key={item.id} type="button" className={`${styles.typeBtn} ${item.nodeId === focusedNodeId ? styles.typeBtnActive : ''}`} style={item.nodeId === focusedNodeId ? { ['--tc' as string]: 'var(--fill-positive)' } : undefined} onClick={() => item.nodeId && setFocusedNodeId(item.nodeId)}><Navigation size={12} />{item.label}</button>)}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 16, alignItems: 'start' }}>
        <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface-elevated) 82%, transparent), var(--bg-surface))' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Twin Scene</div><div className={styles.tdSecondary}>{heatLayer === 'forecast' ? 'Ghost forecast' : `${heatLayer} heat`} • isolate {isolateLayer}</div></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className={styles.exportBtn} onClick={() => void syncRuntime.mutateAsync(selectedSiteId)} disabled={syncRuntime.isPending}>{syncRuntime.isPending ? <RefreshCw size={14} /> : <Activity size={14} />}Sync runtime</button>
              {!twin?.layout.draftVersion ? <button type="button" className={styles.addBtn} onClick={() => void handleCreateDraft()} disabled={createDraft.isPending}>{createDraft.isPending ? <RefreshCw size={14} /> : <MoveDiagonal size={14} />}Create Draft</button> : <button type="button" className={styles.addBtn} onClick={() => setPublishReviewOpen(true)} disabled={publishDraft.isPending}><ShieldAlert size={14} />Review Publish</button>}
            </div>
          </div>

          {projectionMode === 'spatial' ? (
            <div style={{ padding: 16 }}>
              <WarehouseTwinSpatialCanvas nodes={nodes} routes={twin?.routes ?? []} focusedNodeId={focusedNodeId} cameraMode={cameraMode} showBins={showBins} showGhost={showGhost} showRoutes={showRoutes} showForecast={showForecast} heatLayer={heatLayer} isolateLayer={isolateLayer} activeRouteId={activeRoute?.id} routePulseKey={live.lastSyncAt ?? ''} zoneHeatMap={zoneHeatMap} binHeatMap={binHeatMap} onFocusNode={setFocusedNodeId} />
            </div>
          ) : (
            <div ref={sceneRef} style={{ position: 'relative', overflow: 'auto', padding: 16, maxHeight: 780 }}>
              <div style={{ position: 'relative', width: sceneBounds.width * scale, height: sceneBounds.height * scale, minWidth: 640, minHeight: 420, background: 'radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--fill-accent) 8%, transparent), transparent 45%), linear-gradient(180deg, color-mix(in srgb, var(--bg-surface-inset) 75%, transparent), var(--bg-surface))', borderRadius: 18, border: '1px solid var(--border-subtle)' }}>
                {showRoutes ? <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>{(twin?.routes ?? []).map((route) => <line key={route.id} x1={route.from.x * scale} y1={route.from.y * scale} x2={route.to.x * scale} y2={route.to.y * scale} stroke={levelColor(route.priority)} strokeWidth={!activeRoute || activeRoute.id === route.id ? 5 : 2.6} strokeDasharray={route.status === 'in_progress' ? '0' : '10 6'} opacity={!activeRoute || activeRoute.id === route.id ? 0.96 : (routeReplayPlaying ? 0.16 : 0.48)} />)}</svg> : null}
                <div style={{ position: 'absolute', left: twin?.camera.dispatchAnchor.x ? twin.camera.dispatchAnchor.x * scale - 42 : 12, top: twin?.camera.dispatchAnchor.y ? twin.camera.dispatchAnchor.y * scale - 18 : 12, width: 84, height: 36, borderRadius: 12, border: '1px dashed color-mix(in srgb, var(--fill-warning) 50%, var(--border-subtle))', color: 'var(--fill-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: 'color-mix(in srgb, var(--fill-warning) 10%, var(--bg-surface))' }}>Dispatch</div>
                {zoneNodes.map((node) => { const metric = zoneMetric(zoneHeatMap.get(node.domainId), heatLayer); return <button key={node.id} ref={(element) => { nodeRefs.current[node.id] = element; }} type="button" onClick={() => setFocusedNodeId(node.id)} style={{ position: 'absolute', left: node.x * scale, top: node.y * scale, width: node.width * scale, height: node.height * scale, borderRadius: 16, border: `1px solid color-mix(in srgb, ${nodeTone(node)} 42%, var(--border-subtle))`, background: `linear-gradient(180deg, color-mix(in srgb, ${nodeTone(node)} 12%, var(--bg-surface)), var(--bg-surface-elevated))`, color: 'var(--text-primary)', textAlign: 'left', padding: 12, cursor: 'pointer', opacity: nodeOpacity(node), boxShadow: focusedNodeId === node.id ? `0 0 0 1px color-mix(in srgb, ${nodeTone(node)} 60%, transparent)` : 'none' }}><div className={styles.tdName}>{node.label ?? node.zone?.code ?? 'Zone'}</div><div className={styles.tdSecondary}>{node.zone?.name ?? node.zone?.zoneType ?? 'Zone'}</div><div className={styles.drawerCardRowSecondary} style={{ marginTop: 6, color: nodeTone(node) }}>{metric.label}</div>{showForecast && heatLayer === 'forecast' ? <div className={styles.stockBadge} style={{ marginTop: 6, background: `color-mix(in srgb, ${nodeTone(node)} 14%, transparent)`, color: nodeTone(node) }}>Forecast {Math.round(metric.value * 100)}%</div> : null}</button>; })}
                {showBins ? binNodes.map((node) => { const metric = binMetric(binHeatMap.get(node.domainId), heatLayer); return <button key={node.id} ref={(element) => { nodeRefs.current[node.id] = element; }} type="button" onClick={() => setFocusedNodeId(node.id)} style={{ position: 'absolute', left: node.x * scale, top: node.y * scale, width: node.width * scale, height: node.height * scale, borderRadius: 10, border: `1px solid color-mix(in srgb, ${nodeTone(node)} 36%, var(--border-subtle))`, background: `color-mix(in srgb, ${nodeTone(node)} 14%, var(--bg-surface))`, color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer', opacity: nodeOpacity(node), boxShadow: focusedNodeId === node.id ? `0 0 0 1px color-mix(in srgb, ${nodeTone(node)} 70%, transparent)` : 'none' }} title={metric.label}>{node.label ?? node.bin?.code ?? 'Bin'}</button>; }) : null}
              </div>
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className={styles.drawerCard}><div className={styles.drawerCardLabel}>Runtime Mode</div><div className={styles.tdName}>{twin?.layout.mode === 'draft' ? 'Draft layout active' : 'Live layout active'}</div><div className={styles.drawerCardRowSecondary}>Live version: {twin?.layout.liveVersion.versionNo ?? '-'}</div><div className={styles.drawerCardRowSecondary}>Execution owner</div><input className={styles.select} value={executionOwner} onChange={(event) => setExecutionOwner(event.target.value)} placeholder="Twin Operator" />{twin?.layout.availableDrafts?.length ? <select className={styles.select} value={selectedDraftId ?? ''} onChange={(event) => updateParams({ site: selectedSiteId, draft: event.target.value || null })}><option value="">Live layout</option>{twin.layout.availableDrafts.map((draft) => <option key={draft.id} value={draft.id}>Draft v{draft.versionNo}</option>)}</select> : null}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}><button className={styles.exportBtn} onClick={() => twin?.layout.draftVersion && void validateDraft.mutateAsync({ siteId: selectedSiteId, draftId: twin.layout.draftVersion.id })} disabled={!twin?.layout.draftVersion || validateDraft.isPending}>Validate</button><button className={styles.addBtn} onClick={() => setPublishReviewOpen(true)} disabled={!twin?.layout.draftVersion}>Review</button></div></section>

          <section className={styles.drawerCard}>
            <div className={styles.drawerCardLabel}>Assignee Pools</div>
            <div className={styles.tdName}>{formatNumber(pools.length)} pools online</div>
            <div style={{ display: 'grid', gap: 8 }}>{pools.slice(0, 4).map((pool) => (
              <div key={pool.id} className={styles.drawerCardRowSecondary} style={{ justifyContent: 'space-between' }}>
                <span>{pool.name}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {(pool.overdueTasks ?? 0) > 0 ? <TriangleAlert size={11} color="var(--fill-warning)" /> : null}
                  {pool.activeTasks ?? 0} tasks
                  {pool.assignmentPolicy && pool.assignmentPolicy !== 'fifo' ? <span className={styles.stockBadge} style={{ fontSize: 10 }}>{pool.assignmentPolicy}</span> : null}
                </span>
              </div>
            ))}</div>
            <button className={styles.exportBtn} style={{ marginTop: 4 }} onClick={() => void triggerEscalation.mutateAsync(selectedSiteId)} disabled={triggerEscalation.isPending || !selectedSiteId}><TriangleAlert size={13} />Escalate SLA Breach</button>
          </section>

          {activeAnalysis ? (
            <section className={styles.drawerCard}>
              <div className={styles.drawerCardLabel}>Layout Governance</div>
              <div className={styles.tdName}>{activeAnalysis.publishReady ? 'Publish-ready draft' : 'Supervisor review required'}</div>
              <div className={styles.drawerCardRowSecondary}>{activeAnalysis.summary.hardBlockers} blockers / {activeAnalysis.summary.warnings} warnings / {activeAnalysis.summary.impactedTasks} impacted tasks</div>
              <div className={styles.tdSecondary}>Policy: {activeAnalysis.publishPolicy.canForcePublish ? 'force publish available' : 'no force override'}</div>
              {activeAnalysis.hardBlockers.slice(0, 2).map((blocker) => <div key={`${blocker.code}:${blocker.taskId ?? blocker.nodeId ?? blocker.domainId ?? blocker.message}`} className={styles.drawerCardRowSecondary} style={{ color: 'var(--fill-negative)' }}>{blocker.message}</div>)}
            </section>
          ) : null}

          {(twin?.layout.historyVersions?.length ?? 0) > 0 ? (
            <section className={styles.drawerCard}>
              <div className={styles.drawerCardLabel}>Layout Rollback</div>
              <div className={styles.tdName}>Published / Archived Versions</div>
              <div className={styles.tdSecondary}>Select a version to revert the live layout to that state.</div>
              <select className={styles.select} value={rollbackTargetVersionId} onChange={(event) => setRollbackTargetVersionId(event.target.value)}>
                <option value="">— Select version —</option>
                {(twin?.layout.historyVersions ?? []).map((version) => (
                  <option key={version.id} value={version.id} disabled={version.id === twin?.layout.liveVersion.id}>
                    v{version.versionNo} • {version.state} {version.id === twin?.layout.liveVersion.id ? '(current)' : ''}
                  </option>
                ))}
              </select>
              <button
                className={styles.exportBtn}
                disabled={!rollbackTargetVersionId || rollbackLayout.isPending}
                onClick={() => {
                  if (!rollbackTargetVersionId || !selectedSiteId) return;
                  void rollbackLayout.mutateAsync({ siteId: selectedSiteId, targetVersionId: rollbackTargetVersionId })
                    .then(() => { setRollbackTargetVersionId(''); });
                }}
              >
                <RotateCcw size={13} />{rollbackLayout.isPending ? 'Rolling back…' : 'Rollback to selected'}
              </button>
              {(publishAudit.data?.results?.length ?? 0) > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <div className={styles.drawerCardRowSecondary} style={{ marginBottom: 4 }}>Recent Publish Audit</div>
                  {publishAudit.data!.results.slice(0, 3).map((entry) => (
                    <div key={entry.id} className={styles.drawerCardRowSecondary} style={{ justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <span className={styles.stockBadge} style={{ background: entry.action === 'rollback' ? 'color-mix(in srgb, var(--fill-warning) 14%, transparent)' : entry.action === 'force_publish' ? 'color-mix(in srgb, var(--fill-negative) 14%, transparent)' : 'color-mix(in srgb, var(--fill-positive) 14%, transparent)', color: entry.action === 'rollback' ? 'var(--fill-warning)' : entry.action === 'force_publish' ? 'var(--fill-negative)' : 'var(--fill-positive)' }}>{entry.action}</span>
                        v{(twin?.layout.historyVersions ?? []).find((v) => v.id === entry.layoutVersionId)?.versionNo ?? '?'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{entry.actorName}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.drawerCard}>
            <div className={styles.drawerCardLabel}>Route Replay</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <button type="button" className={`${styles.typeBtn} ${!routeHistoryMode ? styles.typeBtnActive : ''}`} onClick={() => setRouteHistoryMode(false)}><Route size={12} />Live</button>
              <button type="button" className={`${styles.typeBtn} ${routeHistoryMode ? styles.typeBtnActive : ''}`} onClick={() => setRouteHistoryMode(true)}><History size={12} />History ({historicalSegments.length})</button>
            </div>
            {routeHistoryMode ? (
              <>
                <div className={styles.tdName}>{activeHistorySegment ? `${activeHistorySegment.taskType} • ${activeHistorySegment.status}` : 'No history'}</div>
                <div className={styles.drawerCardRowSecondary}>{activeHistorySegment ? `${activeHistorySegment.from?.zoneCode ?? '?'} / ${activeHistorySegment.from?.binCode ?? '?'} → ${activeHistorySegment.to?.zoneCode ?? '?'} / ${activeHistorySegment.to?.binCode ?? '?'}` : 'Route event history will appear here.'}</div>
                {activeHistorySegment?.escalationLevel ? <div className={styles.drawerCardRowSecondary} style={{ color: 'var(--fill-negative)' }}>Escalated L{activeHistorySegment.escalationLevel}</div> : null}
                <div className={styles.drawerCardRowSecondary} style={{ fontSize: 11 }}>{activeHistorySegment?.actorName ?? 'Unassigned'} • SLA {activeHistorySegment?.slaStatus ?? '—'} • {activeHistorySegment?.sourceStrategy ?? 'system'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={styles.exportBtn} onClick={() => setRouteHistoryIndex((value) => value - 1)} disabled={!historicalSegments.length}><SkipBack size={13} />Prev</button>
                  <button className={styles.exportBtn} onClick={() => setRouteHistoryPlaying((value) => !value)} disabled={!historicalSegments.length}>{routeHistoryPlaying ? <Pause size={13} /> : <Play size={13} />}{routeHistoryPlaying ? 'Pause' : 'Play'}</button>
                  <button className={styles.exportBtn} onClick={() => setRouteHistoryIndex((value) => value + 1)} disabled={!historicalSegments.length}><SkipForward size={13} />Next</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.tdName}>{activeRoute ? `${activeRoute.taskType} • ${activeRoute.status}` : 'No active routes'}</div>
                <div className={styles.drawerCardRowSecondary}>{activeRoute ? `${activeRoute.from.label} → ${activeRoute.to.label}` : 'Twin replay waits for active routes.'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={styles.exportBtn} onClick={() => setRouteReplayIndex((value) => value - 1)} disabled={!twin?.routes.length}><SkipBack size={13} />Prev</button>
                  <button className={styles.exportBtn} onClick={() => setRouteReplayPlaying((value) => !value)} disabled={!twin?.routes.length}>{routeReplayPlaying ? <Pause size={13} /> : <Play size={13} />}{routeReplayPlaying ? 'Pause' : 'Play'}</button>
                  <button className={styles.exportBtn} onClick={() => setRouteReplayIndex((value) => value + 1)} disabled={!twin?.routes.length}><SkipForward size={13} />Next</button>
                </div>
              </>
            )}
          </section>

          <section className={styles.drawerCard}><div className={styles.drawerCardLabel}>Action Cards</div><div style={{ display: 'grid', gap: 8 }}>{(controlTower?.actionCards ?? []).slice(0, 3).map((card) => <div key={card.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div className={styles.tdName}>{card.title}</div><span className={styles.stockBadge} style={{ background: `color-mix(in srgb, ${levelColor(card.level)} 14%, transparent)`, color: levelColor(card.level) }}>{card.level}</span></div><div className={styles.tdSecondary}>{card.description}</div><div className={styles.drawerCardRowSecondary}>{card.metric ?? card.actionLabel}</div></div>)}</div></section>
          <section id="routes-panel" className={styles.drawerCard}><div className={styles.drawerCardLabel}>Active Tasks</div><div style={{ display: 'grid', gap: 8 }}>{(twin?.tasks ?? []).slice(0, 6).map((task) => <div key={task.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div className={styles.tdName}>{task.title}</div><span className={styles.stockBadge} style={{ background: `color-mix(in srgb, ${levelColor(task.priority)} 14%, transparent)`, color: levelColor(task.priority) }}>{task.priority}</span></div><div className={styles.tdSecondary}>{task.description}</div><div className={styles.drawerCardRowSecondary}>{task.assigneeName ?? 'unassigned'} / {task.assigneePool?.name ?? 'pool pending'} / SLA {task.slaStatus}{(task.escalationLevel ?? 0) > 0 ? <span className={styles.stockBadge} style={{ background: 'color-mix(in srgb, var(--fill-negative) 14%, transparent)', color: 'var(--fill-negative)' }}>ESC L{task.escalationLevel}</span> : null}</div><div className={styles.tdSecondary}>Source {task.sourceType ?? 'warehouse'} / {task.sourceId ?? task.reservationId ?? '-'}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className={styles.exportBtn} onClick={() => focusNodeForDomain(task.sourceBinId ?? task.targetBinId ?? task.binId)}>Focus</button><button className={styles.exportBtn} onClick={() => setTimelineTarget({ kind: 'task', id: task.id })}>Timeline</button>{!task.assigneeName ? <button className={styles.exportBtn} onClick={() => void runTaskCommand(task, 'assign')}>Claim</button> : null}{['queued', 'assigned', 'accepted', 'paused'].includes(task.status) ? <button className={styles.exportBtn} onClick={() => void runTaskCommand(task, 'start')}>Start</button> : null}{task.status === 'in_progress' ? <button className={styles.exportBtn} onClick={() => void runTaskCommand(task, 'pause')}>Pause</button> : null}{!['completed', 'cancelled'].includes(task.status) ? <button className={styles.addBtn} onClick={() => void runTaskCommand(task, 'complete')}>Complete</button> : null}{task.taskType === 'replenishment' && !['completed', 'cancelled'].includes(task.status) ? <button className={styles.addBtn} onClick={() => void runTaskCommand(task, 'replenish')}>Execute</button> : null}</div></div>)}</div></section>
          <section id="exceptions-panel" className={styles.drawerCard}><div className={styles.drawerCardLabel}>Open Exceptions</div><div style={{ display: 'grid', gap: 8 }}>{(twin?.exceptions ?? []).slice(0, 6).map((item) => <div key={item.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div className={styles.tdName}>{item.title}</div><span className={styles.stockBadge} style={{ background: `color-mix(in srgb, ${levelColor(item.severity)} 14%, transparent)`, color: levelColor(item.severity) }}>{item.severity}</span></div><div className={styles.tdSecondary}>{item.description}</div><div className={styles.drawerCardRowSecondary}>{item.ownerName ?? 'ownerless'} / {item.ownerPool?.name ?? 'supervisor pool'} / SLA {item.slaStatus}</div><div className={styles.tdSecondary}>Source {item.sourceType ?? 'warehouse'} / {item.sourceId ?? item.binId ?? '-'}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className={styles.exportBtn} onClick={() => focusNodeForDomain(item.binId)}>Focus</button><button className={styles.exportBtn} onClick={() => setTimelineTarget({ kind: 'exception', id: item.id })}>Timeline</button>{!item.ownerName && item.status !== 'resolved' ? <button className={styles.exportBtn} onClick={() => void runExceptionCommand(item, 'assign')}>Claim</button> : null}{['open', 'assigned'].includes(item.status) ? <button className={styles.exportBtn} onClick={() => void runExceptionCommand(item, 'acknowledge')}>Acknowledge</button> : null}{item.status !== 'resolved' ? <button className={styles.exportBtn} onClick={() => void runExceptionCommand(item, 'escalate')}>Escalate</button> : null}{item.status !== 'resolved' ? <button className={styles.addBtn} onClick={() => void runExceptionCommand(item, 'resolve')}>Resolve</button> : null}</div></div>)}</div></section>
        </div>
      </div>

      <WarehouseTwinPublishReviewModal open={publishReviewOpen} analysis={activeAnalysis} draft={twin?.layout.draftVersion} liveVersion={twin?.layout.liveVersion} compareOptions={compareOptions} selectedCompareId={selectedCompareVersionId} onSelectCompare={setSelectedCompareVersionId} compareResult={compareResult.data} validatePending={validateDraft.isPending} publishPending={publishDraft.isPending} forcePublish={forcePublish} forceReason={forceReason} onToggleForce={setForcePublish} onForceReasonChange={setForceReason} publishAudit={publishAudit.data?.results} onValidate={() => twin?.layout.draftVersion && void validateDraft.mutateAsync({ siteId: selectedSiteId, draftId: twin.layout.draftVersion.id })} onPublish={() => twin?.layout.draftVersion && void publishDraft.mutateAsync({ siteId: selectedSiteId, draftId: twin.layout.draftVersion.id, dto: forcePublish ? { force: true, forceReason } : {} }).then(() => { setPublishReviewOpen(false); setForcePublish(false); setForceReason(''); updateParams({ site: selectedSiteId, draft: null }); })} onClose={() => { setPublishReviewOpen(false); setForcePublish(false); setForceReason(''); }} />
      <WarehouseTwinTimelineModal open={Boolean(timelineTarget)} title={timelineTarget?.kind === 'task' ? 'Task Timeline' : 'Exception Timeline'} subtitle={timelineTarget?.kind === 'task' ? taskTimeline.data?.task?.title ?? 'Warehouse task event stream' : exceptionTimeline.data?.exception?.title ?? 'Warehouse exception event stream'} loading={timelineTarget?.kind === 'task' ? taskTimeline.isLoading : exceptionTimeline.isLoading} entries={timelineTarget?.kind === 'task' ? (taskTimeline.data?.results ?? []) : (exceptionTimeline.data?.results ?? [])} onClose={() => setTimelineTarget(null)} />
    </div>
  );
}
