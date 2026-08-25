"use client";

/**
 * 🔌 API 교체 지점 — 이 파일은 이미 진짜 TanStack Query 모양이라 다른 두 화면보다 교체가
 * 훨씬 간단하다.
 *
 * `inbound`/`packing` 의 `_data/use-*.ts` 는 `useQuery`/`useMutation` 을 모양만 똑같이
 * 흉내 낸 손수 구현(`useMockQuery`/`useMockMutation`)을 쓴다 — 두 화면 다 폴링이 필요 없어서
 * 굳이 진짜 라이브러리를 안 썼을 뿐이다. 대시보드는 `refetchInterval` 폴링이 핵심
 * 요구사항이라 처음부터 진짜 `useQuery` 를 쓴다(`app/providers.tsx` 에 `QueryClientProvider`
 * 가 이미 걸려 있다). 그래서 실제 API 로 바꿀 때 아래 `queryFn` 한 줄만 고치면 끝난다:
 *
 *   queryFn: () => dashboard.summary()   // @/lib/endpoints 의 dashboard.summary
 *
 * 그 다음 이 파일의 mock 생성 로직(`nextDashboardSummary` 호출 + setTimeout 지연)만 지우면
 * 되고, `../_mock/dashboard.ts` 는 이 파일에서만 참조하므로 함께 지우면 된다.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/endpoints";
import type { DashboardSummary } from "@/lib/types";
import { nextDashboardSummary } from "../_mock/dashboard";

/** mock 응답 지연(ms) — 로딩 상태가 화면에서 실제로 보이도록 조금 늦춘다 */
const MOCK_LATENCY_MS = 300;

/**
 * 2-1 `GET /dashboard/summary`.
 *
 * `refetchInterval: 5_000` — 5초마다 다시 조회한다.
 *
 * ⚠️ 반환값의 `isLoading` 은 TanStack Query 정의상 "최초 1회만 true"(= `isPending &&
 *    isFetching`)라서 그대로 초기 로딩 판정에 쓴다. 폴링으로 재조회될 때마다 true 가 되는
 *    `isFetching` 은 이 화면에서 쓰지 않는다 — 그걸 쓰면 5초마다 화면이 깜빡여 "실시간
 *    갱신"이 아니라 "매번 리로드"처럼 보인다. `page.tsx` 는 `data === undefined` 로 초기
 *    로딩 여부를 가른다(어차피 `inbound`/`lines` 둘 다 필수 필드라 `isLoading` 과 동치다).
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: () =>
      new Promise<DashboardSummary>((resolve) => {
        setTimeout(() => resolve(nextDashboardSummary()), MOCK_LATENCY_MS);
      }),
    refetchInterval: 5_000,
  });
}
