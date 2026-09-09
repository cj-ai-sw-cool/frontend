"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LineSummary } from "@/lib/types";

/**
 * 라인별 처리량·진행 현황 표 — docs/01-mvp.md §3, docs/02-api-spec.md §2-1 의 `lines`.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 로딩 상태는 부모(page.tsx)가 가른다
 * (packing 의 `_components/order-detail-panel.tsx` 와 같은 방식 — 이 컴포넌트는 부모 높이를
 * 100%(`h-full`) 물려받아 그 안에서만 스크롤한다).
 *
 * 열 구성(라인 / 지역 / 처리량 우측 정렬 / 진행 중 가운데 정렬)은 Stitch 샘플
 * (localWork/stitch-sample.html 230~266행)의 4열을 따르되, 샘플에는 없던 상태 배지를
 * 라인 이름 옆에 끼워 넣는다 — status 는 계약(02 §2-1)에만 있는 값이다.
 *
 * 상태 배지 — 계약 "상태 색상은 프론트가 status 로 결정한다"(02 §2-1), status 는
 * ACTIVE|PAUSED 두 값뿐(03-erd.md 193행, "대시보드 상태 색상"이라고 명시).
 *   ACTIVE  Badge variant="default" (bg-primary — 강조 톤)
 *   PAUSED  Badge variant="outline" (테두리만 — 차분한 톤)
 * 색은 전부 시맨틱 토큰(components/ui/badge.tsx 의 variant)이고 하드코딩하지 않는다.
 */
export function LineStatusTable({ lines }: { lines: LineSummary[] }) {
  return (
    <div className="flex h-full flex-col">
      {/* 라인 수는 늘어날 수 있다. 고정 스테이지에서는 넘치면 잘리므로 표만 스크롤한다.
          헤더는 sticky 로 고정해 스크롤해도 밀려나지 않는다. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[38%]">라인</TableHead>
              <TableHead className="w-[22%]">지역</TableHead>
              <TableHead className="w-[20%] text-right">처리량</TableHead>
              <TableHead className="w-[20%] text-center">진행 중</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.lineId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold">{line.name}</span>
                    <LineStatusBadge status={line.status} />
                  </div>
                </TableCell>
                <TableCell className="text-base text-muted-foreground">
                  {line.regionCode}
                </TableCell>
                <TableCell className="text-right text-2xl leading-none font-bold tabular-nums">
                  {line.packedCount}
                </TableCell>
                <TableCell className="text-center text-2xl leading-none font-bold tabular-nums">
                  {line.inProgressCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * status 값 2종(ACTIVE|PAUSED)만 다루는 배지. 계약 밖의 값이 와도(방어적으로) 화면이
 * 죽지 않도록 outline 톤 + 원문 그대로를 기본으로 둔다.
 */
function LineStatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    // 옆의 라인 이름이 text-2xl 로 커진 만큼, 기본 배지(h-5/text-xs)로는 상대적으로 너무
    // 작아 보여 한 단계만 키운다 — 배지 자체의 시맨틱 톤(variant)은 그대로 둔다.
    <Badge variant={isActive ? "default" : "outline"} className="h-6 shrink-0 px-2.5 text-sm">
      {status}
    </Badge>
  );
}
