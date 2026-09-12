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
import type { RebinSimulateResponse } from "@/lib/types";
import { useSimulateRebin } from "../_data/use-waves";
import { RebinResultView } from "./rebin-result-view";
import { Btn, Field, w98 } from "./win98-ui";

const DEFAULT_WORKER = "SIM-01";

/**
 * "리빈 자동 처리" 확인 대화 상자 — `rebin-panel.tsx`의 버튼이 연다(정본 §8.1·§8.3, 브리프
 * §3 S8.3 "확인 대화 상자(작업자 코드 기본 SIM-01) → 실행 → 결과 패널 → 닫으면 새로고침").
 *
 * `wave-batch-simulate-dialog.tsx`와 같은 골격이다: 성공하면 폼 대신 결과 뷰로 전환하고,
 * Radix 가 닫힐 때 `DialogContent` 를 통째로 언마운트하므로 다시 열면 폼으로 되돌아간다.
 * 태스크별 실제 수량 입력이 없어(§8.1 "조율만") 폼이 작업자 코드 한 칸뿐이라 별도 파일로
 * 쪼개지 않고 이 안에 둔다(코딩 규칙 300줄 상한에 여유가 크다).
 */
export function RebinSimulateDialog({
  pickBatchId,
  onOpenChange,
}: {
  pickBatchId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={pickBatchId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[560px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>리빈 자동 처리</DialogTitle>
          <DialogDescription className="sr-only">
            작업자 코드를 입력해 이 배치의 리빈을 서버 시뮬레이터로 처리합니다.
          </DialogDescription>
        </DialogHeader>

        {pickBatchId === null ? null : (
          <DialogBody pickBatchId={pickBatchId} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * 뮤테이션 훅은 여기(DialogContent 안)에 둔다. 바깥 컴포넌트에 두면 닫아도 `data`가 남아
 * 다음 배치로 열었을 때 앞 배치의 결과 뷰가 먼저 뜨고 실행 폼이 나오지 않는다(2026-09-12
 * 화면 체크에서 발견). DialogContent는 닫힐 때 언마운트되므로 여기 두면 열 때마다 새로 시작한다.
 */
function DialogBody({ pickBatchId, onClose }: { pickBatchId: number; onClose: () => void }) {
  const simulate = useSimulateRebin();
  const [worker, setWorker] = useState(DEFAULT_WORKER);
  const result: RebinSimulateResponse | null = simulate.data ?? null;
  const isSubmitting = simulate.isPending;
  const errorMessage = describeError(simulate.error);
  const onSubmit = (code: string) => simulate.mutate({ pickBatchId, worker: code });

  if (result !== null) {
    return <RebinResultView result={result} onClose={onClose} />;
  }

  const canSubmit = worker.trim() !== "" && !isSubmitting;

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          이 배치 토트의 물건을 주문별 슬롯으로 나누고, 완성된 주문을 배송단위 토트로
          옮깁니다. 취소된 주문이 이미 집은 물건은 입고장으로 반납합니다.
        </p>
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
        <Btn disabled={!canSubmit} onClick={() => onSubmit(worker.trim())} className="h-7 w-28 font-bold">
          {isSubmitting ? "처리 중…" : "실행"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}

/** 409 안내 — `wave-batch-simulate-dialog.tsx`와 같은 관례. 판별은 `ApiError.is()` */
function describeError(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    if (error.is("INVALID_STATE")) return "DONE 상태가 아니거나 이미 세션이 있는 배치입니다.";
    if (error.is("NO_SLOT")) return "빈 슬롯이 부족합니다.";
    if (error.is("INCOMPLETE")) return "미완성 슬롯이 남아 종료하지 못했습니다.";
  }
  return error.message;
}
