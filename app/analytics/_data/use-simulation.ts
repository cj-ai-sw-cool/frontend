"use client";

/**
 * 분석 화면 "시뮬레이션" 탭 조회 훅 (Stage 11E, 정본 §16). 뮤테이션은
 * `use-simulation-mutations.ts` 로 따로 뺐다(파일 300줄 상한, `use-slotting.ts`/
 * `use-slotting-mutations.ts` 와 같은 이유).
 *
 * 2026-09-15 백엔드가 라이브로 붙었다(백엔드 노트 `backend/docs/tasks/
 * 2026-09-15-stage11e-backend-notes.md` "프론트 계약") — 처음 만들 때 쓰던 표본
 * 폴백(`lib/mocks/simulation.ts`)은 걷어냈다. 실패하면 다른 화면과 같은 관례로 로딩·에러
 * 상태를 그대로 보여준다(`use-waves.ts` 와 같은 순수 조회 훅 모양).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import type { SimulationRunStatus } from "@/lib/types";

/** 상단 띠 — 표준시간·압축 매개변수 */
export function useSimulationParams(center: string) {
  return useQuery({
    queryKey: queryKeys.simulationParams(center),
    queryFn: () => simulation.params(center),
  });
}

/** 시나리오 목록 — 이름·인원·배치·토트·슬로팅 적용(정본 §16.6 "이름·인원·배치·토트·
 * 슬로팅·최근 실행 상태"). 비어 있으면 화면이 "기본 시나리오 만들기" 버튼을 보여준다
 * (정본 §16.5 "시드가 만든다"를 라이브에서는 `POST …/defaults` 가 대신한다). */
export function useSimulationScenarios(center: string) {
  return useQuery({
    queryKey: queryKeys.simulationScenarios(center),
    queryFn: () => simulation.scenarios(center),
  });
}

const TERMINAL_STATUSES: SimulationRunStatus[] = ["DONE", "STOPPED", "FAILED"];

/** 센터의 실행 전체 — 시나리오 목록의 "최근 실행 상태" 칸과 하단 비교 Select 가 같이 쓴다
 * (N+1 없이 한 번만 조회). 반복 실행 중에는 3초마다 다시 받는다 — 백엔드 노트(2026-09-16)
 * §1.10 라이브 대조: `repeat`의 둘째 판부터는 앞 판이 끝난 뒤 **백엔드가 스스로** 만들어
 * (프론트가 다시 `createRun`을 부르지 않는다), 폴링 없이는 그 새 실행이 이 목록에 나타날
 * 방법이 없다 — 어떤 실행이든 아직 안 끝났으면 계속 돈다, 끝나면 멈춘다. */
export function useSimulationRuns(center: string, scenarioId?: number) {
  return useQuery({
    queryKey: queryKeys.simulationRuns({ center, scenarioId }),
    queryFn: () => simulation.runs({ center, scenarioId }),
    refetchInterval: (q) => {
      const runs = q.state.data;
      if (!runs || runs.some((r) => !TERMINAL_STATUSES.includes(r.status))) return 3000;
      return false;
    },
  });
}

/** 진행 띠 — 실행 중일 때만 2초 폴링(정본 §16.3 "진행" 문단). 끝난 실행은 한 번만 받고
 * 멈춘다 — `refetchInterval` 을 콜백으로 줘서 최신 `status` 를 보고 스스로 켜고 끈다. */
export function useSimulationRunProgress(runId: number | null) {
  return useQuery({
    queryKey: queryKeys.simulationRunProgress(runId ?? -1),
    queryFn: () => simulation.runProgress(runId as number),
    enabled: runId !== null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
}

/** 중단 — 리드타임 분해 누적 막대(구간 9개). 실행 종료 시 한 번 계산해 저장된 값(정본
 * §16.4 "집계는 실행 종료 시 한 번 계산"). */
export function useSimulationLeadtime(runId: number | null) {
  return useQuery({
    queryKey: queryKeys.simulationLeadtime(runId ?? -1),
    queryFn: () => simulation.leadtime(runId as number),
    enabled: runId !== null,
  });
}

/** 중단 — 시간대별 유입 vs 출고 선 + 자원 점유 선 */
export function useSimulationTimeline(runId: number | null) {
  return useQuery({
    queryKey: queryKeys.simulationTimeline(runId ?? -1),
    queryFn: () => simulation.timeline(runId as number),
    enabled: runId !== null,
  });
}

/** 병목 카드 — 구간·시간대·포화 자원 */
export function useSimulationBottleneck(runId: number | null) {
  return useQuery({
    queryKey: queryKeys.simulationBottleneck(runId ?? -1),
    queryFn: () => simulation.bottleneck(runId as number),
    enabled: runId !== null,
  });
}

/** 하단 — 실행 A·B 비교. 둘 다 골랐을 때만 조회한다 */
export function useSimulationCompare(runA: number | null, runB: number | null) {
  return useQuery({
    queryKey: queryKeys.simulationCompare(runA ?? -1, runB ?? -1),
    queryFn: () => simulation.compare(runA as number, runB as number),
    enabled: runA !== null && runB !== null,
  });
}
