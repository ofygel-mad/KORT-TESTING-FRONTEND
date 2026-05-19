import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { WarehouseLayoutNode, WarehouseSiteMapBinHeat, WarehouseSiteMapZoneHeat, WarehouseTwinRouteOverlay } from '@/entities/warehouse/types';

type CameraMode = 'overview' | 'tasks' | 'exceptions' | 'routes';
type HeatLayer = 'none' | 'occupancy' | 'reservation' | 'tasks' | 'exceptions' | 'forecast';
type IsolateLayer = 'none' | 'zones' | 'bins' | 'tasks' | 'exceptions' | 'routes';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const heatTone = (value: number, hint?: string) => hint === 'critical' || value >= 0.72 ? '#ff5f5f' : hint === 'warning' || value >= 0.42 ? '#ffb648' : '#5ab0ff';
const nodeCenter = (node: WarehouseLayoutNode) => new THREE.Vector3(node.x + (node.width / 2), 0, node.y + (node.height / 2));

function zoneMetric(zone: WarehouseSiteMapZoneHeat | undefined, layer: HeatLayer) {
  if (!zone) return { value: 0.12, hint: 'info' };
  if (layer === 'occupancy') return { value: clamp((zone.occupancyRate ?? 0) / 100), hint: zone.level };
  if (layer === 'reservation') return { value: clamp(zone.reservationPressure / 100), hint: zone.level };
  if (layer === 'tasks') return { value: clamp(zone.taskPressure / 100), hint: zone.level };
  if (layer === 'exceptions') return { value: clamp(zone.exceptionCount / 6), hint: zone.exceptionCount > 0 ? zone.level : 'info' };
  if (layer === 'forecast') {
    const score = clamp((zone.reservationPressure + zone.taskPressure + (zone.urgentReplenishment * 20)) / 180);
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.42 ? 'warning' : 'info' };
  }
  return { value: zone.level === 'critical' ? 0.8 : zone.level === 'warning' ? 0.5 : 0.18, hint: zone.level };
}

function binMetric(bin: WarehouseSiteMapBinHeat | undefined, layer: HeatLayer) {
  if (!bin) return { value: 0.12, hint: 'info' };
  if (layer === 'occupancy') return { value: clamp((bin.occupancyRate ?? 0) / 100), hint: bin.level };
  if (layer === 'reservation') return { value: clamp(bin.reservationPressure / 100), hint: bin.level };
  if (layer === 'tasks') {
    const score = clamp((bin.signals.includes('pick_pressure') ? 0.55 : 0) + (bin.signals.includes('replenishment') ? 0.38 : 0));
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.4 ? 'warning' : 'info' };
  }
  if (layer === 'exceptions') {
    const score = clamp((bin.status !== 'active' ? 0.85 : 0) + (bin.signals.includes('blocked') ? 0.5 : 0));
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.4 ? 'warning' : 'info' };
  }
  if (layer === 'forecast') {
    const score = clamp((bin.reservationPressure + (bin.replenishmentLevel === 'critical' ? 55 : bin.replenishmentLevel === 'warning' ? 28 : 0)) / 120);
    return { value: score, hint: score >= 0.7 ? 'critical' : score >= 0.4 ? 'warning' : 'info' };
  }
  return { value: bin.level === 'critical' ? 0.82 : bin.level === 'warning' ? 0.5 : 0.2, hint: bin.level };
}

function CameraRig({ focusedNode, cameraMode }: { focusedNode: WarehouseLayoutNode | null; cameraMode: CameraMode }) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const targetFocus = useMemo(() => new THREE.Vector3(), []);

  useFrame((_state, delta) => {
    const focus = focusedNode ? nodeCenter(focusedNode) : new THREE.Vector3(6, 0, 5);
    const distance = cameraMode === 'overview' ? 13 : cameraMode === 'routes' ? 9 : 7;
    targetFocus.copy(focus);
    targetPosition.set(focus.x + distance * 0.42, cameraMode === 'overview' ? 9 : 6.4, focus.z + distance * 0.68);
    camera.position.lerp(targetPosition, Math.min(1, delta * 2.6));
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetFocus, Math.min(1, delta * 3.4));
      controlsRef.current.update();
    } else {
      camera.lookAt(targetFocus);
    }
  });

  return <OrbitControls ref={controlsRef} enablePan enableRotate maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={24} />;
}

export function WarehouseTwinSpatialCanvas({
  nodes, routes, focusedNodeId, cameraMode, showBins, showGhost, showRoutes, showForecast,
  heatLayer, isolateLayer, activeRouteId, routePulseKey, zoneHeatMap, binHeatMap, onFocusNode,
}: {
  nodes: WarehouseLayoutNode[];
  routes: WarehouseTwinRouteOverlay[];
  focusedNodeId: string;
  cameraMode: CameraMode;
  showBins: boolean;
  showGhost: boolean;
  showRoutes: boolean;
  showForecast: boolean;
  heatLayer: HeatLayer;
  isolateLayer: IsolateLayer;
  activeRouteId?: string | null;
  routePulseKey?: string;
  zoneHeatMap: Map<string, WarehouseSiteMapZoneHeat>;
  binHeatMap: Map<string, WarehouseSiteMapBinHeat>;
  onFocusNode: (nodeId: string) => void;
}) {
  const focusedNode = useMemo(() => nodes.find((node) => node.id === focusedNodeId) ?? null, [focusedNodeId, nodes]);
  const zoneNodes = useMemo(() => nodes.filter((node) => node.nodeType === 'zone' && !node.hidden), [nodes]);
  const binNodes = useMemo(() => nodes.filter((node) => node.nodeType === 'bin' && !node.hidden), [nodes]);

  const taskRouteNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const route of routes) {
      if (route.from.nodeId) ids.add(route.from.nodeId);
      if (route.to.nodeId) ids.add(route.to.nodeId);
    }
    return ids;
  }, [routes]);

  const opacityForNode = (node: WarehouseLayoutNode) => {
    const focusedZoneId = focusedNode?.zoneId ?? focusedNode?.domainId ?? null;
    let opacity = 1;
    if (showGhost && focusedZoneId && node.zoneId && focusedZoneId !== node.zoneId) opacity *= node.nodeType === 'zone' ? 0.18 : 0.1;
    if (isolateLayer === 'zones' && node.nodeType === 'bin') opacity *= 0.08;
    if (isolateLayer === 'bins' && node.nodeType === 'zone') opacity *= 0.16;
    if (isolateLayer === 'routes' && !taskRouteNodeIds.has(node.id)) opacity *= 0.12;
    return opacity;
  };

  const colorForNode = (node: WarehouseLayoutNode) => {
    if (focusedNodeId === node.id) return '#53d89d';
    return node.nodeType === 'zone'
      ? heatTone(zoneMetric(zoneHeatMap.get(node.domainId), heatLayer).value, zoneMetric(zoneHeatMap.get(node.domainId), heatLayer).hint)
      : heatTone(binMetric(binHeatMap.get(node.domainId), heatLayer).value, binMetric(binHeatMap.get(node.domainId), heatLayer).hint);
  };

  return (
    <div style={{ height: 620, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <Canvas shadows camera={{ position: [8, 8, 10], fov: 42 }} gl={{ antialias: true }}>
        <color attach="background" args={['#09121f']} />
        <fog attach="fog" args={['#09121f', 10, 36]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[12, 16, 10]} intensity={1.2} castShadow />
        <directionalLight position={[-8, 10, -12]} intensity={0.45} />
        <Grid args={[36, 36]} position={[8, -0.02, 8]} cellColor="#18324e" sectionColor="#274d74" fadeDistance={48} fadeStrength={1.3} />

        {showRoutes ? routes.map((route) => {
          const highlighted = !activeRouteId || route.id === activeRouteId;
          return (
            <Line
              key={`${route.id}:${routePulseKey ?? 'static'}`}
              points={[[route.from.x, 0.32, route.from.y], [route.to.x, 0.32, route.to.y]]}
              color={heatTone(highlighted ? 0.85 : 0.45, route.priority)}
              lineWidth={highlighted ? 4.2 : 2.2}
              dashed={route.status !== 'in_progress'}
              dashSize={0.26}
              gapSize={0.18}
              transparent
              opacity={highlighted ? 1 : 0.32}
            />
          );
        }) : null}

        {zoneNodes.map((node) => {
          const color = colorForNode(node);
          return (
            <group key={node.id} position={[node.x + (node.width / 2), 0, node.y + (node.height / 2)]}>
              <mesh position={[0, 0.14, 0]} onClick={() => onFocusNode(node.id)} castShadow receiveShadow>
                <boxGeometry args={[node.width, 0.28, node.height]} />
                <meshStandardMaterial color={color} transparent opacity={opacityForNode(node) * (focusedNodeId === node.id ? 0.95 : 0.46)} emissive={color} emissiveIntensity={focusedNodeId === node.id ? 0.24 : 0.1} roughness={0.4} metalness={0.08} />
              </mesh>
              {showForecast && heatLayer === 'forecast' ? <mesh position={[0, 0.48, 0]}><boxGeometry args={[node.width * 0.9, 0.04, node.height * 0.9]} /><meshBasicMaterial color={color} transparent opacity={0.22} /></mesh> : null}
            </group>
          );
        })}

        {showBins ? binNodes.map((node) => {
          const color = colorForNode(node);
          return (
            <group key={node.id} position={[node.x + (node.width / 2), 0, node.y + (node.height / 2)]}>
              <mesh position={[0, 0.42, 0]} onClick={() => onFocusNode(node.id)} castShadow receiveShadow>
                <boxGeometry args={[node.width, 0.22, node.height]} />
                <meshStandardMaterial color={color} transparent opacity={opacityForNode(node) * (focusedNodeId === node.id ? 0.98 : 0.74)} emissive={focusedNodeId === node.id ? '#6ef0b0' : color} emissiveIntensity={focusedNodeId === node.id ? 0.34 : 0.12} roughness={0.38} metalness={0.18} />
              </mesh>
            </group>
          );
        }) : null}

        <CameraRig focusedNode={focusedNode} cameraMode={cameraMode} />
      </Canvas>
    </div>
  );
}
