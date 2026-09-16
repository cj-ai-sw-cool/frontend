"use client";

/**
 * 반복 실행(묶음) — Stage 12, 정본 §17.8(§16.11 이월). 정본은 `POST /admin/simulation/runs`
 * 에 `repeat`(1~5)를 얹으면 백엔드가 순차로 N번 돌려 `batch_id`로 묶어 준다고 하지만,
 * 2026-09-16 시점 이 필드를 백엔드가 아직 안 받는다(같은 단일 실행 엔드포인트는 이미
 * 라이브 — `use-simulation-mutations.ts` 머리말) — 그래서 프론트가 **같은 라이브
 * 엔드포인트를 N번 순차로 부르고** `SimulationBatchGroup`으로 클라이언트에서 묶는다.
 * 순차인 이유는 정본과 별개로 실제 제약이기도 하다(§16.3 "센터당 동시 실행 1개") — 다음
 * 실행을 넣기 전에 이전 실행이 끝날 때까지(`waitForTerminal`) 기다린다.
 *
 * 리드타임 집계(`useSimulationBatchLeadtime`)는 배치 안에서 끝난(DONE·STOPPED) 실행만
 * 골라 `GET …/leadtime`을 각각 불러 구간별 p50 최소~최대~평균을 낸다(§17.8 "구간 막대에
 * 범위 수염", "총 p50에 평균 ± 범위") — 이 계산은 라이브 응답 그대로 쓰므로 표본이 아니다.
 */

import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import {
  simulationRunId,
  LEADTIME_SEGMENTS,
  type LeadtimeSegment,
  type SimulationBatchGroup,
  type SimulationBatchLeadtimeStats,
  type SimulationBatchRange,
  type SimulationLeadtimeResponse,
  type SimulationRun,
  type SimulationRunStatus,
  type StartSimulationRunRequest,
} from "@/lib/types";

const TERMINAL_STATUSES: SimulationRunStatus[] = ["DONE", "STOPPED", "FAILED"];
const POLL_MS = 1500;
const TIMEOUT_MS = 180_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 실행 하나가 끝날 때까지(DONE·STOPPED·FAILED) 기다린다 — 다음 실행을 순차로 넣기 전에
 * 부른다(§16.3 "센터당 동시 실행 1개", 라이브 제약). 타임아웃이면 그냥 진행한다 — 다음
 * 호출이 409를 던지면 그건 그것대로 뮤테이션 에러로 화면에 보인다. */
async function waitForTerminal(runId: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const progress = await simulation.runProgress(runId);
    if (TERMINAL_STATUSES.includes(progress.status)) return;
    await sleep(POLL_MS);
  }
}

/** "실행" Dialog "반복 횟수" 제출 — `onProgress`로 매 실행 생성 직후(그리고 시작 직전)
 * 현재까지의 `SimulationBatchGroup`을 돌려준다(호출부가 이 값을 `batches` 상태에
 * 반영해 "N/M 진행"을 그린다, `simulation-tab.tsx`). */
export function useCreateRunBatch(center: string, onProgress: (batch: SimulationBatchGroup) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StartSimulationRunRequest & { scenarioId: number }) => {
      const size = Math.min(5, Math.max(1, Math.round(body.repeat ?? 1)));
      const batch: SimulationBatchGroup = {
        batchId: `batch-${Date.now()}`,
        scenarioId: body.scenarioId,
        center,
        size,
        runIds: [],
        createdAt: new Date().toISOString(),
      };
      onProgress({ ...batch });

      for (let i = 0; i < size; i++) {
        const run: SimulationRun = await simulation.createRun({ scenarioId: body.scenarioId, repeat: size });
        batch.runIds = [...batch.runIds, simulationRunId(run)];
        queryClient.setQueryData(
          queryKeys.simulationRuns({ center }),
          (old: SimulationRun[] | undefined) => [run, ...(old ?? [])],
        );
        onProgress({ ...batch });
        if (i < size - 1) await waitForTerminal(simulationRunId(run));
      }
      return batch;
    },
  });
}

function range(values: number[]): SimulationBatchRange {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    n: values.length,
  };
}

function aggregateBatchLeadtime(rows: SimulationLeadtimeResponse[]): SimulationBatchLeadtimeStats {
  if (rows.length === 0) return { readyRunIds: [], perSegment: {}, totalP50: null };

  const perSegment: Partial<Record<LeadtimeSegment, SimulationBatchRange>> = {};
  for (const key of LEADTIME_SEGMENTS) {
    const values = rows
      .map((r) => r.segments.find((s) => s.key === key)?.p50Sec)
      .filter((v): v is number => v !== undefined);
    if (values.length > 0) perSegment[key] = range(values);
  }

  return {
    readyRunIds: rows.map((r) => r.runId),
    perSegment,
    totalP50: range(rows.map((r) => r.totalLeadtime.p50Sec)),
  };
}

/** 배치 리드타임 집계 — 묶음 안 모든 실행에 각각 `GET …/leadtime`을 건다. 진행 중인
 * 실행은 409(정본 §16.4 "실행 종료 시 한 번 계산", `simulation-compare-panel.tsx`
 * 머리말과 같은 제약)라 그 실행의 쿼리만 실패하는데, 배치 실행은 선택된 실행(대개 1번)
 * 말고는 아무도 `useSimulationRunProgress`로 폴링하지 않아 "끝났다"는 신호를 받을 길이
 * 없다 — 그래서 캐시된 `SimulationRun.status`(생성 직후 값에 멈춰 있을 수 있다)로
 * 미리 거르지 않고, 실패한 쿼리 각각을 **`refetchInterval`로 스스로 재시도**시킨다(성공하면
 * 멈춘다). 실행 하나가 끝나면 그 실행의 쿼리만 자연히 성공으로 바뀐다. */
export function useSimulationBatchLeadtime(
  batch: SimulationBatchGroup | null,
): { data: SimulationBatchLeadtimeStats | null; isLoading: boolean } {
  const runIds = batch?.runIds ?? [];

  const results = useQueries({
    queries: runIds.map((runId) => ({
      queryKey: queryKeys.simulationLeadtime(runId),
      queryFn: () => simulation.leadtime(runId),
      retry: false,
      // 아직 값이 없으면(진행 중 409) 2초마다 다시 시도, 한 번 성공하면 멈춘다.
      refetchInterval: (q: { state: { data: unknown } }) => (q.state.data ? false : POLL_MS),
    })),
  });

  if (!batch || runIds.length === 0) return { data: null, isLoading: false };

  const isLoading = results.some((r) => r.isLoading);
  const rows = results.map((r) => r.data).filter((d): d is SimulationLeadtimeResponse => d !== undefined);
  if (rows.length === 0) return { data: null, isLoading };
  return { data: aggregateBatchLeadtime(rows), isLoading };
}
