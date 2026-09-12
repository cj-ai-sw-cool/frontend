"use client";

import { useState } from "react";
import type { PickBatchDetail } from "@/lib/types";
import { useRebinSession } from "../_data/use-waves";
import { PickTaskPanel } from "./pick-task-panel";
import { RebinPanel } from "./rebin-panel";
import { Btn } from "./win98-ui";

/**
 * 우측 열 — 피킹 지시 표와 리빈 벽을 탭으로 나눈 배치(브리프 §3 S8.3 "피킹 지시 표는 그대로
 * 두고 그 아래 또는 탭으로 — 높이 예산 안에서 결정"). 배치가 `DONE` 일 때만 "리빈" 탭이
 * 나타난다 — 리빈은 DONE 배치에서만 의미가 있다(정본 §8.1 "세션 시작: 배치 DONE 검사").
 *
 * ── 배치("아래" vs "탭") 결정과 근거 ────────────────────────────────────────
 * 두 표를 세로로 쌓지 않고 탭으로 나눈 이유: 웨이브 탭의 세로 예산은 872px 고정이고, 피킹
 * 지시 표(`pick-task-panel.tsx`)는 이미 그 안에서 `min-h-0 flex-1` 로 남는 높이를 전부 쓴다
 * (배치당 태스크가 SKU 수만큼 많을 수 있어 표 자체가 길다). 리빈 벽 표도 슬롯 수만큼
 * 길어질 수 있으므로, 둘을 같은 열에 세로로 쌓으면 각자 절반씩만 받아 스크롤이 두 겹으로
 * 생기고 어느 쪽도 몇 줄 못 보여준다. 탭으로 나누면 보고 있는 표가 항상 열의 전체 높이를
 * 쓴다 — 세로 예산을 늘리지 않고도 두 표 모두 충분히 보인다.
 *
 * 탭 바(h-5=20px + gap-1=4px = 24px)만큼 두 표의 가용 높이가 줄어들지만, 두 표 모두 자기
 * 안에서 스크롤하는 `Sunken`(`overflow-y-auto`)이라 24px 를 흡수해도 넘치지 않는다(포장
 * 탭 `page.tsx` 의 "탭 바가 생기면 flex-1 칸이 그만큼 줄며 흡수한다"는 계산과 같은 원칙).
 *
 * ⚠️ 다른 배치를 고르면 "피킹 지시" 탭으로 되돌아가야 한다(이전 배치의 리빈 화면이 새
 *    배치에 남아 있으면 혼동을 준다) — effect 로 `setView`를 부르는 대신, 부모
 *    (`waves-tab.tsx`)가 `key={selectedBatchId}`를 걸어 배치가 바뀔 때마다 이 컴포넌트를
 *    통째로 새로 만든다. React 공식 패턴("prop 이 바뀌면 상태를 전부 리셋") — effect 안
 *    setState 로 인한 이중 렌더가 없다(react-hooks/set-state-in-effect).
 */
export function BatchDetailPanel({
  batch,
  isLoading,
  errorMessage,
  onOpenRebin,
  className = "",
}: {
  batch: PickBatchDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
  /** "리빈 자동 처리" 버튼 — 대화 상자를 여는 것은 부모(`waves-tab.tsx`)의 몫이다 */
  onOpenRebin: (pickBatchId: number) => void;
  className?: string;
}) {
  const [view, setView] = useState<"tasks" | "rebin">("tasks");
  const showRebinTab = batch !== null && batch.status === "DONE";

  const rebinSessionQuery = useRebinSession(showRebinTab ? batch.pickBatchId : null);

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-1 ${className}`}>
      {showRebinTab ? (
        <div className="flex shrink-0 gap-1">
          <Btn
            pressed={view === "tasks"}
            onClick={() => setView("tasks")}
            className="h-5 px-3 text-[12px] font-bold"
          >
            피킹 지시
          </Btn>
          <Btn
            pressed={view === "rebin"}
            onClick={() => setView("rebin")}
            className="h-5 px-3 text-[12px] font-bold"
          >
            리빈
          </Btn>
        </div>
      ) : null}

      {batch !== null && batch.status === "DONE" && view === "rebin" ? (
        <RebinPanel
          session={rebinSessionQuery.data ?? null}
          isLoading={rebinSessionQuery.isLoading}
          error={rebinSessionQuery.error ?? null}
          onOpenSimulate={() => onOpenRebin(batch.pickBatchId)}
        />
      ) : (
        <PickTaskPanel batch={batch} isLoading={isLoading} errorMessage={errorMessage} />
      )}
    </div>
  );
}
