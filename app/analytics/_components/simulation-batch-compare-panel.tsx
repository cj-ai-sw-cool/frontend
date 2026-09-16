"use client";

/**
 * "시나리오 비교" 패널의 묶음(반복 실행) 모드 — 정본 §17.8 "묶음 vs 묶음 선택 가능, 범위
 * 겹침이면 '차이 불확실' 표시". 실행 vs 실행 비교(`simulation-compare-panel.tsx`)는
 * 라이브 `GET /admin/simulation/compare`를 그대로 쓰지만, 이 화면은 그 엔드포인트가
 * 실행 두 개만 받아 묶음을 모른다 — 배치 안 각 실행의 `GET …/leadtime`을 모아
 * 클라이언트에서 직접 비교한다(`use-simulation-batch.ts`의 `useSimulationBatchLeadtime`,
 * 라이브 응답을 그대로 집계하므로 표본은 아니다).
 *
 * "차이 불확실" 판정: 총 리드타임 p50 범위 [min,max]가 두 묶음에서 겹치면 — 반복 안에서도
 * 이 정도 흔들리는 값이라 평균 차이만으로 어느 쪽이 낫다고 말할 수 없다는 뜻이다.
 */

import { useState } from "react";
import { useSimulationScenarios } from "../_data/use-simulation";
import { useSimulationBatchLeadtime } from "../_data/use-simulation-batch";
import { LEADTIME_SEGMENTS } from "@/lib/types";
import { SEGMENT_LABEL } from "./simulation-labels";
import { Select, Sunken, w98 } from "./win98-ui";
import { simulationScenarioId, type SimulationBatchGroup } from "@/lib/types";

export function SimulationBatchComparePanel({
  center,
  batches,
  onActiveChange,
}: {
  center: string;
  batches: SimulationBatchGroup[];
  onActiveChange: (active: boolean) => void;
}) {
  const scenarios = useSimulationScenarios(center);

  // 실행이 2개 이상 만들어진 묶음만 비교 대상 — 아직 끝나지 않았어도 고를 수 있다,
  // `useSimulationBatchLeadtime`이 진행 중인 실행의 409를 스스로 재시도하며 채운다.
  const comparableBatches = batches.filter((b) => b.runIds.length >= 2);

  const [batchAId, setBatchAId] = useState<string | null>(null);
  const [batchBId, setBatchBId] = useState<string | null>(null);
  const batchA = comparableBatches.find((b) => b.batchId === batchAId) ?? null;
  const batchB = comparableBatches.find((b) => b.batchId === batchBId) ?? null;

  const selectBatchA = (id: string | null) => {
    setBatchAId(id);
    onActiveChange(id !== null && batchBId !== null);
  };
  const selectBatchB = (id: string | null) => {
    setBatchBId(id);
    onActiveChange(batchAId !== null && id !== null);
  };

  const statsA = useSimulationBatchLeadtime(batchA);
  const statsB = useSimulationBatchLeadtime(batchB);

  const nameOf = (b: SimulationBatchGroup) =>
    scenarios.data?.find((s) => simulationScenarioId(s) === b.scenarioId)?.name ?? `#${b.scenarioId}`;

  if (comparableBatches.length === 0) {
    return (
      <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
실행이 2개 이상 만들어진 묶음이 없습니다 — &quot;실행&quot; Dialog에서 반복 횟수를 2 이상으로 돌려보세요.
      </p>
    );
  }

  const totalA = statsA.data?.totalP50 ?? null;
  const totalB = statsB.data?.totalP50 ?? null;
  const overlaps = totalA && totalB ? totalA.min <= totalB.max && totalB.min <= totalA.max : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <BatchSelect label="묶음 A" batches={comparableBatches} value={batchAId} onChange={selectBatchA} nameOf={nameOf} />
        <BatchSelect label="묶음 B" batches={comparableBatches} value={batchBId} onChange={selectBatchB} nameOf={nameOf} />
        {overlaps ? (
          <span className="bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
            차이 불확실 — 총 p50 범위가 겹칩니다
          </span>
        ) : null}
      </div>

      {!totalA || !totalB ? (
        <p className={`${w98.small} min-h-0 flex-1 text-[color:var(--muted-foreground)]`}>묶음 둘 다 고르세요.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <Sunken className={`${w98.mono} flex flex-col gap-1 px-3 py-2 text-[12px]`}>
              <span className="font-bold">A · {batchA ? nameOf(batchA) : ""} ({totalA.n}회)</span>
              <span>총 p50 평균 {totalA.avg.toFixed(0)}s (범위 {totalA.min.toFixed(0)}~{totalA.max.toFixed(0)}s)</span>
            </Sunken>
            <Sunken className={`${w98.mono} flex flex-col gap-1 px-3 py-2 text-[12px]`}>
              <span className="font-bold">B · {batchB ? nameOf(batchB) : ""} ({totalB.n}회)</span>
              <span>총 p50 평균 {totalB.avg.toFixed(0)}s (범위 {totalB.min.toFixed(0)}~{totalB.max.toFixed(0)}s)</span>
            </Sunken>
          </div>

          <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
            <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
                <tr>
                  <Th>구간</Th>
                  <Th>A 평균(초)</Th>
                  <Th>B 평균(초)</Th>
                  <Th>차이(초)</Th>
                </tr>
              </thead>
              <tbody>
                {LEADTIME_SEGMENTS.map((key) => {
                  const a = statsA.data?.perSegment[key];
                  const b = statsB.data?.perSegment[key];
                  const diff = a && b ? b.avg - a.avg : null;
                  return (
                    <tr key={key}>
                      <td className="border-t border-[color:var(--border)] p-1.5">{SEGMENT_LABEL[key]}</td>
                      <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{a ? a.avg.toFixed(0) : "—"}</td>
                      <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{b ? b.avg.toFixed(0) : "—"}</td>
                      <td
                        className={`${w98.mono} border-t border-[color:var(--border)] p-1.5 font-bold ${
                          diff === null ? "" : diff <= 0 ? "text-[color:var(--status-success)]" : "text-[color:var(--status-error)]"
                        }`}
                      >
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(0)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Sunken>
        </div>
      )}
    </div>
  );
}

function BatchSelect({
  label,
  batches,
  value,
  onChange,
  nameOf,
}: {
  label: string;
  batches: SimulationBatchGroup[];
  value: string | null;
  onChange: (id: string | null) => void;
  nameOf: (b: SimulationBatchGroup) => string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} className="h-8 w-48 text-[12px]">
        <option value="">선택</option>
        {batches.map((b) => (
          <option key={b.batchId} value={b.batchId}>
            {nameOf(b)} ({b.runIds.length}/{b.size}회)
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
