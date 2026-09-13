/**
 * 관제 모드 오버레이 — 베이 점등(`bay-pulse.ts`)과 작업자 마커(`worker-markers.ts`)를
 * 하나로 묶어 `layout-scene.tsx`가 씬에 올리고 매 프레임 `tick()`만 부르면 되게 한다
 * (브리프 §2, 정본 §13.1·§13.5). 씬은 `THREE.Group` 하나만 알면 되고, 베이 id·작업자
 * 코드 같은 도메인 값 해석은 이 파일이 `LayoutIndex`로 맡는다.
 */

import * as THREE from "three";
import type { InventoryTxType, LayoutResponse } from "@/lib/types";
import { buildBayPulse, TX_TYPE_COLORS, type BayPulse } from "./bay-pulse";
import { buildLayoutIndex } from "./layout-geometry";
import { buildWorkerPath, pathLength } from "./worker-path";
import { buildWorkerMarkers, type WorkerMarkers } from "./worker-markers";

const TRAVEL_SPEED_MPS = 1.4; // 도보 속도 근사(연출, 정본 §13.1)

export interface ControlOverlay {
  group: THREE.Group;
  pulseBay: (bayId: number, txType: InventoryTxType | undefined, atMs: number) => void;
  setWorkerTransition: (code: string, fromBayId: number | null, toBayId: number, atMs: number, speed: number) => void;
  tick: (nowMs: number) => void;
  dispose: () => void;
}

export function buildControlOverlay(layout: LayoutResponse): ControlOverlay {
  const index = buildLayoutIndex(layout);
  const pulse: BayPulse = buildBayPulse();
  const markers: WorkerMarkers = buildWorkerMarkers();

  const group = new THREE.Group();
  group.name = "control-overlay";
  group.add(pulse.group);
  group.add(markers.group);

  const pulseBay: ControlOverlay["pulseBay"] = (bayId, txType, atMs) => {
    const bay = index.bayById.get(bayId);
    if (!bay) return;
    const color = txType ? TX_TYPE_COLORS[txType] : TX_TYPE_COLORS.STATUS_CHANGE;
    pulse.pulse(bay, index, color, atMs);
  };

  const setWorkerTransition: ControlOverlay["setWorkerTransition"] = (code, fromBayId, toBayId, atMs, speed) => {
    const toBay = index.bayById.get(toBayId);
    if (!toBay) return;
    const fromBay = fromBayId !== null ? (index.bayById.get(fromBayId) ?? null) : null;
    const path = buildWorkerPath(fromBay, toBay, index);
    if (path.length === 0) return;
    const distanceM = pathLength(path);
    const durationMs = Math.max(300, (distanceM / (TRAVEL_SPEED_MPS * Math.max(0.25, speed))) * 1000);
    markers.setTransition({ code, path, startedAt: atMs, durationMs });
  };

  const tick: ControlOverlay["tick"] = (nowMs) => {
    pulse.tick(nowMs);
    markers.tick(nowMs);
  };

  return {
    group,
    pulseBay,
    setWorkerTransition,
    tick,
    dispose: () => {
      pulse.dispose();
      markers.dispose();
    },
  };
}
