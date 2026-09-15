"use client";

/**
 * 시뮬레이션 탭 하단 — 실행 A·B 비교(정본 §16.5·§16.6). 완료(`DONE`) 실행만 고를 수
 * 있다 — 진행 중인 실행은 리드타임 집계가 아직 저장되지 않는다(정본 §16.4 "실행 종료
 * 시 한 번 계산").
 */

import { useSimulationCompare, useSimulationRuns, useSimulationScenarios } from "../_data/use-simulation";
import { RESOURCE_LABEL, SEGMENT_LABEL } from "./simulation-labels";
// ⚠️ `SEGMENT_LABEL` 은 비교 구간 표에만 남겨 둔다 — `SimulationCompareSegmentRow` 는
// 자체 `label` 을 안 준다(백엔드 노트가 label 추가를 알려온 자리는 leadtime·bottleneck
// 뿐이다), 그래서 여기만 클라이언트 폴백 맵을 그대로 쓴다.
import { Select, Sunken, w98 } from "./win98-ui";
import { simulationRunId, type SimulationRun } from "@/lib/types";

export function SimulationComparePanel({
  center,
  runA,
  runB,
  onSelectRunA,
  onSelectRunB,
}: {
  center: string;
  runA: number | null;
  runB: number | null;
  onSelectRunA: (id: number | null) => void;
  onSelectRunB: (id: number | null) => void;
}) {
  const scenarios = useSimulationScenarios(center);
  const runs = useSimulationRuns(center);
  const doneRuns = (runs.data ?? []).filter((r) => r.status === "DONE");
  const compare = useSimulationCompare(runA, runB);
  /** 부모(`simulation-tab.tsx`)가 이 값으로 패널 높이를 84px/280px 로 접었다 편다
   * (872px 고정 예산, 위 세로 예산 주석) — 여기서도 접혔을 때는 셀렉트 두 줄만 남기고
   * 안내문을 뺀다. 안 그러면 84px 안에 select(32px) + 안내문 줄이 겹쳐 아래 결과 패널을
   * 침범한다(2026-09-15 화면 체크에서 발견). */
  const compact = !(runA !== null && runB !== null);

  const nameOf = (run: SimulationRun) =>
    scenarios.data?.find((s) => s.id === run.scenarioId)?.name ?? `#${run.scenarioId}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-3">
        <RunSelect label="실행 A" runs={doneRuns} value={runA} onChange={onSelectRunA} nameOf={nameOf} />
        <RunSelect label="실행 B" runs={doneRuns} value={runB} onChange={onSelectRunB} nameOf={nameOf} />
        {!compact && doneRuns.length < 2 ? (
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>완료된 실행이 2개 이상이어야 비교할 수 있습니다.</span>
        ) : null}
      </div>

      {compact ? null : compare.data ? (
        <CompareBody data={compare.data} />
      ) : (
        <p className={`${w98.small} min-h-0 flex-1 text-[color:var(--muted-foreground)]`}>비교 불러오는 중…</p>
      )}
    </div>
  );
}

function RunSelect({
  label,
  runs,
  value,
  onChange,
  nameOf,
}: {
  label: string;
  runs: SimulationRun[];
  value: number | null;
  onChange: (id: number | null) => void;
  nameOf: (run: SimulationRun) => string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <Select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="h-8 w-40 text-[12px]"
      >
        <option value="">선택</option>
        {runs.map((run) => (
          <option key={simulationRunId(run)} value={simulationRunId(run)}>
            #{simulationRunId(run)} {nameOf(run)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function CompareBody({ data }: { data: NonNullable<ReturnType<typeof useSimulationCompare>["data"]> }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        <Sunken className={`${w98.mono} flex flex-col gap-1 px-3 py-2 text-[12px]`}>
          <span className="font-bold">A · #{data.runA}</span>
          <span>완료율 {data.completionRatePctA.toFixed(1)}%</span>
          <span>피크 출고 지연 {data.peakShipDelaySecA}초</span>
          <span>
            병목 {data.bottleneckA.label} · {data.bottleneckA.saturated.map((r) => RESOURCE_LABEL[r]).join("·")}
          </span>
        </Sunken>
        <Sunken className={`${w98.mono} flex flex-col gap-1 px-3 py-2 text-[12px]`}>
          <span className="font-bold">B · #{data.runB}</span>
          <span>완료율 {data.completionRatePctB.toFixed(1)}%</span>
          <span>피크 출고 지연 {data.peakShipDelaySecB}초</span>
          <span>
            병목 {data.bottleneckB.label} · {data.bottleneckB.saturated.map((r) => RESOURCE_LABEL[r]).join("·")}
          </span>
        </Sunken>
      </div>

      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
            <tr>
              <Th>구간</Th>
              <Th>A(초)</Th>
              <Th>B(초)</Th>
              <Th>차이(초)</Th>
              <Th>차이(%)</Th>
            </tr>
          </thead>
          <tbody>
            {data.segments.map((row) => (
              <tr key={row.segment}>
                <td className="border-t border-[color:var(--border)] p-1.5">{SEGMENT_LABEL[row.segment]}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row.aSec}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row.bSec}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row.diffSec}</td>
                <td
                  className={`${w98.mono} border-t border-[color:var(--border)] p-1.5 font-bold ${
                    row.diffPct >= 0 ? "text-[color:var(--status-success)]" : "text-[color:var(--status-error)]"
                  }`}
                >
                  {row.diffPct > 0 ? "+" : ""}
                  {row.diffPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sunken>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">{children}</th>
  );
}
