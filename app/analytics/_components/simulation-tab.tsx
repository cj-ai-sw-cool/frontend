"use client";

/**
 * 분석 화면 "시뮬레이션" 탭 (Stage 11E, 정본 §16.6) — `analytics-page.tsx` 가 탭 전환으로
 * 이 컴포넌트를 통째로 올린다. 상단(시나리오·실행·진행), 중단(결과), 하단(비교) 셋으로
 * 나눴다 — `slotting-tab.tsx` 와 같은 구조.
 *
 * ── 세로 예산 ──────────────────────────────────────────────────────────────
 * 이 화면은 스크롤이 없다(`analytics/layout.tsx` 머리말 "이 화면은 스크롤이 없다 — 각
 * 화면이 872px 안에서 끝나야 한다") — 세 패널이 고정 872px(탭 줄 제외) 을 나눠 쓴다.
 * ⚠️ 비교 패널은 **실행 두 개를 고르기 전에는 접혀 있는다**(`h-[84px]`, 셀렉트 두 줄 +
 * 안내문만) — 2026-09-15 화면 체크에서 결과 패널이 리드타임 막대 한 줄만 보이고 타임라인·
 * 자원 점유·병목이 잘려 나가는 결함이 나왔다: 비교 패널을 시나리오 패널과 똑같이
 * 280px 고정으로 뒀더니 결과 패널에 남는 게 229px(1440 폭 기준, 순수 차트 영역은 그보다
 * 더 작다)뿐이었다. 시나리오 패널도 230px로 줄였다(목록은 어차피 안쪽 스크롤이 있다,
 * `simulation-scenario-panel.tsx`) — 남는 공간을 전부 결과 패널(`flex-1`)에 준다.
 */

import { useMemo, useState } from "react";
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

  const compareActive = compareA !== null && compareB !== null;
  const compareHeightClass = useMemo(() => (compareActive ? "h-[280px]" : "h-[84px]"), [compareActive]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── 상단 — 시나리오·실행·진행 ──────────────────────────────────── */}
      <Panel title="시나리오 · 실행" className="h-[230px] shrink-0">
        <SimulationScenarioPanel
          center={center}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={setSelectedScenarioId}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onOpen3D={onOpen3D}
        />
      </Panel>

      {/* ── 중단 — 선택한 실행의 결과. 시나리오·비교가 남긴 공간을 전부 받는다 ──── */}
      <Panel title="결과 — 리드타임 · 타임라인 · 병목" className="min-h-0 flex-1">
        <SimulationResultsPanel runId={selectedRunId} />
      </Panel>

      {/* ── 하단 — 실행 두 개 비교. 고르기 전에는 접혀 있는다(위 세로 예산 주석) ── */}
      <Panel title="시나리오 비교" className={`${compareHeightClass} shrink-0 transition-[height]`}>
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
