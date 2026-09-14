"use client";

/**
 * 분석 화면 "슬로팅" 탭 뮤테이션 (Stage 11B, 정본 §15.2·15.6·15.7).
 *
 * 2026-09-14 백엔드가 라이브로 붙었다(백엔드 노트 §3 "프론트 계약") — 처음 만들 때
 * 쓰던 404(route-not-found) 낙관 폴백(react-query 캐시를 직접 써서 제안 생성·적용·
 * 시뮬레이터·재평가를 흉내 내던 임시 장치)은 걷어냈다. 이제는 실제 서버 응답만 쓰고,
 * `onSuccess` 로 관련 캐시를 갱신하는 평범한 뮤테이션 훅이다(`use-waves.ts`와 같은 관례).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, relocations, slotting } from "@/lib/endpoints";
import type {
  ApplyProposalRequest,
  CompareProposalRequest,
  CompareProposalResponse,
  CreateProposalRequest,
  RelocationProposalDetail,
  SimulateRelocationRequest,
  UpdateSlottingParamsRequest,
} from "@/lib/types";

/** 매개변수 편집 Dialog "저장" */
export function useUpdateSlottingParams(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSlottingParamsRequest) => slotting.updateParams(center, body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.slottingParams(center), data);
    },
  });
}

/** "제안 생성" — DRAFT 1건(정본 §15.6) */
export function useCreateProposal(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProposalRequest) => slotting.createProposal(body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.slottingProposal(data.proposalId), data);
      queryClient.setQueryData(
        queryKeys.slottingProposals({ center, status: "DRAFT" }),
        (old: RelocationProposalDetail[] | undefined) => [data, ...(old ?? [])],
      );
    },
  });
}

/** "선택 적용" — 선택 항목을 seq 순으로 OPEN 으로(정본 §15.6). 비우면 그 제안 전부 */
export function useApplyProposal(proposalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyProposalRequest) => slotting.applyProposal(proposalId, body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.slottingProposal(proposalId), data);
    },
  });
}

/** "자동 처리" — 재배치 항목 하나를 작업자 시뮬레이터로 OPEN → DONE(웨이브 탭과 같은 관례) */
export function useSimulateRelocation(proposalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: number; body: SimulateRelocationRequest }) =>
      relocations.simulate(itemId, body),
    onSuccess: ({ item }, variables) => {
      queryClient.setQueryData(
        queryKeys.slottingProposal(proposalId),
        (current: RelocationProposalDetail | undefined) =>
          current
            ? {
                ...current,
                items: current.items.map((i) =>
                  i.itemId === item.itemId
                    ? { ...i, status: item.status, completedAt: item.completedAt, worker: variables.body.worker }
                    : i,
                ),
              }
            : current,
      );
    },
  });
}

/** "재평가" — after 가 전부 적용됐다고 가정한 재매핑으로 15.3 을 다시 돈다(정본 §15.7).
 * 결과는 서버가 제안 행(`beforeM`·`afterM`·…)에도 저장한다(라이브 대조) — 여기서는
 * 화면이 바로 읽는 두 캐시(제안 상세 + 비교 결과)를 같이 갱신한다. */
export function useCompareProposal(proposalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CompareProposalRequest) => slotting.compareProposal(proposalId, body),
    onSuccess: (data: CompareProposalResponse) => {
      queryClient.setQueryData(
        queryKeys.slottingProposal(proposalId),
        (current: RelocationProposalDetail | undefined) =>
          current
            ? {
                ...current,
                beforeM: data.before.distanceM,
                afterM: data.after.distanceM,
                beforeSec: data.before.timeSec,
                afterSec: data.after.timeSec,
              }
            : current,
      );
      queryClient.setQueryData(["slotting", "compare", proposalId], data);
    },
  });
}
