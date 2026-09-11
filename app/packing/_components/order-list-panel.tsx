"use client";

import type { OrderListItem, OrderStatus, Seller } from "@/lib/types";
import { Btn, Panel, Select, Sunken, w98 } from "./win98-ui";

/** 주문 상태 → 화면 표기 — 정본 §5.2. order-detail-panel.tsx 도 같은 맵을 쓴다 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: "접수",
  ALLOCATED: "할당",
  WAVED: "웨이브",
  PICKING: "피킹",
  REBINNING: "리비닝",
  PACKING: "포장중",
  SHIPPED: "출고완료",
  CANCELLED: "취소",
};

const STATUS_TABS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "RECEIVED", label: "접수" },
  { value: "ALLOCATED", label: "할당" },
  { value: "WAVED", label: "웨이브" },
  { value: "PICKING", label: "피킹" },
  { value: "REBINNING", label: "리비닝" },
  { value: "PACKING", label: "포장중" },
  { value: "SHIPPED", label: "출고완료" },
  { value: "CANCELLED", label: "취소" },
];

/**
 * 좌측 열 — 주문 목록 (브리프 §3 S5.4 "주문 목록(화주·상태 필터, 페이지)").
 *
 * ASN 목록(`asn-list-panel.tsx`)과 같은 조합(상태 탭 + 화주 셀렉트 + 파인 목록)을 쓴다 —
 * 이 저장소에서 목록+필터 화면이 이미 정한 모양이라 새로 고안하지 않는다.
 */
export function OrderListPanel({
  items,
  isLoading,
  errorMessage,
  sellers,
  sellerFilter,
  onSellerFilterChange,
  statusFilter,
  onStatusFilterChange,
  selectedId,
  onSelect,
  page,
  totalPages,
  onPageChange,
  className = "",
}: {
  items: OrderListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  sellers?: Seller[];
  sellerFilter: string;
  onSellerFilterChange: (code: string) => void;
  statusFilter: OrderStatus | "ALL";
  onStatusFilterChange: (status: OrderStatus | "ALL") => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  return (
    <Panel
      title="주문 목록"
      right={
        <Select
          value={sellerFilter}
          onChange={(event) => onSellerFilterChange(event.target.value)}
          className="h-6 w-24 shrink-0 text-[12px]"
        >
          <option value="">전체 화주</option>
          {(sellers ?? []).map((seller) => (
            <option key={seller.code} value={seller.code}>
              {seller.code}
            </option>
          ))}
        </Select>
      }
      className={`min-h-0 flex-1 ${className}`}
      bodyClassName="min-h-0 gap-1.5"
    >
      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => (
          <Btn
            key={tab.value}
            pressed={statusFilter === tab.value}
            onClick={() => onStatusFilterChange(tab.value)}
            className="h-6 px-1.5 text-[12px]"
          >
            {tab.label}
          </Btn>
        ))}
      </div>

      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {isLoading ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
        ) : errorMessage !== null ? (
          <p className={`${w98.small} p-2 font-bold text-[color:var(--status-error)]`}>
            불러오지 못했습니다 — {errorMessage}
          </p>
        ) : items.length === 0 ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
            해당 조건의 주문이 없습니다.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={selectedId === item.id ? "true" : undefined}
                  className={`flex w-full flex-col gap-0.5 border-b border-[color:var(--surface-dim)] px-2 py-1.5 text-left ${
                    selectedId === item.id ? "bg-[color:var(--surface-variant)]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`${w98.mono} truncate text-[14px] font-bold`}>{item.receiptNo}</span>
                    <span className={`${w98.small} shrink-0 font-bold text-[color:var(--primary)]`}>
                      {ORDER_STATUS_LABEL[item.status]}
                    </span>
                  </span>
                  <span className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
                    {item.seller.code} · {item.regionCode} · {item.orderedAt.slice(0, 16).replace("T", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sunken>

      <div className="flex shrink-0 items-center justify-between gap-1">
        <Btn
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page <= 0}
          className="h-6 px-2 text-[12px]"
        >
          ◀ 이전
        </Btn>
        <span className={`${w98.small} ${w98.mono} text-[color:var(--muted-foreground)]`}>
          {totalPages === 0 ? "0 / 0" : `${page + 1} / ${totalPages}`}
        </span>
        <Btn
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= totalPages}
          className="h-6 px-2 text-[12px]"
        >
          다음 ▶
        </Btn>
      </div>
    </Panel>
  );
}
