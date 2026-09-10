"use client";

/**
 * 재고(Stage 2) 데이터 훅 — 재고 창, 3D·2D 점유, 흐름·월간·규격별 패널이 함께 쓴다.
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `inventory` 를 쓴다(컴포넌트에서 fetch 직접 호출 금지,
 * 다른 화면과 같은 규칙).
 *
 * 정본: backend/docs/02-system/02-data-model.md §2.4·§2.6, docs/tasks/
 * 2026-09-10-stage2-inventory-core-handoff.md §3.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventory, queryKeys } from "@/lib/endpoints";
import type { AdjustInventoryRequest, StockQuery } from "@/lib/types";

/** 재고 창의 표 — 필터가 바뀔 때마다 새로 조회한다 */
export function useStock(params: StockQuery) {
  return useQuery({
    queryKey: queryKeys.stock(params),
    queryFn: () => inventory.stock(params),
  });
}

/** 재고 창에서 행을 클릭했을 때 여는 원장 표. `stockId` 가 없으면 조회하지 않는다 */
export function useStockLedger(stockId: number | null, params?: { page?: number; size?: number }) {
  return useQuery({
    queryKey: queryKeys.stockLedger(stockId ?? -1, params),
    queryFn: () => inventory.stockLedger(stockId as number, params),
    enabled: stockId !== null,
  });
}

/**
 * BIN 전체 점유 — 3D·2D 지도 인스턴스 매핑용(3,888행, 정본 §2.4).
 * 30초 폴링 — 브리프 §3 S2.6. 재고 창의 조정 성공(`useAdjustInventory`)도 즉시 무효화한다.
 */
export function useOccupancy() {
  return useQuery({
    queryKey: queryKeys.occupancy,
    queryFn: () => inventory.occupancy(),
    refetchInterval: 30_000,
  });
}

/** 존별 현재고 합계 — 규격별 재고 패널, 3D 헤더의 "칸 N개 · 점유 M개" */
export function useZonesSummary() {
  return useQuery({
    queryKey: queryKeys.zonesSummary,
    queryFn: () => inventory.zonesSummary(),
  });
}

/** 일별 입출고·현재고·점유율 — 흐름·월간 패널. 기간 상한 92일(서버가 400 으로 막는다) */
export function useDailyInventory(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.dailyInventory(from, to),
    queryFn: () => inventory.daily(from, to),
  });
}

/**
 * 오늘 기준 최근 N일 — 흐름·월간 패널이 함께 쓴다(브리프 §3 S2.8 "GET /inventory/daily?
 * from=오늘−30&to=오늘"). 두 패널이 같은 방식으로 날짜를 계산해야 쿼리 키가 같아지고,
 * 그래야 TanStack Query 가 요청을 하나로 합친다 — 각자 `new Date()` 를 부르면 아주 드물게
 * 자정을 사이에 두고 하루가 어긋날 수 있어, 이 훅 하나로 계산을 모은다.
 */
export function useRecentDailyInventory(days = 30) {
  const { from, to } = useMemo(() => recentRange(days), [days]);
  return useDailyInventory(from, to);
}

function recentRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from: toISODate(from), to: toISODate(to) };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 재고 조정 — 화면 체크·ICQA 전 임시 창구(정본 §2.4).
 * 성공하면 재고 표·점유(3D·2D)·존 요약을 모두 무효화한다 — 조정 한 건이 세 화면(재고 창,
 * 3D·2D 지도, 규격별 재고 패널)의 숫자를 동시에 바꾸기 때문이다.
 */
export function useAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdjustInventoryRequest) => inventory.adjust(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.zonesSummary });
    },
  });
}
