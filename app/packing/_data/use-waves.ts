"use client";

/**
 * 포장 화면 "웨이브" 탭 + "주문 투입" 대화 상자의 데이터 훅 (Stage 6,
 * docs/02-system/02-data-model.md §6.5, docs/tasks/2026-09-11-stage6-wave-hard-handoff.md
 * §3 S6.5).
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `waves`/`pickBatches` 만 쓴다(fetch 직접 호출 금지,
 * 다른 데이터 훅과 같은 규약). 백엔드가 이 화면과 동시에 만들어지는 중이라 — 계약(§6.5)대로
 * 먼저 붙이고 라이브 검증은 완료 보고에서 별도로 남긴다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { picking, pickBatches, queryKeys, waves } from "@/lib/endpoints";
import type { SimulateRequest, WaveCreateRequest, WavesQuery } from "@/lib/types";

/** 웨이브 목록 — 좌측 열. 상태 필터가 바뀔 때마다 쿼리 키가 바뀌어 다시 불러온다 */
export function useWavesList(params?: WavesQuery) {
  return useQuery({
    queryKey: queryKeys.waves(params),
    queryFn: () => waves.list(params),
  });
}

/** 웨이브 상세 — 목록에서 행을 골랐을 때만 조회한다 */
export function useWaveDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.wave(id ?? -1),
    queryFn: () => waves.get(id as number),
    enabled: id !== null,
  });
}

/** 배치 상세(피킹 지시 표) — 웨이브 상세에서 배치를 클릭했을 때만 조회한다 */
export function usePickBatchDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.pickBatch(id ?? -1),
    queryFn: () => pickBatches.get(id as number),
    enabled: id !== null,
  });
}

/**
 * 웨이브 생성 — "주문 투입" 버튼. 성공하면 ALLOCATED 였던 주문이 WAVED 로 바뀌므로
 * 주문 목록·상세·웨이브 목록을 모두 무효화한다(주문 탭·웨이브 탭이 최신 상태를 보게).
 */
export function useCreateWave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: WaveCreateRequest) => waves.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["waves"] });
    },
  });
}

/**
 * 작업자 시뮬레이터 — 웨이브 탭 OPEN 배치의 "자동 처리" 대화 상자(정본 §7.5, 브리프 §3
 * S7.6). 성공하면 배치·웨이브 상태가 바뀌고(웨이브 DONE 가능) 주문도 REBINNING/CANCELLED
 * 로 넘어가므로 배치·웨이브·주문 캐시를 전부 무효화한다.
 */
export function useSimulateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SimulateRequest }) => picking.simulate(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["waves"] });
      void queryClient.invalidateQueries({ queryKey: ["pick-batches"] });
    },
  });
}
