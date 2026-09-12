"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import type { DamageReportResponse } from "@/lib/types";
import { useDamageReport } from "../_data/use-shipment-detail";
import { Btn, Field, w98 } from "./win98-ui";

const DEFAULT_WORKER = "PK-01";

/**
 * 대화 상자가 다룰 품목 — 품목 표 행에서 "파손 신고"를 눌렀을 때 그 행의 값과 함께
 * `shipmentId` 도 그 순간 값으로 담아 둔다. 부모의 `shipment` state 를 매 렌더 다시
 * 읽으면, 주문 취소(ORDER_CANCELLED) 결과가 부모의 스캔 상태를 초기화하는 순간
 * `shipmentId` 가 null 이 되어 결과를 보여주는 도중에 대화 상자가 닫혀 버린다 — 열 때
 * 값을 굳혀 두면 그 뒤 부모가 무엇을 하든 이 대화 상자는 흔들리지 않는다.
 */
export interface DamageReportTarget {
  shipmentId: number;
  gtin: string;
  name: string;
  qty: number;
  verifiedQty: number;
}

/**
 * "파손 신고" 확인 대화 상자 — `shipment-items-panel.tsx` 의 행 버튼이 연다(정본 §9.3·§9.4,
 * 브리프 §3 "수량, 작업자 코드 기본 PK-01→ 결과").
 *
 * `rebin-simulate-dialog.tsx` 와 같은 골격이다: 성공하면 폼 대신 결과 뷰로 전환하고, Radix 가
 * 닫힐 때 `DialogContent` 를 통째로 언마운트하므로 다시 열면 폼으로 되돌아간다.
 *
 * ⚠️ 뮤테이션 훅은 `DialogContent` 안(`DialogBody`)에 둔다. 바깥에 두면 닫아도 `data` 가
 *    남아 다음 품목으로 열었을 때 앞 결과가 먼저 뜬다(`rebin-simulate-dialog.tsx` 주석과
 *    같은 이유, 2026-09-12 화면 체크에서 발견된 패턴).
 */
export function DamageReportDialog({
  target,
  onOpenChange,
  onOutcome,
}: {
  target: DamageReportTarget | null;
  onOpenChange: (open: boolean) => void;
  /** 성공 즉시 호출 — 주문 취소(ORDER_CANCELLED)면 부모가 스캔 화면을 초기화한다
   * (그 배송단위는 더 이상 없다, 정본 §9.3) */
  onOutcome: (result: DamageReportResponse) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[480px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>파손 신고</DialogTitle>
          <DialogDescription className="sr-only">
            파손 수량과 작업자 코드를 입력해 이 품목의 파손을 신고합니다.
          </DialogDescription>
        </DialogHeader>

        {target === null ? null : (
          <DialogBody target={target} onClose={() => onOpenChange(false)} onOutcome={onOutcome} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  target,
  onClose,
  onOutcome,
}: {
  target: DamageReportTarget;
  onClose: () => void;
  onOutcome: (result: DamageReportResponse) => void;
}) {
  const damage = useDamageReport();
  const [qty, setQty] = useState("1");
  const [worker, setWorker] = useState(DEFAULT_WORKER);
  const result: DamageReportResponse | null = damage.data ?? null;
  const isSubmitting = damage.isPending;
  const errorMessage = describeError(damage.error);
  const parsedQty = toPositiveInt(qty);

  if (result !== null) {
    return (
      <>
        <div className="flex flex-col gap-2 p-3">
          <p className={`${w98.small} font-bold`}>{outcomeMessage(result)}</p>
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
          <Btn onClick={onClose} className="h-7 w-24 font-bold">
            확인
          </Btn>
        </div>
      </>
    );
  }

  const canSubmit = parsedQty !== null && worker.trim() !== "" && !isSubmitting;

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          {target.name}({target.gtin}) 스캔 {target.verifiedQty}/{target.qty} — 이 수량만큼
          토트에서 불량으로 바꾸고 입고장으로 옮깁니다.
        </p>
        <label className="flex max-w-[160px] flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>수량</span>
          <Field
            type="text"
            inputMode="numeric"
            mono
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            className="h-7 w-full text-[14px]"
          />
        </label>
        <label className="flex max-w-[200px] flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>작업자 코드</span>
          <Field
            mono
            value={worker}
            onChange={(event) => setWorker(event.target.value)}
            className="h-7 w-full text-[14px]"
          />
        </label>

        {errorMessage ? (
          <div
            role="alert"
            className={`${w98.sunken} ${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn
          disabled={!canSubmit}
          onClick={() => {
            if (parsedQty === null) return;
            damage.mutate(
              {
                shipmentId: target.shipmentId,
                gtin: target.gtin,
                qty: parsedQty,
                worker: worker.trim(),
              },
              { onSuccess: onOutcome },
            );
          }}
          className="h-7 w-28 font-bold"
        >
          {isSubmitting ? "처리 중…" : "신고"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}

/** 결과 문구 — 정본 §9.4 그대로("보충 배치 #n 생성 — 웨이브 탭에서 자동 처리 후 다시 스캔" /
 * "주문 취소(DAMAGED_SHORT) — 정상품 입고장 반납") */
function outcomeMessage(result: DamageReportResponse): string {
  if (result.outcome === "REPLENISH") {
    return `보충 배치 #${result.replenishBatchId} 생성 — 웨이브 탭에서 자동 처리 후 다시 스캔`;
  }
  return "주문 취소(DAMAGED_SHORT) — 정상품 입고장 반납";
}

/** 409 안내 — `wave-batch-simulate-dialog.tsx` 와 같은 관례. 판별은 `ApiError.is()` */
function describeError(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    if (error.is("INVALID_STATE")) return "지금은 파손 신고를 할 수 없는 상태입니다.";
    if (error.is("VALIDATION_ERROR")) return "입력값을 확인하세요.";
  }
  return error.message;
}

function toPositiveInt(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}
