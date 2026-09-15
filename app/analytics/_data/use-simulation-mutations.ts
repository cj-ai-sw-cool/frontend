"use client";

/**
 * 분석 화면 "시뮬레이션" 탭 뮤테이션 (Stage 11E, 정본 §16.3~16.5).
 *
 * 백엔드가 같은 브랜치에서 동시 작업 중이라 2026-09-15 시점엔 이 API들이 전부 404다.
 * "시나리오 생성 → 실행 → 정지"가 화면 체크(브리프 §2)의 핵심 흐름이라 정적 표본
 * 하나로는 흉내 낼 수 없다 — `use-slotting-mutations.ts`(11B, 백엔드 붙기 전)와 같이
 * **route-not-found(404) 에 한해** `lib/mocks/simulation.ts` 의 가변 상태를 직접 써서
 * 그 흐름을 재현한다(라이브 확인 뒤 걷어낸다).
 * ⚠️ 404 가 아닌 다른 실패는 그대로 던져 화면이 에러를 보여준다.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { queryKeys, simulation } from "@/lib/endpoints";
import {
  mockCreateRun,
  mockCreateScenario,
  mockListRuns,
  mockListScenarios,
  mockScenarioById,
  mockStopRun,
} from "@/lib/mocks/simulation";
import type {
  CreateSimulationScenarioRequest,
  SimulationScenario,
  StartSimulationRunRequest,
  UpdateSimulationParamsRequest,
} from "@/lib/types";

/** 라우트가 아직 없을 때(404 `ROUTE_NOT_FOUND`)만 참 — 그 밖의 에러는 그대로 던진다 */
function isRouteMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** 매개변수 편집 "저장" */
export function useUpdateSimulationParams(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateSimulationParamsRequest) => {
      try {
        return await simulation.updateParams(center, body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const current = queryClient.getQueryData(queryKeys.simulationParams(center));
        return { ...(current as object), ...body, center } as Awaited<ReturnType<typeof simulation.params>>;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.simulationParams(center), data);
    },
  });
}

/** "새 시나리오" Dialog 저장 */
export function useCreateScenario(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSimulationScenarioRequest) => {
      try {
        return await simulation.createScenario(body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        return mockCreateScenario(body);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.simulationScenarios(center),
        (old: SimulationScenario[] | undefined) => {
          const base = old ?? mockListScenarios(center);
          // `mockCreateScenario` 가 공유 모듈 배열(`createdScenarios`)에 먼저 써 넣으므로
          // `old` 가 없어서 방금 `mockListScenarios` 로 다시 읽으면 새 항목이 이미 들어
          // 있다 — 그 위에 `data` 를 또 붙이면 같은 id 가 두 번 생겨 목록에 행이 겹친다
          // (2026-09-15 화면 체크 "Encountered two children with the same key" 발견).
          return base.some((s) => s.id === data.id) ? base : [...base, data];
        },
      );
    },
  });
}

/** "실행" 버튼 — 정본 §16.3 "비동기 1개만 동시 실행/센터", 202 */
export function useCreateRun(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StartSimulationRunRequest) => {
      try {
        return await simulation.createRun(body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        // `mockScenarioById` 가 시드 4개뿐 아니라 방금 "새 시나리오"로 만든 것도 찾는다
        // (같은 모듈의 `createdScenarios` — 여기서 따로 들고 있으면 둘이 어긋난다).
        const scenario = mockScenarioById(body.scenarioId);
        if (!scenario) throw error;
        return mockCreateRun(scenario);
      }
    },
    onSuccess: (data) => {
      // `old` 가 비어 있으면(이 쿼리가 아직 한 번도 성공한 적 없는 404 상태) 시드 실행
      // 3건(`mockListRuns`)부터 채운다 — 안 그러면 새 실행 하나로 캐시가 통째로 바뀌어
      // 다른 시나리오의 "최근 실행" 칸이 전부 "실행 없음"으로 보이는 사고가 난다
      // (2026-09-15 화면 체크에서 발견). `mockCreateRun` 이 공유 배열에 먼저 써 넣으므로
      // `mockListRuns` 가 이미 새 실행을 포함할 수 있다 — id 로 중복을 걸러야 같은 실행이
      // 행 두 개로 겹치지 않는다(시나리오 목록과 같은 결함, 위 주석 참고).
      queryClient.setQueryData(
        queryKeys.simulationRuns({ center }),
        (old: Awaited<ReturnType<typeof simulation.runs>> | undefined) => {
          const base = old ?? mockListRuns(center);
          return base.some((r) => r.id === data.id) ? base : [data, ...base];
        },
      );
    },
  });
}

/** "정지" 버튼 */
export function useStopRun(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: number) => {
      try {
        return await simulation.stopRun(runId);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const stopped = mockStopRun(runId);
        if (!stopped) throw error;
        return stopped;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.simulationRuns({ center }),
        (old: Awaited<ReturnType<typeof simulation.runs>> | undefined) =>
          (old ?? mockListRuns(center)).map((r) => (r.id === data.id ? data : r)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationRunProgress(data.id) });
      // 결과 패널이 정지 이전에 이미 한 번 렌더링돼 있으면(진행률이 낮을 때의 표본 폴백
      // 값을 들고 있으면) 다시 부르지 않는 한 그대로 멈춰 있다 — 리드타임·타임라인은
      // 폴링이 없어(정본 §16.4 "저장값 조회") 아무것도 다시 그 쿼리를 건드리지 않는다.
      // 정지 직후 무효화해 멈춘 시점의 진행률로 다시 계산하게 한다(2026-09-15 화면
      // 체크 — "주문 3,900건"이 진행 띠의 "진행 52%·유입 7,800"과 어긋나던 결함).
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationLeadtime(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationTimeline(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.simulationBottleneck(data.id) });
    },
  });
}
