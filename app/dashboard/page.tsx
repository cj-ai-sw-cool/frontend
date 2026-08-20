import { PageHeader, Placeholder } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 통합 대시보드 화면 — P3 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃 (docs/01-mvp.md §3): 라인별 처리량·진행 현황, 입고 현황 집계
 * API: 2-1 `GET /dashboard/summary` — 래퍼는 `@/lib/endpoints` 의 `dashboard`.
 * 상태 색상은 프론트가 `status` 로 결정한다 (docs 02 §2-1).
 * 폴링·캐시 무효화는 TanStack Query 로 (D-08).
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="통합 대시보드"
        description="라인별 처리량·진행 현황, 입고 현황 집계"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">라인별 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {/* TODO(P3): summary.lines — packedCount(처리량) / inProgressCount, status 색상 */}
            <Placeholder>라인 3개 처리량·진행 현황 (2-1)</Placeholder>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">입고 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {/* TODO(P3): summary.inbound — todayConfirmed / pendingNew */}
            <Placeholder>오늘 확정 · 신규 대기 (2-1)</Placeholder>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
