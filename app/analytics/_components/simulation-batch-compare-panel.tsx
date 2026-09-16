"use client";

/**
 * "시나리오 비교" 패널의 묶음(반복 실행) 모드 — 정본 §17.8 "묶음 vs 묶음 선택 가능, 범위
 * 겹침이면 '차이 불확실' 표시". 백엔드 노트(2026-09-16) §1.11 라이브 대조 — 전용
 * `GET /admin/simulation/compare/batches?batchA=&batchB=`가 있어 `rangesOverlap`도
 * 백엔드가 이미 계산해 준다(프론트가 겹침을 다시 재지 않는다, `use-simulation-batch.ts`).
 *
 * 고를 수 있는 묶음 목록은 `useSimulationRuns(center)`를 `batchId`로 묶어 만든다 —
 * `SimulationRun.batchId`(라이브 대조: 첫 판 실행 자신의 id)가 같은 실행이 2개 이상이면
 * 실제 반복 묶음이다(혼자 돈 실행도 자기 자신을 가리키는 batchId를 갖는다).
 */

import { useMemo, useState } from "react";
import { useSimulationRuns, useSimulationScenarios } from "../_data/use-simulation";
import { useSimulationCompareBatches } from "../_data/use-simulation-batch";
import { LEADTIME_SEGMENTS } from "@/lib/types";
import { SEGMENT_LABEL } from "./simulation-labels";
import { Select, Sunken, w98 } from "./win98-ui";
import { simulationScenarioId, type SimulationRun } from "@/lib/types";

interface BatchOption {
  batchId: number;
  scenarioId: number;
  count: number;
}

export function SimulationBatchComparePanel({
  center,
  onActiveChange,
}: {
  center: string;
  onActiveChange: (active: boolean) => void;
}) {
  const scenarios = useSimulationScenarios(center);
  const runs = useSimulationRuns(center);

  const batchOptions = useMemo(() => {
    const byBatch = new Map<number, SimulationRun[]>();
    for (const run of runs.data ?? []) {
      if (run.batchId === undefined) continue;
      const list = byBatch.get(run.batchId) ?? [];
      list.push(run);
      byBatch.set(run.batchId, list);
    }
    const options: BatchOption[] = [];
    for (const [batchId, members] of byBatch) {
      if (members.length > 1) options.push({ batchId, scenarioId: members[0].scenarioId, count: members.length });
    }
    return options.sort((a, b) => b.batchId - a.batchId);
  }, [runs.data]);

  const [batchAId, setBatchAId] = useState<number | null>(null);
  const [batchBId, setBatchBId] = useState<number | null>(null);

  const selectBatchA = (id: number | null) => {
    setBatchAId(id);
    onActiveChange(id !== null && batchBId !== null);
  };
  const selectBatchB = (id: number | null) => {
    setBatchBId(id);
    onActiveChange(batchAId !== null && id !== null);
  };

  const compare = useSimulationCompareBatches(batchAId, batchBId);

  const nameOf = (scenarioId: number) =>
    scenarios.data?.find((s) => simulationScenarioId(s) === scenarioId)?.name ?? `#${scenarioId}`;

  if (batchOptions.length === 0) {
    return (
      <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
        실행이 2개 이상 만들어진 묶음이 없습니다 — &quot;실행&quot; Dialog에서 반복 횟수를 2 이상으로 돌려보세요.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <BatchSelect label="묶음 A" options={batchOptions} value={batchAId} onChange={selectBatchA} nameOf={nameOf} />
        <BatchSelect label="묶음 B" options={batchOptions} value={batchBId} onChange={selectBatchB} nameOf={nameOf} />
        {compare.data?.p50.rangesOverlap ? (
          <span className="bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
            차이 불확실 — 총 p50 범위가 겹칩니다
          </span>
        ) : null}
      </div>

      {!compare.data ? (
        <p className={`${w98.small} min-h-0 flex-1 text-[color:var(--muted-foreground)]`}>묶음 둘 다 고르세요.</p>
      ) : (
        <CompareBatchBody data={compare.data} />
      )}
    </div>
  );
}

function CompareBatchBody({ data }: { data: NonNullable<ReturnType<typeof useSimulationCompareBatches>["data"]> }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        <BatchSideCard label="A" side={data.a} />
        <BatchSideCard label="B" side={data.b} />
      </div>

      <Sunken className={`${w98.mono} flex items-center gap-4 px-3 py-1.5 text-[12px]`}>
        <span>
          총 p50 차이 {data.p50.diffSec > 0 ? "+" : ""}
          {data.p50.diffSec.toFixed(0)}s ({data.p50.diffPct === null ? "—" : `${data.p50.diffPct.toFixed(1)}%`})
        </span>
        <span>{data.p50.rangesOverlap ? "범위 겹침 — 차이 불확실" : "범위 안 겹침"}</span>
      </Sunken>

      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
            <tr>
              <Th>구간</Th>
              <Th>A 평균(초)</Th>
              <Th>B 평균(초)</Th>
              <Th>차이(초)</Th>
              <Th>겹침</Th>
            </tr>
          </thead>
          <tbody>
            {LEADTIME_SEGMENTS.map((key) => {
              const row = data.segments.find((s) => s.key === key);
              return (
                <tr key={key}>
                  <td className="border-t border-[color:var(--border)] p-1.5">{row?.label ?? SEGMENT_LABEL[key]}</td>
                  <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row ? row.a.avg.toFixed(0) : "—"}</td>
                  <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row ? row.b.avg.toFixed(0) : "—"}</td>
                  <td
                    className={`${w98.mono} border-t border-[color:var(--border)] p-1.5 font-bold ${
                      !row ? "" : row.diff.diffSec <= 0 ? "text-[color:var(--status-success)]" : "text-[color:var(--status-error)]"
                    }`}
                  >
                    {row ? `${row.diff.diffSec > 0 ? "+" : ""}${row.diff.diffSec.toFixed(0)}` : "—"}
                  </td>
                  <td className="border-t border-[color:var(--border)] p-1.5">{row?.diff.rangesOverlap ? "겹침" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Sunken>
    </div>
  );
}

function BatchSideCard({ label, side }: { label: string; side: NonNullable<ReturnType<typeof useSimulationCompareBatches>["data"]>["a"] }) {
  return (
    <Sunken className={`${w98.mono} flex flex-col gap-1 px-3 py-2 text-[12px]`}>
      <span className="font-bold">
        {label} · #{side.batchId} {side.scenarioName} ({side.completed}/{side.runs}회 완료)
      </span>
      <span>
        총 p50 평균 {side.totalP50.avg.toFixed(0)}s (범위 {side.totalP50.min.toFixed(0)}~{side.totalP50.max.toFixed(0)}s)
      </span>
    </Sunken>
  );
}

function BatchSelect({
  label,
  options,
  value,
  onChange,
  nameOf,
}: {
  label: string;
  options: BatchOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  nameOf: (scenarioId: number) => string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className="h-8 w-48 text-[12px]">
        <option value="">선택</option>
        {options.map((o) => (
          <option key={o.batchId} value={o.batchId}>
            #{o.batchId} {nameOf(o.scenarioId)} ({o.count}회)
          </option>
        ))}
      </Select>
    </label>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">{children}</th>
  );
}
