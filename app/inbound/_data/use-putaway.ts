"use client";

/**
 * 진열(directed putaway) 탭의 데이터 훅 (Stage 4, docs/02-system/02-data-model.md §4.5,
 * docs/tasks/2026-09-11-stage4-putaway-handoff.md §3 S4.3).
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `putaway` 만 쓴다(fetch 직접 호출 금지, 다른 데이터 훅과
 * 같은 규약). 백엔드가 이 화면과 동시에 만들어지는 중이라 — 계약(§4.5)대로 먼저 붙이고
 * 라이브 검증은 완료 보고에서 별도로 남긴다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { putaway, queryKeys } from "@/lib/endpoints";
import type {
  PutawayConfirmRequest,
  PutawayPendingQuery,
  PutawayRecommendRequest,
} from "@/lib/types";

/** 진열 대기 목록 — 좌측 열. 화주 필터가 바뀔 때마다 쿼리 키가 바뀌어 다시 불러온다 */
export function usePutawayPending(params?: PutawayPendingQuery) {
  return useQuery({
    queryKey: queryKeys.putawayPending(params),
    queryFn: () => putaway.pending(params),
  });
}

/**
 * 추천 — 행을 고르거나 "재추천"을 누를 때마다 새로 부른다.
 * 조회가 아니라 **행동**(추천을 계산해 달라는 요청)이라 `useBarcodeScan` 과 같은 이유로
 * mutation 으로 둔다 — 쿼리 캐시에 자동으로 붙지 않고, 호출 시점을 화면이 직접 정한다.
 */
export function usePutawayRecommend() {
  return useMutation({
    mutationFn: (body: PutawayRecommendRequest) => putaway.recommend(body),
  });
}

/**
 * 확정 — 성공하면 대기 목록(이 stockId 가 빠진다)과 재고 전반(재고 창 표 + 3D·2D 점유)을
 * 무효화한다. `["stock"]` 프리픽스 하나로 `queryKeys.stock`/`queryKeys.occupancy` 가 모두
 * 걸린다 — `useAdjustInventory`(analytics/_data/use-inventory.ts)와 같은 관례.
 *
 * 409 `PUTAWAY_REJECTED` 는 여기서 삼키지 않는다 — 화면이 `error.detail` 을
 * `PutawayRejectedDetail` 로 읽어 사유를 보여주고 재추천 버튼을 띄운다(§4.6).
 */
export function usePutawayConfirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: PutawayConfirmRequest) => putaway.confirm(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["putaway", "pending"] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
  });
}

/**
 * "다른 칸" 확인 — 코드를 입력하고 확인을 누를 때 한 번 부른다. 온디맨드 조회라 `useMeasure`
 * 와 같은 이유로 mutation 으로 둔다(입력마다 자동 조회하지 않는다 — 오타 중간값으로 404를
 * 반복해서 부르지 않으려면 명시적 트리거가 낫다).
 *
 * `stockId`/`qty` 를 함께 보낸다 — 백엔드가 그 조합으로 `acceptable`/`rejectReason`/`maxQty`
 * 를 계산해 준다(2026-09-11 라이브 보고, `lib/endpoints.ts` 의 `putaway.capacity` 참고).
 * 화면이 혼적·온도·규격 규칙을 다시 베끼지 않는다.
 */
export function useLocationCapacityCheck() {
  return useMutation({
    mutationFn: ({ locationCode, stockId, qty }: { locationCode: string; stockId: number; qty: number }) =>
      putaway.capacity(locationCode.trim().toUpperCase(), { stockId, qty }),
  });
}
