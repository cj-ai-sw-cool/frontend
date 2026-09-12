"use client";

/**
 * "실사" 탭 — Stage 10, 정본 §10.4, 브리프 §3 S10.3.
 *
 * 마스터 창(`master-window.tsx`)의 네 번째 탭. 위 — "실사 생성"(days·topN) → 아래 — 태스크
 * 표(칸·존·사유·상태·담당). 행을 고르고 "실사 시작"을 누르면 `IcqaCountDialog`가 블라인드
 * 카운트 → 제출 → 결과까지 이어서 보여준다.
 *
 * 결과 패널의 "재카운트 실사 열기"는 이 탭의 `activeTaskId` 를 재카운트 태스크 id 로 바꿔
 * 대화 상자를 다시 연다 — `IcqaCountDialog` 를 그 id 로 `key` 를 걸어 강제로 새로 마운트한다
 * (열려 있는 채로 id 만 바뀌면 이전 태스크의 폼·결과 상태가 남는다, `rebin-simulate-dialog.tsx`
 * 의 "DialogContent 는 닫힐 때 언마운트" 관례와 같은 이유).
 */

import { useState } from "react";
import { toast } from "sonner";
import type { CountTaskStatus } from "@/lib/types";
import { useCountTasks, useGenerateCountTasks } from "../_data/use-icqa";
import { Th, Td } from "./master-window";
import { Btn, Field, Select, Sunken, w98 } from "./win98-ui";
import { IcqaCountDialog } from "./icqa-count-dialog";

const REASON_LABEL: Record<string, string> = {
  CYCLE_ROTATION: "회전 상위",
  CYCLE_RECENT_ADJUST: "최근 조정",
  PICK_DISCREPANCY: "피킹 불일치",
  RECOUNT: "재카운트",
};

const STATUS_LABEL: Record<CountTaskStatus, string> = {
  OPEN: "대기",
  COUNTING: "카운팅 중",
  DONE: "완료",
  RECOUNT_NEEDED: "재카운트 필요",
  CANCELLED: "취소",
};

export function IcqaTab() {
  const [statusFilter, setStatusFilter] = useState<CountTaskStatus | "">("");
  const { data: page, isLoading, error } = useCountTasks(statusFilter ? { status: statusFilter } : undefined);
  const generate = useGenerateCountTasks();

  const [days, setDays] = useState("7");
  const [topN, setTopN] = useState("5");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  const selectedTask = page?.content.find((t) => t.countTaskId === selectedTaskId) ?? null;
  const canStart = selectedTask !== null && selectedTask.status === "OPEN";

  const runGenerate = () => {
    const parsedDays = Number(days);
    const parsedTopN = Number(topN);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) return;
    if (!Number.isFinite(parsedTopN) || parsedTopN <= 0) return;
    generate.mutate(
      { days: parsedDays, topN: parsedTopN },
      {
        onSuccess: (result) =>
          toast.success(`실사 생성 ${result.created.length}건 · 건너뜀 ${result.skipped.length}건`, {
            className: "win98-toast",
            duration: 2400,
          }),
        onError: (err) =>
          toast.error("실사 생성에 실패했습니다", { className: "win98-toast", duration: 2600, description: err.message }),
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* 실사 생성 */}
      <div className={`${w98.raised} flex shrink-0 flex-wrap items-end gap-2 bg-[color:var(--surface)] p-2`}>
        <label className="flex flex-col gap-1 text-[12px]">
          기간(일)
          <Field
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            className="h-7 w-[70px] text-right text-[13px]"
            mono
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          상위 N
          <Field
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
            inputMode="numeric"
            className="h-7 w-[70px] text-right text-[13px]"
            mono
          />
        </label>
        <Btn onClick={runGenerate} disabled={generate.isPending} className="h-7 px-4 font-bold">
          {generate.isPending ? "생성 중…" : "실사 생성"}
        </Btn>

        <label className="ml-auto flex flex-col gap-1 text-[12px]">
          상태
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CountTaskStatus | "")}
            className="h-7 w-[140px] text-[13px]"
          >
            <option value="">전체</option>
            {Object.entries(STATUS_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {/* 태스크 표 */}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>칸</Th>
              <Th>존</Th>
              <Th>사유</Th>
              <Th>상태</Th>
              <Th>담당</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                  실사 태스크를 불러오는 중…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="p-3 text-[color:var(--status-error)]">
                  실사 태스크를 불러오지 못했습니다.
                </td>
              </tr>
            ) : page?.content.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                  &ldquo;실사 생성&rdquo;을 눌러 태스크를 만드세요.
                </td>
              </tr>
            ) : (
              page?.content.map((task) => (
                <tr
                  key={task.countTaskId}
                  onClick={() => setSelectedTaskId(task.countTaskId)}
                  className={`cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)] ${
                    task.countTaskId === selectedTaskId ? "bg-[color:var(--surface-variant)] font-bold" : ""
                  }`}
                >
                  <Td mono>{task.locationCode}</Td>
                  <Td mono>{task.zoneCode}</Td>
                  <Td>{REASON_LABEL[task.reason] ?? task.reason}</Td>
                  <Td>{STATUS_LABEL[task.status]}</Td>
                  <Td mono>{task.worker ?? "—"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      <div className="flex shrink-0 justify-end">
        <Btn disabled={!canStart} onClick={() => setActiveTaskId(selectedTaskId)} className="h-7 px-4 font-bold">
          실사 시작
        </Btn>
      </div>

      <IcqaCountDialog
        key={activeTaskId ?? "none"}
        countTaskId={activeTaskId}
        onOpenChange={(open) => {
          if (!open) setActiveTaskId(null);
        }}
        onOpenRecount={(recountTaskId) => {
          setSelectedTaskId(recountTaskId);
          setActiveTaskId(recountTaskId);
        }}
      />
    </div>
  );
}
