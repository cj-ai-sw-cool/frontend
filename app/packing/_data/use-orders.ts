"use client";

/**
 * 포장 화면 "주문" 탭의 데이터 훅 (Stage 5, docs/02-system/02-data-model.md §5.7,
 * docs/tasks/2026-09-11-stage5-orders-allocation-handoff.md §3 S5.4).
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `orders` 만 쓴다(fetch 직접 호출 금지, 다른 데이터 훅과
 * 같은 규약). 백엔드가 이 화면과 동시에 만들어지는 중이라 — 계약(§5.7)대로 먼저 붙이고
 * 라이브 검증은 완료 보고에서 별도로 남긴다.
 *
 * 화주 목록은 `master.sellers()`(Stage 1) 를 그대로 재사용한다 — 입고 화면의 진열 탭이
 * `useSellers` 를 그대로 쓰는 것과 같은 이유로, 이 화면에 화주 등록 API 를 새로 만들 필요는
 * 없다(조회만 필요하다).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { master, orders, queryKeys } from "@/lib/endpoints";
import type { OrdersImportRequest, OrdersQuery } from "@/lib/types";

/** 접수 폼의 화주 선택 — Stage 1 마스터 API 재사용 */
export function useSellers() {
  return useQuery({
    queryKey: queryKeys.sellers,
    queryFn: () => master.sellers(),
  });
}

/** 주문 목록 — 좌측 열. 화주·상태 필터가 바뀔 때마다 쿼리 키가 바뀌어 다시 불러온다 */
export function useOrdersList(params?: OrdersQuery) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () => orders.list(params),
  });
}

/** 주문 상세 — 목록에서 행을 골랐을 때만 조회한다 */
export function useOrderDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.order(id ?? -1),
    queryFn: () => orders.get(id as number),
    enabled: id !== null,
  });
}

/**
 * 취소 — 성공하면 그 주문 상세와 목록을 다시 읽는다. 재고 자체는 안 바뀌지만(SOFT 할당만
 * CANCELLED) 가용재고 탭(ATP)이 이 주문의 할당을 반영하고 있으므로 그쪽도 무효화한다.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => orders.cancel(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(id) });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["sellers"] });
    },
  });
}

/**
 * 테스트용 접수 — 성공/부분 거부 모두 200 으로 온다(정본 §5.4, 기존 동작 유지).
 * 성공한 주문만큼 목록·가용재고가 바뀌므로 둘 다 무효화한다.
 */
export function useImportOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: OrdersImportRequest) => orders.import(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["sellers"] });
    },
  });
}
