"use client";

/**
 * 분석 화면 "슬로팅" 탭 조회 훅 (Stage 11B, 정본 §15). 뮤테이션은 `use-slotting-mutations.ts`
 * 로 따로 뺐다(파일 300줄 상한, `wave-batch-simulate-dialog.tsx`가 `simulate-form.tsx` 를
 * 떼어낸 것과 같은 이유).
 *
 * 2026-09-14 백엔드가 라이브로 붙었다(백엔드 노트 `backend/docs/tasks/
 * 2026-09-14-stage11b-backend-notes.md` §3 "프론트 계약") — 처음 만들 때 쓰던 표본
 * 폴백(`lib/mocks/slotting.ts`)은 걷어냈다. 실패하면 다른 화면과 같은 관례로 로딩·에러
 * 상태를 그대로 보여준다(`use-waves.ts`와 같은 순수 조회 훅 모양).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys, slotting } from "@/lib/endpoints";
import type { CompareProposalResponse, SlottingEvaluateRequest } from "@/lib/types";

/** 상단 띠 — 매개변수 요약 */
export function useSlottingParams(center: string) {
  return useQuery({
    queryKey: queryKeys.slottingParams(center),
    queryFn: () => slotting.params(center),
  });
}

/** 등급 분포 — A/B/C 상품 수·라인 비율(중단 좌 아래). `{distribution, rows}` — 등급 집계는
 * `distribution` 을 그대로 쓴다(`rows` 를 순회해 다시 셀 필요가 없다, 라이브 대조) */
export function useVelocity(center: string, days?: number, limit?: number) {
  const params = { center, days, limit };
  return useQuery({
    queryKey: queryKeys.slottingVelocity(params),
    queryFn: () => slotting.velocity(params),
  });
}

/** 2D 히트맵 색 — 베이별 PICK 라인 수, `{maxLines, bays}` */
export function useHeatmap(center: string, days?: number) {
  const params = { center, days };
  return useQuery({
    queryKey: queryKeys.slottingHeatmap(params),
    queryFn: () => slotting.heatmap(params),
  });
}

/** 골든존 테두리 토글 — 켰을 때만 조회한다(계산 비용을 아낀다는 뜻에서 `enabled`) */
export function useGoldenZone(center: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.slottingGoldenZone(center),
    queryFn: () => slotting.goldenZone(center),
    enabled,
  });
}

/** 제안이 아직 없을 때의 "현재" 평가 — 중단 좌 막대의 전(before)만 채운다(브리프 §1 "제안
 * 없으면 evaluate만 현재"). `waveIds`·`batchIds` 를 비우면 서버가 최근 웨이브 20개를
 * 고정으로 쓴다(백엔드 노트 §1.14) — "평가 대상" Select 는 그래서 지금 화면 표시용일 뿐
 * 요청에 반영되지 않는다(개수를 고르는 매개변수가 없다, `slotting-tab.tsx` 참고). */
export function useEvaluate(request: SlottingEvaluateRequest | null) {
  return useQuery({
    queryKey: queryKeys.slottingEvaluate(request ?? { center: "" }),
    queryFn: () => slotting.evaluate(request as SlottingEvaluateRequest),
    enabled: request !== null,
  });
}

/** 제안 목록 — DRAFT 1건만 다루는 화면이라 상세까지 포함한 배열을 그대로 쓴다(N+1 없이).
 * 목록 자체는 `items`·`skipped` 가 빈 배열로 온다(라이브 대조) — 상세는 `useProposalDetail`. */
export function useProposals(center: string) {
  return useQuery({
    queryKey: queryKeys.slottingProposals({ center, status: "DRAFT" }),
    queryFn: () => slotting.proposals({ center, status: "DRAFT" }),
  });
}

/** 제안 상세(항목 포함) — "제안 생성"이 캐시에 써 넣은 값을 그대로 보여준다. 실패해도
 * react-query 가 이전 `data` 를 유지하므로 생성 직후 표가 계속 보인다. */
export function useProposalDetail(id: number | null) {
  const query = useQuery({
    queryKey: queryKeys.slottingProposal(id ?? -1),
    queryFn: () => slotting.proposal(id as number),
    enabled: id !== null,
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
