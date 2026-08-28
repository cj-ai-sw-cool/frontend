"use client";

/**
 * 라인 목록 — `GET /lines`. "라인별 배송 내역" 패널 위쪽 LINE 탭이 이 값을 그린다.
 *
 * 이름은 서버가 준 그대로 쓴다(화면에 박지 않는다) — `status` 가 `"ACTIVE"` 가 아닌 라인은
 * 목록에는 남기되 고를 수 없게 막는 것은 화면(`line-shipments-panel.tsx`) 몫이다.
 */

import { useQuery } from "@tanstack/react-query";
import { outbound, queryKeys } from "@/lib/endpoints";

export function useLines() {
  return useQuery({
    queryKey: queryKeys.lines,
    queryFn: () => outbound.lines(),
  });
}
