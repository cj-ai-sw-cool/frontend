"use client";

import type { PendingReceiptItem } from "@/lib/types";
import { Etched, Field, w98 } from "./win98-ui";

/**
 * 검수 입력 패널 — Stage 2 전환기(T1) 수량 패널을 대체한다(정본 §3.5).
 *
 * ⚠️ 화주·로트 select/입력은 여기서 **없앴다**(T1 삭제). 화주는 선택한 ASN이 이미 정하고,
 *    로트는 ASN 품목이 갖고 온다 — 검수자는 아래 로트·유통기한 칸에서 **확인·정정**만 한다.
 *    기본값은 미검수 품목 목록에서 고른 품목의 값이다(page.tsx 의 runScan 참고).
 *
 * ⚠️ 값은 여기서 들고 있지 않다. page.tsx 의 상태이고 이 칸은 그리기만 한다
 *    (precautions-panel.tsx 와 같은 규약).
 */
export function ReceiptInputPanel({
  pendingItem,
  receivedQty,
  onReceivedQtyChange,
  damagedQty,
  onDamagedQtyChange,
  lotNo,
  onLotNoChange,
  expiresOn,
  onExpiresOnChange,
  disabled,
  note,
}: {
  /** 지금 검수 중인 미검수 품목 — 목록에서 클릭하지 않고 직접 스캔했으면 null(예정 수량 불명) */
  pendingItem: PendingReceiptItem | null;
  receivedQty: number;
  onReceivedQtyChange: (qty: number) => void;
  damagedQty: number;
  onDamagedQtyChange: (qty: number) => void;
  lotNo: string;
  onLotNoChange: (lotNo: string) => void;
  expiresOn: string;
  onExpiresOnChange: (expiresOn: string) => void;
  disabled: boolean;
  /** 잠긴 이유 — 잠기지 않았으면 빈 문자열(precautions-panel.tsx 의 note 와 같은 규약) */
  note: string;
}) {
  return (
    <div className={`${w98.raised} shrink-0 bg-[color:var(--surface)] p-2`}>
      <div
        className={`${w98.titleText} flex h-6 items-center px-1.5 text-[14px] font-bold tracking-[0.02em] select-none`}
      >
        검수 입력
      </div>

      <Etched className="mt-1 mb-1.5" />

      <div
        className="flex flex-col gap-2 px-1 pb-0.5 text-[15px]"
        title={note === "" ? undefined : note}
      >
        <div className="flex items-center justify-between">
          <span className="font-bold">예정 수량</span>
          <span className={`${w98.mono} tabular-nums`}>
            {pendingItem === null ? "--" : pendingItem.expectedQty}
          </span>
        </div>

        <Etched className="my-0.5" />

        <div className="flex items-center gap-2">
          <label htmlFor="receipt-received-qty" className="w-16 shrink-0 font-bold">
            수령:
          </label>
          <Field
            id="receipt-received-qty"
            type="text"
            inputMode="numeric"
            mono
            value={String(receivedQty)}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value.trim());
              if (!Number.isFinite(parsed) || parsed < 0) return;
              onReceivedQtyChange(parsed);
            }}
            className="h-8 w-24 text-right text-[18px] tabular-nums"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="receipt-damaged-qty" className="w-16 shrink-0 font-bold">
            파손:
          </label>
          <Field
            id="receipt-damaged-qty"
            type="text"
            inputMode="numeric"
            mono
            value={String(damagedQty)}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.target.value.trim());
              if (!Number.isFinite(parsed) || parsed < 0) return;
              onDamagedQtyChange(parsed);
            }}
            className="h-8 w-24 text-right text-[18px] tabular-nums"
          />
        </div>

        <Etched className="my-0.5" />

        <div className="flex items-center gap-2">
          <label htmlFor="receipt-lot" className="w-16 shrink-0 font-bold">
            로트:
          </label>
          <Field
            id="receipt-lot"
            type="text"
            mono
            value={lotNo}
            disabled={disabled}
            onChange={(event) => onLotNoChange(event.target.value)}
            placeholder="L-2026-09"
            maxLength={40}
            className="h-8 flex-1 text-[15px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="receipt-expires" className="w-16 shrink-0 font-bold">
            유통기한:
          </label>
          <Field
            id="receipt-expires"
            type="date"
            mono
            value={expiresOn}
            disabled={disabled}
            onChange={(event) => onExpiresOnChange(event.target.value)}
            className="h-8 flex-1 text-[14px]"
          />
        </div>
      </div>
    </div>
  );
}
