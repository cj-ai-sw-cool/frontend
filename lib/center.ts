"use client";

/**
 * 센터 컨텍스트 — Stage 11D(정본 §12.8) "센터 컨텍스트(`useCenter()`): 경로의 `code`".
 *
 * 화면 셋(입고·포장·분석)은 전부 `/center/{code}/…` 아래에 있으므로, 어느 깊이의
 * 클라이언트 컴포넌트에서든 `useParams()` 로 그 세그먼트를 바로 읽을 수 있다 — page.tsx
 * 가 prop 으로 내려줄 필요가 없다(`app/center/[code]/inbound/page.tsx` 주석 참고).
 *
 * ⚠️ `/hub` 는 센터 축 밖의 독립 라우트라 `code` 세그먼트가 없다 — 이 훅을 거기서 부르면
 *    `DEFAULT_CENTER`(`C1`)로 떨어진다. 허브 창은 센터를 스스로 고르므로(주문·이동·ATP
 *    탭 모두 센터를 필터 값으로 받는다) 이 훅을 쓰지 않는다.
 */

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { hub, queryKeys } from "./endpoints";
import { mockCenters } from "./mocks/hub";
import type { CenterSummary } from "./types";

/** 백엔드 전환기 기본값과 같은 값(정본 §12.6 "없으면 `C1`") — 경로에 `code` 가 없을 때만 쓴다 */
export const DEFAULT_CENTER = "C1";

/**
 * 셸 상단 센터 선택 — `GET /hub/centers`(정본 §12.8). 백엔드가 `feat/stage11d-
 * multicenter`에서 같은 시각 작업 중이라(브리프 머리말) 이 시점엔 엔드포인트가 없을 수
 * 있다 — 실패하면 `lib/mocks/hub.ts` 표본 3곳으로 대신 채운다. 라이브 검증 대기.
 */
export function useHubCenters() {
  const query = useQuery<CenterSummary[]>({
    queryKey: queryKeys.hubCenters,
    queryFn: () => hub.centers(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockCenters : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

export function useCenter(): string {
  const params = useParams<{ code?: string }>();
  return params.code ?? DEFAULT_CENTER;
}

export type CenterScreen = "inbound" | "packing" | "analytics";

/** 같은 화면의 다른 센터 경로 — 셸 상단 센터 선택이 이동할 곳을 계산한다 */
export function centerPath(code: string, screen: CenterScreen): string {
  return `/center/${code}/${screen}`;
}
