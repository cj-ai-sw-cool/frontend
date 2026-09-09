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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ShipmentListItem, ShipmentStatus } from "@/lib/types";

/**
 * 라인별 배송 내역(3-1) — docs/02-api-spec.md §3-1, D-12.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 상태 탭 선택은 부모(page.tsx)가 들고
 * 있고(controlled) 여기서는 값과 변경 콜백만 받는다 — `order-detail-panel.tsx`/
 * `dashboard/_components/line-status-table.tsx` 와 같은 방식.
 *
 * 주문 단위 그룹 상세(A안)는 추후 확장이라(D-12) 행은 클릭할 수 없다 — 드릴다운 없음.
 *
 * 탭 4개: 전체(기본값, status=undefined) / 완료(PACKED) / 진행중(PACKING) / 준비중
 * (TOTE_ASSIGNED). "전체"는 필터 없이 세 상태를 그대로 보여준다(서버 쿼리도 `status` 생략과
 * 같은 의미 — `_data/use-line-shipments.ts`).
 *
 * 스크롤은 `TabsContent` 안에서만 한다. 이 패널을 담는 `Card` 가 고정 240px 이고 그 위에서
 * 탭 목록이 자리를 차지하므로, 표까지 스크롤 영역을 넓히면 탭이 밀려 올라간다.
 * 부모 `CardContent` 는 `overflow-hidden` 이어야 한다(품목 카드와 같은 패턴) — 그래야 이 안의
 * 스크롤 경계가 이중으로 생기지 않는다.
 */

/** TOTE_ASSIGNED=준비중, PACKING=진행중, PACKED=완료 (D-12). PLANNED/LOADED 는 이 목록 범위 밖 */
const STATUS_TABS: { value: ShipmentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "PACKED", label: "완료" },
  { value: "PACKING", label: "진행중" },
  { value: "TOTE_ASSIGNED", label: "준비중" },
];

/** 상태 배지 — 시맨틱 variant 만 쓴다(하드코딩 색 금지). 완료는 강조, 진행중은 보조,
 *  준비중은 아직 손대지 않은 상태라 outline 로 가장 차분하게 둔다. */
const STATUS_LABEL: Record<ShipmentStatus, string> = {
  PLANNED: "계획",
  TOTE_ASSIGNED: "준비중",
  PACKING: "진행중",
  PACKED: "완료",
  LOADED: "적재완료",
};

const STATUS_BADGE_VARIANT: Record<ShipmentStatus, "default" | "secondary" | "outline"> = {
  PLANNED: "outline",
  TOTE_ASSIGNED: "outline",
  PACKING: "secondary",
  PACKED: "default",
  LOADED: "default",
};

export function LineShipmentsPanel({
  shipments,
  status,
  onStatusChange,
}: {
  shipments: ShipmentListItem[];
  /** undefined = "전체" 탭 (세 상태 모두, 필터 없음) */
  status: ShipmentStatus | undefined;
  onStatusChange: (status: ShipmentStatus | undefined) => void;
}) {
  return (
    <Tabs
      value={status ?? "ALL"}
      onValueChange={(value) =>
        onStatusChange(value === "ALL" ? undefined : (value as ShipmentStatus))
      }
      className="h-full gap-2"
    >
      <TabsList className="shrink-0">
        {STATUS_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* 탭 값이 4개지만 내용(표)은 부모가 이미 필터링해 넘긴 하나뿐이다 — 탭마다 다른
          content 를 만들지 않고 공용 표 하나를 재사용한다(서버/부모 쪽 필터와 중복 필터링을
          피한다). value 는 현재 선택된 탭과 항상 같으므로 늘 보인다. */}
      <TabsContent value={status ?? "ALL"} className="min-h-0 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[40%]">주문번호</TableHead>
              <TableHead className="w-[15%] text-center">분할</TableHead>
              <TableHead className="w-[20%] text-center">상태</TableHead>
              <TableHead className="w-[25%]">토트</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  표시할 배송단위가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => (
                <TableRow key={shipment.shipmentId}>
                  <TableCell className="font-mono text-xs">{shipment.receiptNo}</TableCell>
                  <TableCell className="text-center tabular-nums">{shipment.seqNo}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={STATUS_BADGE_VARIANT[shipment.status]}>
                      {STATUS_LABEL[shipment.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {shipment.toteBarcode ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}
