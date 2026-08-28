"use client";

/**
 * 다음 시연 토트 발급 (`POST /admin/demo/outbound/next-tote?lineId=`).
 *
 * 시연장에 스캐너가 없어 화면의 버튼이 이 API 로 토트 바코드를 받아 스캔 칸을 채운다.
 * 그 라인에 포장할 게 남지 않으면 서버가 204 를 주므로 결과가 `null` 이다 —
 * 에러가 아니라 "더 줄 게 없다"이다. `app/inbound-win98/_data/use-inbound.ts` 의
 * `useNextDemoBarcode` 와 같은 이유·같은 모양이다.
 */

import { useMutation } from "@tanstack/react-query";
import { demo } from "@/lib/endpoints";
import type { DemoNextTote } from "@/lib/types";

export function useNextTote() {
  return useMutation<DemoNextTote | null, Error, number>({
    mutationFn: (lineId) => demo.nextTote(lineId),
  });
}
