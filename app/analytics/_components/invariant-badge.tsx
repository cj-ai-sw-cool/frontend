"use client";

/**
 * 불변식 배지 — 분석 개요 탭 상단(브리프 §1, 정본 §17.3). "입출고 흐름" Panel 제목 줄
 * 오른쪽(`right` prop)에 얹는다 — 이 탭이 872px 세로 예산을 이미 다 쓰고 있어(정본
 * `analytics-page.tsx` 머리말) 새 줄을 얹으면 그 예산 계산이 다 어긋난다. 제목 줄은
 * 높이가 이미 고정이라 자리를 새로 만들지 않는다.
 *
 * 위반 > 0이면 경고색으로 바뀌고, 클릭하면 최근 20회 이력 Dialog(정본 §17.3 "위반 > 0이면
 * 경고색과 목록 링크"). "지금 검사" 버튼은 `POST …/invariant/run`을 불러 이력을 갱신한다
 * — 조회성 검사 트리거라 브리프 금지 규칙("FULL 측정 중 실행 시작·PUT 금지")과 무관하다.
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
      <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
        <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
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
              <tr key={run.id} className={row.total > 0 ? "bg-[#ffdad6]" : undefined}>
                <Td mono>{row.time}</Td>
                <Td>{row.trigger}</Td>
                <Td mono className={row.stockVsLedger > 0 ? "font-bold text-[color:var(--status-error)]" : ""}>
                  {row.stockVsLedger}
                </Td>
                <Td mono className={row.allocationOverStock > 0 ? "font-bold text-[color:var(--status-error)]" : ""}>
                  {row.allocationOverStock}
                </Td>
                <Td mono className={row.ledgerVsOutbox > 0 ? "font-bold text-[color:var(--status-error)]" : ""}>
                  {row.ledgerVsOutbox}
                </Td>
                <Td mono>{row.durationMs}ms</Td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="border-t border-[color:var(--border)] p-3 text-center text-[color:var(--muted-foreground)]">
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

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">{children}</th>
  );
}

function Td({ children, mono = false, className = "" }: { children?: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <td className={`border-t border-[color:var(--border)] p-1.5 ${mono ? w98.mono : ""} ${className}`}>{children}</td>
  );
}
