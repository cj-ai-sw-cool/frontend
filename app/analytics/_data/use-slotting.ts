"use client";

/**
 * 분석 화면 "슬로팅" 탭 조회 훅 (Stage 11B, 정본 §15). 뮤테이션은 `use-slotting-mutations.ts`
 * 로 따로 뺐다(파일 300줄 상한, `wave-batch-simulate-dialog.tsx`가 `simulate-form.tsx` 를
 * 떼어낸 것과 같은 이유).
 *
 * 백엔드가 같은 시각 `feat/stage11b-slotting`에서 작업 중이라 2026-09-14 curl 확인
 * 시점엔 404다 — `webhookAdmin`의 `usingMock` 관례를 그대로 쓴다: `retry: false` 로 조회
 * 실패를 빠르게 확정하고, 실패했을 때만 `lib/mocks/slotting.ts` 표본으로 대신 그린다.
 * 라이브 검증 대기.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys, slotting } from "@/lib/endpoints";
import {
  mockEvaluate,
  mockGoldenZone,
  mockHeatmap,
  mockSlottingParams,
  mockVelocity,
} from "@/lib/mocks/slotting";
import type { CompareProposalResponse, SlottingEvaluateRequest } from "@/lib/types";

/** 상단 띠 — 매개변수 요약 */
export function useSlottingParams(center: string) {
  const query = useQuery({
    queryKey: queryKeys.slottingParams(center),
    queryFn: () => slotting.params(center),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockSlottingParams : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 등급 분포 — A/B/C 상품 수·라인 비율(중단 좌 아래) */
export function useVelocity(center: string, days?: number) {
  const params = { center, days };
  const query = useQuery({
    queryKey: queryKeys.slottingVelocity(params),
    queryFn: () => slotting.velocity(params),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockVelocity : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 2D 히트맵 색 — 베이별 PICK 라인 수 */
export function useHeatmap(center: string, days?: number) {
  const params = { center, days };
  const query = useQuery({
    queryKey: queryKeys.slottingHeatmap(params),
    queryFn: () => slotting.heatmap(params),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockHeatmap : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 골든존 테두리 토글 — 켰을 때만 조회한다(계산 비용을 아낀다는 뜻에서 `enabled`) */
export function useGoldenZone(center: string, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.slottingGoldenZone(center),
    queryFn: () => slotting.goldenZone(center),
    enabled,
    retry: false,
  });
  const usingMock = enabled && query.isError;
  return {
    data: query.data ?? (usingMock ? mockGoldenZone : undefined),
    isLoading: enabled && query.isLoading && !usingMock,
    usingMock,
  };
}

/** 제안이 아직 없을 때의 "현재" 평가 — 중단 좌 막대의 전(before)만 채운다(브리프 §1 "제안
 * 없으면 evaluate만 현재"). 최근 웨이브 N개를 그대로 evaluate 에 넘긴다. */
export function useEvaluate(request: SlottingEvaluateRequest | null) {
  const query = useQuery({
    queryKey: queryKeys.slottingEvaluate(request ?? { center: "" }),
    queryFn: () => slotting.evaluate(request as SlottingEvaluateRequest),
    enabled: request !== null,
    retry: false,
  });
  const usingMock = request !== null && query.isError;
  return {
    data: query.data ?? (usingMock ? mockEvaluate : undefined),
    isLoading: request !== null && query.isLoading && !usingMock,
    usingMock,
  };
}

/** 제안 목록 — DRAFT 1건만 다루는 화면이라 상세까지 포함한 배열을 그대로 쓴다(N+1 없이) */
export function useProposals(center: string) {
  const query = useQuery({
    queryKey: queryKeys.slottingProposals({ center, status: "DRAFT" }),
    queryFn: () => slotting.proposals({ center, status: "DRAFT" }),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    // 실패했을 때는 표본을 보여주지 않는다 — "제안 생성" 버튼을 눌러야 생기는 것이 자연스러운
    // 흐름이라(브리프 §1 순서), 목록 표본을 미리 채우면 처음 진입부터 없는 제안이 보인다.
    // 생성·적용은 `use-slotting-mutations.ts` 가 react-query 캐시에 직접 써 넣는다.
    data: query.data ?? (usingMock ? [] : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 제안 상세(항목 포함) — "제안 생성"이 캐시에 써 넣은 값을 그대로 보여준다. 이 조회
 * 자체가 404 로 실패해도 캐시 값은 지워지지 않는다(react-query 는 에러 시 이전 `data`
 * 를 유지한다) — 그래서 낙관 생성 뒤에도 표가 계속 보인다. */
export function useProposalDetail(id: number | null) {
  const query = useQuery({
    queryKey: queryKeys.slottingProposal(id ?? -1),
    queryFn: () => slotting.proposal(id as number),
    enabled: id !== null,
    retry: false,
  });
  return query.data ?? null;
}

/** "재평가"(`useCompareProposal`)가 캐시에 써 넣은 결과를 읽기만 한다 — 조회를 직접
 * 돌리지 않는다(`enabled: false`), 그래도 그 캐시 키가 바뀌면 리렌더한다. */
export function useCompareResult(proposalId: number | null) {
  const query = useQuery<CompareProposalResponse>({
    queryKey: ["slotting", "compare", proposalId ?? -1],
    queryFn: () => Promise.reject(new Error("재평가를 먼저 눌러야 합니다")),
    enabled: false,
    retry: false,
  });
  return query.data ?? null;
}
