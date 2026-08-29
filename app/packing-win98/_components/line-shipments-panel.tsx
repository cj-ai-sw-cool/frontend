"use client";

import type { ShipmentListItem, ShipmentStatus } from "@/lib/types";
import { Panel, Sunken, w98 } from "./win98-ui";

/**
 * 3-1 라인별 배송 내역 — win98 리스트 뷰 모양(`shipment-items-panel.tsx` 와 같은 머리행·파인
 * 상자 스크롤 규칙을 따른다).
 *
 * 라인은 여기서 고르지 않는다 — 라인 선택 칸은 토트 스캔 패널(`tote-scan-panel.tsx` 의
 * `LINE:`)에 하나만 둔다(사용자 지시: 화면에 라인 고르는 곳이 둘이면 안 된다). 이 패널은
 * 그 라인의 결과만 그린다.
 */
export function LineShipmentsPanel({
  selectedLineId,
  linesLoading,
  shipments,
  shipmentsLoading,
  shipmentsError,
  className = "",
}: {
  selectedLineId: number | null;
  /** 라인 목록이 아직 안 왔으면 true — "라인 없음" 과 "아직 안 왔음" 을 가른다 */
  linesLoading: boolean;
  shipments: ShipmentListItem[];
  shipmentsLoading: boolean;
  shipmentsError: boolean;
  className?: string;
}) {
  return (
    <Panel title="Line Shipments — 라인별 배송 내역" className={`h-[340px] shrink-0 ${className}`}>
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {selectedLineId === null ? (
          <Placeholder>
            {linesLoading ? "라인을 불러오는 중입니다" : "고를 수 있는 라인이 없습니다"}
          </Placeholder>
        ) : shipmentsLoading ? (
          <Placeholder>조회 중…</Placeholder>
        ) : shipmentsError ? (
          <Placeholder role="alert" tone="error">
            배송 내역을 불러오지 못했습니다
          </Placeholder>
        ) : shipments.length === 0 ? (
          <Placeholder>이 라인에 배송단위가 없습니다</Placeholder>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[color:var(--surface)]">
                <Th className="w-[40%]">주문번호</Th>
                <Th className="w-[15%] text-center">분할</Th>
                <Th className="w-[25%] text-center">상태</Th>
                <Th className="w-[20%]">토트</Th>
              </tr>
            </thead>
            <tbody>
              {sortForPacking(shipments).map((shipment) => (
                <tr key={shipment.shipmentId}>
                  <td
                    className={`${w98.mono} border-b border-[color:var(--surface-variant)] px-1 py-1.5 align-middle text-[13px]`}
                  >
                    {shipment.receiptNo}
                  </td>
                  <td className="border-b border-[color:var(--surface-variant)] px-1 py-1.5 text-center align-middle tabular-nums">
                    {shipment.seqNo}
                  </td>
                  <td className="border-b border-[color:var(--surface-variant)] px-1 py-1.5 text-center align-middle">
                    <span
                      className={`${w98.raised} ${w98.small} bg-[color:var(--surface)] px-1.5 py-0.5 font-bold`}
                    >
                      {STATUS_LABEL[shipment.status]}
                    </span>
                  </td>
                  <td
                    className={`${w98.mono} border-b border-[color:var(--surface-variant)] px-1 py-1.5 align-middle text-[13px]`}
                  >
                    {shipment.toteBarcode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sunken>
    </Panel>
  );
}

/**
 * 화면에 놓이는 순서 — 지금 포장 중인 것이 맨 위, 다음에 집을 대기중이 그 아래, 끝난 것은 맨
 * 아래다. 작업자가 위에서부터 훑으면 지금 할 일이 먼저 보인다.
 *
 * 같은 상태끼리는 서버가 준 순서를 지킨다 — 먼저 들어온 주문이 먼저 나간다.
 */
const PACKING_ORDER: Record<ShipmentStatus, number> = {
  PACKING: 0,
  TOTE_ASSIGNED: 1,
  PLANNED: 2,
  PACKED: 3,
  LOADED: 4,
};

function sortForPacking(shipments: ShipmentListItem[]): ShipmentListItem[] {
  return [...shipments].sort(
    (a, b) => PACKING_ORDER[a.status] - PACKING_ORDER[b.status],
  );
}

/** TOTE_ASSIGNED=대기중, PACKING=진행중, PACKED=완료 (D-12) — 이 목록에 오는 상태만 다룬다 */
const STATUS_LABEL: Record<ShipmentStatus, string> = {
  PLANNED: "계획",
  TOTE_ASSIGNED: "대기중",
  PACKING: "진행중",
  PACKED: "완료",
  LOADED: "적재완료",
};

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`${w98.raised} bg-[color:var(--surface)] px-1 py-1 text-left font-normal ${className}`}
    >
      {children}
    </th>
  );
}

function Placeholder({
  children,
  role,
  tone = "normal",
}: {
  children: React.ReactNode;
  role?: "alert";
  tone?: "normal" | "error";
}) {
  return (
    <div
      role={role}
      className={`flex h-full items-center justify-center p-4 text-center text-[13px] ${
        tone === "error"
          ? "text-[color:var(--status-error)]"
          : "text-[color:var(--muted-foreground)]"
      }`}
    >
      {children}
    </div>
  );
}
