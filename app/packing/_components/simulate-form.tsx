"use client";

import { useState } from "react";
import type { PickBatchDetail } from "@/lib/types";
import { Btn, Field, Sunken, w98 } from "./win98-ui";

const DEFAULT_WORKER = "SIM-01";

/**
 * 자동 처리 폼 — 작업자 코드 + 태스크별 실제 수량(`wave-batch-simulate-dialog.tsx`가 부름,
 * 브리프 §3 S7.6 "태스크 표(순서·칸·상품·로트·지시·실제 수량 입력 기본=지시, 0~지시 범위)").
 *
 * 실제 수량을 비워 두거나 지시 수량 그대로 두면 그 태스크는 요청에 넣지 않는다(정본 §7.5
 * "지정하지 않은 태스크는 지시대로") — 입력칸을 굳이 안 건드린 행까지 매번 `shorts` 에
 * 채워 보낼 필요가 없다.
 */
export function SimulateForm({
  batch,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  batch: PickBatchDetail;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (body: { worker: string; shorts: { pickTaskId: number; foundQty: number }[] }) => void;
  onCancel: () => void;
}) {
  const [worker, setWorker] = useState(DEFAULT_WORKER);
  const [actualQty, setActualQty] = useState<Record<number, string>>({});

  // 재할당 실패로 이미 취소된 몫은 시뮬레이터가 건드릴 대상이 아니다(정본 §7.5 "CANCELLED
  // 태스크는 건너뛴다") — 실행 전 배치는 전부 PENDING 이라 실제로는 걸러질 일이 드물다.
  const tasks = batch.tasks.filter((task) => task.status === "PENDING");

  const canSubmit = worker.trim() !== "" && tasks.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const shorts: { pickTaskId: number; foundQty: number }[] = [];
    for (const task of tasks) {
      const raw = actualQty[task.pickTaskId];
      if (raw === undefined || raw.trim() === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value === task.qty) continue;
      shorts.push({ pickTaskId: task.pickTaskId, foundQty: value });
    }
    onSubmit({ worker: worker.trim(), shorts });
  };

  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <label className="flex max-w-[200px] flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>작업자 코드</span>
          <Field
            mono
            value={worker}
            onChange={(event) => setWorker(event.target.value)}
            className="h-7 w-full text-[14px]"
          />
        </label>

        <span className={`${w98.small} font-bold`}>
          태스크 — 실제 수량을 지시와 다르게 입력하면 부족 피킹으로 처리합니다
        </span>
        <Sunken className={`${w98.scroll} max-h-[320px] overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <th className="p-1.5">순서</th>
                <th className="p-1.5">칸</th>
                <th className="p-1.5">상품</th>
                <th className="p-1.5">로트</th>
                <th className="p-1.5 text-right">지시 수량</th>
                <th className="p-1.5 text-right">실제 수량</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.pickTaskId} className="border-t border-[color:var(--border)]">
                  <td className={`${w98.mono} p-1.5`}>{task.seqNo}</td>
                  <td className={`${w98.mono} p-1.5 font-bold`}>{task.locationCode}</td>
                  <td className="p-1.5">
                    {task.productName}
                    <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                      {task.gtin}
                    </span>
                  </td>
                  <td className={`${w98.mono} p-1.5`}>{task.lotNo}</td>
                  <td className={`${w98.mono} p-1.5 text-right`}>{task.qty}</td>
                  <td className="p-1.5 text-right">
                    <Field
                      type="number"
                      mono
                      min={0}
                      max={task.qty}
                      placeholder={String(task.qty)}
                      value={actualQty[task.pickTaskId] ?? ""}
                      onChange={(event) =>
                        setActualQty((prev) => ({ ...prev, [task.pickTaskId]: event.target.value }))
                      }
                      className="h-7 w-20 text-right text-[13px]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sunken>

        {errorMessage ? (
          <div
            role="alert"
            className={`${w98.sunken} ${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={!canSubmit || isSubmitting} onClick={submit} className="h-7 w-28 font-bold">
          {isSubmitting ? "처리 중…" : "실행"}
        </Btn>
        <Btn onClick={onCancel} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}
