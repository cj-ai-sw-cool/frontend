"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import type { PickBatchDetail, SimulateResponse } from "@/lib/types";
import { usePickBatchDetail, useSimulateBatch } from "../_data/use-waves";
import { SimulateForm } from "./simulate-form";
import { SimulateResultView } from "./simulate-result-view";
import { w98 } from "./win98-ui";

/**
 * "자동 처리" 대화 상자 — 웨이브 탭 OPEN 배치 행에서 연다(정본 §7.5·§7.6, 브리프 §3 S7.6).
 *
 * `wave-create-dialog.tsx` 와 같은 골격이다: 성공하면 폼 대신 결과 뷰로 전환하고, Radix 가
 * 닫힐 때 `DialogContent` 를 통째로 언마운트하므로 다시 열면 폼으로 되돌아간다. 다른 점은
 * 폼 상태(`batchId`)를 부모(`waves-tab.tsx`)가 쥔다는 것 — 배치 행마다 다른 태스크 목록을
 * 새로 조회해야 해서다.
 *
 * 폼(태스크별 실제 수량 입력)과 결과 뷰(단계별 행·취소 주문·추가 태스크)를 각각
 * `simulate-form.tsx`/`simulate-result-view.tsx` 로 나눴다 — 한 파일에 다 담으면 300줄을
 * 넘는다(코딩 규칙 파일 300줄 상한).
 */
export function WaveBatchSimulateDialog({
  batchId,
  onOpenChange,
}: {
  batchId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const batchQuery = usePickBatchDetail(batchId);
  const simulate = useSimulateBatch();

  return (
    <Dialog open={batchId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[720px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>자동 처리 — 작업자 시뮬레이터</DialogTitle>
          <DialogDescription className="sr-only">
            작업자 코드와 태스크별 실제 수량을 입력해 배치를 서버 시뮬레이터로 처리합니다.
          </DialogDescription>
        </DialogHeader>

        {batchId === null ? null : (
          <DialogBody
            batchId={batchId}
            batch={batchQuery.data ?? null}
            isLoadingBatch={batchQuery.isLoading}
            batchErrorMessage={batchQuery.error?.message ?? null}
            result={simulate.data ?? null}
            isSubmitting={simulate.isPending}
            submitErrorMessage={describeSimulateError(simulate.error)}
            onSubmit={(body) => simulate.mutate({ id: batchId, body })}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  batch,
  isLoadingBatch,
  batchErrorMessage,
  result,
  isSubmitting,
  submitErrorMessage,
  onSubmit,
  onClose,
}: {
  batchId: number;
  batch: PickBatchDetail | null;
  isLoadingBatch: boolean;
  batchErrorMessage: string | null;
  result: SimulateResponse | null;
  isSubmitting: boolean;
  submitErrorMessage: string | null;
  onSubmit: (body: { worker: string; shorts: { pickTaskId: number; foundQty: number }[] }) => void;
  onClose: () => void;
}) {
  if (result !== null) {
    return <SimulateResultView result={result} onClose={onClose} />;
  }

  if (batch === null) {
    return (
      <p className={`${w98.small} p-3 text-[color:var(--muted-foreground)]`}>
        {isLoadingBatch ? "불러오는 중…" : (batchErrorMessage ?? "배치를 불러오지 못했습니다.")}
      </p>
    );
  }

  return (
    <SimulateForm
      batch={batch}
      isSubmitting={isSubmitting}
      errorMessage={submitErrorMessage}
      onSubmit={onSubmit}
      onCancel={onClose}
    />
  );
}

/** 409 안내 — 브리프 §3 "409 처리". 판별은 `ApiError.is()`(pack-actions.tsx 와 같은 관례) */
function describeSimulateError(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    if (error.is("INVALID_STATE")) return "이미 처리된 배치입니다.";
    if (error.is("ALREADY_CLAIMED")) return "다른 작업자가 가져간 배치입니다.";
  }
  return error.message;
}
