"use client";

/**
 * 3-1 라인별 배송 내역 — `GET /lines/{lineId}/shipments?status=` (docs/02-api-spec.md §3-1, D-12).
 */

import { useQuery } from "@tanstack/react-query";
import { outbound, queryKeys } from "@/lib/endpoints";
import type { ShipmentStatus } from "@/lib/types";

export function useLineShipments(lineId: number, status?: ShipmentStatus) {
  return useQuery({
    queryKey: queryKeys.lineShipments(lineId, status),
    queryFn: () => outbound.lineShipments(lineId, status),
  });
}
