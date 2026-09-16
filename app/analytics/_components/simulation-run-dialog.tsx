"use client";

/**
 * "실행" Dialog — 정본 §17.8 "시나리오 실행 Dialog에 반복 횟수"(1~5). 시나리오 생성
 * Dialog(`simulation-scenario-create-dialog.tsx`)와 달리 이 Dialog는 자체 뮤테이션 훅이
 * 없다 — 실행 생성은 `simulation-scenario-panel.tsx`가 이미 갖고 있는
 * `useCreateRunBatch`를 그대로 쓰고, 이 컴포넌트는 "반복 횟수" 값만 모아 `onSubmit`으로
 * 넘긴다(순차 생성이 Dialog가 닫힌 뒤에도 배경에서 계속돼야 해서 — 진행 상태는
 * 진행 띠 옆 "묶음 N/M" 표시가 대신한다, `simulation-scenario-panel.tsx` 참고).
 */

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Btn, Field, w98 } from "./win98-ui";

const MAX_REPEAT = 5;

export function SimulationRunDialog({
  open,
  onOpenChange,
  scenarioName,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioName: string;
  isPending: boolean;
  onSubmit: (repeat: number) => void;
}) {
  const [repeat, setRepeat] = useState(1);
  /** 두 번 제출 방지 — `onSubmit`이 부모의 `createRunBatch.mutate`를 부르는데, 그
   * `isPending`이 React state 갱신이라 같은 틱 안의 두 번째 클릭(더블 클릭 등)이 아직
   * `false`인 값을 볼 수 있다. 이 ref는 렌더를 기다리지 않고 즉시 막는다. Dialog가
   * 닫히면 언마운트되어 다음에 열 때 자동으로 풀린다. */
  const submittedRef = useRef(false);

  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(Math.min(MAX_REPEAT, Math.max(1, Math.round(repeat))));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[380px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>실행 — {scenarioName}</DialogTitle>
          <DialogDescription className="sr-only">반복 횟수를 정해 시나리오를 실행합니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-3">
          <label className="flex flex-col gap-0.5">
            <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
              반복 횟수(1~{MAX_REPEAT}, 순차 실행 — 정본 §17.8)
            </span>
            <Field
              type="number"
              mono
              min={1}
              max={MAX_REPEAT}
              value={repeat}
              onChange={(e) => setRepeat(Number(e.target.value))}
              className="h-8 w-24 text-[13px]"
            />
          </label>
          {repeat > 1 ? (
            <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
              {repeat}회를 순차로 실행해 하나의 묶음으로 비교합니다. 이전 실행이 끝나야 다음이 시작됩니다.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
          <Btn disabled={isPending} onClick={submit} className="h-7 w-24 font-bold">
            {isPending ? "실행 중…" : "실행"}
          </Btn>
          <Btn onClick={() => onOpenChange(false)} disabled={isPending} className="h-7 w-20">
            취소
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
