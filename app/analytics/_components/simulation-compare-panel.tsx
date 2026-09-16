"use client";

/**
 * 시뮬레이션 탭 하단 — 실행 A·B 비교(정본 §16.5·§16.6). 끝난 실행(`DONE`·`STOPPED`)만
 * 고를 수 있다 — 진행 중인 실행은 리드타임 집계가 아직 저장되지 않아 결과 조회가
 * 409(Conflict)로 막힌다(정본 §16.4 "실행 종료 시 한 번 계산", 라이브 대조로 확인).
 * ⚠️ 처음엔 `DONE` 만 걸렀는데, 라이브 화면 체크에서 "정지" 로 끝낸 실행(STOPPED)도
 * 리드타임·병목이 정상적으로 나오는 걸 확인했다 — 둘 다 비교 대상에 넣는다.
 */

import { useEffect, useState } from "react";
import { useSimulationCompare, useSimulationRuns, useSimulationScenarios } from "../_data/use-simulation";
import { RESOURCE_LABEL } from "./simulation-labels";
import { SimulationBatchComparePanel } from "./simulation-batch-compare-panel";
import { Btn, Select, Sunken, w98 } from "./win98-ui";
import { simulationRunId, simulationScenarioId, type SimulationRun } from "@/lib/types";

type CompareMode = "run" | "batch";

export function SimulationComparePanel({
  center,
  runA,
  runB,
  onSelectRunA,
  onSelectRunB,
  onActiveChange,
}: {
  center: string;
  runA: number | null;
  runB: number | null;
  onSelectRunA: (id: number | null) => void;
  onSelectRunB: (id: number | null) => void;
  /** 부모(`simulation-tab.tsx`)에 "펼침" 여부를 보고한다 — 모드에 따라 판정 기준이
   * 다르다(실행 둘 다 vs 묶음 둘 다) */
  onActiveChange: (active: boolean) => void;
}) {
  const [mode, setMode] = useState<CompareMode>("run");
  const [batchModeActive, setBatchModeActive] = useState(false);

  useEffect(() => {
    onActiveChange(mode === "run" ? runA !== null && runB !== null : batchModeActive);
  }, [mode, runA, runB, batchModeActive, onActiveChange]);
  const scenarios = useSimulationScenarios(center);
  const runs = useSimulationRuns(center);
  const doneRuns = (runs.data ?? []).filter((r) => r.status === "DONE" || r.status === "STOPPED");
  const compare = useSimulationCompare(runA, runB);
  /** 부모(`simulation-tab.tsx`)가 이 값으로 패널 높이를 84px/280px 로 접었다 편다
   * (872px 고정 예산, 위 세로 예산 주석) — 여기서도 접혔을 때는 셀렉트 두 줄만 남기고
   * 안내문을 뺀다. 안 그러면 84px 안에 select(32px) + 안내문 줄이 겹쳐 아래 결과 패널을
   * 침범한다(2026-09-15 화면 체크에서 발견). 묶음 모드는 자체 활성 상태(`batchModeActive`)
   * 로 같은 접힘 판정에 합류한다. */
  const compact = mode === "run" ? !(runA !== null && runB !== null) : !batchModeActive;

  const nameOf = (run: SimulationRun) =>
    scenarios.data?.find((s) => simulationScenarioId(s) === run.scenarioId)?.name ?? `#${run.scenarioId}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <Btn pressed={mode === "run"} onClick={() => setMode("run")} className="h-6 px-2 text-[11px]">
          실행
        </Btn>
        <Btn pressed={mode === "batch"} onClick={() => setMode("batch")} className="h-6 px-2 text-[11px]">
          묶음
        </Btn>
      </div>

      {mode === "batch" ? (
        <SimulationBatchComparePanel center={center} onActiveChange={setBatchModeActive} />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-3">
            <RunSelect label="실행 A" runs={doneRuns} value={runA} onChange={onSelectRunA} nameOf={nameOf} />
            <RunSelect label="실행 B" runs={doneRuns} value={runB} onChange={onSelectRunB} nameOf={nameOf} />
            {!compact && doneRuns.length < 2 ? (
              <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>끝난(완료·정지) 실행이 2개 이상이어야 비교할 수 있습니다.</span>
            ) : null}
          </div>

          {compact ? null : compare.data ? (
            <CompareBody data={compare.data} />
          ) : (
            <p className={`${w98.small} min-h-0 flex-1 text-[color:var(--muted-foreground)]`}>비교 불러오는 중…</p>
          )}
        </>
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

/** 라이브 대조(2026-09-16) — 응답이 `{runA,runB,completionRatePctA/B,...}` 플랫 구조가
 * 아니라 `a`/`b`(실행 요약 전체) + `segments` + `p50`/`p95` + `bottleneck.{a,b}` +
 * `peakHour.{a,b}` 였다. `SEGMENT_LABEL` 폴백 없이 `row.label`(구간 표)을 바로 쓴다 —
 * 비교 구간도 leadtime 과 같이 `label`을 준다. */
function CompareBody({ data }: { data: NonNullable<ReturnType<typeof useSimulationCompare>["data"]> }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        <SideCard label="A" side={data.a} bottleneck={data.bottleneck.a} />
        <SideCard label="B" side={data.b} bottleneck={data.bottleneck.b} />
      </div>

      <Sunken className={`${w98.mono} flex items-center gap-4 px-3 py-1.5 text-[12px]`}>
        <span>
          총 리드타임 p50 A {data.p50.a.toFixed(0)}s · B {data.p50.b.toFixed(0)}s
        </span>
        <span>
          p95 A {data.p95.a.toFixed(0)}s · B {data.p95.b.toFixed(0)}s
        </span>
        <span>{data.sameInput ? "같은 유입(자원 조건만 차이)" : "유입 조건 다름"}</span>
      </Sunken>

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
              <tr key={row.key}>
                <td className="border-t border-[color:var(--border)] p-1.5">{row.label}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row.aSec}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row.bSec}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{row.diffSec}</td>
                {/* `diffPct` 는 A 가 0(그 구간을 아무도 안 거침, 주로 출고 대기)이면 null —
                 * 라이브 대조 전에는 늘 값이 있다고 가정해 `.toFixed` 가 죽었다(2026-09-16
                 * 화면 체크에서 발견). */}
                <td
                  className={`${w98.mono} border-t border-[color:var(--border)] p-1.5 font-bold ${
                    row.diffPct === null
                      ? ""
                      : row.diffPct >= 0
                        ? "text-[color:var(--status-success)]"
                        : "text-[color:var(--status-error)]"
                  }`}
                >
                  {row.diffPct === null ? "—" : `${row.diffPct > 0 ? "+" : ""}${row.diffPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sunken>
    </div>
  );
}

function SideCard({
  label,
  side,
  bottleneck,
}: {
  label: string;
  side: NonNullable<ReturnType<typeof useSimulationCompare>["data"]>["a"];
  bottleneck: NonNullable<ReturnType<typeof useSimulationCompare>["data"]>["bottleneck"]["a"];
}) {
  return (
    <Sunken className={`${w98.mono} flex flex-col gap-1 px-3 py-2 text-[12px]`}>
      <span className="font-bold">
        {label} · #{side.runId} {side.name}
      </span>
      <span>완료율 {side.orders.completionPct.toFixed(1)}% (출고 {side.orders.shipped.toLocaleString()}건)</span>
      <span>
        병목 {bottleneck.label} ·{" "}
        {bottleneck.saturated.length > 0 ? bottleneck.saturated.map((r) => RESOURCE_LABEL[r]).join("·") : "없음"}
      </span>
    </Sunken>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">{children}</th>
  );
}
