"use client";

import type { AsnListItem, AsnStatus } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/** ASN 상태 → 화면 표기. asn-detail-panel.tsx 도 같은 맵을 쓴다 */
export const ASN_STATUS_LABEL: Record<AsnStatus, string> = {
  REGISTERED: "예정",
  ARRIVED: "도착",
  RECEIVING: "검수중",
  PARTIALLY_RECEIVED: "부분수령",
  CLOSED: "마감",
};

const STATUS_TABS: { value: AsnStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "REGISTERED", label: "예정" },
  { value: "ARRIVED", label: "도착" },
  { value: "RECEIVING", label: "검수중" },
  { value: "PARTIALLY_RECEIVED", label: "부분수령" },
  { value: "CLOSED", label: "마감" },
];

/**
 * 좌측 열 — ASN 목록 (정본 §3.6 "입고 화면 좌측: ASN 목록(상태 필터) + ASN 등록 폼").
 *
 * 상태 필터 탭은 목업이 없어 이 화면의 다른 탭(예: 출고 화면 라인 탭)과 같은 `pressed` Btn
 * 조합으로 만들었다. 등록 폼은 자리를 차지하지 않게 **대화 상자**로 뺐다 — 목록이 늘 보여야
 * 상태 필터가 의미가 있는데, 폼까지 이 칸에 펼치면 목록이 몇 줄 안 남는다.
 */
export function AsnListPanel({
  items,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  selectedId,
  onSelect,
  onRegister,
}: {
  items: AsnListItem[];
  isLoading: boolean;
  statusFilter: AsnStatus | "ALL";
  onStatusFilterChange: (status: AsnStatus | "ALL") => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRegister: () => void;
}) {
  return (
    <Panel
      title="ASN 목록"
      right={
        <Btn onClick={onRegister} className="h-6 shrink-0 px-2 text-[13px] font-bold">
          ASN 등록
        </Btn>
      }
      className="h-72 shrink-0"
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
        ) : items.length === 0 ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
            해당 상태의 ASN이 없습니다.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.asnId}>
                <button
                  type="button"
                  onClick={() => onSelect(item.asnId)}
                  aria-current={selectedId === item.asnId ? "true" : undefined}
                  className={`flex w-full flex-col gap-0.5 border-b border-[color:var(--surface-dim)] px-2 py-1.5 text-left ${
                    selectedId === item.asnId ? "bg-[color:var(--surface-variant)]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`${w98.mono} truncate text-[14px] font-bold`}>{item.asnNo}</span>
                    <span className={`${w98.small} shrink-0 font-bold text-[color:var(--primary)]`}>
                      {ASN_STATUS_LABEL[item.status]}
                    </span>
                  </span>
                  <span className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
                    {item.sellerCode} · {item.sellerName} · {item.expectedOn}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sunken>
    </Panel>
  );
}
