"use client";

/**
 * 화주 가용재고(ATP) 데이터 훅 — Stage 5, docs/02-system/02-data-model.md §5.7,
 * docs/tasks/2026-09-11-stage5-orders-allocation-handoff.md §3 S5.4.
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `sellers` 를 쓴다(컴포넌트에서 fetch 직접 호출 금지,
 * `use-master.ts` 와 같은 규약). 백엔드가 이 화면과 동시에 만들어지는 중이라 — 계약(§5.7)
 * 대로 먼저 붙이고 라이브 검증은 완료 보고에서 별도로 남긴다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, sellers } from "@/lib/endpoints";
import type { UpdateSellerRequest } from "@/lib/types";

/** 화주 전 SKU 가용재고 표 — `code` 가 없으면(화주를 아직 안 골랐으면) 조회하지 않는다 */
export function useSellerAtp(code: string | null, params?: { page?: number; size?: number }) {
  return useQuery({
    queryKey: queryKeys.sellerAtp(code ?? "", params),
    queryFn: () => sellers.atp(code as string, params),
    enabled: code !== null && code !== "",
  });
}

/**
 * 금지선 일수 변경 — 성공하면 `["sellers"]` 프리픽스 전체를 무효화한다(가용재고 표 +
 * 화주 목록 둘 다). ⚠️ 화주 목록(`queryKeys.sellers`, `use-master.ts`)도 반드시 같이
 * 무효화해야 한다 — 이 탭이 그 목록을 `useSellers()` 로 읽어 `selectedSeller.
 * minShelfLifeDays` 를 저장 버튼의 "바뀐 값인가" 판정에 쓰는데(`atp-tab.tsx`), 목록이
 * 안 갱신되면 그 판정 기준이 낡은 값에 묶여 **한 번 저장한 뒤 원래 값으로 되돌리는
 * 저장이 막힌다**(버튼이 "안 바뀜"으로 오판해 disabled 로 남는다) — 실제로 화면 체크
 * 5번(400 → 7 복귀)에서 이 증상으로 걸렸다.
 */
export function useUpdateSeller() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: UpdateSellerRequest }) =>
      sellers.update(code, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sellers"] });
    },
  });
}
