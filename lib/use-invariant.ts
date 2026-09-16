"use client";

/**
 * 불변식 이력 훅 (Stage 12, 정본 §17.3) — 분석 개요 탭·허브 관제 탭 배지가 함께 쓴다
 * (`lib/use-events.ts`와 같은 이유로 라우트별 `_data/`가 아니라 이 자리에 둔다).
 *
 * 2026-09-16 curl 확인 — `GET/POST /admin/inventory/invariant/*`가 404(백엔드 같은
 * 브랜치 동시 작업 중, 브리프 머리말). `use-hub.ts`/`use-simulation.ts`(라이브 붙기 전)와
 * 같은 `usingMock` 관례: 조회는 `retry:false` + 실패 시 표본, "지금 검사"는 route-missing
 * (404)에 한해서만 표본으로 넘어간다(`use-simulation-mutations.ts` 11E 버전의
 * `isRouteMissing` 그대로).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { invariant, queryKeys } from "./endpoints";
import { mockInvariantRuns, mockRunInvariantCheck } from "./mocks/invariant";
import type { InvariantRun } from "./types";

const HISTORY_LIMIT = 20;

function isRouteMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** 배지·이력 Dialog가 함께 쓴다 — 배지는 `data[0]`만, Dialog는 배열 전체(최근 20건)를 표로 */
export function useInvariantRuns(center: string, limit = HISTORY_LIMIT) {
  const query = useQuery({
    queryKey: queryKeys.invariantRuns({ center, limit }),
    queryFn: () => invariant.runs({ center, limit }),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockInvariantRuns(center, limit) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** "지금 검사" 버튼 — 성공하면 이력 쿼리를 무효화해 배지·Dialog를 새 값으로 갱신한다 */
export function useRunInvariantCheck(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<InvariantRun> => {
      try {
        return await invariant.run(center);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        return mockRunInvariantCheck(center);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "inventory", "invariant", "runs"] });
    },
  });
}
