"use client";

/**
 * 분석 화면 "슬로팅" 탭 뮤테이션 (Stage 11B, 정본 §15.2·15.6·15.7).
 *
 * 백엔드가 같은 시각 작업 중이라 2026-09-14 시점엔 이 API들이 전부 404 다. 조회
 * (`use-slotting.ts`)는 실패하면 정적 표본으로 대신 그리지만, 뮤테이션은 "제안 생성 →
 * 목록 → 적용 → 자동 처리 → 재평가"가 화면 체크(브리프 §3)의 핵심 흐름이라 정적 표본
 * 하나로는 흉내 낼 수 없다 — 그래서 여기서만 **route-not-found(404) 에 한해** react-query
 * 캐시를 직접 써서 그 흐름을 재현한다(과거 `use-webhooks.ts` 의 `isRouteMissing` 낙관
 * 폴백과 같은 임시 장치, 라이브 확인 뒤 걷어낸다 — 노트 "라이브 정정 대기").
 * ⚠️ 404 가 아닌 다른 실패(검증 오류·409 등)는 그대로 던져 화면이 에러를 보여준다 —
 * 백엔드가 붙은 뒤에는 이 파일의 낙관 분기가 자연히 타지 않게 된다.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { queryKeys, relocations, slotting } from "@/lib/endpoints";
import { mockCompare, mockProposal } from "@/lib/mocks/slotting";
import type {
  ApplyProposalRequest,
  CompareProposalRequest,
  CompareProposalResponse,
  CreateProposalRequest,
  RelocationProposalDetail,
  SimulateRelocationRequest,
  SlottingParams,
} from "@/lib/types";

/** 라우트가 아직 없을 때(404 `ROUTE_NOT_FOUND`)만 참 — 그 밖의 에러(검증 실패 등)는
 * 구분해서 그대로 던진다. */
function isRouteMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

let mockProposalSeq = 1;

/** 매개변수 편집 Dialog "저장" */
export function useUpdateSlottingParams(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SlottingParams) => {
      try {
        return await slotting.updateParams(center, body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        return body;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.slottingParams(center), data);
    },
  });
}

/** "제안 생성" — DRAFT 1건(정본 §15.6). 낙관 폴백은 표본 12항목을 그대로 새 id 로 찍어낸다 */
export function useCreateProposal(center: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProposalRequest) => {
      try {
        return await slotting.createProposal(body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        return mockProposal(1000 + mockProposalSeq++);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.slottingProposal(data.id), data);
      queryClient.setQueryData(
        queryKeys.slottingProposals({ center, status: "DRAFT" }),
        (old: RelocationProposalDetail[] | undefined) => [data, ...(old ?? [])],
      );
    },
  });
}

/** "선택 적용" — 선택 항목을 seq 순으로 OPEN 으로(정본 §15.6) */
export function useApplyProposal(proposalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ApplyProposalRequest) => {
      try {
        return await slotting.applyProposal(proposalId, body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const current = queryClient.getQueryData<RelocationProposalDetail>(
          queryKeys.slottingProposal(proposalId),
        );
        if (!current) throw error;
        const applied: RelocationProposalDetail = {
          ...current,
          items: current.items.map((item) =>
            body.itemIds.includes(item.id) ? { ...item, status: "OPEN" as const } : item,
          ),
        };
        return applied;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.slottingProposal(proposalId), data);
    },
  });
}

/** "자동 처리" — 재배치 항목 하나를 작업자 시뮬레이터로 OPEN → DONE(웨이브 탭과 같은 관례) */
export function useSimulateRelocation(proposalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, body }: { itemId: number; body: SimulateRelocationRequest }) => {
      try {
        return await relocations.simulate(itemId, body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const current = queryClient.getQueryData<RelocationProposalDetail>(
          queryKeys.slottingProposal(proposalId),
        );
        const item = current?.items.find((i) => i.id === itemId);
        if (!current || !item) throw error;
        const now = new Date().toISOString();
        return {
          item: { ...item, status: "DONE" as const, workerId: body.worker, startedAt: now, completedAt: now },
        };
      }
    },
    onSuccess: ({ item }) => {
      queryClient.setQueryData(
        queryKeys.slottingProposal(proposalId),
        (current: RelocationProposalDetail | undefined) =>
          current
            ? { ...current, items: current.items.map((i) => (i.id === item.id ? item : i)) }
            : current,
      );
    },
  });
}

/** "재평가" — after 가 전부 적용됐다고 가정한 재매핑으로 15.3 을 다시 돈다(정본 §15.7) */
export function useCompareProposal(proposalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CompareProposalRequest) => {
      try {
        return await slotting.compareProposal(proposalId, body);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        return mockCompare;
      }
    },
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
