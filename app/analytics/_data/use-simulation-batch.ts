"use client";

/**
 * 반복 실행(묶음) 조회 — Stage 12, 정본 §17.8. 생성은 이제 이 파일이 하지 않는다 —
 * 백엔드 노트(2026-09-16) §1.10 라이브 대조: `POST /admin/simulation/runs`에
 * `repeat`를 얹으면 **첫 판만 응답으로 오고 나머지는 백엔드가 스스로** 만든다("센터당
 * 살아 있는 실행 하나" 제약 때문에 미리 다 만들 수 없다). 그래서 `simulation-scenario-
 * panel.tsx`가 기존 `useCreateRun`(`use-simulation-mutations.ts`)에 `repeat`를 얹어
 * 한 번만 부르면 끝난다 — 예전에 이 파일에 있던 순차 생성 루프·`waitForTerminal`은
 * 걷어냈다.
 *
 * 이 파일에 남은 건 **조회**뿐이다: `GET /admin/simulation/compare/batches?batchA=&batchB=`
 * (백엔드 노트 §1.11, 기존 `/compare`와 경로가 다르다)를 그대로 쓴다. 배치 하나만의
 * 집계(결과 패널 "구간 막대에 범위 수염")가 필요할 때도 전용 엔드포인트가 없어
 * `batchA=batchB`로 자기 자신과 비교해 그 `a` 쪽만 읽는다.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import type { SimulationBatchSide } from "@/lib/types";

/** 하단 "묶음 비교" — 서로 다른 두 배치(정본 §17.8 "묶음 vs 묶음", `rangesOverlap`은
 * 백엔드가 이미 계산해 준다). */
export function useSimulationCompareBatches(batchA: number | null, batchB: number | null) {
  const enabled = batchA !== null && batchB !== null;
  return useQuery({
    queryKey: queryKeys.simulationCompareBatches(batchA ?? -1, batchB ?? -1),
    queryFn: () => simulation.compareBatches(batchA as number, batchB as number),
    enabled,
    retry: false,
  });
}

/** 결과 패널 범위 수염 — 배치 하나의 집계만 필요할 때 자기 자신과 비교해 `a`만 쓴다.
 * `runs <= 1`이면(혼자 돈 실행, `SimulationRun.batchId` 머리말 참고) 굳이 부르지 않는다
 * — 호출부(`simulation-results-panel.tsx`)가 `enabled` 조건으로 이미 거른다. */
export function useSimulationBatchStats(batchId: number | null): {
  data: SimulationBatchSide | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: queryKeys.simulationCompareBatches(batchId ?? -1, batchId ?? -1),
    queryFn: () => simulation.compareBatches(batchId as number, batchId as number),
    enabled: batchId !== null,
    retry: false,
  });
  return { data: query.data?.a, isLoading: query.isLoading };
}
