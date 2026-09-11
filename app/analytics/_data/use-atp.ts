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
 * 금지선 일수 변경 — 성공하면 그 화주의 가용재고 표를 다시 읽는다(정본 §5.3, 금지선이
 * 바뀌면 ATP·금지선 제외 수량이 즉시 달라진다). 화주 목록(코드/이름/상태 탭)에는
 * `minShelfLifeDays` 를 안 보여주므로 그쪽은 무효화하지 않는다.
 */
export function useUpdateSeller() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: UpdateSellerRequest }) =>
      sellers.update(code, body),
    onSuccess: (_data, { code }) => {
      void queryClient.invalidateQueries({ queryKey: ["sellers", code, "atp"] });
    },
  });
}
