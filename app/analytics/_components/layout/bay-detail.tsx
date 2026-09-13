"use client";

/**
 * 우측 패널 — 베이 클릭 시 `GET /bays/{id}/bins` 결과를 단×위치 격자로(브리프 §2).
 * role 별 테두리(PICK_FACE 초록·RESERVE 파랑), 비어 있으면 회색. 3D(`layout-scene.tsx`)의
 * 칸 펼침과 같은 데이터, 같은 뜻 — 2D(`warehouse-map.tsx`)도 이 컴포넌트를 그대로 쓴다.
 */

import type { Bay, Bin } from "@/lib/types";
import { bayDisplayCode, type LayoutIndex } from "./layout-geometry";

const ROLE_LABEL: Record<Bin["role"], string> = { PICK_FACE: "피킹면", RESERVE: "예비" };

export function BayDetailPanel({
  bay,
  bins,
  isLoading,
  index,
  onClose,
}: {
  bay: Bay;
  bins: Bin[] | undefined;
  isLoading: boolean;
  index: LayoutIndex;
  onClose: () => void;
}) {
  const levels = [...new Set((bins ?? []).map((b) => b.levelNo))].sort((a, b) => b - a);
  const positions = [...new Set((bins ?? []).map((b) => b.positionNo))].sort((a, b) => a - b);
  const byCell = new Map((bins ?? []).map((b) => [`${b.levelNo}-${b.positionNo}`, b]));

  return (
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col gap-2 border-l border-[color:var(--border)] bg-[color:var(--surface)] p-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">
          {bayDisplayCode(bay, index)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          닫기
        </button>
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)]">
        {bay.binType} · {bay.levels}단 × {bay.positions}위치 · {bay.occupiedBins}/{bay.totalBins} 점유
      </p>

      {isLoading ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">칸 불러오는 중…</p>
      ) : bins && bins.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {levels.map((level) => (
            <div key={level} className="flex items-center gap-1">
              <span className="w-6 shrink-0 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                {level}단
              </span>
              <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${positions.length}, minmax(0, 1fr))` }}>
                {positions.map((position) => {
                  const bin = byCell.get(`${level}-${position}`);
                  const filled = bin && bin.qty > 0;
                  const border = !bin
                    ? "border-[color:var(--border)]"
                    : bin.role === "PICK_FACE"
                      ? "border-[color:var(--status-success)]"
                      : "border-[color:var(--primary)]";
                  return (
                    <div
                      key={position}
                      title={bin ? `${bin.code} · ${ROLE_LABEL[bin.role]}` : undefined}
                      className={`flex flex-col items-center justify-center rounded border-2 px-1 py-1 text-center text-[10px] leading-tight ${border} ${
                        filled ? "bg-[color:var(--surface-variant)]" : "bg-[color:var(--surface-dim)] text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      {filled ? (
                        <>
                          <span className="truncate font-bold">{bin.sellerCode}</span>
                          <span className="truncate">{bin.productName}</span>
                          <span className="font-mono">{bin.qty}</span>
                        </>
                      ) : (
                        "빈 칸"
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[color:var(--muted-foreground)]">칸 정보가 없습니다.</p>
      )}
    </div>
  );
}
