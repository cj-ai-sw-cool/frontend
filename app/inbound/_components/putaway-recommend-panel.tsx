"use client";

import type { LocationCapacity, PutawayMove, PutawayRejectedDetail } from "@/lib/types";
import { Btn, Etched, Field, Panel, Sunken, TrayBox, w98 } from "./win98-ui";
import { PUTAWAY_TIER_LABEL } from "./putaway-tier";

/**
 * 우측 열 — 정본 §4.6 "추천 결과(이동 목록) + '다른 칸' 입력 + 확정 버튼".
 * 기존 입고 화면 우측 열과 같은 폭(380px)을 쓴다.
 */
export function PutawayRecommendPanel({
  moves,
  unplacedQty,
  otherCode,
  onOtherCodeChange,
  onCheckOther,
  isCheckingOther,
  otherCapacity,
  otherCapacityError,
  onReplaceWithOther,
  rejectedDetail,
  onRetryRecommend,
  onConfirm,
  isConfirming,
  canConfirm,
}: {
  moves: PutawayMove[];
  unplacedQty: number;
  otherCode: string;
  onOtherCodeChange: (code: string) => void;
  onCheckOther: () => void;
  isCheckingOther: boolean;
  otherCapacity: LocationCapacity | undefined;
  otherCapacityError: string | null;
  onReplaceWithOther: () => void;
  rejectedDetail: PutawayRejectedDetail | null;
  onRetryRecommend: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  canConfirm: boolean;
}) {
  return (
    <div className="flex w-[380px] shrink-0 flex-col gap-1.5">
      <Panel title="이동 목록" className="min-h-0 flex-1" bodyClassName="min-h-0 gap-1.5">
        <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
          {moves.length === 0 ? (
            <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
              아직 추천 결과가 없습니다.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className={`${w98.small} border-b border-[color:var(--surface-dim)] text-left`}>
                  <th className="px-1.5 py-1">칸</th>
                  <th className="px-1.5 py-1">수량</th>
                  <th className="px-1.5 py-1">구분</th>
                  <th className="px-1.5 py-1 text-right">적재율(후)</th>
                </tr>
              </thead>
              <tbody className={w98.mono}>
                {moves.map((move) => (
                  <tr key={move.locationCode} className="border-b border-[color:var(--surface-dim)]">
                    <td className="px-1.5 py-1 font-bold">{move.locationCode}</td>
                    <td className="px-1.5 py-1 tabular-nums">{move.qty}</td>
                    <td className="px-1.5 py-1">{PUTAWAY_TIER_LABEL[move.tier]}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{move.loadLevelAfterPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sunken>
        {unplacedQty > 0 ? (
          <TrayBox tone="error" className="shrink-0">
            부분 진열 — 남은 {unplacedQty}개는 칸을 못 찾았습니다
          </TrayBox>
        ) : null}
      </Panel>

      {/* ── 다른 칸 ───────────────────────────────────────────── */}
      <div className={`${w98.raised} shrink-0 bg-[color:var(--surface)] p-1`}>
        <div className={`${w98.titleText} flex h-5 items-center px-1.5 text-[13px] font-bold`}>다른 칸</div>
        <Etched className="mt-0.5 mb-1" />
        <div className="flex items-center gap-1.5 px-1">
          <Field
            type="text"
            mono
            value={otherCode}
            onChange={(event) => onOtherCodeChange(event.target.value)}
            placeholder="AMBS-02-01-01-04"
            className="h-6 flex-1 text-[13px] uppercase"
          />
          <Btn
            onClick={onCheckOther}
            disabled={otherCode.trim() === "" || isCheckingOther}
            className="h-6 px-2 text-[12px] font-bold"
          >
            {isCheckingOther ? "확인 중…" : "확인"}
          </Btn>
        </div>

        {otherCapacityError !== null ? (
          <p className={`${w98.small} px-1 pt-1 font-bold text-[color:var(--status-error)]`}>
            {otherCapacityError}
          </p>
        ) : otherCapacity !== undefined ? (
          <div className="px-1 pt-1">
            <p className={`${w98.small}`}>
              적재율 {otherCapacity.loadLevelPct}%
              {otherCapacity.zoneCode !== null ? ` · ${otherCapacity.zoneCode}존` : ""}
              {otherCapacity.items.length === 0
                ? " · 빈 칸"
                : ` · 재고 ${otherCapacity.items.length}종`}
            </p>
            {/* acceptable/rejectReason/maxQty 는 stockId+qty 를 같이 보냈을 때만 온다
                (putaway-tab.tsx 의 handleCheckOther) — 서버가 혼적·온도·규격·부피를 전부
                따져 판정한다, 화면은 그 결과를 보여줄 뿐이다(정본 §4.1). */}
            {otherCapacity.acceptable === true ? (
              <>
                <p className={`${w98.small} font-bold text-[color:var(--primary)]`}>
                  수용 가능 — 이 칸으로 바꿀 수 있습니다
                  {otherCapacity.maxQty !== null ? ` (최대 ${otherCapacity.maxQty}개)` : ""}
                </p>
                <Btn onClick={onReplaceWithOther} className="mt-1 h-6 px-2 text-[12px] font-bold">
                  이 칸으로 교체
                </Btn>
              </>
            ) : otherCapacity.acceptable === false ? (
              <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
                수용 불가 — {otherCapacity.rejectReason ?? "확정할 수 없는 칸입니다"}
              </p>
            ) : null}
            <p className={`${w98.small} mt-1 text-[color:var(--muted-foreground)]`}>
              최종 확인은 확정 시 서버가 잠금 아래 다시 검증합니다.
            </p>
          </div>
        ) : null}
      </div>

      {/* ── 409 사유 + 재추천 ────────────────────────────────── */}
      {rejectedDetail !== null ? (
        <div className={`${w98.raised} shrink-0 bg-[color:var(--surface)] p-1.5`}>
          <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
            {rejectedDetail.locationCode} 진열 거부 — {rejectedDetail.reason}
          </p>
          <Btn onClick={onRetryRecommend} className="mt-1 h-6 px-2 text-[12px] font-bold">
            재추천
          </Btn>
        </div>
      ) : null}

      <Btn
        onClick={onConfirm}
        disabled={!canConfirm || isConfirming}
        className="h-8 shrink-0 text-[14px] font-bold"
      >
        {isConfirming ? "확정 중…" : "확정"}
      </Btn>
    </div>
  );
}
