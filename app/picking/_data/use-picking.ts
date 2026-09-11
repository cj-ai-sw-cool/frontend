"use client";

/**
 * 피킹 화면 데이터 훅 (Stage 7, docs/02-system/02-data-model.md §7.3·§7.4, docs/tasks/
 * 2026-09-12-stage7-picking-handoff.md §3 S7.4).
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `picking` 만 쓴다(fetch 직접 호출 금지, 다른 데이터 훅과
 * 같은 규약). 백엔드(stage7-backend)와 세션 안에서 응답 형태를 맞춘 뒤 붙였다 — 계약대로
 * 먼저 구현하고 라이브 검증은 완료 보고에서 남긴다(브리프 §5).
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { picking, queryKeys } from "@/lib/endpoints";
import type { PickBatchDetail, PickTaskPickRequest } from "@/lib/types";

/** OPEN 배치 목록 — 작업자가 배치를 아직 안 잡았을 때만 조회한다(정본 §7.3) */
export function useOpenPickBatches(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.pickBatchesList("OPEN"),
    queryFn: () => picking.batches("OPEN"),
    enabled,
    // 다른 작업자가 먼저 가져갈 수 있어 목록이 빨리 낡는다 — claim 409 안내와 별개로
    // 화면에 오래 떠 있으면 주기적으로 다시 읽는다
    refetchInterval: enabled ? 15_000 : false,
  });
}

/** 배치 상세 — claim 이후 화면이 계속 다시 읽는 중심 데이터(태스크 목록·진행) */
export function usePickBatch(id: number | null) {
  return useQuery({
    queryKey: queryKeys.pickBatch(id ?? -1),
    queryFn: () => picking.batch(id as number),
    enabled: id !== null,
  });
}

/** claim·start·complete 로 배치 상태가 바뀌면 목록(피킹 화면의 OPEN 목록, 포장 화면의
 * 웨이브·배치 표)이 같이 낡는다 — 이 셋을 한 번에 무효화한다 */
function invalidateBatchLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["pick-batches"] });
  void queryClient.invalidateQueries({ queryKey: ["waves"] });
}

export function useClaimPickBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, worker }: { id: number; worker: string }) => picking.claim(id, worker),
    onSuccess: (data: PickBatchDetail) => {
      queryClient.setQueryData(queryKeys.pickBatch(data.pickBatchId), data);
      invalidateBatchLists(queryClient);
    },
  });
}

export function useStartPickBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => picking.start(id),
    onSuccess: (data: PickBatchDetail) => {
      queryClient.setQueryData(queryKeys.pickBatch(data.pickBatchId), data);
    },
  });
}

/**
 * 태스크 확정 — 성공하면 배치 상세를 다시 읽는다(태스크 목록·진행·다음 태스크가 전부 거기서
 * 나온다). 응답 자체(`PickTaskPickResponse`)는 그 한 태스크의 결과(discrepancy·reallocation
 * 안내)만 담아서 오므로, 화면 상태는 배치 상세 쪽을 기준으로 삼는다.
 */
export function usePickTask(batchId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: PickTaskPickRequest }) =>
      picking.pick(taskId, body),
    onSuccess: () => {
      if (batchId !== null) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.pickBatch(batchId) });
      }
    },
  });
}

export function useCompletePickBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => picking.complete(id),
    onSuccess: (data: PickBatchDetail) => {
      queryClient.setQueryData(queryKeys.pickBatch(data.pickBatchId), data);
      invalidateBatchLists(queryClient);
      // 배치 완료는 주문을 REBINNING 으로 옮긴다(정본 §7.3) — 주문 탭이 열려 있으면 같이 갱신
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
