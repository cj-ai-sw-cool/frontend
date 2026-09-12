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
          <DialogBody batchId={batchId} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * 조회·뮤테이션 훅은 여기(DialogContent 안)에 둔다. 바깥 컴포넌트에 두면 닫아도 뮤테이션의
 * `data`가 남아 다음 배치로 열었을 때 앞 배치의 결과 뷰가 먼저 뜨고 폼이 나오지 않는다
 * (2026-09-12 리빈 대화 상자에서 발견, 같은 골격이라 함께 고침). DialogContent는 닫힐 때
 * 언마운트되므로 여기 두면 열 때마다 새로 시작한다.
 */
function DialogBody({ batchId, onClose }: { batchId: number; onClose: () => void }) {
  const batchQuery = usePickBatchDetail(batchId);
  const simulate = useSimulateBatch();
  const batch: PickBatchDetail | null = batchQuery.data ?? null;
  const isLoadingBatch = batchQuery.isLoading;
  const batchErrorMessage = batchQuery.error?.message ?? null;
  const result: SimulateResponse | null = simulate.data ?? null;
  const isSubmitting = simulate.isPending;
  const submitErrorMessage = describeSimulateError(simulate.error);
  const onSubmit = (body: { worker: string; shorts: { pickTaskId: number; foundQty: number }[] }) =>
    simulate.mutate({ id: batchId, body });

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
