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
import type { CountTaskBlindLine, SubmitCountTaskLine, SubmitCountTaskResponse } from "@/lib/types";
import { useStartCountTask, useSubmitCountTask } from "../_data/use-icqa";
import { IcqaCountLines } from "./icqa-count-lines";
import { IcqaResultView } from "./icqa-result-view";
import { Btn, Field, w98 } from "./win98-ui";

const DEFAULT_WORKER = "IC-01";

/**
 * "실사 시작 → 블라인드 카운트 → 제출 → 결과" 대화 상자 — 실사 탭의 행 선택 + "실사 시작"이
 * 연다(정본 §10.1·§10.4, 브리프 §3 S10.3).
 *
 * 단계가 셋이라 `rebin-simulate-dialog.tsx`/`damage-report-dialog.tsx`(폼 → 결과 둘)보다
 * 하나 더 있다: `worker`(시작 폼) → `lines`(블라인드 카운트) → `result`(제출 결과). 세
 * 단계 모두 이 파일 하나에 두면 300줄을 넘어 카운트 표·결과 패널은 별도 파일로 뺐다
 * (`icqa-count-lines.tsx`/`icqa-result-view.tsx`).
 *
 * 뮤테이션 훅은 `DialogContent` 안(`DialogBody`)에 둔다 — 닫을 때 언마운트돼야 다음 태스크로
 * 다시 열었을 때 이전 결과가 먼저 뜨지 않는다(같은 골격의 다른 대화 상자와 같은 이유).
 */
export function IcqaCountDialog({
  countTaskId,
  onOpenChange,
  onOpenRecount,
}: {
  countTaskId: number | null;
  onOpenChange: (open: boolean) => void;
  /** 결과 패널의 "재카운트 실사 열기" — 부모가 `activeTaskId` 를 이 id 로 바꿔 다시 연다 */
  onOpenRecount: (recountTaskId: number) => void;
}) {
  return (
    <Dialog open={countTaskId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[760px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>실사 — 블라인드 카운트</DialogTitle>
          <DialogDescription className="sr-only">
            작업자 코드로 실사를 시작하고, 칸 안의 실제 수량을 입력해 제출합니다.
          </DialogDescription>
        </DialogHeader>

        {countTaskId === null ? null : (
          <DialogBody
            countTaskId={countTaskId}
            onClose={() => onOpenChange(false)}
            onOpenRecount={onOpenRecount}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Stage = "worker" | "lines" | "result";

function DialogBody({
  countTaskId,
  onClose,
  onOpenRecount,
}: {
  countTaskId: number;
  onClose: () => void;
  onOpenRecount: (recountTaskId: number) => void;
}) {
  const [stage, setStage] = useState<Stage>("worker");
  const [worker, setWorker] = useState(DEFAULT_WORKER);
  const [blindLines, setBlindLines] = useState<CountTaskBlindLine[]>([]);
  const [result, setResult] = useState<SubmitCountTaskResponse | null>(null);

  const start = useStartCountTask();
  const submit = useSubmitCountTask();

  if (stage === "result" && result !== null) {
    return (
      <IcqaResultView
        result={result}
        blindLines={blindLines}
        onClose={onClose}
        onOpenRecount={(recountTaskId) => {
          onOpenRecount(recountTaskId);
        }}
      />
    );
  }

  if (stage === "lines") {
    return (
      <IcqaCountLines
        blindLines={blindLines}
        isSubmitting={submit.isPending}
        errorMessage={describeError(submit.error)}
        onCancel={onClose}
        onSubmit={(lines: SubmitCountTaskLine[]) =>
          submit.mutate(
            { id: countTaskId, body: { lines } },
            { onSuccess: (data) => { setResult(data); setStage("result"); } },
          )
        }
      />
    );
  }

  const canStart = worker.trim() !== "" && !start.isPending;

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          이 칸의 (화주·상품·로트·상태)별 실제 수량을 셉니다. 전산 수량은 보여주지 않습니다.
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

        {describeError(start.error) ? (
          <div
            role="alert"
            className={`${w98.sunken} ${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
          >
            {describeError(start.error)}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn
          disabled={!canStart}
          onClick={() =>
            start.mutate(
              { id: countTaskId, body: { worker: worker.trim() } },
              {
                onSuccess: (data) => {
                  setBlindLines(data.lines);
                  setStage("lines");
                },
              },
            )
          }
          className="h-7 w-28 font-bold"
        >
          {start.isPending ? "시작 중…" : "실사 시작"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}

/** 409 안내 — 다른 대화 상자와 같은 관례. 판별은 `ApiError.is()` */
function describeError(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    if (error.is("INVALID_STATE")) return "지금은 이 태스크를 처리할 수 없는 상태입니다.";
    if (error.is("VALIDATION_ERROR")) return "입력값을 확인하세요.";
  }
  return error.message;
}
