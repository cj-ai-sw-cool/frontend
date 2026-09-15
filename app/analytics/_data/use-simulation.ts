"use client";

/**
 * 분석 화면 "시뮬레이션" 탭 조회 훅 (Stage 11E, 정본 §16). 뮤테이션은
 * `use-simulation-mutations.ts` 로 따로 뺐다(파일 300줄 상한, `use-slotting.ts`/
 * `use-slotting-mutations.ts` 와 같은 이유).
 *
 * 백엔드가 같은 브랜치에서 동시 작업 중이라 2026-09-15 curl 확인 시점엔 404다 —
 * `use-slotting.ts`(11B, 백엔드 붙기 전)의 `usingMock` 관례를 그대로 쓴다: `retry: false`
 * 로 조회 실패를 빠르게 확정하고, 실패했을 때만 `lib/mocks/simulation.ts` 표본으로 대신
 * 그린다. 라이브 검증 대기.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import {
  mockListRuns,
  mockListScenarios,
  mockRunById,
  mockRunProgress,
  mockRunProgressFraction,
  mockScenarioById,
  mockSimulationParams,
} from "@/lib/mocks/simulation";
import { deriveBottleneck, deriveCompare, deriveLeadtimeResponse, deriveTimeline } from "@/lib/mocks/simulation-metrics";
import type { SimulationRunStatus } from "@/lib/types";

/** 상단 띠 — 표준시간·압축 매개변수 */
export function useSimulationParams(center: string) {
  const query = useQuery({
    queryKey: queryKeys.simulationParams(center),
    queryFn: () => simulation.params(center),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockSimulationParams : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 시나리오 목록 — 이름·인원·배치·토트·슬로팅 적용(정본 §16.6 "이름·인원·배치·토트·
 * 슬로팅·최근 실행 상태") */
export function useSimulationScenarios(center: string) {
  const query = useQuery({
    queryKey: queryKeys.simulationScenarios(center),
    queryFn: () => simulation.scenarios(center),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockListScenarios(center) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 센터의 실행 전체 — 시나리오 목록의 "최근 실행 상태" 칸과 하단 비교 Select 가 같이 쓴다
 * (N+1 없이 한 번만 조회). */
export function useSimulationRuns(center: string, scenarioId?: number) {
  const query = useQuery({
    queryKey: queryKeys.simulationRuns({ center, scenarioId }),
    queryFn: () => simulation.runs({ center, scenarioId }),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockListRuns(center, scenarioId) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

const TERMINAL_STATUSES: SimulationRunStatus[] = ["DONE", "STOPPED", "FAILED"];

/** 진행 띠 — 실행 중일 때만 2초 폴링(정본 §16.3 "진행" 문단). 끝난 실행은 한 번만 받고
 * 멈춘다 — `refetchInterval` 을 콜백으로 줘서 최신 `status` 를 보고 스스로 켜고 끈다. */
export function useSimulationRunProgress(runId: number | null) {
  const query = useQuery({
    queryKey: queryKeys.simulationRunProgress(runId ?? -1),
    queryFn: () => simulation.runProgress(runId as number),
    enabled: runId !== null,
    retry: false,
    refetchInterval: (q) => {
      // 라이브 응답이 오면 그 status 를 본다. 지금(백엔드 404)은 실제 쿼리가 한 번도
      // 성공하지 못해 `q.state.data` 가 항상 비어 있으므로, 낙관 폴백이 이미 DONE/STOPPED
      // 로 굳혀 둔 모듈 상태(`mockRunById`)도 함께 본다 — 안 그러면 끝난 실행도 계속 2초
      // 마다 폴링해 매번 에러→재시도 사이 깜빡임이 남는다.
      const liveStatus = q.state.data?.status;
      const mockStatus = runId !== null ? mockRunById(runId)?.status : undefined;
      const status = liveStatus ?? mockStatus;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
  const usingMock = runId !== null && query.isError;
  return {
    data: query.data ?? (usingMock ? mockRunProgress(runId as number) : undefined),
    isLoading: runId !== null && query.isLoading && !usingMock,
    usingMock,
  };
}

/** 중단 — 리드타임 분해 누적 막대(구간 9개). 실행 종료 시 한 번 계산해 저장된 값(정본
 * §16.4 "집계는 실행 종료 시 한 번 계산") — 끝난 실행에서만 조회한다. */
export function useSimulationLeadtime(runId: number | null) {
  const query = useQuery({
    queryKey: queryKeys.simulationLeadtime(runId ?? -1),
    queryFn: () => simulation.leadtime(runId as number),
    enabled: runId !== null,
    retry: false,
  });
  const usingMock = runId !== null && query.isError;
  const fallback = () => {
    if (runId === null) return undefined;
    const run = mockRunById(runId);
    const scenario = run ? mockScenarioById(run.scenarioId) : null;
    if (!scenario) return undefined;
    return deriveLeadtimeResponse(runId, scenario.params, mockRunProgressFraction(runId));
  };
  return {
    data: query.data ?? (usingMock ? fallback() : undefined),
    isLoading: runId !== null && query.isLoading && !usingMock,
    usingMock,
  };
}

/** 중단 — 시간대별 유입 vs 출고 선 + 자원 점유 선 */
export function useSimulationTimeline(runId: number | null) {
  const query = useQuery({
    queryKey: queryKeys.simulationTimeline(runId ?? -1),
    queryFn: () => simulation.timeline(runId as number),
    enabled: runId !== null,
    retry: false,
  });
  const usingMock = runId !== null && query.isError;
  const fallback = () => {
    if (runId === null) return undefined;
    const run = mockRunById(runId);
    const scenario = run ? mockScenarioById(run.scenarioId) : null;
    if (!scenario) return undefined;
    return deriveTimeline(runId, scenario.params, mockRunProgressFraction(runId));
  };
  return {
    data: query.data ?? (usingMock ? fallback() : undefined),
    isLoading: runId !== null && query.isLoading && !usingMock,
    usingMock,
  };
}

/** 병목 카드 — 구간·시간대·포화 자원 */
export function useSimulationBottleneck(runId: number | null) {
  const query = useQuery({
    queryKey: queryKeys.simulationBottleneck(runId ?? -1),
    queryFn: () => simulation.bottleneck(runId as number),
    enabled: runId !== null,
    retry: false,
  });
  const usingMock = runId !== null && query.isError;
  const fallback = () => {
    if (runId === null) return undefined;
    const run = mockRunById(runId);
    const scenario = run ? mockScenarioById(run.scenarioId) : null;
    if (!scenario) return undefined;
    return deriveBottleneck(scenario.params);
  };
  return {
    data: query.data ?? (usingMock ? fallback() : undefined),
    isLoading: runId !== null && query.isLoading && !usingMock,
    usingMock,
  };
}

/** 하단 — 실행 A·B 비교. 둘 다 골랐을 때만 조회한다 */
export function useSimulationCompare(runA: number | null, runB: number | null) {
  const enabled = runA !== null && runB !== null;
  const query = useQuery({
    queryKey: queryKeys.simulationCompare(runA ?? -1, runB ?? -1),
    queryFn: () => simulation.compare(runA as number, runB as number),
    enabled,
    retry: false,
  });
  const usingMock = enabled && query.isError;
  const fallback = () => {
    if (runA === null || runB === null) return undefined;
    const rA = mockRunById(runA);
    const rB = mockRunById(runB);
    const sA = rA ? mockScenarioById(rA.scenarioId) : null;
    const sB = rB ? mockScenarioById(rB.scenarioId) : null;
    if (!sA || !sB) return undefined;
    return deriveCompare(runA, sA.params, runB, sB.params);
  };
  return {
    data: query.data ?? (usingMock ? fallback() : undefined),
    isLoading: enabled && query.isLoading && !usingMock,
    usingMock,
  };
}
