"use client";

/**
 * 대기 중인 주문 한 묶음 투입 (`POST /admin/demo/orders/next`).
 *
 * 시연을 리셋하면 상품과 토트는 준비되지만 주문은 대기열에만 쌓인다. 이 호출이 한 묶음을
 * 풀어 주문과 배송단위를 만든다. 더 풀 것이 없으면 서버가 204 를 주므로 결과가 `null` 이다 —
 * 에러가 아니라 "더 넣을 게 없다"이다. `use-next-tote.ts` 와 같은 모양이다.
 *
 * 투입하면 라인별 배송 내역이 달라지므로 그 조회를 다시 읽게 한다.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { demo, queryKeys } from "@/lib/endpoints";
import type { DemoReleasedOrders } from "@/lib/types";

export function useReleaseOrders() {
  const queryClient = useQueryClient();

  return useMutation<DemoReleasedOrders | null, Error, void>({
    mutationFn: () => demo.releaseOrders(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lines });
    },
  });
}
