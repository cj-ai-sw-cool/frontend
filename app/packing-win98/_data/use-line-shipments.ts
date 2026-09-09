"use client";

/**
 * 3-1 라인별 배송 내역 — `GET /lines/{lineId}/shipments?status=` (docs/02-api-spec.md §3-1, D-12).
 *
 * `lineId` 가 null 이면(아직 라인을 못 골랐으면) 조회하지 않는다 — 라인 목록이 아직 로딩
 * 중이거나 비어 있는 동안 잘못된 id 로 요청이 나가지 않게 막는다.
 */

import { useQuery } from "@tanstack/react-query";
import { outbound, queryKeys } from "@/lib/endpoints";
import type { ShipmentStatus } from "@/lib/types";

export function useLineShipments(lineId: number | null, status?: ShipmentStatus) {
  return useQuery({
    queryKey: queryKeys.lineShipments(lineId ?? -1, status),
    queryFn: () => outbound.lineShipments(lineId as number, status),
    enabled: lineId !== null,
  });
}
