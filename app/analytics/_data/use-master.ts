"use client";

/**
 * 마스터(화주·존·로케이션) 데이터 훅 — Stage 1.
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `master` 를 쓴다(컴포넌트에서 fetch 직접 호출 금지,
 * 다른 화면과 같은 규칙).
 *
 * 정본: backend/docs/02-system/02-data-model.md §1,
 * docs/tasks/2026-09-09-stage1-master-handoff.md §2·§3 S1.4c.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { master, queryKeys } from "@/lib/endpoints";
import type { LocationsQuery } from "@/lib/types";

/** 화주 목록 — 화주 탭의 표 */
export function useSellers() {
  return useQuery({
    queryKey: queryKeys.sellers,
    queryFn: () => master.sellers(),
  });
}

/**
 * 화주 등록 — 성공하면 목록을 다시 읽는다.
 * code 중복은 409 `CONFLICT` 로 온다(`lib/api.ts` 의 `ApiError.is("CONFLICT")` 로 분기).
 */
export function useCreateSeller() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: master.createSeller,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sellers });
    },
  });
}

/** 존 목록 — 로케이션 탭의 1단(존 목록)과 랙 수 계산의 근거 */
export function useZones() {
  return useQuery({
    queryKey: queryKeys.zones,
    queryFn: () => master.zones(),
  });
}

/**
 * 로케이션 목록 — 로케이션 탭의 3단(로케이션 표).
 * `params.zone` 이 없으면(아직 존을 못 골랐으면) 조회하지 않는다 — 3,888칸 전체를 한 번에
 * 받아 오는 사고를 막는다.
 */
export function useLocations(params: LocationsQuery) {
  return useQuery({
    queryKey: queryKeys.locations(params),
    queryFn: () => master.locations(params),
    enabled: params.zone !== undefined,
  });
}
