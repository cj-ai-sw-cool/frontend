/**
 * 작업자 마커 이동 경로 — 정본 §13.1 "위치는 마지막 태스크가 말한다. 마커는 두
 * 로케이션 사이를 통로 그래프 위에서 보간해 움직인다(연출이고 기록이 아님을 화면에
 * 표시)", 브리프 §2 "이동 = 이전 로케이션 베이 앞 → 통로 축 따라 → 현재 베이 앞(통로가
 * 다르면 통로 끝 → 다음 통로)".
 *
 * 통로 그래프 전체(교차점 연결)는 계약에 없어 만들 수 없다 — 대신 건물 앞쪽 공용
 * 교차 통로(`layoutBounds().x0` 바깥쪽 여유 지점)를 모든 통로가 만나는 환승 지점으로
 * 쓴다. 통로가 다를 때도 그럴듯하게 잇히지만 최단경로는 아니다 — 연출이라 괜찮다.
 */

import type { Bay, LayoutResponse } from "@/lib/types";
import { bayBox, layoutBounds, type LayoutIndex } from "./layout-geometry";

export interface PathPoint {
  x: number;
  y: number;
}

/** 베이 앞 대기 지점 — 그 베이가 속한 통로의 중심선(`aisle.yM`) 위, 베이 정면 X */
export function bayFrontPoint(bay: Bay, index: LayoutIndex): PathPoint | null {
  const box = bayBox(bay, index);
  if (!box) return null;
  const aisle = (index.aislesByZone.get(bay.zoneCode) ?? []).find((a) => a.no === bay.aisleNo);
  return { x: box.cx, y: aisle?.yM ?? box.cy };
}

function aisleKey(bay: Bay): string {
  return `${bay.zoneCode}:${bay.aisleNo}`;
}

/**
 * 두 베이 사이 웨이포인트. 같은 통로면 직선 두 점, 통로가 다르면 공용 교차 통로를
 * 거치는 네 점(앞 베이 앞 → 교차 통로 진입 → 교차 통로로 새 통로 진입 → 새 베이 앞).
 */
export function buildWorkerPath(fromBay: Bay | null, toBay: Bay, index: LayoutIndex): PathPoint[] {
  const to = bayFrontPoint(toBay, index);
  if (!to) return [];
  if (!fromBay) return [to];

  const from = bayFrontPoint(fromBay, index);
  if (!from) return [to];
  if (aisleKey(fromBay) === aisleKey(toBay)) return [from, to];

  const crossX = layoutBounds(index.layout).x0 - 1;
  return [from, { x: crossX, y: from.y }, { x: crossX, y: to.y }, to];
}

/** 경로 전체 길이(m) — 이동 소요 시간 계산용 */
export function pathLength(path: PathPoint[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return Math.max(len, 1);
}

/**
 * `GET /workers`의 `lastLocationCode` → 베이(코디네이터 지시 2026-09-14). 코드는
 * `{center}-{zone}-{통로:2}-{베이:2}-{단:2}-{위치:2}`(센터 축 붙은 라이브 형식) 또는
 * 센터 접두가 없는 옛 형식 둘 다 온다 — 위치를 가리지 않고 연속 세 구간(zone·aisle·
 * bay)이 실제 베이와 맞는지 앞에서부터 훑는다. `TOTE-003`·`RCV-01`·`S-001`처럼 BIN이
 * 아닌 로케이션은 못 찾는다(그게 맞다 — 그 경우 RCV 존 격자로 대신 둔다).
 */
export function bayFromLocationCode(code: string | null | undefined, layout: LayoutResponse): Bay | null {
  if (!code) return null;
  const segments = code.split("-");
  for (let i = 0; i + 2 < segments.length; i++) {
    const zoneCode = segments[i];
    const aisleNo = Number(segments[i + 1]);
    const bayNo = Number(segments[i + 2]);
    if (!Number.isFinite(aisleNo) || !Number.isFinite(bayNo)) continue;
    const bay = layout.bays.find((b) => b.zoneCode === zoneCode && b.aisleNo === aisleNo && b.no === bayNo);
    if (bay) return bay;
  }
  return null;
}

/**
 * RCV(입고·검수, `Area.kind === "RECEIVING"`) 존 안 격자 좌석 — 베이를 못 찾은 작업자
 * (토트·입고장에 마지막으로 있던 사람)를 한 점에 쌓지 않고 흩어 둔다(코디네이터 지시).
 * 존 폭이 좁아도(라이브 RCV 폭 1m) 열을 줄여 안쪽에 들어가게 한다.
 */
export function receivingGridPoint(index: LayoutIndex, seatIndex: number, totalSeats: number): PathPoint | null {
  const area = index.layout.areas.find((a) => a.kind === "RECEIVING") ?? index.areaByCode.get("RCV");
  if (!area) return null;
  const cols = Math.max(1, Math.min(4, Math.floor(area.wM / 0.4)));
  const rows = Math.max(1, Math.ceil(totalSeats / cols));
  const col = seatIndex % cols;
  const row = Math.floor(seatIndex / cols) % rows;
  const cellW = area.wM / (cols + 1);
  const cellD = area.dM / (rows + 1);
  return { x: area.xM + cellW * (col + 1), y: area.yM + cellD * (row + 1) };
}

/** 경로 위 진행률(0~1) 지점 — 세그먼트 길이 비례 보간 */
export function pointAlongPath(path: PathPoint[], t: number): PathPoint {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];

  const total = pathLength(path);
  const target = Math.max(0, Math.min(1, t)) * total;
  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (travelled + segLen >= target || i === path.length - 1) {
      const segT = segLen > 0 ? (target - travelled) / segLen : 0;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * segT,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * segT,
      };
    }
    travelled += segLen;
  }
  return path[path.length - 1];
}
