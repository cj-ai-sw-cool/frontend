"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PickTask } from "@/lib/types";
import { Btn, w98 } from "./win98-ui";

/**
 * 부족 확인 대화 — 브리프 §3 "수량을 지시 미만으로 확정하면 확인 대화(부족 처리 — 불일치
 * 신고·재할당) 후 전송". 취소하면 카드로 돌아가 수량을 다시 고칠 수 있다 — 실수로 적게
 * 입력했을 때 되돌릴 자리가 필요하다(주문 취소까지 이어질 수 있는 동작이라 한 번 더 확인).
 */
export function ShortConfirmDialog({
  task,
  qty,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  task: PickTask;
  qty: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[420px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>부족 처리</DialogTitle>
          <DialogDescription className="sr-only">
            지시 수량보다 적게 확정합니다 — 불일치 신고와 재할당이 자동으로 일어납니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 p-3">
          <p className={`${w98.small}`}>
            <b className={w98.mono}>{task.locationCode}</b> 칸 지시 수량{" "}
            <b className={w98.mono}>{task.qty}</b> 중 <b className={`${w98.mono} text-[color:var(--status-error)]`}>{qty}</b>개만
            확정합니다.
          </p>
          <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
            불일치 신고가 자동으로 남고, 부족분은 같은 상품의 다른 칸으로 재할당을
            시도합니다. 재할당이 안 되면 그 부족분이 걸린 주문은 취소됩니다(사유
            PICK_SHORT). 이미 집은 물건은 그대로 남습니다.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
          <Btn
            disabled={isSubmitting}
            onClick={onConfirm}
            className="h-8 w-32 font-bold text-[color:var(--status-error)]"
          >
            {isSubmitting ? "전송 중…" : "부족 확정"}
          </Btn>
          <Btn disabled={isSubmitting} onClick={() => onOpenChange(false)} className="h-8 w-24">
            돌아가기
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
