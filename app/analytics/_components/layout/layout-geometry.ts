/**
 * `GET /layout` 좌표 변환 — 3D(`layout-scene.tsx`)와 2D(`warehouse-map.tsx`)가 이 파일
 * 하나만 본다(옛 `lib/zone-layout.ts`의 후계, Stage 11 정본 §11.0 "3D·2D 계약").
 *
 * ⚠️ 2026-09-13 라이브 검증(백엔드가 이 화면과 같은 시각에 배포한 `/layout`)으로 계약
 * 문구 "area 원점 기준"의 뜻이 처음 생각과 달랐다 — area·zone·aisle·bay 좌표는 **모두
 * 같은 건물 전역 평면**이다(예: `zone.xM === area.xM`, 존이 area 왼쪽 끝에서 시작).
 * area 오프셋을 더하면 위치가 두 배로 밀린다 — 그래서 아래 함수들은 엔티티의 xM/yM 을
 * **그대로** 세계 좌표로 쓴다. 자세한 것은 `lib/types.ts` `Area`/`Bay` 주석.
 *
 * ⚠️ 존의 `dM`이 자기 area 의 `dM`보다 클 수 있다(라이브: AMBS 존 69.6m vs AMB area
 * 48m) — 존은 통로를 한 줄로 쌓은 개략도라 area 사각형과 정확히 맞물리지 않는다. 그래서
 * area 는 "바닥판 배경"으로만 그리고, 레이아웃 전체 바운딩 박스(`layoutBounds`)는
 * area·zone·bay 를 모두 훑어 잡는다 — area 만 보면 존·베이가 잘린다.
 *
 * ⚠️ 베이가 통로를 참조하는 필드는 `aisleId` 가 아니라 `zoneCode`+`aisleNo`(라이브
 * 검증, `Bay` 타입 주석). `Aisle.id` 가 필요하면(로케이션 탭 Select 값) 이 파일이
 * `zoneCode`+`aisleNo` 로 역매칭해 둔다(`buildLayoutIndex` 의 `aisleByZoneAndNo`).
 * ⚠️ 통로가 뻗는 축은 X — `bay.no` 가 커질수록 `xM` 이 `BAY_LENGTH_M` 만큼 늘고,
 * `side`(LEFT/RIGHT)는 Y 로 갈린다(라이브 데이터로 확인, 브리프엔 축 표기가 없었다).
 * `bay.xM/yM` 은 그 footprint 의 **통로 쪽 모서리**다(중심이 아니다).
 *
 * 평면축은 건물 도면 그대로 X(가로)·Y(깊이)를 쓰고, 3D 장면에서만 Y → three.js Z 로
 * 옮긴다(`layout-scene.tsx`). 2D 캔버스는 X/Y 를 그대로 화면 가로/세로로 쓴다.
 */

import type { Area, Aisle, Bay, LayoutResponse, Medium, Zone } from "@/lib/types";

/** 통로 방향의 베이 길이(m) — 정본 §11.0 표 "선반 베이 폭 1.2m·5단, 파렛트 랙 베이 2.7m" */
export const BAY_LENGTH_M: Record<Medium, number> = {
  SHELF: 1.2,
  PALLET_RACK: 2.7,
  PALLET_FLOOR: 2.7,
};
/** 통로에서 베이가 뻗어나가는 깊이(m) — bin_type 최대 폭(선반 XL 60cm)과 파렛트(110cm)에
 * 여유를 더한 근사치. 라이브 응답엔 이 값이 없다(베이 자체 치수 필드가 없음) */
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

export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** `layout` 을 한 번 훑어 역참조를 만든다 — 매 프레임 find() 하지 않도록 3D·2D 가 마운트
 * 시 한 번만 만든다. `baysByAisle`/`aisleById` 는 로케이션 탭의 통로 Select(값 = 진짜
 * `Aisle.id`)가 쓴다 — 베이 자신은 `aisleId` 를 안 주므로 `zoneCode`+`aisleNo` 로
 * 역매칭해 채운다. */
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
  const aisleByZoneAndNo = new Map<string, Aisle>();
  for (const aisle of layout.aisles) {
    const list = aislesByZone.get(aisle.zoneCode) ?? [];
    list.push(aisle);
    aislesByZone.set(aisle.zoneCode, list);
    aisleByZoneAndNo.set(`${aisle.zoneCode}:${aisle.no}`, aisle);
  }

  const baysByAisle = new Map<number, Bay[]>();
  for (const bay of layout.bays) {
    const aisle = aisleByZoneAndNo.get(`${bay.zoneCode}:${bay.aisleNo}`);
    if (!aisle) continue;
    const list = baysByAisle.get(aisle.id) ?? [];
    list.push(bay);
    baysByAisle.set(aisle.id, list);
  }

  return { layout, areaByCode, zoneByCode, aisleById, bayById, aislesByZone, baysByAisle };
}

export function areaWorldRect(area: Area): WorldRect {
  return { x0: area.xM, y0: area.yM, x1: area.xM + area.wM, y1: area.yM + area.dM };
}

export function zoneWorldRect(zone: Zone): WorldRect {
  return { x0: zone.xM, y0: zone.yM, x1: zone.xM + zone.wM, y1: zone.yM + zone.dM };
}

export function aisleWorldOrigin(aisle: Aisle): { x: number; y: number } {
  return { x: aisle.xM, y: aisle.yM };
}

/** 존 하나의 보관칸 합계 — `Zone.binCount` 는 `GET /layout` 응답엔 없다(타입 주석
 * 참고), 베이 `totalBins` 를 더해 직접 구한다 */
export function zoneBinCount(zoneCode: string, index: LayoutIndex): number {
  let sum = 0;
  for (const bay of index.layout.bays) if (bay.zoneCode === zoneCode) sum += bay.totalBins;
  return sum;
}

export interface BayBox {
  bay: Bay;
  medium: Medium;
  /** 베이 박스 중심 세계 좌표(m) */
  cx: number;
  cy: number;
  width: number; // 통로 방향(m, X)
  depth: number; // 통로에서 뻗어나가는 방향(m, Y)
  height: number; // levels × LEVEL_HEIGHT_M(m)
  occupancyRatio: number; // 0~1
}

/** 베이 하나의 세계 좌표 박스 — `bay.xM/yM` 은 footprint 의 통로 쪽 모서리라 가운데로
 * 반 칸 옮긴다(위 파일 머리말). InstancedMesh 배치(3D)·사각형(2D)가 함께 쓴다 */
export function bayBox(bay: Bay, index: LayoutIndex): BayBox | null {
  const medium = index.zoneByCode.get(bay.zoneCode)?.medium;
  if (!medium) return null;

  const width = BAY_LENGTH_M[medium];
  const depth = BAY_DEPTH_M[medium];
  return {
    bay,
    medium,
    cx: bay.xM + width / 2,
    cy: bay.yM + depth / 2,
    width,
    depth,
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
export function bayDisplayCode(bay: Bay): string {
  return `${bay.zoneCode}-${String(bay.aisleNo).padStart(2, "0")}-${String(bay.no).padStart(2, "0")}`;
}

/** 레이아웃 전체를 담는 세계 좌표 바운딩 박스 — 카메라 초기 프레이밍(3D)·캔버스 fit(2D).
 * area 만 훑으면 area 보다 깊게 뻗는 존·베이가 잘린다(위 파일 머리말) — zone·bay 박스도
 * 함께 본다. */
export function layoutBounds(layout: LayoutResponse): WorldRect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (gx0: number, gy0: number, gx1: number, gy1: number) => {
    x0 = Math.min(x0, gx0); y0 = Math.min(y0, gy0);
    x1 = Math.max(x1, gx1); y1 = Math.max(y1, gy1);
  };
  for (const area of layout.areas) grow(area.xM, area.yM, area.xM + area.wM, area.yM + area.dM);
  for (const zone of layout.zones) grow(zone.xM, zone.yM, zone.xM + zone.wM, zone.yM + zone.dM);
  for (const bay of layout.bays) {
    const medium = layout.zones.find((z) => z.code === bay.zoneCode)?.medium;
    const w = medium ? BAY_LENGTH_M[medium] : 1;
    const d = medium ? BAY_DEPTH_M[medium] : 1;
    grow(bay.xM, bay.yM, bay.xM + w, bay.yM + d);
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  return { x0, y0, x1, y1 };
}
