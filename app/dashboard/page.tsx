"use client";

import { Placeholder } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InboundSummaryCard } from "./_components/inbound-summary-card";
import { LineStatusTable } from "./_components/line-status-table";
import { useDashboardSummary } from "./_data/use-dashboard";

/**
 * 통합 대시보드 화면 — 프론트는 이번에 구현, 백엔드(API 구현)는 P3 담당 (docs/05-team-plan.md §2).
 * 기존 스캐폴드의 "P3 담당" 단독 표기는 부정확했다 — 이번 작업이 화면(mock 연동)까지 끝내고,
 * 남은 것은 `@/lib/endpoints` 의 `dashboard.summary` 실제 구현뿐이다.
 *
 * 레이아웃 (docs/01-mvp.md §3): 입고 현황 집계 + 라인별 처리량·진행 현황.
 * API: 2-1 `GET /dashboard/summary` — 계약 타입은 `@/lib/types` 의 `DashboardSummary`.
 * 상태 색상(ACTIVE/PAUSED)은 프론트가 `status` 로 결정한다(02 §2-1, enum 은 docs/03-erd.md
 * 193행). 색 분기는 이 화면이 아니라 `LineStatusTable` 안에 있다.
 *
 * ── 세로 예산 ───────────────────────────────────────────────
 * `<main>` 은 1445×940 `overflow-hidden` + `p-grid-gap`(12px) 이 이미 걸려 있어 이 화면이
 * 실제로 쓰는 자리는 **1421×916** 이고, 페이지 자체는 스크롤되지 않는다(inbound/packing과
 * 같은 전제 — 넘치면 스크롤이 아니라 잘린다).
 *   상단  입고 현황 카드 — 고정 높이(`shrink-0`), 두 통계가 나란히 들어갈 정도면 충분하다.
 *   하단  라인별 현황 표 — 남는 세로 전부(`min-h-0 flex-1`). 라인 수가 늘어도 표 안에서만
 *         스크롤한다(`LineStatusTable` 자체 구현).
 *
 * ── 이 화면만 진짜 TanStack Query 를 쓰는 이유 ─────────────
 * `inbound`/`packing` 은 폴링이 필요 없어 `useQuery` 모양만 흉내 낸 손수 구현을 쓰지만,
 * 대시보드는 5초 `refetchInterval` 폴링이 핵심 요구사항이라 처음부터 진짜 `useQuery`
 * (`_data/use-dashboard.ts`)를 쓴다. 실제 API 로 바꿀 때도 그 파일 한 곳만 고치면 된다.
 *
 * ── 이 파일의 역할: 컨테이너 ──────────────────────────────
 * 다른 두 화면과 같은 3층 구조다.
 *   `_data/use-dashboard.ts`  데이터를 가져온다 (지금은 mock 폴링 시뮬레이터, 나중에 실제 API)
 *   `_components/*`           받은 값을 그리기만 한다 (fetch 없음, props 만)
 *   `page.tsx` (이 파일)      둘을 이어 붙인다 — 이 화면은 화면 전용 상태가 없어 `packing`/
 *                             `inbound` 와 달리 이벤트 핸들러도 없다.
 */
export default function DashboardPage() {
  const { data } = useDashboardSummary();

  return (
    <div className="flex h-full flex-col gap-grid-gap">
      {/* 상단 — 입고 현황. 2-1 inbound({ todayConfirmed, pendingNew }) */}
      <div className="h-[140px] shrink-0">
        {data?.inbound === undefined ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <InboundSummaryCard inbound={data.inbound} />
        )}
      </div>

      {/* 하단 — 라인별 현황. 2-1 lines(라인/지역/처리량/진행 중 + 상태 배지) */}
      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle className="text-base">라인별 현황</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden">
          {data?.lines === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : data.lines.length === 0 ? (
            <Placeholder>표시할 라인이 없습니다</Placeholder>
          ) : (
            <LineStatusTable lines={data.lines} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
