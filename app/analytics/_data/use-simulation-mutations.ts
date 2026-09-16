"use client";

/**
 * 분석 화면 "시뮬레이션" 탭 뮤테이션 (Stage 11E, 정본 §16.3~16.5).
 *
 * 2026-09-15 백엔드가 라이브로 붙었다(백엔드 노트 `backend/docs/tasks/
 * 2026-09-15-stage11e-backend-notes.md` "프론트 계약") — `use-slotting-mutations.ts`
 * 가 11B 때 그랬듯, 처음 만들 때 쓰던 404(route-not-found) 낙관 폴백(`lib/mocks/
 * simulation.ts` 가변 상태를 직접 쓰던 임시 장치)은 걷어냈다. 이제는 실제 서버 응답만
 * 쓰고, `onSuccess` 로 관련 캐시를 갱신하는 평범한 뮤테이션 훅이다.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import {
  simulationRunId,
  type CreateSimulationScenarioRequest,
  type SimulationRun,
  type SimulationScenario,
  type StartSimulationRunRequest,
  type UpdateSimulationParamsRequest,
} from "@/lib/types";

/** 매개변수 편집 "저장" */
export function useUpdateSimulationParams(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSimulationParamsRequest) => simulation.updateParams(center, body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.simulationParams(center), data);
    },
  });
}

/** "새 시나리오" Dialog 저장 */
export function useCreateScenario(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSimulationScenarioRequest) => simulation.createScenario(body),
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.simulationScenarios(center),
        (old: SimulationScenario[] | undefined) => [...(old ?? []), data],
      );
    },
  });
}

/** "기본 시나리오 만들기" — 목록이 비었을 때(정본 §16.5 "시드가 만든다"를 라이브에서는
 * 이 호출이 대신한다, 2026-09-15 백엔드 노트) 4개(baseline·pickers+5·batch30·slotting)를
 * 한 번에 만든다. 멱등이라 두 번 눌러도 안전하다. */
export function useCreateDefaultScenarios(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => simulation.createDefaultScenarios(center),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.simulationScenarios(center), data);
    },
  });
}

/** "실행" 버튼 — 정본 §16.3 "비동기 1개만 동시 실행/센터", 202 */
export function useCreateRun(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StartSimulationRunRequest) => simulation.createRun(body),
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.simulationRuns({ center }),
        (old: SimulationRun[] | undefined) => [data, ...(old ?? [])],
      );
    },
  });
}

/** "정지" 버튼 */
export function useStopRun(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: number) => simulation.stopRun(runId),
    onSuccess: (data) => {
      const stoppedId = simulationRunId(data);
      queryClient.setQueryData(
        queryKeys.simulationRuns({ center }),
        (old: SimulationRun[] | undefined) => (old ?? []).map((r) => (simulationRunId(r) === stoppedId ? data : r)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationRunProgress(stoppedId) });
      // 정지 이전에 결과 패널이 이미 한 번 렌더링돼 낮은 진행률의 값을 들고 있으면,
      // 리드타임·타임라인은 폴링이 없어(정본 §16.4 "저장값 조회") 다시 부르지 않는 한
      // 그대로 멈춰 있는다 — 정지 직후 무효화해 멈춘 시점 값으로 다시 계산하게 한다.
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationLeadtime(stoppedId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationTimeline(stoppedId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationBottleneck(stoppedId) });
    },
  });
}
