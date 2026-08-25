"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 입고 현황 요약 카드 — docs/02-api-spec.md §2-1 의 `inbound`({ todayConfirmed, pendingNew }).
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 로딩 상태는 부모(page.tsx)가 가른다.
 *
 * Stitch 샘플(localWork/stitch-sample.html 210~226행)은 "오늘 확정"/"신규 대기"를 카드 2개로
 * 나눴지만, 여기서는 카드 하나가 그 둘을 나란히 담는 구조로 만든다(사용자 결정 — 컴포넌트
 * 이름이 "카드" 단수형이다. 구조·비율만 참고했고 색 토큰은 이 앱 것을 쓴다).
 *
 * 큰 숫자는 이 앱의 관례대로 `text-measurement-xl`(32px·700 — app/inbound/_components/
 * measurement-panel.tsx 의 `MeasurementCell` 참고)을 쓰고, 라벨은 `text-label-sm` 이다.
 */
export function InboundSummaryCard({
  inbound,
}: {
  inbound: { todayConfirmed: number; pendingNew: number };
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">입고 현황</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 gap-grid-gap">
        <SummaryStat label="오늘 확정" value={inbound.todayConfirmed} />
        <SummaryStat label="신규 대기" value={inbound.pendingNew} />
      </CardContent>
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-label-sm text-muted-foreground">{label}</span>
      <div className="bg-accent flex h-full min-h-0 flex-1 items-center justify-end border-2 px-panel-padding">
        <span className="text-measurement-xl tabular-nums">{value}</span>
      </div>
    </div>
  );
}
