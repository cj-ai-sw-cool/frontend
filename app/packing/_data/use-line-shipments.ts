"use client";

/**
 * 3-1 라인별 배송 내역 — `GET /lines/{lineId}/shipments?status=` (docs/02-api-spec.md §3-1, D-12).
 *
 * 🔌 API 교체 지점 — `app/dashboard/_data/use-dashboard.ts` 와 같은 mock-now/real-later
 * 모양이다. 실제 API 로 바꿀 때는 아래 `queryFn` 을 한 줄로 바꾸면 끝난다:
 *
 *   queryFn: () => outbound.lineShipments(lineId, status)   // @/lib/endpoints 의 outbound
 *
 * 그 다음 이 파일의 mock 지연(`setTimeout`) + `mockLineShipments` 호출만 지우면 되고,
 * `../_mock/line-shipments.ts` 는 이 파일에서만 참조하므로 함께 지우면 된다.
 *
 * 반환 모양은 `outbound.lineShipments` 의 실제 반환 타입(`{ shipments: ShipmentListItem[] }`)
 * 과 정확히 같다 — 그래서 위 한 줄 교체 이후 `page.tsx`/`LineShipmentsPanel` 은 손댈 게 없다.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/endpoints";
import type { ShipmentListItem, ShipmentStatus } from "@/lib/types";
import { mockLineShipments } from "../_mock/line-shipments";

/** mock 응답 지연(ms) — 로딩 상태가 화면에서 실제로 보이도록 조금 늦춘다 */
const MOCK_LATENCY_MS = 300;

export function useLineShipments(lineId: number, status?: ShipmentStatus) {
  return useQuery({
    queryKey: queryKeys.lineShipments(lineId, status),
    queryFn: () =>
      new Promise<{ shipments: ShipmentListItem[] }>((resolve) => {
        setTimeout(
          () => resolve({ shipments: mockLineShipments(lineId, status) }),
          MOCK_LATENCY_MS,
        );
      }),
  });
}
