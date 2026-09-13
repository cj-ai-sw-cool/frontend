"use client";

/**
 * 우측 패널 — 베이 클릭 시 `GET /bays/{id}/bins` 결과를 단×위치 격자로(브리프 §2).
 * role 별 테두리(PICK_FACE 초록·RESERVE 파랑), 비어 있으면 회색. 3D(`layout-scene.tsx`)의
 * 칸 펼침과 같은 데이터, 같은 뜻 — 2D(`warehouse-map.tsx`)도 이 컴포넌트를 그대로 쓴다.
 */

import type { Bay, Bin } from "@/lib/types";
import { bayDisplayCode } from "./layout-geometry";

const ROLE_LABEL: Record<Bin["role"], string> = { PICK_FACE: "피킹면", RESERVE: "예비" };

export function BayDetailPanel({
  bay,
  bins,
  isLoading,
  onClose,
}: {
  bay: Bay;
  bins: Bin[] | undefined;
  isLoading: boolean;
  onClose: () => void;
}) {
  const levels = [...new Set((bins ?? []).map((b) => b.levelNo))].sort((a, b) => b - a);
  const positions = [...new Set((bins ?? []).map((b) => b.positionNo))].sort((a, b) => a - b);
  const byCell = new Map((bins ?? []).map((b) => [`${b.levelNo}-${b.positionNo}`, b]));

  return (
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col gap-2 border-l border-[color:var(--border)] bg-[color:var(--surface)] p-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-[color:var(--foreground)]">
          {bayDisplayCode(bay)}
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
              {/* min-w-0 이 없으면 이 grid 가 flex 자식의 기본 min-width:auto 를 따라가
                  칸 글자의 원래 폭만큼 커져 패널 밖으로 잘린다(2026-09-13 화면 체크에서
                  발견) — 열은 항상 패널 폭 안에서 `positions.length` 등분한다 */}
              <div
                className="grid min-w-0 flex-1 gap-1"
                style={{ gridTemplateColumns: `repeat(${positions.length}, minmax(0, 1fr))` }}
              >
                {positions.map((position) => {
                  const bin = byCell.get(`${level}-${position}`);
                  const filled = bin && bin.qty > 0;
                  const border = !bin
                    ? "border-[color:var(--border)]"
                    : bin.role === "PICK_FACE"
                      ? "border-[color:var(--status-success)]"
                      : "border-[color:var(--primary)]";
                  /* 상품명은 칸에 안 넣는다 — 화주 코드·수량 두 줄만으로도 XS(4위치)에서
                     이미 폭이 빠듯하다. 여러 품목이면 호버 툴팁에서 전부 보여준다 */
                  const tooltip = bin
                    ? `${bin.code} · ${bin.sellerCode ?? ""} · ${ROLE_LABEL[bin.role]}${
                        bin.items.length > 0 ? " · " + bin.items.map((it) => `${it.productName}(${it.qty})`).join(", ") : ""
                      }`
                    : undefined;
                  /* "SEL-" 접두를 뺀 번호만 보여준다 — 4위치(XS) 칸 폭(약 55~60px)에서
                     "SEL-0068"(8자) 는 truncate 여백이 0이라 화면·폰트에 따라 잘려
                     보일 수 있었다(2026-09-13 재확인). "0068"(4자) 이면 실제 여유가
                     생긴다 — 전체 코드는 툴팁에 그대로 남는다. */
                  const sellerLabel = bin?.sellerCode?.replace(/^SEL-/, "") ?? "";
                  return (
                    <div
                      key={position}
                      title={tooltip}
                      className={`flex min-w-0 flex-col items-center justify-center overflow-hidden rounded border-2 px-0.5 py-1 text-center text-[10px] leading-tight ${border} ${
                        filled ? "bg-[color:var(--surface-variant)]" : "bg-[color:var(--surface-dim)] text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      {filled ? (
                        <>
                          <span className="w-full truncate font-bold">{sellerLabel}</span>
                          <span className="w-full truncate font-mono">{bin.qty}</span>
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
