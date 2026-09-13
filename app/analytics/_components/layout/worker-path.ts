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

import type { Bay } from "@/lib/types";
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
