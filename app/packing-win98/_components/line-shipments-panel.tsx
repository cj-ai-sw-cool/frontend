"use client";

import type { Line, ShipmentListItem, ShipmentStatus } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 라인 선택 탭 + 3-1 라인별 배송 내역 — win98 리스트 뷰 모양(`shipment-items-panel.tsx` 와 같은
 * 머리행·파인 상자 스크롤 규칙을 따른다).
 *
 * 탭은 패널 제목 줄 오른쪽에 둔다(Box Preview 의 모델 전환 탭과 같은 자리) — 세로 예산을
 * 늘리지 않는다. 이름은 서버가 준 그대로 쓴다. `ACTIVE` 가 아닌 라인은 탭에 **그대로 남기고
 * 누를 수만 막는다** — 사라지면 탭이 세 개에서 두 개로 줄어 작업자가 헷갈린다.
 */
export function LineShipmentsPanel({
  lines,
  linesLoading,
  selectedLineId,
  onSelectLine,
  shipments,
  shipmentsLoading,
  shipmentsError,
  className = "",
}: {
  lines: Line[];
  linesLoading: boolean;
  selectedLineId: number | null;
  onSelectLine: (lineId: number) => void;
  shipments: ShipmentListItem[];
  shipmentsLoading: boolean;
  shipmentsError: boolean;
  className?: string;
}) {
  return (
    <Panel
      title="Line Shipments — 라인별 배송 내역"
      right={
        linesLoading ? (
          <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
            불러오는 중…
          </span>
        ) : lines.length === 0 ? (
          <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
            라인 없음
          </span>
        ) : (
          <span className="flex shrink-0 gap-1">
            {lines.map((line) => {
              const isActive = line.status === "ACTIVE";
              return (
                <Btn
                  key={line.lineId}
                  pressed={line.lineId === selectedLineId}
                  disabled={!isActive}
                  onClick={() => onSelectLine(line.lineId)}
                  title={isActive ? line.name : `${line.name} — 지금 고를 수 없음 (${line.status})`}
                  className={`${w98.small} h-5 px-2 font-normal disabled:opacity-40`}
                >
                  {line.name}
                </Btn>
              );
            })}
          </span>
        )
      }
      className={`h-[340px] shrink-0 ${className}`}
    >
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
              {shipments.map((shipment) => (
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
