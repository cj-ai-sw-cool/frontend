"use client";

/**
 * 작업자 목록 — 관제 모드가 켜질 때 마커 초기 배치에만 쓴다(정본 §13.4, 코디네이터
 * 지시 2026-09-14 "마커 초기 위치: GET /workers 의 lastLocationCode→bay"). 스트림이
 * 뜨는 동안엔 이벤트가 위치를 계속 갱신하므로 이 훅은 재조회하지 않는다(관제 모드
 * 켤 때 한 번이면 충분하다).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys, workers } from "@/lib/endpoints";
import type { WorkerRow } from "@/lib/types";

export function useWorkers(center: string) {
  return useQuery<WorkerRow[]>({
    queryKey: queryKeys.workers({ center }),
    queryFn: () => workers.list({ center }),
    retry: false,
    staleTime: Infinity,
  });
}
