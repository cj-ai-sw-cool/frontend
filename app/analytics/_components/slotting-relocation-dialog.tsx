"use client";

/**
 * "자동 처리" 대화 상자 — 제안 패널의 OPEN 항목을 작업자 시뮬레이터로 seq 순서대로
 * 처리한다(정본 §15.9 "웨이브 탭과 같은 시뮬레이터 버튼"). `wave-batch-simulate-dialog.tsx`
 * 와 같은 골격이지만, 웨이브 쪽은 배치 하나를 서버가 한 번에 처리하는 반면 여기는
 * 항목이 여러 개라 **이 화면이 직접 순서대로 반복 호출**한다(정본 §15.6 "seq 순으로
 * OPEN" — EVICT 가 먼저 와야 그 칸을 쓰는 MOVE_IN 이 409 `EVICT_PENDING` 을 만나지
 * 않는다).
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSimulateRelocation } from "../_data/use-slotting-mutations";
import { Btn, Field, Sunken, w98 } from "./win98-ui";
import type { RelocationItem } from "@/lib/types";

export function SlottingRelocationDialog({
  open,
  onOpenChange,
  proposalId,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: number | null;
  items: RelocationItem[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[560px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>자동 처리 — 재배치 작업자 시뮬레이터</DialogTitle>
          <DialogDescription className="sr-only">
            작업자 코드를 입력해 OPEN 재배치 항목을 순서대로 처리합니다.
          </DialogDescription>
        </DialogHeader>

        {proposalId === null ? null : (
          <DialogBody proposalId={proposalId} items={items} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  proposalId,
  items,
  onClose,
}: {
  proposalId: number;
  items: RelocationItem[];
  onClose: () => void;
}) {
  const simulate = useSimulateRelocation(proposalId);
  const [worker, setWorker] = useState("W-C1-P03");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<RelocationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  /* `items`(부모의 OPEN 목록)는 처리될 때마다 줄어든다 — 시뮬레이터가 항목을 DONE
   * 으로 바꿀 때마다 부모가 openItems 를 다시 계산하고, 이 prop 이 바뀌면서 "몇 건 중
   * 몇 건" 분모가 진행 중에 흔들리는 사고가 났다(2026-09-14 화면 체크에서 발견 — "진행
   * 2/0"). 그래서 대화 상자를 여는 순간의 목록을 한 번만 얼려 둔다(state 초기화 함수,
   * `DialogContent` 는 닫힐 때 언마운트되므로 다음에 열면 새로 얼린다). */
  const [sorted] = useState(() => [...items].sort((a, b) => a.seq - b.seq));

  const run = async () => {
    if (!worker.trim() || sorted.length === 0) return;
    setRunning(true);
    setError(null);
    const finished: RelocationItem[] = [];
    for (const item of sorted) {
      try {
        // seq 순서를 지켜야 EVICT → MOVE_IN 이 맞으므로 여기서는 일부러 순차로 await 한다
        const result = await simulate.mutateAsync({ itemId: item.id, body: { worker: worker.trim() } });
        finished.push(result.item);
        setDone([...finished]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리 중 오류");
        break;
      }
    }
    setRunning(false);
  };

  if (done.length === sorted.length && sorted.length > 0 && !running) {
    return (
      <>
        <div className="flex flex-col gap-2 p-3">
          <p className={`${w98.small} font-bold`}>{done.length}건 완료</p>
          <Sunken className={`${w98.scroll} h-40 overflow-y-auto p-1.5`}>
            <ul className="flex flex-col gap-1">
              {done.map((item) => (
                <li key={item.id} className={`${w98.mono} text-[12px]`}>
                  #{item.seq} {item.productName} → {item.toLocationCode ?? "—"}{" "}
                  <b className="text-[color:var(--status-success,#3D9E7A)]">DONE</b>
                </li>
              ))}
            </ul>
          </Sunken>
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
          <Btn onClick={onClose} className="h-7 w-24 font-bold">
            닫기
          </Btn>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          OPEN 항목 {sorted.length}건을 seq 순서대로 claim→pick→complete 합니다.
        </p>
        <label className="flex flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>작업자 코드</span>
          <Field
            mono
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            disabled={running}
            className="h-8 w-48 text-[13px]"
          />
        </label>

        {done.length > 0 ? (
          <span className={`${w98.small}`}>
            진행 {done.length}/{sorted.length}
          </span>
        ) : null}

        {error ? (
          <p role="alert" className={`${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={running || sorted.length === 0 || !worker.trim()} onClick={run} className="h-7 w-28 font-bold">
          {running ? "처리 중…" : "자동 처리"}
        </Btn>
        <Btn onClick={onClose} disabled={running} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}
