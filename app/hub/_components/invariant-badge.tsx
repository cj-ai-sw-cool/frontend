"use client";

/**
 * 불변식 배지 — 허브 관제 탭 상단(브리프 §1, 정본 §17.3). `control-tab.tsx`의 셀렉트·
 * StatusLine 옆에 얹는다. `app/analytics/_components/invariant-badge.tsx`와 로직은
 * 같지만(포맷터는 `lib/invariant-format.ts` 공용) 이 라우트 자체 `win98-ui.tsx`·
 * `table.tsx` 사본을 쓴다 — 화면마다 코드를 공유하지 않는 관례(`analytics-page.tsx`
 * 머리말 참고).
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invariantBadgeState, invariantDetailList, invariantRowSummary } from "@/lib/invariant-format";
import { useInvariantRuns, useRunInvariantCheck } from "@/lib/use-invariant";
import { Th, Td } from "./table";
import { Btn, w98 } from "./win98-ui";

export function InvariantBadge({ center }: { center: string }) {
  const [open, setOpen] = useState(false);
  const runs = useInvariantRuns(center);
  const runCheck = useRunInvariantCheck(center);
  const state = invariantBadgeState(runs.data);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${w98.small} ${w98.sunken} px-1.5 py-0.5 font-bold ${
          state.hasWarning ? "bg-[color:var(--status-error)] text-white" : "bg-[color:var(--surface-bright)]"
        }`}
      >
        {state.label}
        {runs.usingMock ? " · 표본" : ""}
      </button>
      <Btn
        disabled={runCheck.isPending}
        onClick={() => runCheck.mutate()}
        className="h-6 px-2 text-[11px]"
      >
        {runCheck.isPending ? "검사 중…" : "지금 검사"}
      </Btn>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={`${w98.dialogTheme} ${w98.raised} w-[620px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
        >
          <DialogHeader
            className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
          >
            <DialogTitle className={w98.titleText}>불변식 이력 — 최근 20회</DialogTitle>
            <DialogDescription className="sr-only">
              센터 {center}의 불변식 검사 이력과 위반 목록을 봅니다.
            </DialogDescription>
          </DialogHeader>
          <InvariantHistoryBody runs={runs.data ?? []} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvariantHistoryBody({ runs }: { runs: ReturnType<typeof useInvariantRuns>["data"] }) {
  const rows = runs ?? [];
  return (
    <div className="flex max-h-[480px] flex-col gap-2 overflow-y-auto p-3">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-[color:var(--surface)]">
          <tr>
            <Th>시각</Th>
            <Th>트리거</Th>
            <Th>재고↔원장</Th>
            <Th>할당&gt;재고</Th>
            <Th>원장↔아웃박스</Th>
            <Th>소요</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((run) => {
            const row = invariantRowSummary(run);
            return (
              <tr
                key={run.id}
                className={`border-b border-[color:var(--border)] ${row.total > 0 ? "bg-[#ffdad6]" : ""}`}
              >
                <Td mono>{row.time}</Td>
                <Td>{row.trigger}</Td>
                <Td mono>{row.stockVsLedger}</Td>
                <Td mono>{row.allocationOverStock}</Td>
                <Td mono>{row.ledgerVsOutbox}</Td>
                <Td mono>{row.durationMs}ms</Td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-3 text-center text-[color:var(--muted-foreground)]">
                이력 없음
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {rows.some((r) => invariantDetailList(r).length > 0) ? (
        <div className="flex flex-col gap-1">
          <span className={`${w98.small} font-bold`}>위반 목록</span>
          {rows
            .filter((r) => invariantDetailList(r).length > 0)
            .map((r) => (
              <pre
                key={r.id}
                className={`${w98.mono} ${w98.sunken} overflow-x-auto bg-[color:var(--surface-bright)] p-2 text-[11px]`}
              >
                {JSON.stringify(invariantDetailList(r), null, 2)}
              </pre>
            ))}
        </div>
      ) : null}
    </div>
  );
}
