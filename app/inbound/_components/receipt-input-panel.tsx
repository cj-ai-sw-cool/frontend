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
 *
 * ★ **수령·파손을 한 줄로 합치고 여백을 줄였다** (우측 열 잘림 수정, Stage 3).
 *   Stage 3 가 우측 열에 "미검수 품목" · "검수 입력" 두 칸을 새로 얹으면서 고정 높이
 *   예산을 넘겼고, 그 여파로 아래 "상품 정보" 칸이 세로로 눌려 품목명 한 줄만 남고
 *   잘렸다(사용자 보고). "상품 정보"는 항상 전부 보여야 하는 칸이라 그쪽 크기는 지키고,
 *   대신 이 칸의 줄 수와 줄 간격을 줄여 자리를 돌려준다.
 *   ⚠️ 필드 자체(높이 24px)는 여전히 손으로 누를 수 있는 크기다 — 줄인 건 라벨 폭과
 *      줄 사이 여백이지, 탭 영역이 아니다.
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
    <div className={`${w98.raised} shrink-0 bg-[color:var(--surface)] p-1`}>
      <div
        className={`${w98.titleText} flex h-5 items-center px-1.5 text-[13px] font-bold tracking-[0.02em] select-none`}
      >
        검수 입력
      </div>

      <Etched className="mt-0.5 mb-1" />

      <div className="flex flex-col gap-1 px-1 text-[13px]" title={note === "" ? undefined : note}>
        <div className="flex items-center justify-between">
          <span className="font-bold">예정 수량</span>
          <span className={`${w98.mono} tabular-nums`}>
            {pendingItem === null ? "--" : pendingItem.expectedQty}
          </span>
        </div>

        {/* 수령·파손을 한 줄에 나란히 둔다 — 예전엔 두 줄이었다 */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="receipt-received-qty" className="w-9 shrink-0 font-bold">
            수령
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
            className="h-6 w-14 text-right text-[13px] tabular-nums"
          />
          <label htmlFor="receipt-damaged-qty" className="ml-1 w-9 shrink-0 font-bold">
            파손
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
            className="h-6 w-14 text-right text-[13px] tabular-nums"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="receipt-lot" className="w-9 shrink-0 font-bold">
            로트
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
            className="h-6 flex-1 text-[13px]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="receipt-expires" className="w-9 shrink-0 font-bold">
            유통기한
          </label>
          <Field
            id="receipt-expires"
            type="date"
            mono
            value={expiresOn}
            disabled={disabled}
            onChange={(event) => onExpiresOnChange(event.target.value)}
            className="h-6 flex-1 text-[12px]"
          />
        </div>
      </div>
    </div>
  );
}
