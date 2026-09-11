"use client";

import type { WaveListItem, WaveStatus } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/** 웨이브 상태 → 화면 표기 — 정본 §6.6. wave-detail-panel.tsx 도 같은 맵을 쓴다 */
export const WAVE_STATUS_LABEL: Record<WaveStatus, string> = {
  RELEASED: "생성됨",
  PICKING: "피킹중",
  DONE: "완료",
};

const STATUS_TABS: { value: WaveStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "RELEASED", label: "생성됨" },
  { value: "PICKING", label: "피킹중" },
  { value: "DONE", label: "완료" },
];

/**
 * 좌측 열 — 웨이브 목록 (브리프 §3 S6.5 "목록(상태·페이지)").
 *
 * 주문 목록(`order-list-panel.tsx`)과 같은 조합(상태 탭 + 파인 목록 + 페이지)을 쓴다 — 이
 * 화면에서 목록+필터가 이미 정한 모양이라 새로 고안하지 않는다. 웨이브는 화주를 섞으므로
 * (정본 §6.2a) 화주 필터는 없다.
 */
export function WaveListPanel({
  items,
  isLoading,
  errorMessage,
  statusFilter,
  onStatusFilterChange,
  selectedId,
  onSelect,
  page,
  totalPages,
  onPageChange,
  className = "",
}: {
  items: WaveListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  statusFilter: WaveStatus | "ALL";
  onStatusFilterChange: (status: WaveStatus | "ALL") => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  return (
    <Panel
      title="웨이브 목록"
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
            해당 조건의 웨이브가 없습니다.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.waveId}>
                <button
                  type="button"
                  onClick={() => onSelect(item.waveId)}
                  aria-current={selectedId === item.waveId ? "true" : undefined}
                  className={`flex w-full flex-col gap-0.5 border-b border-[color:var(--surface-dim)] px-2 py-1.5 text-left ${
                    selectedId === item.waveId ? "bg-[color:var(--surface-variant)]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`${w98.mono} truncate text-[14px] font-bold`}>{item.waveNo}</span>
                    <span className={`${w98.small} shrink-0 font-bold text-[color:var(--primary)]`}>
                      {WAVE_STATUS_LABEL[item.status]}
                    </span>
                  </span>
                  <span className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
                    주문 {item.orderCount}건 · {item.cutoffAt.slice(0, 16).replace("T", " ")}
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
