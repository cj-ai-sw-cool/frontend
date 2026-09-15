"use client";

/**
 * 분석 화면 "시뮬레이션" 탭 (Stage 11E, 정본 §16.6) — `analytics-page.tsx` 가 탭 전환으로
 * 이 컴포넌트를 통째로 올린다. 상단(시나리오·실행·진행), 중단(결과), 하단(비교) 셋으로
 * 나눴다 — `slotting-tab.tsx` 와 같은 구조.
 */

import { useState } from "react";
import { useCenter } from "@/lib/center";
import { SimulationComparePanel } from "./simulation-compare-panel";
import { SimulationResultsPanel } from "./simulation-results-panel";
import { SimulationScenarioPanel } from "./simulation-scenario-panel";
import { Panel } from "./win98-ui";

export function SimulationTab({ onOpen3D }: { onOpen3D: () => void }) {
  const center = useCenter();
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── 상단 — 시나리오·실행·진행 ──────────────────────────────────── */}
      <Panel title="시나리오 · 실행" className="h-[280px] shrink-0">
        <SimulationScenarioPanel
          center={center}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={setSelectedScenarioId}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onOpen3D={onOpen3D}
        />
      </Panel>

      {/* ── 중단 — 선택한 실행의 결과 ──────────────────────────────────── */}
      <Panel title="결과 — 리드타임 · 타임라인 · 병목" className="min-h-0 flex-[1.4]">
        <SimulationResultsPanel runId={selectedRunId} />
      </Panel>

      {/* ── 하단 — 실행 두 개 비교 ─────────────────────────────────────── */}
      <Panel title="시나리오 비교" className="h-[280px] shrink-0">
        <SimulationComparePanel
          center={center}
          runA={compareA}
          runB={compareB}
          onSelectRunA={setCompareA}
          onSelectRunB={setCompareB}
        />
      </Panel>
    </div>
  );
}
