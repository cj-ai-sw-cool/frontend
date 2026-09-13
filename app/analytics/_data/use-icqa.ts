"use client";

/**
 * ICQA(순환 실사·조정) 데이터 훅 — Stage 10, 정본 §10.3, 브리프
 * docs/tasks/2026-09-13-stage10-icqa-handoff.md §3.
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `icqa` 만 쓴다(컴포넌트에서 fetch 직접 호출 금지, 다른
 * 데이터 훅과 같은 규약). 백엔드가 이 화면과 동시에 만들어지는 중이라 — 계약(§10.3)대로
 * 먼저 붙이고 라이브 검증은 완료 보고에서 별도로 남긴다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { icqa, queryKeys } from "@/lib/endpoints";
import type {
  CountTasksQuery,
  GenerateCountTasksRequest,
  StartCountTaskRequest,
  SubmitCountTaskRequest,
} from "@/lib/types";

/** 실사 탭의 태스크 표 — 상태 필터가 바뀔 때마다 다시 조회한다 */
export function useCountTasks(params?: CountTasksQuery) {
  return useQuery({
    queryKey: queryKeys.countTasks(params),
    queryFn: () => icqa.list(params),
  });
}

/** 태스크 상세 — id 가 없으면 조회하지 않는다 */
export function useCountTaskDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.countTask(id ?? -1),
    queryFn: () => icqa.detail(id as number),
    enabled: id !== null,
  });
}

/** 실사 생성 — 회전 상위·최근 조정 로케이션에 OPEN 태스크. 성공하면 태스크 표를 다시 읽는다 */
export function useGenerateCountTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: GenerateCountTasksRequest) => icqa.generate(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["count-tasks"] });
    },
  });
}

/** 실사 시작 — OPEN → COUNTING, 블라인드 라인. 성공하면 태스크 표의 상태가 바뀌므로 무효화 */
export function useStartCountTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: StartCountTaskRequest }) => icqa.start(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["count-tasks"] });
    },
  });
}

/**
 * 실사 제출 — 조정이 성공하면 재고 표·원장·점유(3D·2D)·존 요약이 바뀌고(`useAdjustInventory`
 * 와 같은 이유), 재할당·주문 취소가 있으면 주문·웨이브·피킹 배치도 바뀐다. 재카운트 태스크가
 * 새로 생기거나 이 칸의 피킹 불일치가 해결되므로 태스크 표도 무효화한다.
 */
export function useSubmitCountTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SubmitCountTaskRequest }) => icqa.submit(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["count-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.zonesSummary });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["waves"] });
      void queryClient.invalidateQueries({ queryKey: ["pick-batches"] });
    },
  });
}
