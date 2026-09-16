"use client";

/**
 * 시뮬레이션 탭 상단 — 시나리오 목록 + 실행/정지 + 진행 띠(정본 §16.6). 행을 고르면
 * 그 시나리오의 최근 실행을 아래 결과 패널에 올린다(`onSelectRun`) — `slotting-tab.tsx`
 * 가 `activeProposalId` 를 자식에 내려주는 것과 같은 얕은 상태 끌어올리기.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import { useCreateRunBatch } from "../_data/use-simulation-batch";
import { useCreateDefaultScenarios, useStopRun } from "../_data/use-simulation-mutations";
import {
  useSimulationParams,
  useSimulationRunProgress,
  useSimulationRuns,
  useSimulationScenarios,
} from "../_data/use-simulation";
import { RUN_STATUS_LABEL } from "./simulation-labels";
import { SimulationRunDialog } from "./simulation-run-dialog";
import { SimulationScenarioCreateDialog } from "./simulation-scenario-create-dialog";
import { Btn, Sunken, w98 } from "./win98-ui";
import {
  mergeScenarioParams,
  simulationRunId,
  simulationScenarioId,
  type SimulationBatchGroup,
  type SimulationRun,
  type SimulationRunStatus,
  type SimulationScenario,
} from "@/lib/types";

const TERMINAL_STATUSES: SimulationRunStatus[] = ["DONE", "STOPPED", "FAILED"];

export function SimulationScenarioPanel({
  center,
  selectedScenarioId,
  onSelectScenario,
  selectedRunId,
  onSelectRun,
  onOpen3D,
  batches,
  onBatchProgress,
}: {
  center: string;
  selectedScenarioId: number | null;
  onSelectScenario: (id: number) => void;
  selectedRunId: number | null;
  onSelectRun: (id: number) => void;
  onOpen3D: () => void;
  /** 반복 실행 묶음 — 탭이 들고 있다(§17.8, `simulation-tab.tsx` 참고) */
  batches: SimulationBatchGroup[];
  onBatchProgress: (batch: SimulationBatchGroup) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const scenarios = useSimulationScenarios(center);
  const centerParams = useSimulationParams(center);
  const runs = useSimulationRuns(center);
  const progress = useSimulationRunProgress(selectedRunId);
  const handleBatchProgress = (batch: SimulationBatchGroup) => {
    onBatchProgress(batch);
    // 배치의 첫 실행이 만들어지자마자 진행 띠에 올린다 — 순차 실행 나머지는 배경에서
    // 계속되고("N/M 진행" 표시는 아래 `activeBatch`가 대신한다), 사용자가 지켜볼 대상은
    // 항상 방금 시작한 실행이다.
    if (batch.runIds.length === 1) onSelectRun(batch.runIds[0]);
  };
  const createRunBatch = useCreateRunBatch(center, handleBatchProgress);
  const stopRun = useStopRun(center);
  const createDefaults = useCreateDefaultScenarios(center);
  const queryClient = useQueryClient();

  /** 선택된 실행이 속한 묶음(§17.8) — 진행 띠 옆 "묶음 N/M" 표시용 */
  const activeBatch = useMemo(
    () => (selectedRunId === null ? null : (batches.find((b) => b.runIds.includes(selectedRunId)) ?? null)),
    [batches, selectedRunId],
  );

  /** 실행이 끝나면(DONE/STOPPED/FAILED) "최근 실행" 칸과 결과 패널(리드타임·타임라인·
   * 병목)을 같이 갱신한다. `useCreateRun` 의 `onSuccess` 가 캐시에 한 번 써 넣은 뒤로는
   * 이 쿼리가 더 이상 404 로 실패하지 않아(`usingMock` 이 꺼진다) 목록 훅이 표본으로
   * 되돌아가지 못하고, 결과 패널도 폴링이 없어(정본 §16.4 "저장값 조회") 끝나기 전에
   * 한 번 그린 값(낮은 진행률의 표본 폴백)에 멈춰 있는다(2026-09-15 화면 체크에서
   * 둘 다 발견). `syncedRunIdRef` 로 같은 실행에 두 번 이상 반복하지 않는다 — `progress.data`
   * 는 매 렌더 새 객체다. */
  const syncedRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedRunId === null || !progress.data) return;
    if (!TERMINAL_STATUSES.includes(progress.data.status)) return;
    if (syncedRunIdRef.current === selectedRunId) return;
    syncedRunIdRef.current = selectedRunId;
    queryClient.setQueryData(
      queryKeys.simulationRuns({ center }),
      (old: Awaited<ReturnType<typeof simulation.runs>> | undefined) =>
        (old ?? []).map((r) => (simulationRunId(r) === selectedRunId ? { ...r, status: progress.data!.status } : r)),
    );
    queryClient.invalidateQueries({ queryKey: queryKeys.simulationLeadtime(selectedRunId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.simulationTimeline(selectedRunId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.simulationBottleneck(selectedRunId) });
  }, [selectedRunId, progress.data, center, queryClient]);

  /** 시나리오마다 가장 최근 실행(정본 §16.6 "최근 실행 상태" 칸) — 실행 id 는 대체로
   * 생성 순이라 내림차순으로 첫 항목을 쓴다 */
  const latestRunByScenario = useMemo(() => {
    const map = new Map<number, SimulationRun>();
    for (const run of [...(runs.data ?? [])].sort((a, b) => simulationRunId(b) - simulationRunId(a))) {
      if (!map.has(run.scenarioId)) map.set(run.scenarioId, run);
    }
    return map;
  }, [runs.data]);

  /** 센터당 동시 실행 1개(정본 §16.3) — 이미 RUNNING 인 실행이 있으면 "실행" 버튼을 막는다 */
  const anyRunning = (runs.data ?? []).some((r) => r.status === "RUNNING");

  const handleSelectScenario = (scenario: SimulationScenario) => {
    const scenarioId = simulationScenarioId(scenario);
    onSelectScenario(scenarioId);
    const latest = latestRunByScenario.get(scenarioId);
    if (latest) onSelectRun(simulationRunId(latest));
  };

  const handleRun = () => {
    if (selectedScenarioId === null) return;
    setRunDialogOpen(true);
  };

  const handleSubmitRun = (repeat: number) => {
    if (selectedScenarioId === null) return;
    createRunBatch.mutate({ scenarioId: selectedScenarioId, repeat });
  };

  const handleStop = () => {
    if (selectedRunId === null) return;
    stopRun.mutate(selectedRunId);
  };

  const isSelectedRunning = progress.data?.status === "RUNNING";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className={`${w98.small} flex-1`}>시나리오 {scenarios.data?.length ?? "…"}개</span>
        <Btn onClick={() => setCreateOpen(true)} className="h-7 px-3 text-[12px]">
          새 시나리오
        </Btn>
        <Btn
          disabled={selectedScenarioId === null || anyRunning || createRunBatch.isPending}
          onClick={handleRun}
          className="h-7 px-3 text-[12px]"
        >
          {createRunBatch.isPending ? "시작 중…" : "실행"}
        </Btn>
        <Btn disabled={!isSelectedRunning || stopRun.isPending} onClick={handleStop} className="h-7 px-3 text-[12px]">
          {stopRun.isPending ? "정지 중…" : "정지"}
        </Btn>
        <Btn onClick={onOpen3D} className="h-7 px-3 text-[12px]">
          3D 관제에서 보기
        </Btn>
      </div>

      {/* 시나리오가 4개면(데모 시드) 표 높이(122px)가 4행(146px)보다 작아 안쪽 스크롤이
       * 필요하다 — `min-h-0`(flex 자식이 내용만큼 안 늘어나게) 만으로는 의도가 코드에
       * 안 드러나 `max-h` 를 명시했다(11B `slotting-proposal-panel.tsx` 와 같은 패턴,
       * 실측은 이미 `overflow-y:auto` 로 동작 확인 — `s11e-live-6-list-scroll.png`). */}
      <Sunken className={`${w98.scroll} min-h-0 max-h-[150px] flex-1 overflow-y-auto`}>
        <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
            <tr>
              <Th>이름</Th>
              <Th>인원(피커/리빈/포장)</Th>
              <Th>배치</Th>
              <Th>토트</Th>
              <Th>슬로팅</Th>
              <Th>최근 실행</Th>
            </tr>
          </thead>
          <tbody>
            {(scenarios.data ?? []).map((scenario) => {
              const scenarioId = simulationScenarioId(scenario);
              const latest = latestRunByScenario.get(scenarioId);
              const selected = scenarioId === selectedScenarioId;
              // 시나리오 params 는 null 이면 센터 기본값을 상속한다(라이브 대조,
              // `mergeScenarioParams` 참고) — 그대로 찍으면 "null/null/null" 이 보인다.
              const merged = mergeScenarioParams(scenario.params, centerParams.data?.params);
              return (
                <tr
                  key={scenarioId}
                  onClick={() => handleSelectScenario(scenario)}
                  className={`cursor-pointer ${selected ? "bg-[color:var(--surface-variant)]" : ""}`}
                >
                  <Td className="font-bold">{scenario.name}</Td>
                  <Td mono>
                    {merged.pickers}/{merged.rebinners}/{merged.packers}
                  </Td>
                  <Td mono>{merged.batchSize}</Td>
                  <Td mono>{merged.totes}</Td>
                  <Td>{merged.applySlotting ? "적용" : "—"}</Td>
                  <Td className="font-bold">{latest ? RUN_STATUS_LABEL[latest.status] : "실행 없음"}</Td>
                </tr>
              );
            })}
            {(scenarios.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="border-t border-[color:var(--border)] p-3 text-center text-[color:var(--muted-foreground)]">
                  <div className="flex flex-col items-center gap-1.5">
                    <span>시나리오 없음 — 기본 4개(baseline·pickers+5·batch30·slotting)를 만들거나 직접 만드세요</span>
                    <Btn
                      disabled={createDefaults.isPending}
                      onClick={() => createDefaults.mutate()}
                      className="h-7 px-3 text-[12px]"
                    >
                      {createDefaults.isPending ? "만드는 중…" : "기본 시나리오 만들기"}
                    </Btn>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Sunken>

      {selectedRunId !== null ? (
        <ProgressBar progress={progress.data} batch={activeBatch} />
      ) : (
        <p className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          {selectedScenarioId === null ? "시나리오를 고르세요." : '"실행"을 눌러 시작하세요.'}
        </p>
      )}

      {/* 묶음 순차 생성 중 실패(예: 센터당 동시 실행 1개 제약에 다른 호출이 먼저 걸림,
       * 정본 §16.3) — 조용히 멈추면 "N/M"이 왜 안 늘어나는지 알 수 없다. */}
      {createRunBatch.error ? (
        <p role="alert" className={`${w98.small} shrink-0 bg-[#ffdad6] p-1.5 font-bold text-[color:var(--status-error)]`}>
          묶음 실행 중 오류: {createRunBatch.error.message}
        </p>
      ) : null}

      <SimulationScenarioCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        center={center}
        onCreated={(id) => onSelectScenario(id)}
      />

      <SimulationRunDialog
        open={runDialogOpen}
        onOpenChange={setRunDialogOpen}
        scenarioName={scenarios.data?.find((s) => simulationScenarioId(s) === selectedScenarioId)?.name ?? ""}
        isPending={createRunBatch.isPending}
        onSubmit={handleSubmitRun}
      />
    </div>
  );
}

function ProgressBar({
  progress,
  batch,
}: {
  progress: ReturnType<typeof useSimulationRunProgress>["data"];
  /** 선택된 실행이 속한 반복 실행 묶음(§17.8) — 있으면 "묶음 N/M" 배지를 더 보여준다 */
  batch: SimulationBatchGroup | null;
}) {
  if (!progress) {
    return <Sunken className="shrink-0 px-3 py-2"><span className={`${w98.small} text-[color:var(--muted-foreground)]`}>진행 불러오는 중…</span></Sunken>;
  }
  return (
    <Sunken className={`${w98.mono} flex shrink-0 items-center gap-4 px-3 py-2 text-[12px]`}>
      {batch ? <span className="font-bold">묶음 {batch.runIds.length}/{batch.size}</span> : null}
      <span className="font-bold">{RUN_STATUS_LABEL[progress.status]}</span>
      <span>가상 시각 {progress.virtualHours.toFixed(1)}h</span>
      <span>진행 {progress.progressPct.toFixed(1)}%</span>
      <span>유입 {progress.ordersReceived.toLocaleString()}</span>
      <span>출고 {progress.ordersShipped.toLocaleString()}</span>
      <span>유휴 토트 {progress.idleTotes?.toLocaleString() ?? "—"}</span>
      <span>포장대 가동 {progress.busyPackStations}</span>
      <span>{progress.eventsPerSec}건/s</span>
    </Sunken>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">{children}</th>
  );
}

function Td({ children, className = "", mono = false }: { children?: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <td className={`border-t border-[color:var(--border)] p-1.5 ${mono ? w98.mono : ""} ${className}`}>{children}</td>
  );
}
