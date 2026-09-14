/**
 * 관제 모드 오버레이 — 베이 점등(`bay-pulse.ts`)과 작업자 마커(`worker-markers.ts`)를
 * 하나로 묶어 `layout-scene.tsx`가 씬에 올리고 매 프레임 `tick()`만 부르면 되게 한다
 * (브리프 §2, 정본 §13.1·§13.5). 씬은 `THREE.Group` 하나만 알면 되고, 베이 id·작업자
 * 코드 같은 도메인 값 해석은 이 파일이 `LayoutIndex`로 맡는다.
 *
 * 색은 이 파일이 정하지 않는다 — 원장(`InventoryTxRecorded`)과 태스크 이벤트
 * (`PickTaskConfirmed` 등)가 색을 고르는 규칙이 달라(코디네이터 지시 2026-09-14),
 * 그 판단은 `use-control-mode.ts`가 하고 여기는 완성된 색만 받는다.
 */

import * as THREE from "three";
import type { LayoutResponse, WorkerRow } from "@/lib/types";
import { buildBayPulse, type BayPulse } from "./bay-pulse";
import { buildLayoutIndex } from "./layout-geometry";
import { bayFromLocationCode, bayFrontPoint, buildWorkerPath, pathLength, receivingGridPoint } from "./worker-path";
import { buildWorkerMarkers, type WorkerMarkers } from "./worker-markers";

const TRAVEL_SPEED_MPS = 1.4; // 도보 속도 근사(연출, 정본 §13.1)

export interface ControlOverlay {
  group: THREE.Group;
  pulseBay: (bayId: number, colorHex: number, atMs: number) => void;
  setWorkerTransition: (code: string, fromBayId: number | null, toBayId: number, atMs: number, speed: number) => void;
  /** 관제 시작 시 초기 배치 — `lastLocationCode`로 베이를 찾으면 그 앞에, 못 찾으면
   * RCV 존 격자에 흩는다. 반환 맵은 베이를 찾은 작업자만 담는다(그 워커의 다음 실제
   * 이벤트가 여기서부터 이어 움직이도록 `use-control-mode.ts`가 `workerLastBayRef`에
   * 채운다) — 격자로 대신한 작업자는 다음 이벤트가 올 때까지 베이가 없다는 뜻이다. */
  seedWorkers: (rows: Pick<WorkerRow, "code" | "lastLocationCode">[], atMs: number) => Map<string, number>;
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

  const pulseBay: ControlOverlay["pulseBay"] = (bayId, colorHex, atMs) => {
    const bay = index.bayById.get(bayId);
    if (!bay) return;
    pulse.pulse(bay, index, colorHex, atMs);
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

  const seedWorkers: ControlOverlay["seedWorkers"] = (rows, atMs) => {
    const resolvedBays = new Map<string, number>();
    let gridSeat = 0;
    rows.forEach((row) => {
      const bay = bayFromLocationCode(row.lastLocationCode, layout);
      const point = bay ? bayFrontPoint(bay, index) : null;
      if (bay && point) {
        markers.setTransition({ code: row.code, path: [point], startedAt: atMs, durationMs: 1 });
        resolvedBays.set(row.code, bay.id);
        return;
      }
      const grid = receivingGridPoint(index, gridSeat, rows.length);
      gridSeat += 1;
      if (grid) markers.setTransition({ code: row.code, path: [grid], startedAt: atMs, durationMs: 1 });
    });
    return resolvedBays;
  };

  const tick: ControlOverlay["tick"] = (nowMs) => {
    pulse.tick(nowMs);
    markers.tick(nowMs);
  };

  return {
    group,
    pulseBay,
    setWorkerTransition,
    seedWorkers,
    tick,
    dispose: () => {
      pulse.dispose();
      markers.dispose();
    },
  };
}
