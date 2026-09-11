"use client";

import type { PutawayMove, PutawayPendingItem } from "@/lib/types";
import { Btn, Field, Panel, Sunken, w98 } from "./win98-ui";
import { PUTAWAY_TIER_LABEL } from "./putaway-tier";

/**
 * 가운데 열 — 정본 §4.6 "3D 미니 뷰 또는 2D 지도(재사용 가능하면 재사용, 아니면 추천 칸
 * 코드·존·랙·단·열 텍스트 강조)".
 *
 * ★ **텍스트 강조를 골랐다** (재사용 대신). 분석 화면의 3D(`warehouse-slot-3d.jsx`)는
 *   2,300줄짜리 three.js 씬이고 `ssr:false` 로 필요할 때만 불러오는 무거운 번들이다 —
 *   그걸 입고 화면 안에 다시 넣으면 Stage 3 가 겪은 "우측 열 잘림"(`f9b7d9c`)과 같은
 *   높이 예산 사고를 하나 더 늘리는 셈이고, 브리프 §5 도 "입고 화면 안에 3D를 넣는 건
 *   높이 예산상 무리"라고 이미 못 박아 뒀다(같은 문단이 "3D에서 보기" 버튼으로 분석
 *   화면에 넘기라고 정한다). 그래서 이 칸은 추천 결과를 존·랙·단·열로 크게 분해해
 *   보여주는 "주소판"이고, 실제 3D 확인은 아래 버튼이 분석 화면으로 넘긴다.
 * ⚠️ 3D `flyTo`/`setHighlight` 는 **존 단위까지만** 움직인다(`master-window.tsx` 머리말) —
 *   "3D에서 보기"도 그래서 칸이 아니라 그 칸이 속한 존까지만 강조한다. 자세한 사정은
 *   `app/analytics/page.tsx` 의 `HighlightFromQuery` 주석과 인수인계 보고 참고.
 */
export function PutawayLocationPanel({
  selectedItem,
  qty,
  onQtyChange,
  onRecommend,
  isRecommending,
  moves,
  unplacedQty,
  onGoTo3D,
}: {
  selectedItem: PutawayPendingItem | null;
  qty: number;
  onQtyChange: (qty: number) => void;
  onRecommend: () => void;
  isRecommending: boolean;
  moves: PutawayMove[];
  unplacedQty: number;
  onGoTo3D: (locationCode: string) => void;
}) {
  const isDimUnconfirmed = selectedItem !== null && !selectedItem.dimConfirmed;
  const canRecommend = selectedItem !== null && !isDimUnconfirmed && qty > 0 && !isRecommending;
  const primary = moves[0] ?? null;

  return (
    <Panel title="진열 위치" className="min-h-0 min-w-0 flex-1" bodyClassName="min-h-0 gap-2">
      {selectedItem === null ? (
        <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
          왼쪽 목록에서 진열할 품목을 선택하세요.
        </p>
      ) : (
        <>
          <div className={`${w98.raised} shrink-0 bg-[color:var(--surface)] p-2 text-[13px]`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-bold">{selectedItem.product.name}</span>
              <span className={`${w98.mono} shrink-0`}>{selectedItem.seller.code}</span>
            </div>
            <div className={`${w98.small} text-[color:var(--muted-foreground)]`}>
              로트 {selectedItem.lot.lotNo} · 대기 {selectedItem.qty}개
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <label htmlFor="putaway-qty" className="w-16 shrink-0 font-bold">
                진열 수량
              </label>
              <Field
                id="putaway-qty"
                type="text"
                inputMode="numeric"
                mono
                value={String(qty)}
                onChange={(event) => {
                  const parsed = Number(event.target.value.trim());
                  if (!Number.isFinite(parsed) || parsed < 0) return;
                  onQtyChange(parsed);
                }}
                className="h-6 w-20 text-right text-[13px] tabular-nums"
              />
              <Btn
                onClick={onRecommend}
                disabled={!canRecommend}
                className="ml-auto h-6 px-3 text-[12px] font-bold"
              >
                {isRecommending ? "추천 중…" : moves.length > 0 ? "재추천" : "추천"}
              </Btn>
            </div>
            {isDimUnconfirmed ? (
              <p className={`${w98.small} mt-1 font-bold text-[color:var(--status-error)]`}>
                치수 미확정 — 진열할 수 없습니다(정본 §4.3).
              </p>
            ) : null}
          </div>

          <Sunken className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-3">
            {primary === null ? (
              <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                추천을 누르면 이 칸에 위치가 표시됩니다.
              </p>
            ) : (
              <>
                {/* ── 주소판 — 존 글자를 크게, 랙·단·열은 숫자 칩으로. 백엔드가 이미 분해해서
                    준다(2026-09-11 라이브 보고) — 프론트에서 코드 문자열을 다시 쪼개지 않는다. */}
                <div className={`${w98.mono} text-[64px] leading-none font-bold text-[color:var(--primary)]`}>
                  {primary.zoneCode}
                </div>
                <div className="flex gap-2">
                  <AddressChip label="랙" value={String(primary.rackNo)} />
                  <AddressChip label="단" value={String(primary.levelNo)} />
                  <AddressChip label="열" value={String(primary.colNo)} />
                </div>
                <div className={`${w98.mono} text-[15px] font-bold`}>{primary.locationCode}</div>
                <div className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                  {PUTAWAY_TIER_LABEL[primary.tier]} · 이동 후 적재율 {primary.loadLevelAfterPct}%
                </div>

                {moves.length > 1 ? (
                  <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                    외 {moves.length - 1}칸으로 분할 — 우측 이동 목록 참고
                  </p>
                ) : null}
                {unplacedQty > 0 ? (
                  <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
                    부분 진열 — {unplacedQty}개는 넣을 칸을 찾지 못했습니다
                  </p>
                ) : null}

                <Btn onClick={() => onGoTo3D(primary.locationCode)} className="mt-1 h-6 px-3 text-[12px]">
                  3D에서 보기 ▶
                </Btn>
              </>
            )}
          </Sunken>
        </>
      )}
    </Panel>
  );
}

function AddressChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${w98.raised} flex flex-col items-center bg-[color:var(--surface)] px-3 py-1`}>
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <span className={`${w98.mono} text-[22px] leading-none font-bold tabular-nums`}>{value}</span>
    </div>
  );
}
