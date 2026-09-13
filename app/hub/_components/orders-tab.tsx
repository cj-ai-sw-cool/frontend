"use client";

/**
 * 허브 "주문" 탭 — 정본 §12.6·§12.8, 브리프 §2.
 *
 * 좌 — `GET /hub/orders?center=&status=` 표(접수번호·화주·권역·센터·규칙·상태). 우 — 행을
 * 클릭하면 `GET /hub/orders/{id}/routing` 로 그 주문의 라우팅 후보(센터별 라인 ATP)를
 * 보여준다(화면 체크 3, 브리프 §3). 이 탭이 자기 상태·데이터 훅을 통째로 들고 있다
 * (`app/packing/_components/orders-tab.tsx` 와 같은 관례).
 */

import { useState } from "react";
import { useHubCenters, useHubOrders, useOrderRouting } from "../_data/use-hub";
import { Th, Td } from "./table";
import { Select, Sunken, w98 } from "./win98-ui";
import type { CenterCode, OrderStatus, RoutingRule } from "@/lib/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: "접수",
  ALLOCATED: "할당",
  WAVED: "웨이브",
  PICKING: "피킹",
  REBINNING: "리빈",
  PACKING: "포장",
  SHIPPED: "출고완료",
  CANCELLED: "취소",
};

const RULE_LABEL: Record<RoutingRule, string> = {
  PRIORITY: "우선센터",
  REGION: "권역",
  STOCK: "재고",
  REROUTE: "재라우팅",
};

export function OrdersTab() {
  const { data: centers } = useHubCenters();
  const [centerFilter, setCenterFilter] = useState<CenterCode | "">("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: page, isLoading, error } = useHubOrders({
    center: centerFilter || undefined,
    status: statusFilter || undefined,
  });
  const routing = useOrderRouting(selectedId);

  return (
    <div className="flex h-full min-h-0 gap-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 gap-2">
          <Select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value as CenterCode | "")}
            className="w-40"
          >
            <option value="">센터 전체</option>
            {(centers ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
            className="w-32"
          >
            <option value="">상태 전체</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <Th>접수번호</Th>
                <Th>화주</Th>
                <Th>권역</Th>
                <Th>센터</Th>
                <Th>규칙</Th>
                <Th>상태</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                    주문을 불러오는 중…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="p-3 text-[color:var(--status-error)]">
                    주문 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : page?.content.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                    조건에 맞는 주문이 없습니다.
                  </td>
                </tr>
              ) : (
                page?.content.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)] ${
                      o.id === selectedId ? "bg-[color:var(--surface-variant)] font-bold" : ""
                    }`}
                  >
                    <Td mono>{o.orderNo}</Td>
                    <Td>
                      {o.sellerName} <span className={w98.mono}>({o.sellerCode})</span>
                    </Td>
                    <Td>{o.regionCode ?? "—"}</Td>
                    <Td mono>{o.centerCode ?? "—"}</Td>
                    <Td>{o.rule ? RULE_LABEL[o.rule] : "—"}</Td>
                    <Td>{STATUS_LABEL[o.status]}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Sunken>
      </div>

      <Sunken className={`${w98.scroll} flex w-[420px] shrink-0 flex-col gap-2 overflow-y-auto p-2`}>
        {selectedId === null ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">
            행을 클릭하면 라우팅 후보(센터별 라인 ATP)를 보여줍니다.
          </span>
        ) : routing.isLoading ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">라우팅 조회 중…</span>
        ) : routing.data === undefined || routing.data === null ? (
          <span className="p-1 text-[13px] text-[color:var(--status-error)]">
            라우팅 정보를 불러오지 못했습니다.
          </span>
        ) : (
          <RoutingDetail decision={routing.data} />
        )}
      </Sunken>
    </div>
  );
}

function RoutingDetail({ decision }: { decision: NonNullable<ReturnType<typeof useOrderRouting>["data"]> }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className={`${w98.titleText}`}>{decision.orderNo}</span>
        {decision.rejected ? (
          <span className="bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
            거부 — 후보 없음
          </span>
        ) : (
          <span className="bg-[color:var(--status-success)] px-1.5 py-0.5 text-[11px] font-bold text-white">
            {decision.selectedCenter} 선택 · {decision.rule ? RULE_LABEL[decision.rule] : ""}
          </span>
        )}
      </div>

      {decision.candidates.map((c) => (
        <div
          key={c.centerCode}
          className={`${w98.raised} p-1.5 ${
            c.centerCode === decision.selectedCenter ? "bg-[color:var(--surface-variant)]" : ""
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-bold">
              {c.centerCode} · {c.centerName}
            </span>
            <span
              className="text-[11px] font-bold"
              style={{ color: c.sufficient ? "var(--status-success)" : "var(--status-error)" }}
            >
              {c.sufficient ? "충분" : "부족"}
            </span>
          </div>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr>
                <Th>GTIN</Th>
                <Th>상품</Th>
                <Th>필요</Th>
                <Th>ATP</Th>
              </tr>
            </thead>
            <tbody>
              {c.lines.map((line) => (
                <tr key={line.gtin} className="border-t border-[color:var(--border)]">
                  <Td mono>{line.gtin}</Td>
                  <Td>{line.productName}</Td>
                  <Td mono>{line.requiredQty}</Td>
                  <Td mono>
                    <span style={{ color: line.sufficient ? undefined : "var(--status-error)" }}>{line.atp}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
