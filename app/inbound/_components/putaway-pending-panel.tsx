"use client";

import type { PutawayPendingItem, Seller } from "@/lib/types";
import { Panel, Select, Sunken, w98 } from "./win98-ui";

/**
 * 좌측 열 — 진열 대기 목록 (정본 §4.6 "진열 대기 목록(화주 필터)").
 *
 * 입고장(RCV-01)의 AVAILABLE 재고만 온다 — DAMAGED·HOLD 는 화면 체크 1 이 확인하는
 * 대로 여기 보이지 않는다(백엔드가 이미 걸러 준다, 정본 §4.1).
 *
 * ★ ASN 목록(`asn-list-panel.tsx`)과 같은 자리·같은 폭(300px)을 쓴다 — 입고 화면의
 *   기존 좌측 열 관례를 그대로 따라, 검수 탭에서 진열 탭으로 넘어가도 눈이 헤매지 않는다.
 */
export function PutawayPendingPanel({
  items,
  isLoading,
  errorMessage,
  sellers,
  sellerFilter,
  onSellerFilterChange,
  selectedStockId,
  onSelect,
}: {
  items: PutawayPendingItem[];
  isLoading: boolean;
  /** 조회 실패 사유 — 없으면 null(다른 패널의 error props 와 같은 규약) */
  errorMessage: string | null;
  sellers?: Seller[];
  sellerFilter: string;
  onSellerFilterChange: (code: string) => void;
  selectedStockId: number | null;
  onSelect: (item: PutawayPendingItem) => void;
}) {
  return (
    <Panel
      title="진열 대기 목록"
      right={
        <Select
          value={sellerFilter}
          onChange={(event) => onSellerFilterChange(event.target.value)}
          className="h-6 w-28 shrink-0 text-[12px]"
        >
          <option value="">전체 화주</option>
          {(sellers ?? []).map((seller) => (
            <option key={seller.code} value={seller.code}>
              {seller.code}
            </option>
          ))}
        </Select>
      }
      className="min-h-0 flex-1"
      bodyClassName="min-h-0 gap-1.5"
    >
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {isLoading ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
        ) : errorMessage !== null ? (
          <p className={`${w98.small} p-2 font-bold text-[color:var(--status-error)]`}>
            불러오지 못했습니다 — {errorMessage}
          </p>
        ) : items.length === 0 ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
            진열 대기 재고가 없습니다.
          </p>
        ) : (
          <ul>
            {items.map((item) => {
              const isDimUnconfirmed = !item.dimConfirmed;
              return (
                <li key={item.stockId}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    aria-current={selectedStockId === item.stockId ? "true" : undefined}
                    className={`flex w-full flex-col gap-0.5 border-b border-[color:var(--surface-dim)] px-2 py-1.5 text-left ${
                      selectedStockId === item.stockId ? "bg-[color:var(--surface-variant)]" : ""
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-bold">{item.product.name}</span>
                      <span className={`${w98.mono} shrink-0 tabular-nums`}>{item.qty}</span>
                    </span>
                    <span className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
                      {item.seller.code} · {item.lot.lotNo}
                      {item.lot.expiresOn ? ` · ~${item.lot.expiresOn}` : ""}
                    </span>
                    {isDimUnconfirmed ? (
                      <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
                        치수 미확정 — 진열 불가
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sunken>
    </Panel>
  );
}
