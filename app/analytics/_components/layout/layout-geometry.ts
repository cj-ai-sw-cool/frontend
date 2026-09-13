/**
 * `GET /layout` 좌표 변환 — 3D(`layout-scene.tsx`)와 2D(`warehouse-map.jsx`)가 이 파일
 * 하나만 본다(옛 `lib/zone-layout.ts`의 후계, Stage 11 정본 §11.0 "3D·2D 계약").
 *
 * 계약은 "좌표는 m, area 원점 기준"이라고만 말한다 — 라이브 예시가 아직 없어(브리프
 * 머리말), 이 파일은 **모든 엔티티(zone·aisle·bay)의 xM/yM 이 그 엔티티가 속한
 * `Area`의 원점 기준**이라고 해석한다(가장 단순하고, `Zone` 주석이 명시한 해석과도
 * 일치). 세계 좌표 = `area.xM/yM + entity.xM/yM`. 라이브 검증 대기 — 다르면 이 파일만
 * 고치면 된다(3D·2D 둘 다 여기만 본다).
 *
 * 평면축은 건물 도면 그대로 X(가로)·Y(깊이)를 쓰고, 3D 장면에서만 Y → three.js Z 로
 * 옮긴다(`layout-scene.tsx`). 2D 캔버스는 X/Y 를 그대로 화면 가로/세로로 쓴다.
 */

import type { Area, Aisle, Bay, LayoutResponse, Medium, Zone } from "@/lib/types";

/** 통로 방향의 베이 폭(m) — 정본 §11.0 표 "선반 베이 폭 1.2m·5단, 파렛트 랙 베이 2.7m" */
export const BAY_LENGTH_M: Record<Medium, number> = {
  SHELF: 1.2,
  PALLET_RACK: 2.7,
  PALLET_FLOOR: 2.7,
};
/** 통로에서 베이가 뻗어나가는 깊이(m) — bin_type 최대 폭(선반 XL 60cm)과 파렛트(110cm)에
 * 여유를 더한 근사치. 라이브 값이 오면 여기만 바꾼다 */
export const BAY_DEPTH_M: Record<Medium, number> = {
  SHELF: 0.55,
  PALLET_RACK: 1.3,
  PALLET_FLOOR: 1.3,
};
/** 베이 높이 = levels × 이 값(m) — 브리프 §2 "높이 = levels × 0.42m 선반 / 1.5m 파렛트" */
export const LEVEL_HEIGHT_M: Record<Medium, number> = {
  SHELF: 0.42,
  PALLET_RACK: 1.5,
  PALLET_FLOOR: 1.5,
};
/** 통로 폭(m) — 차선 하나(베이 앞 작업 공간) */
export const AISLE_WIDTH_M = 1.7;

export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** `layout` 을 한 번 훑어 존→area·통로→존·베이→통로 역참조를 만든다 — 매 프레임 find()
 * 하지 않도록 3D·2D 가 마운트 시 한 번만 만든다 */
export interface LayoutIndex {
  layout: LayoutResponse;
  areaByCode: Map<string, Area>;
  zoneByCode: Map<string, Zone>;
  aisleById: Map<number, Aisle>;
  bayById: Map<number, Bay>;
  aislesByZone: Map<string, Aisle[]>;
  baysByAisle: Map<number, Bay[]>;
}

export function buildLayoutIndex(layout: LayoutResponse): LayoutIndex {
  const areaByCode = new Map(layout.areas.map((a) => [a.code, a]));
  const zoneByCode = new Map(layout.zones.map((z) => [z.code, z]));
  const aisleById = new Map(layout.aisles.map((a) => [a.id, a]));
  const bayById = new Map(layout.bays.map((b) => [b.id, b]));

  const aislesByZone = new Map<string, Aisle[]>();
  for (const aisle of layout.aisles) {
    const list = aislesByZone.get(aisle.zoneCode) ?? [];
    list.push(aisle);
    aislesByZone.set(aisle.zoneCode, list);
  }

  const baysByAisle = new Map<number, Bay[]>();
  for (const bay of layout.bays) {
    const list = baysByAisle.get(bay.aisleId) ?? [];
    list.push(bay);
    baysByAisle.set(bay.aisleId, list);
  }

  return { layout, areaByCode, zoneByCode, aisleById, bayById, aislesByZone, baysByAisle };
}

export function areaWorldRect(area: Area): WorldRect {
  return { x0: area.xM, y0: area.yM, x1: area.xM + area.wM, y1: area.yM + area.dM };
}

export function zoneWorldRect(zone: Zone, index: LayoutIndex): WorldRect | null {
  const area = index.areaByCode.get(zone.areaCode);
  if (!area) return null;
  return {
    x0: area.xM + zone.xM,
    y0: area.yM + zone.yM,
    x1: area.xM + zone.xM + zone.wM,
    y1: area.yM + zone.yM + zone.dM,
  };
}

/** 통로가 속한 존을 거쳐 area 를 찾는다(통로엔 areaCode 가 없다, `zoneCode` 만) */
export function areaForAisle(aisle: Aisle, index: LayoutIndex): Area | null {
  const zone = index.zoneByCode.get(aisle.zoneCode);
  if (!zone) return null;
  return index.areaByCode.get(zone.areaCode) ?? null;
}

export function aisleWorldOrigin(aisle: Aisle, index: LayoutIndex): { x: number; y: number } | null {
  const area = areaForAisle(aisle, index);
  if (!area) return null;
  return { x: area.xM + aisle.xM, y: area.yM + aisle.yM };
}

/** 베이가 속한 존의 매체(medium) — 베이 자체엔 매체가 없어 통로→존을 거친다.
 * `binType`(XS~XL·PLT)이 아니라 이 값으로 박스 치수를 결정한다(브리프 §2) */
export function mediumForBay(bay: Bay, index: LayoutIndex): Medium | null {
  const aisle = index.aisleById.get(bay.aisleId);
  if (!aisle) return null;
  return index.zoneByCode.get(aisle.zoneCode)?.medium ?? null;
}

export interface BayBox {
  bay: Bay;
  medium: Medium;
  /** 베이 박스 중심 세계 좌표(m) */
  cx: number;
  cy: number;
  width: number; // 통로 방향(m)
  depth: number; // 통로에서 뻗어나가는 방향(m)
  height: number; // levels × LEVEL_HEIGHT_M(m)
  occupancyRatio: number; // 0~1
}

/** 베이 하나의 세계 좌표 박스 — `bay.xM/yM` 은 **그 베이가 속한 area 원점 기준 footprint
 * 중심**이라고 해석한다(위 파일 머리말). InstancedMesh 배치(3D)·사각형(2D)가 함께 쓴다 */
export function bayBox(bay: Bay, index: LayoutIndex): BayBox | null {
  const aisle = index.aisleById.get(bay.aisleId);
  if (!aisle) return null;
  const area = areaForAisle(aisle, index);
  const medium = mediumForBay(bay, index);
  if (!area || !medium) return null;

  return {
    bay,
    medium,
    cx: area.xM + bay.xM,
    cy: area.yM + bay.yM,
    width: BAY_LENGTH_M[medium],
    depth: BAY_DEPTH_M[medium],
    height: bay.levels * LEVEL_HEIGHT_M[medium],
    occupancyRatio: bay.totalBins > 0 ? bay.occupiedBins / bay.totalBins : 0,
  };
}

/** 점유율 5단계 색 인덱스(0=비어 있음 … 4=거의 참) — 3D·2D 가 같은 경계값을 쓴다 */
export function occupancyTier(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (ratio <= 0) return 0;
  if (ratio < 0.35) return 1;
  if (ratio < 0.65) return 2;
  if (ratio < 0.9) return 3;
  return 4;
}

/** 점유율 5단계 색(16진수 정수) — `bay-mesh.ts`(3D)와 `warehouse-map.tsx`(2D)가 같은
 * 배열을 쓴다. 여기 두는 이유는 순수 데이터라 `three` 를 끌어오지 않기 때문이다 — 2D
 * 지도는 캔버스 2D 만 쓰고 WebGL 번들을 받지 않는다(옛 `warehouse-map.jsx` 머리말과
 * 같은 이유) */
export const OCCUPANCY_COLORS = [0x2c3644, 0x3d6fa3, 0x3d9e7a, 0xd0a02c, 0xc23b3b] as const;

/** 16진수 정수 색 → 캔버스 2D `fillStyle` 문자열 */
export function hexToRgba(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 베이 표시 코드 — `{존}-{통로:2}-{베이:2}`(정본 §11.0 "주소", 브리프 §2 호버 예시
 * `AMBS-04-13`). 실제 칸 코드(`Bin.code`)는 여기에 단·위치가 더 붙는다 */
export function bayDisplayCode(bay: Bay, index: LayoutIndex): string {
  const aisle = index.aisleById.get(bay.aisleId);
  const zoneCode = aisle?.zoneCode ?? "?";
  const aisleNo = aisle?.no ?? 0;
  return `${zoneCode}-${String(aisleNo).padStart(2, "0")}-${String(bay.no).padStart(2, "0")}`;
}

/** 레이아웃 전체를 담는 세계 좌표 바운딩 박스 — 카메라 초기 프레이밍(3D)·캔버스 fit(2D) */
export function layoutBounds(layout: LayoutResponse): WorldRect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const area of layout.areas) {
    x0 = Math.min(x0, area.xM);
    y0 = Math.min(y0, area.yM);
    x1 = Math.max(x1, area.xM + area.wM);
    y1 = Math.max(y1, area.yM + area.dM);
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  return { x0, y0, x1, y1 };
}
