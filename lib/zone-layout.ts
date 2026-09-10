/**
 * 3D·2D 창고 레이아웃 — `GET /zones` 응답을 창고 화면이 그리던 정적
 * `GRADES`/`ROWS`/`computeLayout` 형태로 바꾼다(Stage 1, docs/tasks/
 * 2026-09-09-stage1-master-handoff.md §3 S1.5).
 *
 * 3D(`app/analytics/_components/warehouse-slot-3d.jsx`)와 2D(`warehouse-data.js`)가
 * 이 파일 하나만 본다 — 각자 복사해 두던 배치 상수와 계산을 여기로 모았다. 존 규격이
 * 바뀌면 백엔드 시드(`V14__zone_location.sql`)만 바뀌고, 화면은 API 응답을 그대로 따라간다.
 *
 * 정본: backend/docs/02-system/02-data-model.md §1.3, docs/00-planning/
 * 05-frontend-baseline.md "3D 창고 구조와 로케이션 모델 대응".
 */

import type { Zone } from "./types";

export type InvKey = "xs" | "s" | "m" | "l" | "xl" | "xxl";

/**
 * **정적 재고 매핑(Stage 2 전까지)** — 브리프 §3 S1.5 그대로.
 * G(냉동)는 대응하는 실측 재고 배열이 없어 `null` — 점유 0으로 렌더한다.
 */
const INV_KEY_BY_CODE: Record<string, InvKey | null> = {
  A: "xs",
  B: "s",
  C: "m",
  D: "l",
  E: "xl",
  F: "xxl",
  G: null,
};

/**
 * 구역 색 — 기존 `GRADES` 배열(A~E)의 밝기 계단을 그대로 옮겼다. 상온 존에
 * `orderInRow`·`rowNo` 순서로 부여한다(존이 늘어도 계단이 저절로 이어지도록 배열로 둔다).
 * 냉장·냉동은 별도 계열이다 — F(냉장)는 기존 색 그대로, G(냉동)는 **한 단계 더 진하게**
 * 잡았다(브리프 §3 S1.5 "G존은 F와 같은 냉장 계열에서 한 단계 더 진하게").
 */
const AMBIENT_COLOR_STEPS = [0xa8c0e4, 0x8fa9d2, 0x7792bf, 0x5f7bab, 0x4a6595];
const CHILLED_COLOR = 0x5fc2c8;
const FROZEN_COLOR = 0x3f8488;

export interface LayoutZone {
  /** = zone.code (예 "A"). 기존 `GRADES[].id` 자리를 대신한다 */
  id: string;
  code: string;
  name: string;
  /** 칸 한 변(m) */
  w: number;
  /** 칸 높이(m) */
  h: number;
  pairs: number;
  singles: number;
  cols: number;
  levels: number;
  /** 냉장·냉동 존 — 3D·2D 모두 여백·점선 테두리 등 별도 처리 대상 */
  cold: boolean;
  color: number;
  invKey: InvKey | null;
  rowNo: number;
  orderInRow: number;
}

/** `GET /zones` 응답 → 화면이 쓰는 레이아웃 존 배열로 변환한다 */
export function toLayoutZones(zones: Zone[]): LayoutZone[] {
  const sorted = [...zones].sort((a, b) => a.rowNo - b.rowNo || a.orderInRow - b.orderInRow);
  let ambientIdx = 0;
  return sorted.map((zone) => {
    const cold = zone.tempZone !== "AMBIENT";
    let color: number;
    if (!cold) {
      color = AMBIENT_COLOR_STEPS[Math.min(ambientIdx, AMBIENT_COLOR_STEPS.length - 1)];
      ambientIdx += 1;
    } else {
      color = zone.tempZone === "FROZEN" ? FROZEN_COLOR : CHILLED_COLOR;
    }
    return {
      id: zone.code,
      code: zone.code,
      name: zone.name,
      w: zone.binWidthCm / 100,
      h: zone.binHeightCm / 100,
      pairs: zone.rackPairs,
      singles: zone.rackSingles,
      cols: zone.cols,
      levels: zone.levels,
      cold,
      color,
      invKey: INV_KEY_BY_CODE[zone.code] ?? null,
      rowNo: zone.rowNo,
      orderInRow: zone.orderInRow,
    };
  });
}

/* ── 3D·2D 가 함께 쓰는 배치 상수 ────────────────────────────────────────────
   기존 `warehouse-slot-3d.jsx`·`warehouse-data.js` 양쪽에 있던 값이다(둘 다 같은 값을
   썼다). 이제 계산이 한 곳으로 모였으니 상수도 한 곳에 둔다. */
export const AISLE = 1.7;
export const PAIR_GAP = 0.08;
export const ZONE_GAP = 2.3;
export const CORRIDOR = 3.2;

export interface LayoutZoneGeom {
  g: LayoutZone;
  xLocal: number;
  width: number;
  len: number;
  depth: number;
  rackXs: number[];
  pad: number;
  row: number;
  x0: number;
  center: number;
  racks: number[];
  zStart: number;
  labelZ: number;
}

export interface Layout {
  zones: LayoutZoneGeom[];
  rowWidths: number[];
  backLen: number;
  frontLen: number;
}

/**
 * 존 배열 → 3D·2D 가 그리는 좌표 배치. 존을 `rowNo` 로 줄을 나누고(0 뒷줄, 1 앞줄)
 * 그 안에서 `orderInRow` 순서로 왼쪽부터 늘어놓는다 — 기존 `computeLayout()` 이
 * 모듈 전역 `ROWS`/`GRADES` 를 읽던 것을 인자로 받게 바꾼 것뿐, 계산식은 그대로다.
 */
export function computeLayout(layoutZones: LayoutZone[]): Layout {
  const rowsMap = new Map<number, LayoutZone[]>();
  for (const zone of layoutZones) {
    const list = rowsMap.get(zone.rowNo) ?? [];
    list.push(zone);
    rowsMap.set(zone.rowNo, list);
  }
  for (const list of rowsMap.values()) {
    list.sort((a, b) => a.orderInRow - b.orderInRow);
  }
  const rowNos = [...rowsMap.keys()].sort((a, b) => a - b);

  const zones: LayoutZoneGeom[] = [];
  const rowWidths: number[] = [];

  rowNos.forEach((rowNo, rowIdx) => {
    const rowZones = rowsMap.get(rowNo) ?? [];
    let cursor = 0;
    const rowGeoms: LayoutZoneGeom[] = [];
    for (const g of rowZones) {
      const depth = g.w;
      const len = g.cols * g.w;
      const rackXs: number[] = [];
      let width = 0;
      if (g.pairs > 0) {
        const pairW = depth * 2 + PAIR_GAP;
        for (let p = 0; p < g.pairs; p++) {
          const x0 = p * (pairW + AISLE);
          rackXs.push(x0 + depth / 2, x0 + depth + PAIR_GAP + depth / 2);
        }
        width = g.pairs * pairW + (g.pairs - 1) * AISLE;
      } else {
        for (let s = 0; s < g.singles; s++) rackXs.push(s * (depth + AISLE) + depth / 2);
        width = g.singles * depth + (g.singles - 1) * AISLE;
      }
      const pad = g.cold ? 1.0 : 0;
      rowGeoms.push({
        g,
        xLocal: cursor + pad,
        width,
        len,
        depth,
        rackXs,
        pad,
        row: rowIdx,
        x0: 0,
        center: 0,
        racks: [],
        zStart: 0,
        labelZ: 0,
      });
      cursor += width + ZONE_GAP + pad * 2;
    }
    const totalW = cursor - ZONE_GAP;
    rowWidths.push(totalW);
    const startX = -totalW / 2;
    for (const z of rowGeoms) {
      z.x0 = startX + z.xLocal;
      z.center = z.x0 + z.width / 2;
      z.racks = z.rackXs.map((rx) => z.x0 + rx);
      if (rowIdx === 0) {
        // 뒷줄: 랙 끝이 통로 뒤편에 정렬
        z.zStart = -CORRIDOR / 2 - z.len;
        z.labelZ = -CORRIDOR / 2 + 0.95;
      } else {
        // 앞줄: 랙 시작이 통로 앞편에 정렬
        z.zStart = CORRIDOR / 2;
        z.labelZ = z.zStart + z.len + 1.35;
      }
      zones.push(z);
    }
  });

  const backLen = Math.max(...zones.filter((z) => z.row === 0).map((z) => z.len));
  const frontLen = Math.max(...zones.filter((z) => z.row === 1).map((z) => z.len));
  return { zones, rowWidths, backLen, frontLen };
}
